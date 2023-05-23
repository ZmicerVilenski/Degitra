const hre = require("hardhat");
require('dotenv').config();

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {

  // DEPLOY TOKEN
  const name = "Digitra.com";
  const symbol = "DGTA";
  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy(name, symbol);
  await token.deployed();
  console.log(`Token deployed to ${token.address}`);

  const verify = (process.env.VERIFY_ON_ETHERSCAN.toLowerCase() === 'true');
  if (verify) {
    // PAUSE
    console.log(`Pause 30 sec...`)
    await timeout(30000);
    // VERIFY on ETHERSCAN
    console.log(`Verifying Token on Etherscan...`);
    try {
      await hre.run(`verify:verify`, {
        address: token.address,
        constructorArguments: [name, symbol],
      });
    } catch (error) {
        console.error('error: ', error);
    }
  }
  // TRANSFER_TOKENS
  const newOwner = process.env.NEW_OWNER;
  const amountForOwner = '450000000000000';
  await token.transfer(newOwner, amountForOwner);
  console.log(`Send: ${amountForOwner} tokens to: ${newOwner}`);


  // DEPLOY VESTING
  const Vesting = await hre.ethers.getContractFactory("TokenVesting");
  const vesting = await Vesting.deploy(token.address);
  await vesting.deployed();
  console.log(`Vesting deployed to ${vesting.address}`);
  // TRANSFER_TOKENS
  const amountForVesting = '29550000000000000';
  await token.transfer(vesting.address, amountForVesting);
  console.log(`Send: ${amountForVesting} tokens to: ${vesting.address}`);
  //
  if (verify) {
    // PAUSE
    console.log(`Pause 30 sec...`)
    await timeout(30000);
    // VERIFY on ETHERSCAN
    console.log(`Verifying Vesting on Etherscan...`);
    try {
      await hre.run(`verify:verify`, {
        address: vesting.address,
        constructorArguments: [token.address],
      });
    } catch (error) {
        console.error('error: ', error);
    }
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
