const mongoose = require('mongoose');
const {ContractOHLCV_highX, ContractToken_highX} = require('./contract_ohlcv');
const fs = require('fs');
const { Parser } = require('json2csv');
const moment = require('moment');

// Replace with your MongoDB connection string
const mongoURI = 'mongodb://localhost:27017/dipBotDB';

async function connectToDatabase() {
    try {
        await mongoose.connect(mongoURI, {});
        console.log('Connected to the database');
    } catch (error) {
        console.error('Error connecting to the database', error);
        process.exit(1);
    }
}

async function loopThroughAndDelete() {
    await connectToDatabase();
    
    //highX deleting
    try {
        const contracts = await ContractOHLCV_highX.find({}); // Fetch all contracts
        const contracts1 = await ContractToken_highX.find({});
        if (contracts.length === 0 && contracts1.length === 0) {
            console.log('highX No contracts found.');
            return;
        }

        for (let contract of contracts) {
            // Print details
            console.log('highX Contract OHLCV details:');
            console.log(`highX Creation Date: ${contract.creationDate}, CA: ${contract.contractAddress}, Token: ${contract.tokenName}, OHLCV len: ${contract.OHLCV.length}`);
            const data = contract.OHLCV
            // Delete the contract
            await ContractOHLCV_highX.findByIdAndDelete(contract._id);
            console.log('highX Deleted contract');
        }

        console.log('highX All contracts deleted');
    } catch (error) {
        console.error('highX Error looping through and deleting contracts:', error);
    }
    try {
        const contracts = await ContractToken_highX.find({}); // Fetch all contracts

        if (contracts.length === 0) {
            console.log('highX No contracts found.');
            return;
        }

        for (let contract of contracts) {
            // Print details
            console.log('highX Contract Token details:');
            console.log(`highX lastProcessedTime: ${contract.lastProcessedTime}, CA: ${contract.contractAddress}, Token: ${contract.tokenName}, CVWAP: ${contract.CVWAP}`);

            // Delete the contract
            await ContractToken_highX.findByIdAndDelete(contract._id);
            console.log('highX Deleted contract');
        }

        console.log('highX All contracts deleted');
    } catch (error) {
        console.error('highX Error looping through and deleting contracts:', error);
    }finally {
        mongoose.connection.close();
    }
}

function normalizeOHLCVEntries(ohlcvEntries) {
    return ohlcvEntries.flatMap(entry => (Array.isArray(entry) ? entry : [entry]));
}

async function fetchOHLCVData_CSV(tokenName, contractAddress) {
    try {
        const contract = await ContractOHLCV_highX.findOne({ contractAddress });

        if (!contract) {
            console.log(`No contract found with address ${contractAddress}`);
            return;
        }
        const ohlcvData = normalizeOHLCVEntries(contract.OHLCV);
        // Check for the presence of avwap and cvwap in any entry
        const containsAvwap = ohlcvData.some(entry => 'Avwap' in entry);
        const containsCvwap = ohlcvData.some(entry => 'Cvwap' in entry);

        const fields = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
        if (containsAvwap) fields.push('avwap');
        if (containsCvwap) fields.push('cvwap');

        const data = ohlcvData.map(entry => {
            let rowData = {
                timestamp: moment(new Date(entry.unixTime * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                open: entry.o,
                high: entry.h,
                low: entry.l,
                close: entry.c,
                volume: entry.v,
            };

            if (containsAvwap) rowData.avwap = entry.Avwap || '';
            if (containsCvwap) rowData.cvwap = entry.Cvwap || '';

            return rowData;
        });

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        fs.writeFileSync(`/home/nithilan/Downloads/Telegram Desktop/ChatExport_2024-06-29/ohlcv_js/${tokenName}_${contractAddress}.csv`, csv);
        console.log(`CSV file has been saved for contract address ${contractAddress}`);
    } catch (error) {
        console.error('Error fetching OHLCV data:', error);
    }
}

function convertDateString(dateString) {
    // Create a Date object from the input string
    const date = new Date(dateString);

    // Extract individual components
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Format the date and time components
    const formattedDate = `${day}.${month}.${year}`;
    const formattedTime = `${hours}:${minutes}:${seconds}`;

    // Combine the date, time, and JST
    const formattedDateTime = `${formattedDate} ${formattedTime} JST`;

    return formattedDateTime;
}

async function loopThroughAndCSVWrite() {
    await connectToDatabase();

    try {
        const contracts = await ContractOHLCV_highX.find({}); // Fetch all contracts

        if (contracts.length === 0) {
            console.log('No contracts found.');
            return;
        }
        for (let contract of contracts) {
            // Print details
            console.log('Contract OHLCV details:');
            console.log(`Creation Date: ${contract.creationDate}, CA: ${contract.contractAddress}, Token: ${contract.tokenName}, OHLCV len: ${contract.OHLCV.length}`);
            
            // Fetch OHLCV data and write to CSV
            await fetchOHLCVData_CSV(contract.tokenName, contract.contractAddress);
        }

        const csvData = contracts.map(contract => ({
            date: convertDateString(contract.signalDate),
            token_name: contract.tokenName,
            token_address: contract.contractAddress,
            pool_address: contract.pairAddress
        }));

        const csvRows = [
            ['date', 'token_name', 'token_address', 'pool_address'], // CSV header
            ...csvData.map(row => [row.date, row.token_name, row.token_address, row.pool_address])
        ].map(row => row.join(',')).join('\n'); // Join rows with tab separator and newline

        fs.writeFileSync('/home/nithilan/Downloads/Telegram Desktop/ChatExport_2024-06-29/tokens_live_run.csv', csvRows, 'utf8');
        console.log('All contracts saved');
        console.log('Total number of tokens in DB: ', contracts.length);
    } catch (error) {
        console.error('Error looping through and csv saving contracts:', error);
    } finally {
        mongoose.connection.close();
    }
}

async function test_TG_BuySignal(contractAddress){
    try {
        const updateResult = await ContractToken_highX.updateOne(
          { contractAddress: contractAddress }, // Filter condition
          { $set: { BuySignal: true }});
  
        if (updateResult.modifiedCount > 0) {
            console.log(`Buysignal set for Token ${contractAddress} in DB`);
        } else {
            console.error(`Error setting Buysignal for Token, ${contractAddress} not found or no updates applied`);
        }
    } catch (error) {
        console.error(`Error setting Buysignal for token ${contractAddress}:`, error);
    }
  }


async function test_function(){
    await connectToDatabase();
    await test_TG_BuySignal("6YTxumzmiUpeuKGc3AdxJPvXqEu8AhGCRtPeNNfTpump");
}



//loopThroughAndCSVWrite();
loopThroughAndDelete();
//test_function();