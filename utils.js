require('dotenv').config();
const { originalConsole } = require('./logger');

const {ContractToken, ContractOHLCV} = require('./contract_ohlcv')
const { fetchOHLCVData, fetchOHLCVData_conseq } = require('./fetch_ohlcv_historical');
const { isExpired_highX, updateOHLCV_DB_highX, updateToken_DB_highX } = require('./mongo_DB_highx');

function updateCVWAP(cvwap_n, totalVolume_n, ohlcvData_nplus) {
    let totalValue = cvwap_n * totalVolume_n; // Initial total value is cvwap_n * totalVolume_n
    let totalVolume = totalVolume_n; // Initial total volume is totalVolume_n
    let vwap = 0;
    // Calculate the sum of (average price * volume) for new entries and add corresponding VWAP
    const updatedData = ohlcvData_nplus.map(candle => {
        const avgPrice = (candle[1] + candle[2] + candle[3] + candle[4]) / 4;
        totalValue += avgPrice * candle[5]; // Add new candle's weighted value to totalValue
        totalVolume += candle[5]; // Add new candle's volume to totalVolume
        if (totalVolume > 0){
            // Calculate VWAP for this candle
            vwap = totalValue / totalVolume;
        }
        else{
            vwap = 0;
        }

        // Return candle data with added VWAP
        return {
            ...candle,
            vwap
        };
    });

    // Return both updated cvwap and total volume along with the updated data
    return {
        cvwap_upd: vwap,
        totalVolume_upd: totalVolume,
        updatedData_full: updatedData
    };
}

function updateAVWAP(cvwap_n, totalVolume_n, ohlcvData_nplus) {
    let totalValue = cvwap_n * totalVolume_n; // Initial total value is cvwap_n * totalVolume_n
    let totalVolume = totalVolume_n; // Initial total volume is totalVolume_n
    let vwap = 0;

    // Calculate the sum of (average price * volume) for new entries and add corresponding VWAP
    const updatedData = ohlcvData_nplus.map(candle => {
        const avgPrice = (candle.o + candle.h + candle.l + candle.c) / 4;
        totalValue += avgPrice * candle.v; // Add new candle's weighted value to totalValue
        totalVolume += candle.v; // Add new candle's volume to totalVolume

        if (totalVolume > 0){
            // Calculate VWAP for this candle
            vwap = totalValue / totalVolume;
        }
        else{
            vwap = 0;
        }

        // Return candle data with added VWAP
        return {
            ...candle,
            Avwap: vwap
        };
    });

    // Return both updated cvwap and total volume along with the updated data
    return {
        avwap_upd: vwap,
        totalVolume_upd_avwap: totalVolume,
        updatedData_full: updatedData
    };
}

async function fetchOHLCVData_live(tokenData) {
    try{
        const fetchPromises = tokenData.map(async ({ lastProcessedTime, creationDate, tokenName, contractAddress, pairAddress, CVWAP, Total_volume}) => {
            const last_processed_time_unix = Math.floor(new Date(lastProcessedTime).getTime() / 1000);
            const current_time = new Date();
            const time_diff = (current_time.getTime() - new Date(lastProcessedTime).getTime()) / 1000;
            // console.log(`Last processed time: ${lastProcessedTime}`);
            // console.log(`Current time: ${current_time}`);
            // console.log(`Difference in seconds: ${time_diff} secs`);
            const result_highX = await isExpired_highX(contractAddress);
            if (time_diff > 120 && !result_highX){ //either one of the strategy is still tracking the token
                try{
                   const no_of_entries = Math.floor(time_diff / 60);
                    const ohlcvData = await fetchOHLCVData_conseq(pairAddress, no_of_entries, current_time);
                    ohlcvData.reverse();
                    ohlcvData.pop();
                    if(ohlcvData.length > 0){
                        let filteredData = ohlcvData.filter(entry => entry[0] > last_processed_time_unix);
                        if(filteredData.length > 0){
                            const last_data_ohlcv =  filteredData[filteredData.length - 1]// popped last 1 entries as volume is zero
                            const last_data_time = new Date(last_data_ohlcv[0] * 1000);
                            let {cvwap_upd, totalVolume_upd, updatedData_full} = updateCVWAP(CVWAP, Total_volume, filteredData);
                            //console.log(`Data for ${tokenName} processed, Vol: ${totalVolume_upd}, CVWAP: ${cvwap_upd} at ${last_data_time}`);
                            try {
                                const token_db = { last_data_time, creationDate, tokenName, contractAddress, pairAddress, cvwap_upd, totalVolume_upd, updatedData_full };
                                if (!result_highX){ //highX logic still running
                                    await updateOHLCV_DB_highX(token_db);
                                    await updateToken_DB_highX(token_db);
                                }
                            } catch (error) {
                                console.error('highX Error updating token to DB:', error);
                                return { tokenName, contractAddress, error, status: 'Error highX' };
                            }

                            return { tokenName, contractAddress, cvwap_upd, status: 'Updated' };
                        }
                        else{
                            return { tokenName, contractAddress, CVWAP, status: 'No New Entries' };
                        }
                    } else{
                        return { tokenName, contractAddress, CVWAP, status: 'No New Entries' };
                    }
                } catch (error) {
                    console.error('Error updating token to DB highX:', error);
                    return { tokenName, contractAddress, error, status: 'Error' };
                    }
            }
            else{
                return { tokenName, contractAddress, CVWAP, status: 'Skipped' };
            }
        });
    
        try {
            const results = await Promise.allSettled(fetchPromises);
            const fulfilledResults = results.filter(result => result.status === 'fulfilled').map(result => result.value);
            const rejectedResults = results.filter(result => result.status === 'rejected').map(result => result.reason);
            return fulfilledResults.concat(rejectedResults);
        } catch (error) {
            console.error('Error in fetching OHLCV data:', error);
        }
    }
    catch(error){
        console.error('Error updating tokenlist from two trading logics:', error);
        throw error;
    }
}

module.exports = {fetchOHLCVData_live};