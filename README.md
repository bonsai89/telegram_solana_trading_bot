# Solana Trading Bot Documentation

## Overview

This project is a Solana trading bot designed to automate trading activities on the Solana blockchain. The bot integrates with the Telegram messaging platform to receive trade signals and execute trades using the Trojan Solana Bot (https://trojan.com/). It leverages real-time market data, such as OHLCV (Open, High, Low, Close, Volume), and applies custom trading logic to identify and act on trading opportunities. The bot stores data in a MongoDB database and uses environment variables for secure configuration.

## File: `telegram_bot.js`

### Purpose

The `telegram_bot.js` file serves as the primary interface between the trading bot and the Telegram messaging platform. It handles the following core functionalities:

- **Initialization**: Establishes a connection to Telegram using the `telegram` library and authenticates using API credentials stored in environment variables.
- **MongoDB Integration**: Connects to a local MongoDB instance to store and retrieve token data for trading.
- **Message Handling**: Listens for specific Telegram messages (e.g., "NEW SELL ALERT") from a designated chat and queues them for processing.
- **Trade Signal Execution**: Processes queued messages to extract token details and triggers trading logic, interfacing with the Trojan Solana Bot for trade execution.
- **Scheduled Tasks**: Runs periodic tasks to update OHLCV data, check trading conditions, and clear expired contracts using the `node-cron` library.
- **Error Handling**: Implements robust error handling to log issues and prevent system crashes during operation.

### Dependencies

The file relies on the following Node.js packages, which must be installed prior to running the bot:

- `dotenv`: Loads environment variables from a `.env` file for secure configuration.
- `telegram`: Provides the Telegram client for interacting with the Telegram API.
- `mongoose`: Facilitates MongoDB database connectivity and operations.
- `node-cron`: Schedules recurring tasks, such as data updates and contract cleanup.
- `input`: Enables interactive input for Telegram authentication (e.g., phone number, password, and verification code).

Additionally, the file imports custom modules from the project:

- `./fear_greed_index`: Retrieves the Fear and Greed Index to influence trading decisions.
- `./logger`: Provides a custom logging utility (`originalConsole`).
- `./contract_ohlcv`: Defines MongoDB schemas and methods for token and OHLCV data (`ContractToken_highX`, `ContractOHLCV_highX`).
- `./process_token_details`: Processes token details and OHLCV data for simulation (`extractTokenDetails_ProcessOHLCVData_simulation`).
- `./utils`: Fetches live OHLCV data (`fetchOHLCVData_live`).
- `./mongo_DB_highx`: Manages token data in MongoDB (`loadTokens_highX`, `loopThroughAndDeleteExpired_highX`, `clearbuySignalTokens_highX`).
- `./trading_logic`: Executes the core trading logic (`runTradingLogic_highX`).

### Environment Variables

The following environment variables must be defined in a `.env` file in the project root:

- `API_ID`: The Telegram API ID (integer) for authenticating the bot.
- `API_HASH`: The Telegram API hash (string) for authenticating the bot.
- `Session`: The Telegram session string for persistent authentication.
- `DIP_BOT`: The Telegram chat ID (integer) where trade signals are received and sent.

Example `.env` file:

```plaintext
API_ID=123456
API_HASH=your_api_hash
Session=your_session_string
DIP_BOT=789012
```

### Key Functionalities

#### 1. **Telegram Client Initialization**

The bot initializes a `TelegramClient` instance using the `telegram` library. It authenticates using the provided `API_ID`, `API_HASH`, and `Session` string. If no session exists, the bot prompts the user to input their phone number, password, and verification code interactively. The client is configured to retry connections up to five times in case of network issues.

#### 2. **MongoDB Connection**

The bot connects to a local MongoDB instance at `mongodb://localhost:27017/dipBotDB` using Mongoose. The connection is established when the script starts, and any errors are logged to the console.

#### 3. **Message Queue Processing**

The bot listens for messages in the Telegram chat specified by `DIP_BOT`. Messages containing "NEW SELL ALERT" are added to a `messageQueue` array for asynchronous processing. The `processMessageQueue` function processes these messages one at a time, ensuring no concurrent processing issues. It checks the Fear and Greed Index (currently hardcoded to 50 due to commented code) and skips processing if the index is below 45, indicating market fear.

Each message is passed to `extractTokenDetails_ProcessOHLCVData_simulation` for token detail extraction and OHLCV processing, which prepares data for trading logic.

#### 4. **Trade Signal Detection and Execution**

The bot monitors the MongoDB collection `ContractToken_highX` for tokens with a `BuySignal` set to `true`. When such tokens are found, the bot:

- Clears the buy signal using `clearbuySignalTokens_highX`.
- Sends a trade signal to the Telegram group via the Trojan Solana Bot (`helenus_trojanbot`) with the message format: `highX Trade signal detected for <contractAddress>`.

Trade execution is handled externally by the Trojan Solana Bot, which receives these signals and performs the actual trades.

#### 5. **Scheduled Tasks**

The bot uses `node-cron` to schedule recurring tasks:

- **Every 24 Hours**: Deletes expired contracts from MongoDB using `loopThroughAndDeleteExpired_highX` (runs at midnight).
- **Every 20 Seconds**: Fetches live OHLCV data for tokens in `tokenList_highX` using `fetchOHLCVData_live`. The results are logged, indicating whether data was updated, skipped, or encountered errors.
- **Every 5 Seconds**: Runs the core trading logic (`runTradingLogic_highX`) on the `tokenList_highX` tokens. The logic evaluates conditions such as volume spikes, price crossing VWAP, or pre-buy signals, and logs actions like "Buy," "Sell," or "Stop."
- **Every 2 Seconds**: Checks for buy signals and sends trade notifications to the Telegram group, as described above.

#### 6. **Trading Logic**

The trading logic, executed every 5 seconds, processes tokens in `tokenList_highX` and evaluates various conditions, including:

- **Stop Conditions**: Removes tokens from tracking after 3 hours, 2 hours post-pre-buy, or due to volume spikes, VWAP crosses, or low volume (< $1000).
- **PreBuy and Buy Signals**: Identifies potential buy opportunities and triggers buy actions.
- **Sell Signals**: Initiates sell actions when conditions are met.
- **Data Wait**: Skips tokens with insufficient data for trading decisions.

Results are logged with detailed statuses (e.g., "Processed," "Skipped," "Error") to aid debugging and monitoring.

#### 7. **OHLCV Data Updates**

The bot fetches OHLCV data every 20 seconds for tokens in `tokenList_highX`. It skips updates if the time difference since the last update is less than 120 seconds to avoid redundant requests. Errors during OHLCV updates set the `errorOccured_highX` flag, pausing further processing until resolved.

#### 8. **Error Handling**

The bot includes comprehensive error handling:

- MongoDB connection errors are logged and prevent trading logic execution.
- Telegram message sending errors are caught and logged without interrupting the bot.
- OHLCV fetch errors set the `errorOccured_highX` flag and are logged.
- Trading logic errors are caught per token, ensuring one token’s failure does not halt the entire process.

#### 9. **Logging**

The bot logs key events, such as MongoDB connection status, OHLCV updates, trading actions, and errors, to the console. A timestamp is printed every 30 seconds to provide a reference for log entries.

### Usage

To run `telegram_bot.js`:

1. **Install Dependencies**:

   ```bash
   npm install dotenv telegram mongoose node-cron input
   ```

2. **Set Up Environment Variables**:

   Create a `.env` file with the required variables (`API_ID`, `API_HASH`, `Session`, `DIP_BOT`).

3. **Start MongoDB**:

   Ensure a MongoDB instance is running locally on port 27017 with a database named `dipBotDB`.

4. **Run the Script**:

   ```bash
   node telegram_bot.js
   ```

   The bot will prompt for Telegram authentication details if no session exists, then start processing messages and executing trades.

### Notes

- The Fear and Greed Index functionality is currently disabled (hardcoded to 50). To enable it, uncomment the `getFearGreedIndex` call in the `processMessageQueue` function and ensure the `./fear_greed_index` module is implemented.
- The bot assumes the Trojan Solana Bot is configured to receive messages at the Telegram handle `helenus_trojanbot`. Update the handle in `sendMessageToGroup_highX` if necessary.
- The `tokenList_highX` array is populated from MongoDB using `loadTokens_highX`. Ensure the database is seeded with valid token data before running the bot.
- The bot requires a stable internet connection for Telegram and OHLCV data fetching.

### Future Improvements

- Implement retry logic for failed OHLCV fetches to improve robustness.
- Add configuration options for cron schedules and thresholds (e.g., Fear and Greed Index cutoff).
- Enhance logging to write to a file for persistent records.
- Introduce unit tests for critical functions like message processing and trading logic.

## Disclaimer

This Solana trading bot was developed for personal use and is shared as-is for educational and informational purposes. The bot has demonstrated the ability to identify high-potential tokens early, with some trades, such as Chillguy, yielding returns up to 1000x. It primarily monitors signals from the Paragon project (https://paragondefi.com/) and executes trades based on specific, predefined criteria. However, trading cryptocurrencies involves significant financial risk, and past performance is not indicative of future results. Users are strongly advised to exercise discretion and conduct thorough research before deploying this bot or its strategies in live trading environments.

The bot is designed to be adaptable, allowing integration with other signal channels and custom trading logic. If you are interested in hiring me to build tailored trading logic for your needs, please contact me via Telegram at https://t.me/bonsai_habibi
