# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```

1. Before deploy in mainnet fill variables in .env file:
VERIFY_ON_ETHERSCAN=true
TRANSFER_OWNERSHIP=true

2. Deploy & Verify with new deploy-script

```shell
npx hardhat run scripts/deploy.js --network sepolia
```

3. Fill variable - VESTING_ADDRESS in .env file

4. Add vesting schedules in to Vesting contract

```shell
npx hardhat run --network sepolia ./scripts/fillVesting.js
```