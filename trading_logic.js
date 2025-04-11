require('dotenv').config();
const { originalConsole } = require('./logger');
const {ContractToken_highX, ContractOHLCV_highX} = require('./contract_ohlcv')
const {deleteOldTokens_highX, updatePreBuy_DB_highX, updateBuy_DB_highX, updateBuySignal_DB_highX, updateSell1_DB_highX, updateSell2_DB_highX, updateSell3_DB_highX, updateSell4_DB_highX} = require('./mongo_DB_highx')

function convertToUnixTimestamp(dateString) {
    // Split the date string into its components
    const [datePart, timePart] = dateString.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hours, minutes, seconds] = timePart.split(':');
    
    // Create a new Date object with the parsed components
    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    
    // Adjust for JST (+09:00)
    const jstOffsetInMinutes = 9 * 60;
    const unixTimestamp = Math.floor(date.getTime() / 1000) - jstOffsetInMinutes * 60;
  
    return unixTimestamp;
  }

async function checkPreBuyLogic(pp1, pp2, previousData, currentData, tokenName, signalDate, contractAddress, PreBuy) {
    try{
        const {v: pp1Volume} = pp1;
        const {v: pp2Volume} = pp2;
        const { l: previousLow, v: previousVolume , o: previousOpen, c: previousClose} = previousData;
        const { Avwap: currentAvwap, Cvwap: currentCvwap, unixTime: currentTime, h: currentHigh, l: currentLow, o: currentOpen, c: currentClose, v: currentVolume} = currentData;

        const three_hours_in_seconds = 3 * 60 * 60;
        const signal_epoch_time = Math.floor(new Date(signalDate).getTime() / 1000);
        const elapsed_time = currentTime - signal_epoch_time;

        if (elapsed_time > three_hours_in_seconds && !PreBuy) {
            console.log(`highX 3 hours expired for ${tokenName} at ${new Date(currentTime * 1000)}`);
            await deleteOldTokens_highX(contractAddress, tokenName);
            return { action: 'Stop', status: 'Processed' };
        }

        // Condition 1: Green candle and Anchored VWAP of current candle < low or AVWAP < High
        const condition1 = parseFloat(currentOpen) < parseFloat(currentClose) && parseFloat(previousOpen) < parseFloat(previousClose) && (
            parseFloat(currentAvwap) < parseFloat(currentLow) || parseFloat(currentAvwap) < parseFloat(currentClose));

        // Condition 2: Percentage price difference between high of current candle and low of previous candle > 30%
        const price_diff_percentage = ((parseFloat(currentHigh) - parseFloat(previousLow)) / parseFloat(previousLow)) * 100;
        const condition2 = price_diff_percentage > 30;

        // Condition 3: 1min Volume of current candle is 2x more than 1min volume of previous candle and volume > 10000
        const condition3 = (currentVolume > 2 * previousVolume) && (previousVolume > 10000);

        // Condition 4: Current candle’s high < CumulativeVWAP of current candle
        const condition4 = parseFloat(currentHigh) < parseFloat(currentCvwap);

        if(currentVolume < 1000 && previousVolume < 1000 && pp1Volume < 1000 & pp2Volume < 1000){ //volume of 4 consec candles less than 1000$
            console.log(`highX 2 consecutive volumes lower than 1000$ ${tokenName} at ${new Date(currentTime * 1000)}`);
            await deleteOldTokens_highX(contractAddress, tokenName);
            return { action: 'lowVol', status: 'Processed' };
        }

        if(parseFloat(currentClose) > parseFloat(currentCvwap)){  // Or currentHigh ??
            console.log(`highX Price above Cvwap for ${tokenName} at ${new Date(currentTime * 1000)}`);
            await deleteOldTokens_highX(contractAddress, tokenName);
            return { action: 'Cvwap', status: 'Processed' };
        }
        
        if (condition1 && condition2 && condition3 && condition4) {
            //console.log(`PreBuy condition triggered for ${tokenName} at ${new Date(currentTime * 1000)}`);
            await updatePreBuy_DB_highX(contractAddress, tokenName, currentTime);
            return { action: 'PreBuy', status: 'Processed' };
        } else {
            return { action: 'Wait', status: 'Processed' };
        }
    } catch(error){
        return { error, action: 'Stop', status: 'Error' };
    }
}

async function checkSellSignal(currentData, contractAddress, currentPrice_now, buy_Price, tokenName, Sell1, Sell2, Sell3, Sell4) {
    // Initialize variables
    let currentPrice = parseFloat(currentPrice_now);
    let buyPrice = parseFloat(buy_Price);
    // Extract necessary data
    const cumulativeVWAP = parseFloat(currentData.Cvwap);
    try{
        // Sell based on entry
        if (currentPrice > 4 * buyPrice && !Sell1) { // 300%
            profitPercentage = ((currentPrice - buyPrice) / buyPrice) * 100;
            console.log(`highX SELL 1 triggered for ${tokenName} at ${new Date(currentData.unixTime * 1000)}. Profit percentage: ${profitPercentage.toFixed(2)}%`);
            await updateSell1_DB_highX(contractAddress, tokenName);
            return { action: 'SELL 1', status: 'Processed' };
        } else if (currentPrice > 6 * buyPrice && Sell1 && !Sell2) { // 500% above cvwap
            profitPercentage = ((currentPrice - buyPrice) / buyPrice) * 100;
            console.log(`highX SELL 2 triggered for ${tokenName} at ${new Date(currentData.unixTime * 1000)}. Profit percentage: ${profitPercentage.toFixed(2)}%`);
            await updateSell2_DB_highX(contractAddress, tokenName);
            return { action: 'SELL 2', status: 'Processed' };
        } else if (currentPrice > 10 * buyPrice && Sell1 && Sell2 && !Sell3) { // 900% above cvwap
            profitPercentage = ((currentPrice - buyPrice) / buyPrice) * 100;
            console.log(`highX SELL 3 triggered for ${tokenName} at ${new Date(currentData.unixTime * 1000)}. Profit percentage: ${profitPercentage.toFixed(2)}%`);
            await updateSell3_DB_highX(contractAddress, tokenName);
            return { action: 'SELL 3', status: 'Processed' };
        } else if (currentPrice > 21 * buyPrice && Sell1 && Sell2 && Sell3 && !Sell4) { // 2000% above cvwap
            profitPercentage = ((currentPrice - buyPrice) / buyPrice) * 100;
            console.log(`highX SELL 4 triggered for ${tokenName} at ${new Date(currentData.unixTime * 1000)}. Profit percentage: ${profitPercentage.toFixed(2)}%`);
            await updateSell4_DB_highX(contractAddress, tokenName);
            return { action: 'SELL 4', status: 'Processed' };
        }
        return { action: 'Check_Sell', status: 'Processed' };
    } catch(error){
        throw error;
    }
}

async function checkBuySignalOrInvalidation(currentData, currentPrice_now, contractAddress, tokenName, PreBuyTime) {
    console.log(`highX Buy signal triggered for ${tokenName} at ${new Date()}`);
    try{
        await updateBuy_DB_highX(contractAddress, tokenName, 0); //Price is dummy TODO
        await updateBuySignal_DB_highX(contractAddress, tokenName); // For telegram Auto Buy
        await deleteOldTokens_highX(contractAddress, tokenName); //set expired
        return { action: "Buy", status: 'Processed' };
    } catch(error){
        throw error;
    }
}


async function fetchPrice_OHLCV(contractAddress) {
    const maxRetries = 3;
    const retryDelay = 2000; // Delay in milliseconds (2 seconds)

    const fetchWithRetry = async (url, options) => {
        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                attempts++;
                if (attempts >= maxRetries) {
                    console.error(`Error fetching data from ${url} after ${attempts} attempts:`, error);
                    throw error; // Throw error after max retries
                }
                console.warn(`Attempt ${attempts} failed. Retrying in ${retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay)); // Delay before next attempt
            }
        }
    };

    try {
        const currentTimeFrom = Math.floor((new Date().getTime() / 1000) / 60) * 60;
        const currentTimeTo = currentTimeFrom + 30;
        const options = {
            method: 'GET',
            headers: { 'X-API-KEY': process.env.BDS_API_KEY },
            timeout: 10000
        };
        const apiUrl = `https://public-api.birdeye.so/defi/ohlcv?address=${contractAddress}&type=1m&time_from=${currentTimeFrom}&time_to=${currentTimeTo}`;

        console.log(`Fetching data from ${apiUrl}`);

        const data = await fetchWithRetry(apiUrl, options);

        // Ensure the response structure is as expected
        if (data.success && data.data && Array.isArray(data.data.items) && data.data.items.length === 1) {
            const price_object = data.data.items[0];
            const price = Math.min(price_object.o, price_object.h, price_object.l, price_object.c);
            console.log('Fetched and calculated price:', price);
            return price;
        } else {
            console.error('Unexpected response structure or data items count not equal to 1');
            throw new Error('Unexpected response structure or data items count not equal to 1');
        }
    } catch (error) {
        console.error(`Error fetching data for ${contractAddress}:`, error);
        throw error; // Propagate the error back to the caller
    }
}


async function fetchPrice(contractAddress){ // let lowerWholeMinuteTimestamp = Math.floor(unixTimestamp / 60) * 60;
    try {
        // Fetch current prices for tradeable tokens
        const options = {method: 'GET', headers: {'X-API-KEY': process.env.BDS_API_KEY}, timeout: 10000};
        const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${contractAddress}`, options);
        
        // Check if the response status is not OK
        if (!response.ok) {
            throw new Error(`highX Error fetching price data: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success || !data.data ) {
            throw new Error; // Exit loop if no more data or unsuccessful response
        }
        const price = data.data.value;
        return price;
    } catch (error) {
        console.error('highX Error fetching price data:', error);
        throw error; // Exit the function if there's an error fetching prices
    }
}

async function filterOHLCVData(contractAddress, signal_epoch_time) {
    // Filter the OHLCV data using the signal_epoch_time
    const fullData = await ContractOHLCV_highX.findOne({contractAddress});   
    const filteredOhlcvData = fullData.OHLCV.filter(entry => entry[0] >= signal_epoch_time);

    return filteredOhlcvData;
}

async function percentageToFloat_profit(value) {
    if (!value || value.trim() === '') return null;
    return parseFloat(value.replace('%', '').trim());
  }

async function runTradingLogic_highX(tokenData) {
    // Filter tokens where Tradeable is true
    const tradeableTokens = tokenData.filter(token => token.Tradeable);

    if (tradeableTokens.length === 0) {
        console.log("highX No tradeable tokens found.");
        return [];
    }

    const checkTradePromises = tradeableTokens.map(async ({ tokenName, contractAddress, pctProfit, signalDate, PreBuy, PreBuyTime, Buy, BuyPrice, Expired, Sell1, Sell2, Sell3, Sell4 }) => {
        try {
            let price;
            let action;
            const signal_epoch_time = Math.floor(new Date(signalDate).getTime() / 1000) - 60; // Convert to UNIX timestamp in seconds
            const filtohlcvData = await filterOHLCVData(contractAddress, signal_epoch_time);
            const curr_profit = await percentageToFloat_profit(pctProfit);
            if (filtohlcvData && filtohlcvData.length > 1) {
                ohlcvData = filtohlcvData;
                // Initialize high and low frames for comparison
                let max_local_top = Math.max(parseFloat(ohlcvData[0][1]), parseFloat(ohlcvData[0][4]));
                let min_local_bottom = Infinity;
                let max_local_top_frame = ohlcvData[0];
                let min_local_bottom_frame = null;

                let redCounter = 0;
                let top = -1;
                let bottom = -1;
                let buy_price = -1.0;
                let index = -1;
                let maxDip = 0;
                let maxDipFrame = null;
                const percentageThreshold = 70;
                for (let i = 1; i < ohlcvData.length; i++) {
                    const currentData = ohlcvData[i];
                    const previousData = ohlcvData[i - 1];
                    
                    const timeGap_running = (parseFloat(previousData[0]) - signal_epoch_time) / 60;
                    if (timeGap_running > 30 && curr_profit < 600 && !PreBuy) {
                        console.log('One hr passed. Skipping...', tokenName, new Date());
                        action = {action:"Top_sig", status: 'Skipped' };
                        await deleteOldTokens_highX(contractAddress, tokenName);
                        return { tokenName, contractAddress, ...action };
                    }

                    const currentTop = Math.max(parseFloat(previousData[1]), parseFloat(previousData[4]));
                    if (currentTop > max_local_top) {
                        max_local_top = currentTop;
                        max_local_top_frame = previousData;
                        min_local_bottom = Infinity;
                    }
            
                    if (max_local_top_frame && parseFloat(currentData[0]) > parseFloat(max_local_top_frame[0])) {
                        const currentBottom = Math.min(parseFloat(currentData[1]), parseFloat(currentData[4]));
                        if (currentBottom < min_local_bottom) {
                            min_local_bottom = currentBottom;
                            min_local_bottom_frame = currentData;
                        }
            
                        // Track consecutive red candles
                        if (parseFloat(currentData[4]) < parseFloat(currentData[1])) {
                            if (redCounter === 0) {
                                top = parseFloat(currentData[1]);
                                bottom = parseFloat(currentData[4]);
                            } else {
                                bottom = parseFloat(currentData[4]);
                            }
                            redCounter += 1;
                        } else {
                            redCounter = 0;  // Reset counter if not a red candle
                            top = -1;
                            bottom = -1;
                        }
            
            
                        const percentageDrop = ((max_local_top - min_local_bottom) / max_local_top) * 100;
                        if (percentageDrop > maxDip) {
                            maxDip = percentageDrop;
                            maxDipFrame = currentData;
            
                            if (redCounter > 4) {  // If more than 4 consecutive red candles
                                const percentageDropD = ((top - bottom) / top) * 100;
                                if (percentageDropD >= 60 && curr_profit <= 600) {  // Check for a mega dip
                                    console.log('Mega dip... Expired');
                                    Expired = true;
                                    break;
                                } else {
                                    console.log('Escaped...');
                                }
                            }
                        }
            
                        if (maxDip >= percentageThreshold) {
                            PreBuy = true;
                            index = i;
                            break;
                        }
                    }
                }

                // Calculate time gaps and check for buy signal
                const timeGap = (parseFloat(min_local_bottom_frame[0]) - signal_epoch_time) / 60; // in minutes
                const timeGapTop = (parseFloat(max_local_top_frame[0]) - signal_epoch_time) / 60; // in minutes
                const timeGapBottom = (parseFloat(min_local_bottom_frame[0]) - parseFloat(max_local_top_frame[0])) / 60; // in minutes

                if (Expired && !PreBuy) {
                    console.log('No PreBuy or Mega dip for', tokenName, new Date());
                    action = {action:"No_Buy", status: 'Skipped' };
                    await deleteOldTokens_highX(contractAddress, tokenName);
                    return { tokenName, contractAddress, ...action };
                }
                else if (PreBuy && !Expired){
                    if (timeGapBottom < 3 && curr_profit < 600) {
                        console.log('Signal is top. Skipping...', tokenName, new Date());
                        action = {action:"Top_sig", status: 'Skipped' };
                        await deleteOldTokens_highX(contractAddress, tokenName);
                        return { tokenName, contractAddress, ...action };
                    }
                    
                    if (timeGap > 30 && curr_profit < 600) {
                        console.log('One hr expired. Skipping...', tokenName, new Date());
                        action = {action:"Top_sig", status: 'Skipped' };
                        await deleteOldTokens_highX(contractAddress, tokenName);
                        return { tokenName, contractAddress, ...action };
                    }

                    if ((timeGapTop <  3 && contractAddress.includes('pump'))) {
                        console.log('Pump token top. Skipping...', tokenName, new Date());
                        action = {action:"Top_sig", status: 'Skipped' };
                        await deleteOldTokens_highX(contractAddress, tokenName);
                        return { tokenName, contractAddress, ...action };
                    }

                    if ((timeGap <=  30 || timeGapBottom < 3 || timeGapTop <= 30) && curr_profit >= 600) {
                        console.log('Fake pump. Skipping...', tokenName, new Date());
                        action = {action:"Top_sig", status: 'Skipped' };
                        await deleteOldTokens_highX(contractAddress, tokenName);
                        return { tokenName, contractAddress, ...action };
                    }

                    // Example trading logic
                    if (PreBuy && timeGap <= 30 && !Buy && !Expired){
                        currentData = ohlcvData[index];
                        const result = await checkBuySignalOrInvalidation(currentData, price, contractAddress, tokenName, PreBuyTime);
                        action = {action:result.action, status: result.status };
                        return { tokenName, contractAddress, ...action };
                    }
                    
                    if (PreBuy && timeGap > 30 && !Buy && !Expired && curr_profit >= 600){
                        currentData = ohlcvData[index];
                        const result = await checkBuySignalOrInvalidation(currentData, price, contractAddress, tokenName, PreBuyTime);
                        action = {action:result.action, status: result.status };
                        return { tokenName, contractAddress, ...action };
                    }

                    action = {action:"No_Buy", status: 'Skipped' };
                    console.log('No buy. Skipping...', tokenName, new Date());
                    await deleteOldTokens_highX(contractAddress, tokenName);
                    return { tokenName, contractAddress, ...action };
                }
                //time expired more than 30mins and cur profit is less than 600%
                if (!PreBuy && !Expired && timeGap > 30 && curr_profit < 600){
                    action = {action:"No_Buy", status: 'Skipped' };
                    console.log('No buy. Skipping...', tokenName, new Date());
                    await deleteOldTokens_highX(contractAddress, tokenName);
                    return { tokenName, contractAddress, ...action };
                }

                action = {action:"Continue", status: 'Wait' };
                return { tokenName, contractAddress, ...action };

            } else {
                action = {action:"Data_wait", status: 'Wait' };
                return { tokenName, contractAddress, ...action };
            }
        } catch (error) {
            console.error(`highX Error processing trade logic for token ${tokenName}:`, error);
            return { tokenName, contractAddress, error, status: 'Error'};
        }
    });

    try {
        const results = await Promise.allSettled(checkTradePromises);
        const fulfilledResults = results.filter(result => result.status === 'fulfilled').map(result => result.value);
        const rejectedResults = results.filter(result => result.status === 'rejected').map(result => result.reason);
        return fulfilledResults.concat(rejectedResults);
    } catch (error) {
        console.error('highX Error in checking trade logic:', error);
        throw error;
    }
}

module.exports = runTradingLogic_highX;