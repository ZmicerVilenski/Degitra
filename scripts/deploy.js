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

  if (process.env.VERIFY_ON_ETHERSCAN) {
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
  // TRANSFER_OWNERSHIP
  const newOwner = process.env.NEW_OWNER;
  if (process.env.TRANSFER_OWNERSHIP) {
    await token.grantAdminRole(newOwner);
    console.log(`Admin role for Token contract granted to: ${newOwner}`);
    const amount = token.balanceOf(process.env.DEPLORER_ADDR);
    await token.transfer(newOwner, amount);
    console.log(`Send: ${amount} tokens to: ${newOwner}`);
  }


  // DEPLOY VESTING
  const Vesting = await hre.ethers.getContractFactory("Vesting");
  const vesting = await Vesting.deploy(token.address);
  await vesting.deployed();
  console.log(`Vesting deployed to ${vesting.address}`);

  if (process.env.VERIFY_ON_ETHERSCAN) {
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
  // TRANSFER_OWNERSHIP
  if (process.env.TRANSFER_OWNERSHIP) {
    await token.grantAdminRole(newOwner);
    console.log(`Admin role for Vesting contract granted to: ${newOwner}`);
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
