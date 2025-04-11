const fetch_Token_details = require('./token_details_fetch');
const ProcessOHLCVData = require('./process_ohlcv_hist');
const { originalConsole } = require('./logger');
const { checkTokenInDB_highX } = require('./mongo_DB_highx');
const checkRugStatus = require('./rug_check');
async function convertMarketCap(value) {
  value = value.toLowerCase();
  if (value.includes('k')) {
      return parseFloat(value.replace('k', '')) * 1e3;
  } else if (value.includes('m')) {
      return parseFloat(value.replace('m', '')) * 1e6;
  } else if (value.includes('b')) {
      return parseFloat(value.replace('b', '')) * 1e9;
  }
  return parseFloat(value);
}

async function percentageToFloat(value) {
  if (!value || value.trim() === '') return null;
  return parseFloat(value.replace('%', '').trim());
}

async function extractTokenDetails_ProcessOHLCVData(message) {
    const lines = message.message.split('\n').map(line => line.trim());
    const filteredLines = lines.filter(line => line.includes('$') || line.includes('Address:') ||  line.includes('Gain/Loss:')  || line.includes('VWAP Price') || line.includes('Current Market Cap'));

    const tokens = [];
    const date = new Date(message.date * 1000);
    let currentToken = {};
    
    for (let line of filteredLines) {
      if (line.includes('$')) {
        const regex = /\$\$[^\s]+/;
        const match = line.match(regex);
        if (match) {
          currentToken = { signal_date: date, creation_date: '', pair_address: '', name: match[0], ca_address: '', vwapct: '', mkt_cap: '', curr_prft: ''};
        }
      } else if (line.startsWith('Address:')) {
          currentToken.ca_address = line.split('Address: ')[1];
      } else if (line.startsWith('Current Market Cap:')) {
          currentToken.mkt_cap = line.split('Current Market Cap: ')[1];
      } else if (line.startsWith('Gain')) {
          currentToken.curr_prft = line.split('Gain/Loss: ')[1];
      } else if (line.startsWith('VWAP')) {
        currentToken.vwapct = line.split('VWAP Price Dist: ')[1];
        try {
          if (currentToken.name && currentToken.ca_address){
            const res_highX = await checkTokenInDB_highX(currentToken.ca_address);
            const mkt_cap_val = await convertMarketCap(currentToken.mkt_cap);
            const vwap_dist = await percentageToFloat(currentToken.vwapct);
            const curr_profit = await percentageToFloat(currentToken.curr_prft);

            //Rug check 
            const rug_status = await checkRugStatus(currentToken.ca_address);

            if( rug_status != 'Danger' && !res_highX && (mkt_cap_val >= 50000 && mkt_cap_val <= 2000000) && vwap_dist <= 350 && (curr_profit >= 90 && curr_profit <= 1000)){
                const token_data = await fetch_Token_details(currentToken.ca_address);
                console.log('Extracted Data!');
                // console.log(ohlcv_data); // Process the fetched and extracted data as needed
                if(token_data){
                  if ((token_data.baseAddress.includes(currentToken.ca_address))){
                      currentToken.pair_address = token_data.pair_address
                      currentToken.creation_date = token_data.createdAt
                      tokens.push(currentToken)
                  }
                  else{
                      console.log('Skipped token: ', token_data);
                  }
                }
            }
            else if (rug_status === 'Danger') {
              console.log('Skipped Scam token: ', currentToken.name);
            } 
            else if (res_highX) {
              console.log('Skipped already processed token: ', currentToken.name);
            } 
            else if (mkt_cap_val < 50000 || mkt_cap_val > 2000000) {
              console.log('Skipped Mkt Cap: ', currentToken.name);
            } 
            else if (vwap_dist > 350) {
              console.log('Skipped Vwap price pct: ', currentToken.name);
            } 
            else if (curr_profit < 90 || curr_profit > 1000) {
              console.log('Skipped Curr profit pct: ', currentToken.name);
            } 
          }
        } catch (error) {
          console.error('Error processing Token data:', error);
          throw error;
          }
      } 
    }
    try {
      const processedData = await ProcessOHLCVData(tokens)
    } catch (error) {
        console.error('Error processing OHLCV data:', error);
        throw error;
    }
    return tokens;
  }

  async function extractTokenDetails_ProcessOHLCVData_simulation(message) {
    const lines = message.message.split('\n').map(line => line.trim());
    const filteredLines = lines.filter(line => line.includes('$') || line.includes('Address:') ||  line.includes('Gain/Loss:')  || line.includes('VWAP Price') || line.includes('Current Market Cap'));

    const tokens = [];
    let currentToken = {};
    
    for (let line of filteredLines) {
      if (line.includes('$')) {
        const regex = /\$\$[^\s]+/;
        const match = line.match(regex);
        if (match) {
          currentToken = { signal_date: new Date(), creation_date: '', pair_address: '', name: match[0], ca_address: '', vwapct: '', mkt_cap: '', curr_prft: ''};
        }
      } else if (line.startsWith('Address:')) {
          currentToken.ca_address = line.split('Address: ')[1];
      } else if (line.startsWith('Current Market Cap:')) {
          currentToken.mkt_cap = line.split('Current Market Cap: ')[1];
      } else if (line.startsWith('Gain')) {
          currentToken.curr_prft = line.split('Gain/Loss: ')[1];
      } else if (line.startsWith('VWAP')) {
        currentToken.vwapct = line.split('VWAP Price Dist: ')[1];
        try {
          if (currentToken.name && currentToken.ca_address){
            const res_highX = await checkTokenInDB_highX(currentToken.ca_address);
            const mkt_cap_val = await convertMarketCap(currentToken.mkt_cap);
            const vwap_dist = await percentageToFloat(currentToken.vwapct);
            const curr_profit = await percentageToFloat(currentToken.curr_prft);

            //Rug check 
            const rug_status = await checkRugStatus(currentToken.ca_address);

            if( rug_status != 'Danger' && !res_highX && (mkt_cap_val >= 50000 && mkt_cap_val <= 2000000) && vwap_dist <= 350 && (curr_profit >= 90 && curr_profit <= 1000)){
                const token_data = await fetch_Token_details(currentToken.ca_address);
                console.log('Extracted Data!');
                // console.log(ohlcv_data); // Process the fetched and extracted data as needed
                if(token_data){
                  if ((token_data.baseAddress.includes(currentToken.ca_address))){
                      currentToken.pair_address = token_data.pair_address
                      currentToken.creation_date = token_data.createdAt
                      tokens.push(currentToken)
                  }
                  else{
                      console.log('Skipped token: ', token_data);
                  }
                }
            }
            else if (rug_status === 'Danger') {
              console.log('Skipped Scam token: ', currentToken.name, new Date());
            } 
            else if (res_highX) {
              console.log('Skipped already processed token: ', currentToken.name, new Date());
            } 
            else if (mkt_cap_val < 50000 || mkt_cap_val > 2000000) {
              console.log('Skipped Mkt Cap: ', currentToken.name, new Date());
            } 
            else if (vwap_dist > 350) {
              console.log('Skipped Vwap price pct: ', currentToken.name, new Date());
            } 
            else if (curr_profit < 90 || curr_profit > 1000) {
              console.log('Skipped Curr profit pct: ', currentToken.name, new Date());
            } 
          }
        } catch (error) {
          console.error('Error processing Token data:', error);
          throw error;
          }
      } 
    }
    try {
      const processedData = await ProcessOHLCVData(tokens)
    } catch (error) {
        console.error('Error processing OHLCV data:', error);
        throw error;
    }
    return tokens;
  }


  module.exports = {extractTokenDetails_ProcessOHLCVData, extractTokenDetails_ProcessOHLCVData_simulation};