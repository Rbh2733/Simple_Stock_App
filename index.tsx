/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';
import { Chart, TooltipItem } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

// DOM Elements
const chatHistoryEl = document.getElementById('chat-history') as HTMLDivElement;
const chatFormEl = document.getElementById('chat-form') as HTMLFormElement;
const promptInputEl = document.getElementById('prompt-input') as HTMLInputElement;
const sendButtonEl = chatFormEl.querySelector('button') as HTMLButtonElement;
const clearButtonEl = document.getElementById('clear-button') as HTMLButtonElement;
const historyPanelEl = document.getElementById('history-panel') as HTMLElement;
const historyListEl = document.getElementById('history-list') as HTMLUListElement;
const favoritesListEl = document.getElementById('favorites-list') as HTMLUListElement;
const historyToggleEl = document.getElementById('history-toggle') as HTMLButtonElement;
const clearHistoryButtonEl = document.getElementById('clear-history-button') as HTMLButtonElement;
const appWrapperEl = document.querySelector('.app-wrapper') as HTMLDivElement;
const tickerTapeEl = document.getElementById('ticker-tape') as HTMLDivElement;
const refreshTickerButtonEl = document.getElementById('refresh-ticker-button') as HTMLButtonElement;
const marketStatusIndicatorEl = document.getElementById('market-status-indicator') as HTMLSpanElement;
const marketStatusTextEl = document.getElementById('market-status-text') as HTMLSpanElement;
const lastUpdatedTimestampEl = document.getElementById('last-updated-timestamp') as HTMLSpanElement;


let ai: GoogleGenAI;
let chat: Chat;
let searchHistory: string[] = [];
let favorites: string[] = [];
const trackedTickers = new Map<string, number>();
let priceUpdateInterval: number | null = null;
let updateQueue: string[] = [];
let isUpdatingPriceLoop = false;

const SYSTEM_INSTRUCTION = `You are an expert financial analyst AI. Your goal is to provide a concise, data-driven stock analysis. Use Google Search to find the latest information. If specific data is unavailable, please state 'N/A' for that metric.

Detect whether the user has provided one or two stock tickers.
- If one ticker is provided, follow the "SINGLE STOCK ANALYSIS" format.
- If two tickers are provided (e.g., 'AAPL vs GOOGL', 'TSLA, MSFT'), follow the "TWO-STOCK COMPARISON" format.

---
### SINGLE STOCK ANALYSIS
Your response for a single stock should start with a level 2 markdown heading formatted like this: "## [Company Name] ([TICKER]) - $[Current Price]".
After the heading, your analysis must include the following sections, using markdown for formatting:

**Company Info:**
Use a markdown table for the following:
| Info | Details |
| --- | --- |
| Company Name | [Full Company Name] |
| Exchange | [e.g., NASDAQ] |
| Sector (GICS) | [e.g., Information Technology] |
| Industry (GICS) | [e.g., Software] |
| Website | [URL] |
| Description | [Brief one-sentence company description] |

**1. Key Metrics:**
Use a markdown table for the following:
| Metric | Value |
| --- | --- |
| P/E Ratio | [number] |
| EPS (TTM) | [number] |
| Market Cap | [number] |
| Dividend Yield | [%] |
| 1-Year Change | [%] |
| 5-Year Change | [%] |
| Revenue Growth (YoY) | [%] |
| Price-to-Book (P/B) Ratio | [number] |
| Return on Equity (ROE) | [%] |
| Beta | [number] |

**2. Technical Analysis:**
Use a markdown table for the following:
| Metric | Value |
| --- | --- |
| Previous Close | [price] |
| Open | [price] |
| Day's Range | [low] - [high] |
| 52-Week Range | [low] - [high] |
| 50-Day Moving Average | [price] |
| 200-Day Moving Average | [price] |
| RSI (14-Day) | [number] |
| Short-term Trend | [e.g., Bullish] |

**3. Pivot Points & Support/Resistance:**
- Calculate and present pivot points using both Standard and Fibonacci methods.
- Use two separate markdown tables.

**Standard Pivot Points:**
| Level | Price |
| --- | --- |
| Resistance 3 (R3) | [price] |
| Resistance 2 (R2) | [price] |
| Resistance 1 (R1) | [price] |
| **Pivot Point (P)** | **[price]** |
| Support 1 (S1) | [price] |
| Support 2 (S2) | [price] |
| Support 3 (S3) | [price] |

**Fibonacci Pivot Points:**
| Level | Price |
| --- | --- |
| Resistance 3 (R3) | [price] |
| Resistance 2 (R2) | [price] |
| Resistance 1 (R1) | [price] |
| **Pivot Point (P)** | **[price]** |
| Support 1 (S1) | [price] |
| Support 2 (S2) | [price] |
| Support 3 (S3) | [price] |

**4. Forecast:**
- Based on the technical analysis and key metrics, provide a brief forecast, a price target, and reasoning for the following periods.
- Use the following markdown list format:
  - **Short Term (1-3 Months):** [Forecast] - **Price Target:** [price]. **Reasoning:** [Brief reasoning, citing specific technical indicators like RSI, moving averages, or support/resistance levels from the analysis.]
  - **Mid Term (4-9 Months):** [Forecast] - **Price Target:** [price]. **Reasoning:** [Brief reasoning, connecting recent news, analyst ratings, and estimate revisions to the price target.]
  - **Long Term (12+ Months):** [Forecast] - **Price Target:** [price]. **Reasoning:** [Brief reasoning, referencing fundamental data like P/E, revenue growth, ROE, and the company's competitive landscape.]

**5. Analyst Price Targets (Since Last Earnings):**
- Use price targets issued by respected firms since the previous quarter's earnings report.
Use a markdown table for the following:
| Target | Price |
| --- | --- |
| High | [price] |
| Average | [price] |
| Low | [price] |

**6. Recent Estimate Revisions (Last 30 Days):**
- Summarize up to 3 of the most notable revisions to price targets or EPS estimates in the last 30 days.
- If no notable revisions are found, please state that.
- Use the following markdown table format:
| Date       | Metric         | Revision              | Analyst/Firm |
| ---------- | -------------- | --------------------- | ------------ |
| [YYYY-MM-DD] | Price Target   | [e.g., $150 -> $175]  | [Firm Name]  |
| [YYYY-MM-DD] | EPS Estimate   | [e.g., $1.20 -> $1.25] | [Firm Name]  |

**7. Recent News Summary (Past 7 Days):**
- Summarize 2-3 recent, significant news headlines from the past 7 days.
- For each headline, provide a concise summary as a markdown link to the source, the sentiment (Positive, Negative, or Neutral), and a brief explanation of its potential impact on the stock price.
- Use the following markdown table format:
| News Summary | Sentiment | Potential Impact on Stock Price |
| --- | --- | --- |
| [Concise news summary](URL) | Positive | [Brief explanation, e.g., "Strong earnings report could boost investor confidence and drive the price up."] |
| [Concise news summary](URL) | Negative | [Brief explanation, e.g., "Regulatory concerns may lead to a sell-off and decrease the price."] |
- After the table, provide an overall sentiment analysis in the following format:
  - **Overall News Sentiment:** [Positive/Negative/Neutral] - **AI Overview:** [A 1-2 sentence summary of the overall sentiment from the news and its likely short-term impact.]

**8. Analyst Ratings Breakdown:**
Use a markdown table for the following, finding the number of analysts for each rating within the last 30 days:
| Rating | Count |
| --- | --- |
| Strong Buy | [number] |
| Buy | [number] |
| Hold | [number] |
| Sell | [number] |
| Strong Sell | [number] |

**9. Insider & Institutional Ownership:**
- Use a markdown table to present the following ownership data.
- If data is not available, state 'N/A'.

| Ownership Type | Percentage | Key Holders (Top 3) |
| --- | --- | --- |
| Insider Ownership | [%] | [Name 1], [Name 2], [Name 3] |
| Institutional Ownership | [%] | [Fund 1], [Fund 2], [Fund 3] |

- **Recent Insider Transactions (Last 3 Months):**
  - Summarize up to 3 of the most significant insider buy or sell transactions.
  - If no transactions are found, please state that.
  - Use the following markdown table format:
  | Date | Insider Name | Transaction Type | Shares | Value |
  | --- | --- | --- | --- | --- |
  | [YYYY-MM-DD] | [Name] | [Buy/Sell] | [Number] | [$ Value] |

**10. Historical Data (Last Month):**
- Below this heading, provide a JSON object containing the **daily** closing price and total **daily** trading volume for the **last 30 days**.
- The JSON must be enclosed in a markdown code block with the language identifier \`json-historical-data\`.
- The JSON structure must be: \`{"historicalData": [{"date": "YYYY-MM-DD", "price": <number>, "volume": <number>}, ...]}\`.
- If price or volume data is not available for a specific day, use the JSON value \`null\` for the corresponding field. Do not use "N/A".
- Provide approximately 20-22 data points, one for each trading day of the past month.

Example:
\`\`\`json-historical-data
{
  "historicalData": [
    { "date": "2024-07-20", "price": 180.00, "volume": 5000000 },
    { "date": "2024-07-21", "price": 182.50, "volume": 6000000 },
    { "date": "2024-08-20", "price": 185.75, "volume": 4750000 }
  ]
}
\`\`\`

**11. Overall Summary & Recommendation:**
- Start with a description of the current state of the company, forward guidance provided by company officials, and how that guidance has been received by investors.
- Then, provide a concise, bulleted summary of the stock's current standing, synthesizing the key findings from the analysis above.
- Conclude with an overall outlook (e.g., Bullish, Neutral, Bearish) based on the balance of fundamental and technical factors.
- Use the following format:
  - **Company Status & Guidance:** [A paragraph describing the current state of the company, forward guidance provided by company officials, and how that guidance has been received by investors.]
  - **Key Findings:**
    - [Bullet point summarizing fundamental strengths/weaknesses, citing specific metrics like P/E, ROE, or growth.]
    - [Bullet point summarizing technical picture, citing indicators like moving averages, RSI, or pivot points.]
    - [Bullet point summarizing analyst sentiment and recent news impact.]
  - **Overall Outlook:** [e.g., Bullish] - **Justification:** [A brief 1-2 sentence justification for the outlook, referencing the key findings.]
  - **Primary Sources Used:**
    - [Source 1 Name](URL)
    - [Source 2 Name](URL)
    - [Source 3 Name](URL)

---
### TWO-STOCK COMPARISON
When two tickers are provided, generate a response with the following structure:

**Comparison: [TICKER 1] vs. [TICKER 2]**

### Company Profiles
First, provide a profile for each company including a brief description, its GICS Sector, and its GICS Industry.

**[Company Name 1] ([TICKER 1])**
- **Description:** [Brief one-sentence company description.]
- **Sector (GICS):** [e.g., Information Technology]
- **Industry (GICS):** [e.g., Software]

**[Company Name 2] ([TICKER 2])**
- **Description:** [Brief one-sentence company description.]
- **Sector (GICS):** [e.g., Consumer Discretionary]
- **Industry (GICS):** [e.g., Internet & Direct Marketing Retail]

### Head-to-Head Comparison
Use a single, comprehensive markdown table to compare the stocks.

| Metric | [TICKER 1] | [TICKER 2] |
| --- | --- | --- |
| **_Fundamentals_** | | |
| P/E Ratio | [number] | [number] |
| EPS (TTM) | [number] | [number] |
| Market Cap | [number] | [number] |
| Dividend Yield | [%] | [%] |
| 1-Year Change | [%] | [%] |
| Revenue Growth (YoY) | [%] | [%] |
| Return on Equity (ROE) | [%] | [%] |
| **_Technicals_** | | |
| Previous Close | [price] | [price] |
| Open | [price] | [price] |
| Day's Range | [low] - [high] | [low] - [high] |
| 52-Week Range | [low] - [high] | [low] - [high] |
| 50-Day Moving Average | [price] | [price] |
| 200-Day Moving Average | [price] | [price] |
| RSI (14-Day) | [number] | [number] |
| **_Forecast_** | | |
| Short-Term Target | [price] | [price] |
| Mid-Term Target | [price] | [price] |
| Long-Term Target | [price] | [price] |
| **_Analyst Consensus_** | | |
| Average Price Target | [price] | [price] |

**Comparative Summary:**
- After the table, provide 2-3 brief bullet points summarizing the key differences and highlighting potential advantages of each stock based on the data.

After the summary, add a separate "Analyst Ratings Breakdown" for each stock. Each breakdown should have a heading with the ticker (e.g., "### Analyst Ratings Breakdown: [TICKER 1]") and a markdown table exactly like the one in Section 8 of the "SINGLE STOCK ANALYSIS".

Your response should prioritize numbers and use brief, clear formatting. Avoid long paragraphs. All information is for educational purposes only. Do not give financial advice.`;

/**
 * Appends a new message to the chat history.
 * @param html The HTML content of the message.
 * @param role The role of the sender ('user' or 'model').
 * @param animate Whether to animate the new message.
 * @returns The newly created message element.
 */
function displayMessage(
  html: string,
  role: 'user' | 'model',
  animate = false
): HTMLElement {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', role);
  if (animate) {
    messageEl.classList.add('new-message');
  }
  messageEl.innerHTML = html;
  chatHistoryEl.appendChild(messageEl);
  // Scroll to the bottom of the chat history
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  return messageEl;
}

/**
 * Finds analyst rating tables in a message and renders them as bar charts.
 * @param messageEl The message element to scan for tables.
 */
function renderAnalystChart(messageEl: HTMLElement) {
  const headings = Array.from(
    messageEl.querySelectorAll('h1, h2, h3, h4, h5, h6')
  ).filter((h) => h.textContent?.trim().includes('Analyst Ratings Breakdown'));

  if (headings.length === 0) return;

  headings.forEach((heading) => {
    const table = heading.nextElementSibling;
    if (!table || table.tagName !== 'TABLE') return;

    const data: { rating: string; count: number }[] = [];
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length === 2) {
        const rating = cells[0].textContent?.trim() || '';
        const count = parseInt(cells[1].textContent?.trim() || '0', 10);
        if (rating && !isNaN(count) && count >= 0) {
          data.push({ rating, count });
        }
      }
    });

    if (data.length === 0) return;

    const totalCount = data.reduce((sum, item) => sum + item.count, 0);
    if (totalCount === 0) {
      const noDataEl = document.createElement('p');
      noDataEl.textContent =
        'No analyst rating counts were found for this stock.';
      table.replaceWith(noDataEl);
      return;
    }

    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.setAttribute('aria-label', 'Bar chart of analyst ratings');

    data.forEach((item) => {
      const percentage = (item.count / totalCount) * 100;
      const barWrapper = document.createElement('div');
      barWrapper.className = 'chart-bar-wrapper';

      const label = document.createElement('div');
      label.className = 'chart-label';
      label.textContent = item.rating;

      const barContainer = document.createElement('div');
      barContainer.className = 'chart-bar-container';
      barContainer.setAttribute('role', 'progressbar');
      barContainer.setAttribute('aria-valuenow', String(item.count));
      barContainer.setAttribute('aria-valuemin', '0');
      barContainer.setAttribute('aria-valuemax', String(totalCount));
      barContainer.setAttribute(
        'aria-label',
        `${item.rating}: ${item.count} ratings`
      );

      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      const ratingClass = item.rating.toLowerCase().replace(/\s+/g, '-');
      bar.classList.add(`rating-${ratingClass}`);
      // Defer setting the width to allow CSS transition to work
      setTimeout(() => {
        bar.style.width = `${percentage}%`;
      }, 10);

      const value = document.createElement('div');
      value.className = 'chart-value';
      value.textContent = String(item.count);

      barContainer.appendChild(bar);
      barWrapper.appendChild(label);
      barWrapper.appendChild(barContainer);
      barWrapper.appendChild(value);

      chartContainer.appendChild(barWrapper);
    });

    table.replaceWith(chartContainer);
  });
}

/**
 * Formats a large number into a readable string (e.g., 1.2M).
 * @param num The number to format.
 * @returns The formatted string.
 */
const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
};

/**
 * Finds historical price and volume data and renders it as a combined interactive chart.
 * @param messageEl The message element to scan for the data.
 */
function renderHistoricalDataChart(messageEl: HTMLElement) {
  const codeBlocks = messageEl.querySelectorAll(
    'code.language-json-historical-data'
  );

  codeBlocks.forEach((block) => {
    const preElement = block.parentElement;
    if (!preElement || preElement.tagName !== 'PRE') return;

    let data: {
      historicalData: { date: string; price: number | null; volume: number | null }[];
    };
    try {
      data = JSON.parse(block.textContent || '');
    } catch (e) {
      console.error('Failed to parse historical data JSON:', e);
      const errorEl = document.createElement('p');
      errorEl.style.color = 'var(--price-down-color)';
      errorEl.textContent =
        'Could not render historical data chart: Invalid data format received.';
      preElement.replaceWith(errorEl);
      return;
    }

    // Filter out any entries with null price or volume, as they cannot be charted.
    const historicalData = (data.historicalData || []).filter(
      (d) => d.date && d.price != null && d.volume != null
    ) as { date: string; price: number; volume: number }[];

    if (historicalData.length < 2) {
      const noDataEl = document.createElement('p');
      noDataEl.textContent =
        'Not enough historical data available to render a chart.';
      preElement.replaceWith(noDataEl);
      return;
    }

    // Sort data just in case it's not chronological
    historicalData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const chartContainer = document.createElement('div');
    chartContainer.className = 'historical-chart-container';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'Interactive line chart of historical stock price and bar chart of trading volume.'
    );
    chartContainer.appendChild(canvas);

    const isDarkMode =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDarkMode ? '#e8eaed' : '#333';
    const gridColor = isDarkMode ? '#5f6368' : '#ddd';
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-color')
      .trim();

    const chartData = {
      labels: historicalData.map((d) => d.date),
      datasets: [
        {
          type: 'line' as const,
          label: 'Price (USD)',
          data: historicalData.map((d) => d.price),
          borderColor: primaryColor,
          backgroundColor: `${primaryColor}33`, // semi-transparent
          yAxisID: 'yPrice',
          tension: 0.1,
          pointRadius: 0,
          pointHitRadius: 10,
        },
        {
          type: 'bar' as const,
          label: 'Volume',
          data: historicalData.map((d) => d.volume),
          backgroundColor: `${primaryColor}80`, // more opaque
          yAxisID: 'yVolume',
        },
      ],
    };

    new Chart(canvas, {
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'MMM d, yyyy',
            },
            ticks: {
              color: textColor,
              maxRotation: 0,
              autoSkip: true,
            },
            grid: {
              color: 'transparent',
            },
          },
          yPrice: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Price (USD)',
              color: textColor,
            },
            ticks: {
              color: textColor,
              callback: (value) => `$${Number(value).toFixed(2)}`,
            },
            grid: {
              color: gridColor,
            },
          },
          yVolume: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Volume',
              color: textColor,
            },
            ticks: {
              color: textColor,
              callback: (value) => formatLargeNumber(Number(value)),
            },
            grid: {
              drawOnChartArea: false, // Only show grid for price axis
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: textColor,
            },
          },
          tooltip: {
            callbacks: {
              label: (context: TooltipItem<'line' | 'bar'>) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  if (context.dataset.yAxisID === 'yPrice') {
                    label += new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(context.parsed.y);
                  } else {
                    label += formatLargeNumber(context.parsed.y);
                  }
                }
                return label;
              },
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: 'x',
            },
            limits: {
              x: {
                min: 'original',
                max: 'original',
              },
            },
          },
        },
      },
    });

    preElement.replaceWith(chartContainer);
  });
}

// --- History & Favorites Functions ---

/**
 * Loads search history from localStorage.
 */
function loadHistory() {
  const storedHistory = localStorage.getItem('stockSearchHistory');
  if (storedHistory) {
    searchHistory = JSON.parse(storedHistory);
  }
}

/**
 * Saves search history to localStorage.
 */
function saveHistory() {
  localStorage.setItem('stockSearchHistory', JSON.stringify(searchHistory));
}

/**
 * Loads favorites from localStorage.
 */
function loadFavorites() {
  const storedFavorites = localStorage.getItem('stockSearchFavorites');
  if (storedFavorites) {
    favorites = JSON.parse(storedFavorites);
  }
}

/**
 * Saves favorites to localStorage.
 */
function saveFavorites() {
  localStorage.setItem('stockSearchFavorites', JSON.stringify(favorites));
}

/**
 * Adds a new query to the search history, avoiding duplicates and favorites.
 * @param query The search query to add.
 */
function addToHistory(query: string) {
  if (favorites.includes(query)) return;

  const existingIndex = searchHistory.indexOf(query);
  if (existingIndex > -1) {
    searchHistory.splice(existingIndex, 1);
  }
  searchHistory.unshift(query);
  if (searchHistory.length > 50) {
    searchHistory.pop();
  }
  saveHistory();
  renderHistory();
}

/**
 * Renders the favorites list in the panel.
 */
function renderFavorites() {
  favoritesListEl.innerHTML = '';
  if (favorites.length === 0) {
    const emptyMessage = document.createElement('li');
    emptyMessage.textContent = 'No saved favorites.';
    emptyMessage.className = 'history-empty-message';
    favoritesListEl.appendChild(emptyMessage);
  } else {
    favorites.forEach((query) => {
      const listItem = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = query;
      button.className = 'query-button';
      button.addEventListener('click', () => handleHistoryClick(query));

      const removeButton = document.createElement('button');
      removeButton.className = 'panel-action-button';
      removeButton.setAttribute('aria-label', `Remove ${query} from favorites`);
      removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;
      removeButton.addEventListener('click', () => handleRemoveFromFavorites(query));

      listItem.appendChild(button);
      listItem.appendChild(removeButton);
      favoritesListEl.appendChild(listItem);
    });
  }
}

/**
 * Renders the search history in the panel.
 */
function renderHistory() {
  historyListEl.innerHTML = '';
  if (searchHistory.length === 0) {
    const emptyMessage = document.createElement('li');
    emptyMessage.textContent = 'No recent searches.';
    emptyMessage.className = 'history-empty-message';
    historyListEl.appendChild(emptyMessage);
  } else {
    searchHistory.forEach((query) => {
      const listItem = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = query;
      button.className = 'query-button';
      button.addEventListener('click', () => handleHistoryClick(query));

      const addButton = document.createElement('button');
      addButton.className = 'panel-action-button';
      addButton.setAttribute('aria-label', `Add ${query} to favorites`);
      addButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
      addButton.addEventListener('click', () => handleAddToFavorites(query));

      listItem.appendChild(button);
      listItem.appendChild(addButton);
      historyListEl.appendChild(listItem);
    });
  }
}

/**
 * Handles clicks on history or favorite items.
 * @param query The query from the clicked item.
 */
function handleHistoryClick(query: string) {
  promptInputEl.value = query;
  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
  chatFormEl.dispatchEvent(submitEvent);
  if (window.innerWidth <= 768) {
    appWrapperEl.classList.remove('history-open');
  }
}

/**
 * Moves a query from history to favorites.
 * @param query The query to move.
 */
function handleAddToFavorites(query: string) {
  if (!favorites.includes(query)) {
    favorites.unshift(query);
    saveFavorites();
    renderFavorites();
  }
  const historyIndex = searchHistory.indexOf(query);
  if (historyIndex > -1) {
    searchHistory.splice(historyIndex, 1);
    saveHistory();
    renderHistory();
  }
}

/**
 * Removes a query from the favorites list.
 * @param query The query to remove.
 */
function handleRemoveFromFavorites(query: string) {
  const favoriteIndex = favorites.indexOf(query);
  if (favoriteIndex > -1) {
    favorites.splice(favoriteIndex, 1);
    saveFavorites();
    renderFavorites();
  }
}

/**
 * Clears all items from the search history.
 */
function handleClearHistory() {
  searchHistory = [];
  saveHistory();
  renderHistory();
}

/**
 * Initializes the GoogleGenAI client and chat session.
 */
function initializeChat() {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });
    displayMessage(
      'What can I look up for you?',
      'model'
    );
  } catch (error) {
    console.error('Failed to initialize chat:', error);
    displayMessage(
      'Error: Could not initialize AI chat. Please check your API key and network connection.',
      'model'
    );
  }
}

// --- WebSocket and Ticker Tape Functions ---

/**
 * Checks if the US stock market is currently open.
 * Considers time, day of the week, and major US holidays.
 * @returns {boolean} True if the market is open, false otherwise.
 */
function isMarketOpen(): boolean {
  const now = new Date();
  // Convert current time to Eastern Time (ET)
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etDate.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = etDate.getHours();
  const minute = etDate.getMinutes();

  // Market is open 9:30 AM to 4:00 PM ET
  const isOpenTime = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
  // Market is open Monday to Friday
  const isOpenDay = day > 0 && day < 6;

  if (!isOpenTime || !isOpenDay) {
    return false;
  }
  
  // Check for major US holidays (simplified list)
  const year = etDate.getFullYear();
  const month = etDate.getMonth() + 1; // 1-12
  const date = etDate.getDate();

  const holidays = [
    `1-1`, // New Year's Day
    `1-${new Date(year, 0, 15).getDate()}`, // MLK Day (3rd Mon in Jan) - simplified
    `2-${new Date(year, 1, 19).getDate()}`, // Presidents' Day (3rd Mon in Feb) - simplified
    `5-${new Date(year, 4, 27).getDate()}`, // Memorial Day (Last Mon in May) - simplified
    `6-19`, // Juneteenth
    `7-4`, // Independence Day
    `9-${new Date(year, 8, 2).getDate()}`, // Labor Day (1st Mon in Sep) - simplified
    `11-${new Date(year, 10, 28).getDate()}`, // Thanksgiving (4th Thu in Nov) - simplified
    `12-25` // Christmas Day
  ];
  const todayHoliday = `${month}-${date}`;
  if (holidays.includes(todayHoliday)) {
    return false;
  }

  // Could add more complex holiday logic (e.g., Good Friday) if needed.
  return true;
}

/**
 * Updates the market status UI elements.
 */
function updateMarketStatusUI() {
  const marketOpen = isMarketOpen();
  if (marketOpen) {
    marketStatusTextEl.textContent = 'Market Open';
    marketStatusIndicatorEl.style.backgroundColor = 'var(--price-up-color)';
  } else {
    marketStatusTextEl.textContent = 'Market Closed';
    marketStatusIndicatorEl.style.backgroundColor = 'var(--price-down-color)';
  }
}

/**
 * Fetches the latest stock price for a given ticker using the AI model.
 * @param ticker The stock ticker symbol.
 * @returns The price as a number, or null if it fails.
 */
async function fetchRealPrice(ticker: string): Promise<number | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `What is the most recent stock price for ${ticker}? Please provide only the numerical value, for example: 123.45`,
      config: {
        tools: [{ googleSearch: {} }],
        // Disable thinking for a faster, more direct response for this simple query.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    // The response might contain '$' or other text. Clean it up.
    const priceText = response.text.trim().replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText);
    if (isNaN(price) || price === 0) {
      console.warn(
        `Could not parse a valid price for ${ticker} from response: "${response.text}"`
      );
      return null;
    }
    return price;
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error);
    return null;
  }
}

/**
 * The main loop for updating ticker prices one by one when the market is open.
 * This spaces out API calls to avoid rate limiting.
 */
async function priceUpdateLoop() {
  if (isUpdatingPriceLoop || !isMarketOpen()) {
    return;
  }

  // If the queue is empty, repopulate it with all tracked tickers for the next cycle.
  if (updateQueue.length === 0 && trackedTickers.size > 0) {
    updateQueue = Array.from(trackedTickers.keys());
  }

  if (updateQueue.length === 0) {
    return; // Nothing to update
  }

  isUpdatingPriceLoop = true;
  const ticker = updateQueue.shift();

  if (ticker) {
    const price = await fetchRealPrice(ticker);
    if (price !== null) {
      trackedTickers.set(ticker, price);
      // Dispatch an event to update the UI, mimicking a WebSocket message
      const event = new MessageEvent('message', {
        data: JSON.stringify([{ ticker, price }]),
      });
      window.dispatchEvent(event);
    }
  }

  isUpdatingPriceLoop = false;
  // Schedule the next update. The delay creates a polling effect.
  setTimeout(priceUpdateLoop, 3000); // 3-second delay between each ticker update
}

/**
 * Fetches the latest closing price for all tracked tickers.
 * Used when the market is closed or for a manual refresh.
 */
async function fetchAllTrackedPrices() {
  const tickers = Array.from(trackedTickers.keys());
  for (const ticker of tickers) {
    const price = await fetchRealPrice(ticker);
    if (price !== null) {
      trackedTickers.set(ticker, price);
      const event = new MessageEvent('message', {
        data: JSON.stringify([{ ticker, price }]),
      });
      window.dispatchEvent(event);
    }
    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Manages the automatic ticker price updates based on market hours.
 */
function manageTickerUpdates() {
  updateMarketStatusUI();

  if (isMarketOpen()) {
    // If market is open, start the continuous update loop
    priceUpdateLoop();
  } else {
    // If market is closed, just fetch the latest closing price once for any existing tickers
    if (trackedTickers.size > 0) {
      fetchAllTrackedPrices();
    }
  }
}

/**
 * Handles incoming WebSocket messages and updates the ticker tape.
 * @param event The WebSocket message event.
 */
function handleWebSocketMessage(event: MessageEvent) {
  // Only process string data. Other 'message' events may have non-string data.
  if (typeof event.data !== 'string') {
    return;
  }

  try {
    const updates: any = JSON.parse(event.data);
    
    // Validate the structure of the parsed data to ensure it's our ticker update.
    if (!Array.isArray(updates) || (updates.length > 0 && typeof updates[0]?.ticker === 'undefined')) {
      return; // Not the data format we expect, so we ignore it.
    }

    (updates as { ticker: string; price: number }[]).forEach(update => {
      const tickerItem = document.getElementById(`ticker-${update.ticker}`);
      if (tickerItem) {
        const priceEl = tickerItem.querySelector('.ticker-price') as HTMLSpanElement;
        const oldPrice = parseFloat(priceEl.textContent?.substring(1) || '0');
        const newPrice = update.price;

        priceEl.textContent = `$${newPrice.toFixed(2)}`;

        // Add visual feedback for price change
        let priceClass = '';
        if (!isNaN(oldPrice) && oldPrice > 0) {
          if (newPrice > oldPrice) {
            priceClass = 'price-up';
          } else if (newPrice < oldPrice) {
            priceClass = 'price-down';
          }
        }

        if (priceClass) {
          tickerItem.classList.add(priceClass);
          setTimeout(() => tickerItem.classList.remove(priceClass), 750);
        }
      }
    });

    const now = new Date();
    lastUpdatedTimestampEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;

  } catch (e) {
    // Silently ignore parsing errors, as they are likely from other messages
    // not intended for this handler.
  }
}

/**
 * Adds a ticker to the real-time tracking tape.
 * @param ticker The stock ticker symbol to add.
 */
async function addTickerToTape(ticker: string) {
  if (trackedTickers.has(ticker)) return;

  // Add to map with a placeholder to prevent re-adding during async fetch
  trackedTickers.set(ticker, -1);

  const tickerItem = document.createElement('div');
  tickerItem.className = 'ticker-item';
  tickerItem.id = `ticker-${ticker}`;
  tickerItem.innerHTML = `
    <span class="ticker-symbol">${ticker}</span>
    <span class="ticker-price">Loading...</span>
  `;

  if (tickerTapeEl.firstChild) {
    tickerTapeEl.insertBefore(tickerItem, tickerTapeEl.firstChild);
  } else {
    tickerTapeEl.appendChild(tickerItem);
  }

  const price = await fetchRealPrice(ticker);

  if (price !== null) {
    trackedTickers.set(ticker, price);
    const event = new MessageEvent('message', {
      data: JSON.stringify([{ ticker, price }]),
    });
    window.dispatchEvent(event);

    // If the market is open, add the new ticker to the update queue
    if (isMarketOpen() && !updateQueue.includes(ticker)) {
      updateQueue.push(ticker);
      // Ensure the loop is running
      priceUpdateLoop();
    }
  } else {
    // If fetching fails, show an error and remove it from tracking
    const priceEl = tickerItem.querySelector('.ticker-price');
    if (priceEl) {
      priceEl.textContent = 'N/A';
    }
    trackedTickers.delete(ticker);
  }
}

/**
 * Extracts and tracks tickers from a user's prompt.
 * @param prompt The user's input string.
 */
function trackTickersFromPrompt(prompt: string) {
  // Regex to find potential stock tickers (1-5 uppercase letters)
  const tickerRegex = /\b[A-Z]{1,5}\b/g;
  const tickers = prompt.match(tickerRegex);
  if (tickers) {
    tickers.forEach(ticker => addTickerToTape(ticker));
  }
}

/**
 * Handles the chat form submission.
 * @param e The form submission event.
 */
async function handleFormSubmit(e: Event) {
  e.preventDefault();
  if (!chat || !promptInputEl.value.trim()) return;

  const prompt = promptInputEl.value.trim().toUpperCase();
  promptInputEl.value = '';

  addToHistory(prompt);
  trackTickersFromPrompt(prompt);

  const userMessageHtml = await marked.parse(prompt);
  displayMessage(userMessageHtml, 'user', true);

  sendButtonEl.disabled = true;
  promptInputEl.disabled = true;

  const modelMessageEl = displayMessage('Analyzing...', 'model', true);
  let fullResponse = '';

  try {
    const responseStream = await chat.sendMessageStream({ message: prompt });

    for await (const chunk of responseStream) {
      fullResponse += chunk.text;
      const parsedHtml = await marked.parse(fullResponse);
      modelMessageEl.innerHTML = parsedHtml;
      chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    modelMessageEl.innerHTML = 'Sorry, something went wrong. Please try again.';
  } finally {
    renderAnalystChart(modelMessageEl);
    renderHistoricalDataChart(modelMessageEl);
    sendButtonEl.disabled = false;
    promptInputEl.disabled = false;
    promptInputEl.focus();
  }
}

/**
 * Clears the chat history and starts a new chat session.
 */
function clearChat() {
  if (!ai) return;
  chatHistoryEl.innerHTML = '';
  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
    },
  });
  displayMessage(
    'Chat history cleared. Please enter a new stock ticker.',
    'model'
  );
}

/**
 * Main function to set up the application.
 */
function main() {
  let isDesktop = window.innerWidth > 768;

  const setPanelStateForSize = () => {
    // On desktop, default to open. On mobile, default to closed.
    if (window.innerWidth > 768) {
      appWrapperEl.classList.add('history-open');
    } else {
      appWrapperEl.classList.remove('history-open');
    }
    isDesktop = window.innerWidth > 768;
  };

  // Debounced resize handler
  let resizeTimeout: number;
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      const newIsDesktop = window.innerWidth > 768;
      // Only run state logic if we cross the breakpoint
      if (newIsDesktop !== isDesktop) {
        setPanelStateForSize();
      }
    }, 100);
  };

  setPanelStateForSize();
  window.addEventListener('resize', handleResize);

  initializeChat();
  loadHistory();
  loadFavorites();
  renderHistory();
  renderFavorites();

  // Initialize WebSocket connection and event listener
  window.addEventListener('message', handleWebSocketMessage);
  
  // Set up market status checker to run periodically
  manageTickerUpdates();
  setInterval(manageTickerUpdates, 60000); // Check every minute
  
  chatFormEl.addEventListener('submit', handleFormSubmit);
  clearButtonEl.addEventListener('click', clearChat);
  refreshTickerButtonEl.addEventListener('click', fetchAllTrackedPrices);
  historyToggleEl.addEventListener('click', () => {
    appWrapperEl.classList.toggle('history-open');
  });
  clearHistoryButtonEl.addEventListener('click', handleClearHistory);
}

main();
