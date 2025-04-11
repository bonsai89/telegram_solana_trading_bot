const { SimulatedTime, simulatedClock } = require('./timeSimulation');
require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');
const { DateTime } = require('luxon');

// Configuration for TelegramClient
const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.Session_test); 
const chatId = parseInt(process.env.TEST_DIP_BOT, 10);

// Initialize the Telegram client1
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function parseDateString(dateString) {
    let parts = dateString.split(',');
    let dated = parts[1].trim();
    const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/;
    const match = dated.match(regex);
  
    if (!match) {
        throw new Error('Date string is not in the expected format');
    }
  
    const [_, year, month, day, hour, minute, second, timezone] = match;
    const monthIndex = parseInt(month, 10) - 1;
    const date = new Date(year, monthIndex, day, hour, minute, second);
  
    return date;
}

function parseDateString_orig(dateString) {
    const regex = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([A-Z]{3})$/;
    const match = dateString.match(regex);

    if (!match) {
        throw new Error('Date string is not in the expected format');
    }

    const [_, day, month, year, hour, minute, second, timezone] = match;
    const monthIndex = parseInt(month, 10) - 1; // Month is 0-based in JavaScript Date
    const date = new Date(year, monthIndex, day, hour, minute, second);

    return date;
}

// Function to prompt for input
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Main function for trade simulation
async function runTradeSimulation(csvFilePath) {
    console.log('Loading interactive example...');
    const client1 = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client1.start({
        phoneNumber: async () => await askQuestion('Please enter your phone number: '),
        password: async () => await askQuestion('Please enter your password: '),
        phoneCode: async () => await askQuestion('Please enter the code you received: '),
        onError: (err) => console.log(err),
    });

    console.log('Connected to Telegram.');

    

    // Function to send a message
    async function sendTelegramMessage(message) {
        try {
            await client1.sendMessage(-4274390929, { message });
            console.log('Message sent:', message);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    // Store trade events
    let tradeEvents = [];

    // Process the CSV file
    async function processCSV(filePath) {
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Parse date and add to trade events
                    const dateWin = parseDateString(row.BUY_Sig);
                    tradeEvents.push({
                        dateWin,
                        message: `NEW SELL ALERT - $${row.Token}\n\nAddress: ${row.CA}\nCurrent Market Cap: ${row.mkt_cp_buy}\nGain/Loss: ${row.cur_profit}\nVWAP Price Dist: ${row.VWAP_Price_dist}\nDate: ${row.date_win}`
                    });
                })
                .on('end', () => {
                    resolve();
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Wait for the next trade event
    async function waitForNextTradeEvent() {
        while (tradeEvents.length > 0) {
            const now = DateTime.now().toJSDate();

            const nextEvent = tradeEvents[106]; // <<<<<<<<<<<<<<<<<<<<<<<<<<<<-----------------------enter the trade id to process simulate

            const fourMinutesBeforeEvent = new Date(nextEvent.dateWin.getTime()- 3 * 60 * 1000); 
            if (now >= fourMinutesBeforeEvent) { // sends trade signal 2minutes before BUY
                await sendTelegramMessage(nextEvent.message);
                tradeEvents.shift(); // Remove the processed event
                break;
            } else {
                // Sleep until the next event date_win
                const timeUntilNextEvent = fourMinutesBeforeEvent - now;
                simulatedClock.simulateTimePassing(timeUntilNextEvent);
                //await new Promise(resolve => setTimeout(resolve, Math.max(timeUntilNextEvent, 1000))); // Sleep for at least 1 second
            }
        }
    }

    // Process your CSV file and start checking
    await processCSV(csvFilePath);
    console.log('Done processing CSV.');
    await waitForNextTradeEvent();

    rl.close();
}

// Export the runTradeSimulation function
module.exports = { runTradeSimulation };
