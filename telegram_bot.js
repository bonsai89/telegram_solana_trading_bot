require('dotenv').config(); // Load environment variables from .env file
const { getFearGreedIndex }= require('./fear_greed_index');
const { originalConsole } = require('./logger');
const cron = require('node-cron');
const { ContractToken_highX, ContractOHLCV_highX } = require('./contract_ohlcv');
const { extractTokenDetails_ProcessOHLCVData_simulation } = require('./process_token_details');
const { fetchOHLCVData_live } = require('./utils');
const { loadTokens_highX, loopThroughAndDeleteExpired_highX, clearbuySignalTokens_highX } = require('./mongo_DB_highx');
const runTradingLogic_highX = require('./trading_logic');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input'); // npm install input
const mongoose = require('mongoose');

const messageQueue = [];
let isProcessingQueue = false;

// Replace with your API ID and API Hash loaded from environment variables
const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.Session);  // new StringSession(''); Fill this later with the value from session.save()

let tokenList_highX = []; // Master list of tokens to process
let errorOccured_highX = false;

// Connect to MongoDB
const mongoURI = 'mongodb://localhost:27017/dipBotDB';
mongoose.connect(mongoURI, {})
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

(async () => {
  console.log('Loading interactive example...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Please enter your number: '),
    password: async () => await input.text('Please enter your password: '),
    phoneCode: async () => await input.text('Please enter the code you received: '),
    onError: (err) => console.log(err),
  });

  console.log('You should now be connected.');

  const chatId = parseInt(process.env.DIP_BOT, 10);

  // Loading tokens highX
  try {
    console.log('HighX Loading tokens from DB...');
    tokenList_highX = await loadTokens_highX();
  } catch (error) {
    console.error('highX Error during token loading:', error);
    errorOccured_highX = true;
  }

  // Event handler for new messages
  client.addEventHandler(async (event) => {
    const message = event.message;
    try {
      if (message.message.includes('NEW SELL ALERT')) {
        messageQueue.push(message);
      }
    } catch (error) {
      console.error('Error extracting token details and processing OHLCV:', error);
      errorOccured_highX = true;
      return null;
    }
  }, new NewMessage({ chats: [chatId] }));

  // Function to send a message to a group
  async function sendMessageToGroup_highX(client, chatId, message) {
    try {
      await client.sendMessage('helenus_trojanbot', { message });
      console.log(`highX Message sent to group ${chatId}: ${message} at ${new Date()}`);
    } catch (error) {
      console.error(`highX Error sending message to group ${chatId}:`, error);
    }
  }

  // Schedule the mongo DB clear Expired contracts every 24 hours
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('highX Deleting expired contracts...');
      await loopThroughAndDeleteExpired_highX();
    } catch (error) {
      console.error('highX Error deleting Expired contracts:', error);
    }
  });

  // HighX logic combined for OHLCV fetching
  const scheduleTask = async () => {
    if (mongoose.connection.readyState === 1 && !errorOccured_highX) {
      try {
        console.log(`highX Checking tokens for OHLCV updates. ${new Date()}`);
        tokenList_highX = await loadTokens_highX();
      } catch (error) {
        console.error('highX Error during token loading:', error);
        errorOccured_highX = true;
      }
      if (tokenList_highX.length > 0) {
        try {
          const results = await fetchOHLCVData_live(tokenList_highX);
          // Process the results
          results.forEach(result => {
            if (result.status === 'Updated') {
              console.log(`Token ${result.tokenName} OHLCV successfully updated.`);
            } else if (result.status === 'No New Entries') {
              console.log(`No new OHLCV entries for token ${result.tokenName}.`);
            } else if (result.status === 'Skipped') {
              console.log(`Token ${result.tokenName} skipped as timediff is less than 120sec.`);
            } else if (result.status === 'Error highX') {
              console.error('highX OHLCV update error:', result.error);
              errorOccured_highX = true;
            }
          });
        } catch (error) {
          console.error('OHLCV, CVWAP, AVWAP update:', error);
          errorOccured_highX = true;
        }
      }
    } else {
      console.error('Error occurred.');
      errorOccured_highX = true;
      if (mongoose.connection.readyState !== 1) {
        console.error('MongoDB not connected.');
      }
    }
  };

  // Set up an interval to run the task every 20 seconds
  setInterval(scheduleTask, 20 * 1000);

  async function processMessageQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    // Updating FEAR GREED INDEX here
    let FGI = 50; //getFearGreedIndex();
    while (messageQueue.length > 0) {
      const message = messageQueue.shift();
      try {
        if (FGI >= 45)
          {
            await extractTokenDetails_ProcessOHLCVData_simulation(message);
          }
        else{
          console.log('Fear in the market!! Skipping...', FGI);
        }
      } catch (error) {
        console.error('Error extracting token details and processing OHLCV:', error);
        errorOccured_highX = true;
        isProcessingQueue = false;
        return;
      }
    }

    isProcessingQueue = false;
  }

  // Trading logic every 50 seconds
  cron.schedule('*/5 * * * * *', async () => {
    await processMessageQueue();

    if (mongoose.connection.readyState === 1 && !errorOccured_highX) {
      try {
        tokenList_highX = await loadTokens_highX();
      } catch (error) {
        console.error('highX Error during token loading for trading:', error);
        errorOccured_highX = true;
      }
      if (tokenList_highX.length > 0) {
        try {
          console.log(`highX trading logic checked...`);
          const results = await runTradingLogic_highX(tokenList_highX);
          results.forEach(result => {
            if (result.status === 'Processed') {
              if (result.action === 'Stop') {
                console.log(`highX 3 hours expired - Token removed from tracking ${result.tokenName}.`);
              }
              if (result.action === 'Stop_pb') {
                console.log(`2hrs after PreBuy expired - Token removed from tracking ${result.tokenName}.`);
              }
              if (result.action === 'Spike') {
                console.log(`highX Volume spike - Token removed from tracking ${result.tokenName}.`);
              }
              if (result.action === 'Cvwap') {
                console.log(`highX Crossed CVwap - Token removed from tracking ${result.tokenName}.`);
              }
              if (result.action === 'Avwap') {
                console.log(`highX Avwap above CVwap - Token removed from tracking ${result.tokenName}.`);
              }
              if (result.action === 'lowVol') {
                console.log(`highX Volume less than 1000$ - Token removed from tracking ${result.tokenName}.`);
              } else if (result.action === 'PreBuy') {
                console.log(`highX PreBuy Condition triggered for ${result.tokenName}.`);
              } else if (result.action === 'Wait') {
                console.log(`highX Checking PreBuy for ${result.tokenName}.`);
              } else if (result.action === 'Sell') {
                console.log(`highX Sell triggered for ${result.tokenName}.`);
              } else if (result.action === 'Check_Sell') {
                console.log(`highX Checking for Sell ${result.tokenName}.`);
              } else if (result.action === 'Buy') {
                console.log(`highX Buy triggered for ${result.tokenName}.`);
              } else if (result.action === 'Inv') {
                console.log(`highX Inv: Price crossed Cvwap before Buy ${result.tokenName}.`);
              } else if (result.action === 'Check_Buy') {
                console.log(`highX Checking for Buy ${result.tokenName}.`);
              }
            } else if (result.status === 'Wait') {
              if (result.action === 'Data_wait') {
                console.log(`highX Waiting for more data ${result.tokenName}.`);
              }
              else if (result.action === 'Continue') {
                console.log(`highX continue checking for trade ${result.tokenName}.`);
              }
              
            } else if (result.status === 'Skipped') {
              console.log(`highX token skipped ${result.tokenName}.`);
            } else if (result.status === 'Error') {
              console.error('highX Trade execution error:', result.error);
              errorOccured_highX = true;
            } else if (result.status === 'Insufficient Data') {
              console.error('highX OHLCV error:', result.error);
              errorOccured_highX = true;
            }
          });
        } catch (error) {
          console.error('highX Trade execution error:', error);
          errorOccured_highX = true;
        }
      }
    } else {
      console.error('highX Error occurred.');
      errorOccured_highX = true;
      if (mongoose.connection.readyState !== 1) {
        console.error('highX MongoDB not connected.');
      }
    }
  });

  // Trading logic every 10 seconds
  cron.schedule('*/2 * * * * *', async () => {
    // highX signal telegram
    try {
      const signalReadyTokens = await ContractToken_highX.find({ BuySignal: true });
      if (signalReadyTokens.length > 0) {
        for (let contract of signalReadyTokens) {
          await clearbuySignalTokens_highX(contract.contractAddress, contract.tokenName);
          await sendMessageToGroup_highX(client, chatId, `highX Trade signal detected for ${contract.contractAddress}`);
        }
      }
    } catch (error) {
      console.error('highX Error sending message to TG group:', error);
    }
    await processMessageQueue();
  });

  // Function to print the current time
  function printCurrentTime() {
    console.log('--------------------Current time:',new Date());
  }
  // Start printing the current time every minute
  console.log('--------------------Current time:',new Date());
  setInterval(printCurrentTime, 30000); // 60000 milliseconds = 1 minute

})();
