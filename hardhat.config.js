require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config();
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {

  solidity: "0.8.18",

  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + process.env.INFURA_ID,
      accounts: [process.env.PRIVATE_KEY],
    },
    mainnet: {
      url: "https://mainnet.infura.io/v3/" + process.env.INFURA_ID,
      accounts: [process.env.PRIVATE_KEY],
    },
  },

  etherscan:{
    apiKey: process.env.ETHERSCAN_API_KEY
  },

  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: process.env.COIN_MARKET_CAP,
  },

};
