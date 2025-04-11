require('dotenv').config();
const { originalConsole } = require('./logger');

async function fetch_Token_details(tokenAddress) {
    const url = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${tokenAddress}/pools?page=1`;
    const options = {method: 'GET', headers: {}, timeout:10000};
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        // Ensure the response structure is as expected
        if (data && data.data && data.data.length > 0) {
            // Process the data to filter items with source 'Raydium' and extract required fields
            const raydiumItems = data.data.filter(item => item.relationships.dex.data.id === 'raydium');
            if (raydiumItems.length > 0) {
                const extractedData = {
                    pair_address: raydiumItems[0].attributes.address,
                    baseAddress: raydiumItems[0].relationships.base_token.data.id,
                    createdAt: new Date(raydiumItems[0].attributes.pool_created_at),
                    baseCurrency: raydiumItems[0].attributes.name,
                }
                // console.log(extractedData);
                return extractedData;
            }
            else{
                return null;
            }
        } else {
            throw new Error('Unexpected response structure');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error; // Propagate the error back to the caller
    }
}

// fetch_hist_OHLCV("DMTbBZtgzWbstuRQNSR5S2krBuTTJub7cJraoSydpump")

module.exports = fetch_Token_details;
