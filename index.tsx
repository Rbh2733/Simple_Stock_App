/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

// DOM Elements
const chatHistoryEl = document.getElementById('chat-history') as HTMLDivElement;
const chatFormEl = document.getElementById('chat-form') as HTMLFormElement;
const promptInputEl = document.getElementById('prompt-input') as HTMLInputElement;
const sendButtonEl = chatFormEl.querySelector('button') as HTMLButtonElement;
const clearButtonEl = document.getElementById('clear-button') as HTMLButtonElement;

let ai: GoogleGenAI;
let chat: Chat;

const SYSTEM_INSTRUCTION = `You are an expert financial analyst AI. Your goal is to provide a concise, data-driven stock analysis. Use Google Search to find the latest information. If specific data is unavailable, please state 'N/A' for that metric.

Detect whether the user has provided one or two stock tickers.
- If one ticker is provided, follow the "SINGLE STOCK ANALYSIS" format.
- If two tickers are provided (e.g., 'AAPL vs GOOGL', 'TSLA, MSFT'), follow the "TWO-STOCK COMPARISON" format.

---
### SINGLE STOCK ANALYSIS
Your analysis must include the following sections, using markdown for formatting:

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
  - **Long Term (12+ Months):** [Forecast] - **Price Target:** [price]. **Reasoning:** [Brief reasoning, referencing fundamental data like P/E ratio, revenue growth, ROE, and the company's competitive landscape.]

**5. Analyst Price Targets (Last 3 Months):**
- Use price targets issued by respected firms within the last 3 months.
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
Use a markdown table for the following, finding the number of analysts for each rating:
| Rating | Count |
| --- | --- |
| Strong Buy | [number] |
| Buy | [number] |
| Hold | [number] |
| Sell | [number] |
| Strong Sell | [number] |

---
### TWO-STOCK COMPARISON
When two tickers are provided, generate a response with the following structure:

**Comparison: [TICKER 1] vs. [TICKER 2]**

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
      'Welcome to the Stock Forecaster AI. Enter a stock ticker to get a detailed analysis.',
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

/**
 * Handles the chat form submission.
 * @param e The form submission event.
 */
async function handleFormSubmit(e: Event) {
  e.preventDefault();
  if (!chat || !promptInputEl.value.trim()) return;

  const prompt = promptInputEl.value.trim();
  promptInputEl.value = '';

  // Display user's message
  const userMessageHtml = await marked.parse(prompt);
  displayMessage(userMessageHtml, 'user', true);

  // Disable form while processing
  sendButtonEl.disabled = true;
  promptInputEl.disabled = true;

  // Create a placeholder for the model's response
  const modelMessageEl = displayMessage('Analyzing...', 'model', true);
  let fullResponse = '';

  try {
    const responseStream = await chat.sendMessageStream({ message: prompt });

    for await (const chunk of responseStream) {
      fullResponse += chunk.text;
      const parsedHtml = await marked.parse(fullResponse);
      modelMessageEl.innerHTML = parsedHtml;
      renderAnalystChart(modelMessageEl);
      chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    modelMessageEl.innerHTML = 'Sorry, something went wrong. Please try again.';
  } finally {
    renderAnalystChart(modelMessageEl);
    // Re-enable form
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
  initializeChat();
  chatFormEl.addEventListener('submit', handleFormSubmit);
  clearButtonEl.addEventListener('click', clearChat);
}

main();