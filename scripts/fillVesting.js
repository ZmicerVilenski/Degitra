require('dotenv').config();
const fs = require('fs');
const YAML = require('yaml');
const BigDecimal = require('js-big-decimal');

const vestingAddress = process.env.VESTING_ADDRESS;
if (!vestingAddress || vestingAddress === '') throw new Error('Vesting address missing.');

let accounts, vesting, token, phases;


const loadContracts = async () => {

    accounts = await ethers.provider.listAccounts();
    vesting = await hre.ethers.getContractAt("TokenVesting", vestingAddress);
    const tokenAddress = await vesting.tokenAddress();
    token = await hre.ethers.getContractAt("Token", tokenAddress);

    console.log(`Account: \x1b[36m${accounts[0]}\x1b[0m`);
    console.log(`Token address: \x1b[36m${tokenAddress}\x1b[0m`);
    console.log(`Vesting address: \x1b[36m${vestingAddress}\x1b[0m`);

};


const loadVestingDataFromYaml = async () => {
    const file = fs.readFileSync('./scripts/vesting.yml').toString();
    const data = YAML.parse(file);
    phases = data.phases;
    console.log(`\x1b[34mRounds amount:\x1b[0m ${phases.length}`);
};


const checkPhaseExistence = async (beneficiary) => {
    const phase = await vesting.getVestingSchedule(beneficiary);
    return phase.durationDays !== 0    
};


const addSchedules = async () => {

    for (let phase of phases) {

        const phaseName = phase.round_name;
        console.log(`\x1b[35m=== Processing phase: (${phaseName}). ===\x1b[0m`);
        const amountTotal = phase.amountTotal, 
              amountAfterCliff = phase.amountAfterCliff;

        if (await checkPhaseExistence(phase.beneficiary)) {
            console.log(`    Vesting Phase (${phaseName}) exist`);
        } else {
            const gas = await vesting.estimateGas.createVestingSchedule(phase.beneficiary, phase.durationDays, phase.cliffDays, amountTotal, amountAfterCliff);
            const tx = await vesting.createVestingSchedule(phase.beneficiary, phase.durationDays, phase.cliffDays, amountTotal, amountAfterCliff);
            console.log(`    Vesting Phase (${phaseName}) initialization tx.hash: ${tx.hash}. Gas: ${gas}`);
        }

    };

    console.log(` `);

};


const transferTokensToVestingBalance = async () => {

    let ownerBalance = await token.balanceOf(accounts[0]);
    let vestingBalance = await token.balanceOf(vestingAddress);

    if (BigInt(vestingBalance) == 0) {

        console.log('Before - Vesting balance: ', BigInt(vestingBalance));
        console.log('Before - Token balance: ', BigInt(ownerBalance));
        
        console.log('Calculating all balances...');
        let expectedVestingBalance = new BigDecimal(0);
        for (let phase of phases)
            expectedVestingBalance = expectedVestingBalance.add(new BigDecimal(phase.amountTotal));

        console.log(`Vesting total amount: \x1b[33m${expectedVestingBalance.getValue()}\x1b[0m`);
        const amount = expectedVestingBalance.getValue().toString() + '00000000';
        console.log(`Vesting amount in wei: \x1b[33m${amount}\x1b[0m`);

        await token.transfer(vestingAddress, amount);

        vestingBalance = await token.balanceOf(vestingAddress);
        ownerBalance = await token.balanceOf(accounts[0]);

        console.log('After - Vesting balance:  ', BigInt(vestingBalance));
        console.log('After - Owner balance:  ', BigInt(ownerBalance));
    }

    console.log('Vesting balance:  ', BigInt(vestingBalance));
    console.log('Owner balance:  ', BigInt(ownerBalance));

};


(async () => {

    console.log('\x1b[31m----------------------------------------------------------------------------\x1b[0m');
    await loadContracts();
    await loadVestingDataFromYaml();
    await addSchedules();
    await transferTokensToVestingBalance();

    console.log('\x1b[31m----------------------------------------------------------------------------\x1b[0m');
    console.log('\x1b[32mDone\x1b[0m');
    process.kill(process.pid, 'SIGTERM');

})();
