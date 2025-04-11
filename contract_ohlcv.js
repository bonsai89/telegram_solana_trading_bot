const mongoose = require('mongoose');

const { originalConsole } = require('./logger');

// Define your Mongoose schema
const contractSchemaOHLCV = new mongoose.Schema({
    signalDate: String, 
    creationDate: String, 
    tokenName: String, 
    contractAddress: String, 
    pairAddress: String, 
    pctVWAP: String,
    pctProfit: String,
    OHLCV: Array,
});

const contractSchemaToken = new mongoose.Schema({
    signalDate: String, 
    lastProcessedTime: String, 
    creationDate: String, 
    tokenName: String, 
    contractAddress: String, 
    pairAddress: String, 
    pctProfit: String,
    CVWAP: Number,
    AVWAP: Number,
    Total_volume: Number,
    Total_volume_avwap: Number,
    Tradeable: { type: Boolean, default: false },
    Expired: { type: Boolean, default: false },
    PreBuy: { type: Boolean, default: false },
    Buy: { type: Boolean, default: false },
    Sell1: { type: Boolean, default: false },
    Sell2: { type: Boolean, default: false },
    Sell3: { type: Boolean, default: false },
    Sell4: { type: Boolean, default: false },
    BuySignal: { type: Boolean, default: false },
    PreBuyTime: Number,
    BuyPrice: Number,
    First: { type: Boolean, default: true },
});


// For highX approach
const ContractOHLCV_highX = mongoose.model('ContractOHLCV_highX', contractSchemaOHLCV, 'contract_ohlcv_highX');
const ContractToken_highX = mongoose.model('ContractToken_highX', contractSchemaToken, 'contract_token_highX');

module.exports = {ContractOHLCV_highX, ContractToken_highX}; // Export the model for use in other parts of your application

