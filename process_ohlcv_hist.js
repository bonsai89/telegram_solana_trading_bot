const { fetchOHLCVData } = require('./fetch_ohlcv_historical');
const {pushOHLCV_DB_highX, pushToken_DB_highX, checkTokenInDB_highX} = require('./mongo_DB_highx');
const { originalConsole } = require('./logger');

const calculateVWAP = (data) => {
    let vwap = 0;

    if (!Array.isArray(data)) {
        // If data is not an array, treat it as a single object
        const entry = data;
        const volume = entry[5];
        const avgPrice = (entry[1] + entry[2] + entry[3] + entry[4]) / 4;
        
        if (volume > 0) {
            vwap = (avgPrice * volume) / volume;
        } else {
            vwap = 0;
        }

        // Store vwap in entry[6]
        entry[6] = vwap;

        return [vwap, volume];
    }

    const totalVolume = data.reduce((acc, entry) => acc + entry[5], 0);
    
    if (totalVolume > 0) {
        vwap = data.reduce((acc, entry) => acc + (entry[5] * (entry[1] + entry[2] + entry[3] + entry[4]) / 4), 0) / totalVolume;
    } else {
        vwap = 0;
    }

    // Store VWAP in each entry's 6th index or append it
    data.forEach(entry => {
        const avgPrice = (entry[1] + entry[2] + entry[3] + entry[4]) / 4;
        const individualVWAP = (avgPrice * entry[5]) / entry[5];
        entry[6] = individualVWAP;
    });

    return [vwap, totalVolume];
};


async function ProcessOHLCVData(tokenData) {
        const fetchPromises = tokenData.map(async ({ signal_date, creation_date, name, ca_address, pair_address, vwapct, curr_prft }) => {
            try {
                let ohlcvData = await fetchOHLCVData(pair_address, creation_date, signal_date);
                ohlcvData.reverse();
                ohlcvData.pop();
                const last_data_ohlcv =  ohlcvData[ohlcvData.length - 1]// popped last 1 entries as volume is zero
                const last_ohlcv_time = new Date(last_data_ohlcv[0] * 1000);
                const [cvwap, volume_total] = calculateVWAP(ohlcvData);
                
                console.log(`Data for ${name} processed, length: ${ohlcvData.length}, CVWAP: ${cvwap} at ${signal_date}`);
                try {
                    const token_db = { signal_date, last_ohlcv_time, creation_date, name, ca_address, pair_address, vwapct, curr_prft, ohlcvData, cvwap, volume_total };
                    await pushOHLCV_DB_highX(token_db);
                    await pushToken_DB_highX(token_db);
                  } catch (error) {
                      console.error('Error pushing token to DB:', error);
                }
                return { name, ca_address, last_ohlcv_time, ohlcvData };
            } catch (error) {
                console.error('Error pushing token to DB:', error);
                return { name, ca_address, error };
            }
        });

        // Wait for all fetch operations to complete
        const results = await Promise.allSettled(fetchPromises);

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                console.log(`Data for ${result.value.name} processed`);
            } else {
                console.error(`Error fetching data for ${result.reason.name}:`, result.reason.error);
            }
        });
        return results.map(result => result.status === 'fulfilled' ? result.value : { name: result.reason.name, error: result.reason.error });
}

module.exports = ProcessOHLCVData;