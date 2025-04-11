require('dotenv').config();
const { originalConsole } = require('./logger');

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

async function fetchOHLCVData(tokenAddress, timeFrom_iso, timeTo_iso) {
    const options = {method: 'GET', headers: {}, timeout:10000};

    const timeTo = Math.floor(new Date(timeTo_iso).getTime() / 1000); 
    const timeFrom = Math.floor(new Date(timeTo_iso).getTime() / 1000) + 60; // to avoid missing out signal candle
    
    let combinedData = [];
    let currentTimeFrom = timeFrom;
    const maxDataPointsPerCall = 1000;
    const intervalInSeconds = 60; // Interval in seconds (1 minute)

    try {
        
        const currentTimeTo = Math.min(currentTimeFrom + (maxDataPointsPerCall * intervalInSeconds), timeTo);
        const apiUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${tokenAddress}/ohlcv/minute?aggregate=1&before_timestamp=${timeFrom}&limit=1000&currency=usd&token=base`;
        
        const response = await fetch(apiUrl, options);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data || !data.data || !data.data.attributes || data.data.attributes.ohlcv_list.length === 0) {
            throw new Error('OHLCV data corrupted!'); // Exit loop if no more data or unsuccessful response
        }

        combinedData = combinedData.concat(data.data.attributes.ohlcv_list); // Combine data arrays
        return combinedData;
    } catch (error) {
        console.error(`Error fetching data for ${tokenAddress}:`, error);
        throw error;
    }
}

async function fetchOHLCVData_conseq(tokenAddress, num_entries, timeTo_iso) {
    const options = {method: 'GET', headers: {}, timeout:10000};

    const timeTo = Math.floor(new Date(timeTo_iso).getTime() / 1000); 
    let combinedData = [];
    const maxDataPointsPerCall = 1000;
    const intervalInSeconds = 60; // Interval in seconds (1 minute)

    try {
        
        const apiUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${tokenAddress}/ohlcv/minute?aggregate=1&before_timestamp=${timeTo}&limit=${num_entries}&currency=usd&token=base`;
        
        const response = await fetch(apiUrl, options);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data || !data.data || !data.data.attributes || data.data.attributes.ohlcv_list.length === 0) {
            throw new Error('OHLCV data corrupted!'); // Exit loop if no more data or unsuccessful response
        }

        combinedData = combinedData.concat(data.data.attributes.ohlcv_list); // Combine data arrays
        return combinedData;
    } catch (error) {
        console.error(`Error fetching data for ${tokenAddress}:`, error);
        throw error;
    }
}

// const timeFrom = Math.floor(new Date("2024-07-12 21:34:36").getTime() / 1000);
// const timeTo = Math.floor(new Date("2024-07-12 23:34:36").getTime() / 1000);
// const tokenAddress = "B4u7Kd4WhByuaTgLWrW8rTRLsT8huhUD7wQWBBcvpump";

// fetchOHLCVData(tokenAddress, timeFrom, timeTo)

module.exports = {
    fetchOHLCVData,
    fetchOHLCVData_conseq
};
