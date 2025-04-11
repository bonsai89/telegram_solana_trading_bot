const {ContractOHLCV_highX, ContractToken_highX} = require('./contract_ohlcv');
const moment = require('moment');
const { originalConsole } = require('./logger');


async function loadTokens_highX() {
  try {
      const tokenList = await ContractToken_highX.find({ Expired: false });
      // for (let contract of tokenList) {
      //     console.log(`lastProcessedTime: ${contract.lastProcessedTime}, Token: ${contract.tokenName}, CVWAP: ${contract.CVWAP}, AVWAP: ${contract.AVWAP}, Vol: ${contract.Total_volume}`);
      // }
      console.log(`Total tokens being tracked highX: ${tokenList.length}`);
      return tokenList;
  } catch (error) {
      console.error('Error loading tokens highX:', error);
      throw error;
  }
}

// Function to check if a specific contract is expired using contractAddress
async function isExpired_highX(contractAddress) {
  try {
      const contract = await ContractToken_highX.findOne({ contractAddress: contractAddress }).exec();
      if (contract) {
          return contract.Expired === true;
      } else {
          console.log('Contract not found highX');
          return false;
      }
  } catch (error) {
      console.error('Error checking if contract is expired highX:', error);
      throw error;
  }
}

async function clearbuySignalTokens_highX(contractAddress, tokenName){
  try {
    const result = await checkOHLCVInDB_highX(contractAddress);
    if (result){
      const updateResult = await ContractToken_highX.updateOne(
        { contractAddress: contractAddress }, // Filter condition
        { $set: { BuySignal: false }});
  
      if (updateResult.modifiedCount > 0) {
        console.log(`Token expired ${tokenName} in DB highX`);
      } else {
        console.error(`Error setting expiry Token, ${tokenName} not found or no updates applied highX`);
      }
    }else{
      console.log(`Token not found ${tokenName} in DB highX`);
    }
  } catch (error) {
      console.error(`Error clearing Buy Signal for token highX ${tokenName}:`, error);
      throw error;
  }

}

async function deleteOldTokens_highX(contractAddress, tokenName) {
  try {
    const result = await checkOHLCVInDB_highX(contractAddress);
    if (result){
    const updateResult = await ContractToken_highX.updateOne(
      { contractAddress: contractAddress }, // Filter condition
      { $set: { Expired: true }});

    if (updateResult.modifiedCount > 0) {
      console.log(`Token expired ${tokenName} in DB highX`);
    } else {
      console.error(`Error setting expiry Token, ${tokenName} not found or no updates applied highX`);
    }
    }
    else{
      console.log(`Token not found ${tokenName} in DB highX`);
    }
  } catch (error) {
    console.error(`Error setting expiry for token highX ${tokenName}:`, error);
    throw error;
  }
}

async function checkTokenInDB_highX(contractAddress) {
  try {
      const existingToken = await ContractToken_highX.findOne({ contractAddress });

      if (existingToken) {
        return true;
      }
      else {
        return false;
      }
    } catch (error) {
      console.error(`Error checking token in DB highX ${contractAddress}:`, error);
      throw error;
    }
}

async function checkOHLCVInDB_highX(contractAddress) {
  try {
      const existingToken = await ContractOHLCV_highX.findOne({ contractAddress });

      if (existingToken) {
        return true;
      }
      else {
        return false;
      }
    } catch (error) {
      console.error(`Error checking token in DB highX ${contractAddress}:`, error);
      throw error;
    }
}

// Function to save token details to MongoDB
async function pushOHLCV_DB_highX(token){
  const contractOHLCV_highX = new ContractOHLCV_highX({ signalDate: token.last_ohlcv_time, creationDate: token.creation_date, tokenName: token.name, contractAddress: token.ca_address, pairAddress: token.pair_address, pctVWAP: token.vwapct, pctProfit: token.curr_prft, OHLCV: token.ohlcvData });
  await contractOHLCV_highX.save();
  console.log(`HighX OHLCV to DB: Signal Date: ${moment(token.last_ohlcv_time).format('YYYY-MM-DD HH:mm:ss')}, Token: ${token.name}, CA Address: ${token.ca_address}, VWAP: ${token.vwapct}`);
  console.log(`Creation Date: ${moment(token.creation_date).format('YYYY-MM-DD HH:mm:ss')}, Pair Address: ${token.pair_address}`);
  console.log(`OHLCV length: ${token.ohlcvData.length}`);
}

async function pushToken_DB_highX(token){
  const contractToken_highX = new ContractToken_highX({ signalDate: token.signal_date,
    lastProcessedTime: token.last_ohlcv_time, 
    creationDate: token.creation_date, 
    tokenName: token.name, 
    contractAddress: token.ca_address, 
    pairAddress: token.pair_address, 
    pctProfit: token.curr_prft,
    CVWAP: token.cvwap,
    AVWAP: token.avwap,
    Total_volume: token.volume_total,
    Total_volume_avwap: token.volume_total_avwap
   });
  await contractToken_highX.save();
  console.log(`HighX Token to DB: Last Processed Date: ${moment(token.last_ohlcv_time).format('YYYY-MM-DD HH:mm:ss')}, Token: ${token.name}, CA Address: ${token.ca_address}, CVWAP: ${token.cvwap}`);
  //console.log(`Creation Date: ${moment(token.creation_date).format('YYYY-MM-DD HH:mm:ss')}, Total vol: ${token.volume_total}, avwap_vol: ${token.volume_total_avwap}`);
}


async function updatePreBuy_DB_highX(contractAddress, tokenName, prebuyTime){
  try {
    const result = await isExpired_highX(contractAddress);
    if(!result){
      const updateResult = await ContractToken_highX.updateOne(
        { contractAddress: contractAddress }, // Filter condition
        { $set: { PreBuy: true, PreBuyTime: prebuyTime }});

      if (updateResult.modifiedCount > 0) {
        console.log(`PreBuy set for Token ${tokenName} in DB highX`);
      } else {
        console.error(`Error setting PreBuy for Token, ${tokenName} not found or no updates applied highX`);
      }
    }else{
      console.log(`Expired Token ${tokenName} in DB highX`);
    }
  } catch (error) {
    console.error(`Error setting PreBuy for token highX ${tokenName}:`, error);
    throw error;
  }
  
}
async function updateBuySignal_DB_highX(contractAddress, tokenName){
  try {
    const result = await isExpired_highX(contractAddress);
    if(!result){
      const updateResult = await ContractToken_highX.updateOne(
        { contractAddress: contractAddress }, // Filter condition
        { $set: { BuySignal: true }});

      if (updateResult.modifiedCount > 0) {
        console.log(`BuySignal set for Token ${tokenName} in DB highX`);
      } else {
        console.error(`Error setting BuySignal for Token, ${tokenName} not found or no updates applied highX`);
      }
    }else{
      console.log(`Expired Token ${tokenName} in DB highX`);
    }
  } catch (error) {
    console.error(`Error setting BuySignal for token highX ${tokenName}:`, error);
    throw error;
  }
}


async function updateBuy_DB_highX(contractAddress, tokenName, buyPrice){
  try {
    const result = await isExpired_highX(contractAddress);
    if(!result){
      const updateResult = await ContractToken_highX.updateOne(
        { contractAddress: contractAddress }, // Filter condition
        { $set: { Buy: true, BuyPrice:  buyPrice }});

      if (updateResult.modifiedCount > 0) {
        console.log(`Buy set for Token ${tokenName} in DB highX`);
      } else {
        console.error(`Error setting Buy for Token, ${tokenName} not found or no updates applied highX`);
      }
    }else{
      console.log(`Expired Token ${tokenName} in DB highX`);
    }
  } catch (error) {
    console.error(`Error setting Buy for token highX ${tokenName}:`, error);
    throw error;
  }
}

async function updateSell1_DB_highX(contractAddress, tokenName){
  try {
    const updateResult = await ContractToken_highX.updateOne(
      { contractAddress: contractAddress }, // Filter condition
      { $set: { Sell1: true }});

    if (updateResult.modifiedCount > 0) {
      console.log(`Sell1 set for Token ${tokenName} in DB highX`);
    } else {
      console.error(`Error setting Sell1 for Token, ${tokenName} not found or no updates applied highX`);
    }
  } catch (error) {
    console.error(`Error setting Sell1 for token highX ${tokenName}:`, error);
    throw error;
  }
}

async function updateSell2_DB_highX(contractAddress, tokenName){
  try {
    const updateResult = await ContractToken_highX.updateOne(
      { contractAddress: contractAddress }, // Filter condition
      { $set: { Sell2: true }});

    if (updateResult.modifiedCount > 0) {
      console.log(`Sell2 set for Token ${tokenName} in DB highX`);
    } else {
      console.error(`Error setting Sell2 for Token, ${tokenName} not found or no updates applied highX`);
    }
  } catch (error) {
    console.error(`Error setting Sell2 for token highX ${tokenName}:`, error);
    throw error;
  }
}

async function updateSell3_DB_highX(contractAddress, tokenName){
  try {
    const updateResult = await ContractToken_highX.updateOne(
      { contractAddress: contractAddress }, // Filter condition
      { $set: { Sell3: true }});

    if (updateResult.modifiedCount > 0) {
      console.log(`Sell3 set for Token ${tokenName} in DB highX`);
    } else {
      console.error(`Error setting Sell3 for Token, ${tokenName} not found or no updates applied highX`);
    }
  } catch (error) {
    console.error(`Error setting Sell3 for token highX ${tokenName}:`, error);
    throw error;
  }
}

async function updateSell4_DB_highX(contractAddress, tokenName){
  try {
    const updateResult = await ContractToken_highX.updateOne(
      { contractAddress: contractAddress }, // Filter condition
      { $set: { Sell4: true }});

    if (updateResult.modifiedCount > 0) {
      console.log(`Sell4 set for Token ${tokenName} in DB highX`);
    } else {
      console.error(`Error setting Sell4 for Token, ${tokenName} not found or no updates applied highX`);
    }
  } catch (error) {
    console.error(`Error setting Sell4 for token highX ${tokenName}:`, error);
    throw error;
  }
}

function normalizeOHLCVEntries_highX(ohlcvEntries) {
  return ohlcvEntries.flatMap(entry => (Array.isArray(entry) ? entry : [entry]));
}

async function updateOHLCV_DB_highX(token_db){
  try {
    const result = await checkOHLCVInDB_highX(token_db.contractAddress);
    if (result){
      
        // Normalize the OHLCV entries to ensure no nested arrays
        const normalizedData = normalizeOHLCVEntries_highX(token_db.updatedData_full);

        const updateResult = await ContractOHLCV_highX.updateOne(
            { contractAddress: token_db.contractAddress }, // Filter condition
            { $push: { OHLCV: { $each: normalizedData } } } // Fields to update
        );

        if (updateResult.modifiedCount > 0) {
          console.log(`OHLCV for Token ${token_db.tokenName} updated in DB highX`);
        } else {
          console.error(`OHLCV for Token ${token_db.tokenName} not found or no updates applied highX`);
          throw error;
        }
    }
    else{
      console.log(`OHLCV for Token ${token_db.tokenName} has been deleted highX`);
    }
  } catch (error) {
      console.error(`Error updating DB OHLCV for token highX ${token_db.tokenName}:`, error);
      throw error;
    }
}

async function updateToken_DB_highX(token_db){
  try {
    const result = await checkTokenInDB_highX(token_db.contractAddress);
    if (result){
      // Initial update with main fields
      const updateResult = await ContractToken_highX.updateOne(
        { contractAddress: token_db.contractAddress }, // Filter condition
        { $set: { 
            CVWAP: token_db.cvwap_upd, 
            AVWAP: token_db.avwap_upd, 
            Total_volume_avwap: token_db.totalVolume_upd_avwap, 
            Total_volume: token_db.totalVolume_upd, 
            lastProcessedTime: token_db.last_data_time 
          } 
        }
      );

      if (updateResult.modifiedCount > 0) {
        console.log(`Token details ${token_db.tokenName} updated in DB highX`);
      } else {
        console.error(`Token details ${token_db.tokenName} not found or no updates applied highX`);
        throw error;
      }
    
      // Check time difference and conditionally update Tradeable field
      const existingToken = await ContractOHLCV_highX.findOne({ contractAddress: token_db.contractAddress });
      const existingTokenOHLCV = await ContractToken_highX.findOne({ contractAddress: token_db.contractAddress });
      if (existingToken && !existingTokenOHLCV.Tradeable) {
        const time_diff = (token_db.last_data_time.getTime() - new Date(existingToken.signalDate).getTime()) / 1000;
        if (time_diff >= 120) {
          const tradeableUpdateResult = await ContractToken_highX.updateOne(
            { contractAddress: token_db.contractAddress }, 
            { $set: { Tradeable: true } }
          );

          if (tradeableUpdateResult.modifiedCount > 0) {
            console.log(`Token ${token_db.tokenName} marked as Tradeable in DB at ${new Date()} highX`);
          } else {
            console.error(`Token ${token_db.tokenName} not found or Tradeable not updated highX`);
            throw error;
          }
        }
      }
    }
    else{
      console.log(`Token ${token_db.tokenName} has been deleted highX`);
    }
  } catch (error) {
      console.error(`Error updating token details to DB ${token_db.tokenName} highX:`, error);
      throw error;
    }
}


async function loopThroughAndDeleteExpired_highX() {
  try {
      const contracts = await ContractToken_highX.find({ Expired: true }); // Fetch all contracts

      if (contracts.length === 0) {
          console.log('No Expired contracts found highX.');
          return;
      }

      for (let contract of contracts) {
          // Delete the contract
          await ContractOHLCV_highX.deleteOne({ contractAddress: contract.contractAddress });
          await ContractToken_highX.deleteOne({ contractAddress: contract.contractAddress });
          console.log(`Deleted Expired contract Token highX: ${contract.tokenName}`);
      }
      console.log('All Expired contracts deleted highX');
  } catch (error) {
    console.error('Error looping through and deleting Expired contracts highX:', error);
    throw error;
  }
}

module.exports = {pushOHLCV_DB_highX, pushToken_DB_highX, updateToken_DB_highX, updateOHLCV_DB_highX, clearbuySignalTokens_highX, checkTokenInDB_highX, deleteOldTokens_highX, loadTokens_highX, updateBuySignal_DB_highX, updatePreBuy_DB_highX, updateBuy_DB_highX, updateSell1_DB_highX, updateSell2_DB_highX, updateSell3_DB_highX, updateSell4_DB_highX, isExpired_highX, loopThroughAndDeleteExpired_highX};