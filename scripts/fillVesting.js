require('dotenv').config();

const fs = require('fs');
const YAML = require('yaml');
const BigDecimal = require('js-big-decimal');

const Web3 = require('web3');
const Provider = require('@truffle/hdwallet-provider');

const Vesting = require('../build/contracts/Vesting.json');
const Token = require('../build/contracts/MFToken.json');

const vestingAddress = process.env.VESTING_ADDRESS;
if (!vestingAddress || vestingAddress === '') throw new Error('Vesting address missing.');

let web3, provider, accounts, vesting, token, phases;

const loadContracts = async () => {
    accounts = await web3.eth.getAccounts();
    vesting = new web3.eth.Contract(Vesting.abi, vestingAddress);

    const tokenAddress = await vesting.methods.getToken().call();
    token = new web3.eth.Contract(Token.abi, tokenAddress);

    console.log(`Account: \x1b[36m${accounts[0]}\x1b[0m`);
    console.log(`Token address: \x1b[36m${tokenAddress}\x1b[0m`);
};

const loadVestingData = async () => {
    const file = fs.readFileSync('./vesting.yml').toString();
    const data = YAML.parse(file);
    phases = data.phases;
    console.log(`\x1b[34mRounds amount:\x1b[0m ${phases.length}`);
};

const checkPhaseExistence = async (phaseID) => {
    const phase = await vesting.methods.getVestingPhase(phaseID).call();
    return phase.start !== '0' ||
           phase.duration !== '0' ||
           phase.cliff !== '0' ||
           phase.cliffPercent !== '0' ||
           phase.slicePeriodSeconds !== '0' ||
           phase.phaseName !== '';
};

const checkInvestorExistence = async (phaseID, investorAddress) => {
    const schedules = await vesting.methods.getScheduleArrayByInvestor(investorAddress).call();
    for (schedule of schedules) if (parseInt(schedule.phaseID) === phaseID) return true;
    return false;
};

const addPhase = async (phaseID, start, duration, cliff, cliffPercent, slice, phaseName) => {
    if (await checkPhaseExistence(phaseID)){
        console.log(`Phase ${phaseID} (${phaseName}) is \x1b[32mexisted\x1b[0m. Initialization skipped.`);
        return;
    }

    console.log(`Phase ${phaseID} (${phaseName}) is \x1b[1;31mnot\x1b[0m existed. Initializing...`);

    const gas = await vesting.methods.createVestingPhase(phaseID, start, duration, cliff, cliffPercent, slice, phaseName).estimateGas({ from: accounts[0] });
    console.log(`Vesting Phase ${phaseID} (${phaseName}) gas: `, gas);

    const result = await vesting.methods.createVestingPhase(phaseID, start, duration, cliff, cliffPercent, slice, phaseName).send({from: accounts[0], gasLimit: 300000});
    console.log(`Vesting Phase ${phaseID} (${phaseName}) initialization result: `, result);
};

const addInvestor = async (investor, totalInvestorAmount, cliffPercent, phaseID) => {
    if (await checkInvestorExistence(phaseID, investor)){
        console.log(`Investor \x1b[36m${investor}\x1b[0m is \x1b[32malready in Vesting Phase\x1b[0m. Skipped.`);
        return;
    }

    console.log(`Investor \x1b[36m${investor}\x1b[0m is \x1b[1;31mnot\x1b[0m existed. Creating...`);

    totalInvestorAmount = web3.utils.toWei(String(totalInvestorAmount));
    const gas = await vesting.methods.addInvestor(investor, totalInvestorAmount, cliffPercent, phaseID).estimateGas({ from: accounts[0] });
    console.log('Adding investor gas: ', gas);

    const result = await vesting.methods.addInvestor(investor, totalInvestorAmount, cliffPercent, phaseID).send({from: accounts[0], gasLimit: 300000});
    console.log(`\x1b[32mNew investor added:\x1b[0m \x1b[36m${investor}\x1b[0m/\x1b[33m${BigInt(totalInvestorAmount)} MFT\x1b[0m (txhash: \x1b[1;35m${result.transactionHash}\x1b[0m)`);
};

// Fill vesting balance from a balance of token owner - accounts[0]
const transferTokenBalance = async () => {
    let ownerBalance = await token.methods.balanceOf(accounts[0]).call();
    let vestingContractBalance = await token.methods.balanceOf(vestingAddress).call();

    console.log('Before - Vesting Contract balance: ', BigInt(vestingContractBalance));
    console.log('Before - Token Owner balance: ', BigInt(ownerBalance));

    if (BigInt(vestingContractBalance) == 0) {
        console.log('Calculating all balances...');

        let vestingBalance = new BigDecimal(0);
        for (let phase of phases)
            for (let investor of phase.accounts)
                vestingBalance = vestingBalance.add(new BigDecimal(investor.tokens));

        console.log(`Vesting total amount: \x1b[33m${vestingBalance.getValue()}\x1b[0m`);

        const amount = web3.utils.toWei(vestingBalance.getValue());
        console.log(`Vesting amount in wei: \x1b[33m${amount}\x1b[0m`);

        await token.methods.transfer(vestingAddress, amount).send({ from: accounts[0] });

        vestingContractBalance = await token.methods.balanceOf(vestingAddress).call();
        ownerBalance = await token.methods.balanceOf(accounts[0]).call();
    }

    console.log('After - Vesting Contract balance:  ', BigInt(vestingContractBalance));
    console.log('After - Token Owner balance:  ', BigInt(ownerBalance));
};

const fillInvestors = async () => {
    for (let phase of phases) {
        const phaseIndex = phase.phase_index,
              roundName = phase.round_name;

        console.log(`Processing phase: ${phaseIndex} (${roundName}).`);

        const startDate = new Date(phase.starting_at).getTime() / 1000,
              cliffInterval = phase.cliff.delay * 60,
              cliffPercent = phase.cliff.percent * 10,
              sliceInterval = phase.slice.interval * 60;
        const roundDuration = sliceInterval * phase.slice.periods;

        await addPhase(phaseIndex, startDate, roundDuration, cliffInterval, cliffPercent, sliceInterval, roundName);

        for (let investor of phase.accounts) {
            const { address, tokens } = investor;
            await addInvestor(address, tokens, cliffPercent, phaseIndex);
        }
    };
};

(async () => {
    const provider = new Provider({
        privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
        providerOrUrl: `${ process.env.NETWORK_URL }:${ process.env.NETWORK_PORT }`
    });

    web3 = new Web3(provider);
    await loadContracts();
    loadVestingData();

    await transferTokenBalance();
    await fillInvestors();

    console.log('Done');
    process.kill(process.pid, 'SIGTERM');
})();
