const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
require('dotenv').config();
const fs = require('fs');
const YAML = require('yaml');
const { table } = require("console");

describe("\n\n\n -= 2. Digitra Token & Vesting. Testing a case where investors will claim tokens randomly. Not following the schedule.", function () {

  let token, vesting, phases, admin, accounts, arrVestingPhases = [];
  const decimals = '00000000';

  async function deploy() {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Digitra.com", 'DGTA');
    const Vesting = await ethers.getContractFactory("TokenVesting");
    vesting = await Vesting.deploy(token.address);  
  }

  const loadVestingDataFromYaml = async () => {
    const file = fs.readFileSync('./scripts/vesting.yml').toString();
    const data = YAML.parse(file);
    phases = data.phases;
    console.log(`      \x1b[34mRounds amount:\x1b[0m ${phases.length}`);
  };

  const addSchedules = async () => {
    var i = 0;
    for (let phase of phases) {
      i++;
      const phaseName = phase.round_name;
      const amountTotal = phase.amountTotal + decimals, 
            amountAfterCliff = phase.amountAfterCliff + decimals;
      const tx = await vesting.createVestingSchedule(accounts[i].address, phase.durationDays, phase.cliffDays, amountTotal, amountAfterCliff);
      // console.log(`      Phase (${phaseName}) tx.hash: `, tx.hash);

      arrVestingPhases.push({beneficiary: accounts[i].address, durationDays: phase.durationDays, cliffDays: phase.cliffDays, amountTotal: amountTotal, amountAfterCliff: amountAfterCliff, phaseName: phaseName});

    };
  };

  describe("Deployment, fill Vesting balance", function () {

    it("Reset network", async function () {
      await hre.network.provider.send("hardhat_reset");
      await loadFixture(deploy);
    });

    it("Should get the right balances", async function () {
      const amount = '295500000' + decimals; // 295 500 000 Tokens with 8 decimals
      await token.transfer(vesting.address, amount);
      expect(await token.balanceOf(vesting.address)).to.equal(amount);
    });

  });

  describe("Fill vesting phases", function () {

    it("Load data", async function () {
      loadVestingDataFromYaml();
      addSchedules();      
    });

  });

  describe("Claim", function () {

    // accounts[1] // - Long-term reserve     - cliffDays: 30 - amountTotal: "74 668 025" - amountAfterCliff: "2 196 118" - end date: 04.28.2026
    // accounts[2] // - Private Sale (Seed)   - cliffDays: 0  - amountTotal: " 6 428 571" - amountAfterCliff: "  714 286" - end date: 04.28.2025
    // accounts[3] // - Public Sale (Up to)   - cliffDays: 0  - amountTotal: " 3 600 000" - amountAfterCliff: "  900 000" - end date: 09.28.2023
    // accounts[4] // - New Clients Incentive - cliffDays: 0  - amountTotal: "27 710 000" - amountAfterCliff: "4 890 000" - end date: 04.28.2025
    // accounts[5] // - Trade-to-Earn Airdrop - cliffDays: 0  - amountTotal: "23 114 400" - amountAfterCliff: "5 778 600" - end date: 04.28.2025
    // accounts[6] // - Marketing & Liquidity - cliffDays: 0  - amountTotal: "51 000 000" - amountAfterCliff: "9 000 000" - end date: 04.28.2025
    // accounts[7] // - Team incentives       - cliffDays: 30 - amountTotal: "58 983 051" - amountAfterCliff: "1 016 949" - end date: 04.28.2028
    // accounts[8] // - Ecosystem Growth      - cliffDays: 30 - amountTotal: "28 695 652" - amountAfterCliff: "1 304 348" - end date: 04.28.2025
    // accounts[9] // - Not investor

    it("Claim randomly for all vesting period (5y).", async function () {

      await time.increaseTo(1685232000); // Sun May 28 2023 00:00:00 GMT+0000

      let nexDate = await time.latest();
      finishDate = 1840579200; // 	Sat Apr 29 2028 00:00:00 GMT+0000
      while (nexDate < finishDate) {

        const randMonthIncr = Math.floor(Math.random() * 11) + 1; // 1 - 12
        const randInvestNum = Math.floor(Math.random() * arrVestingPhases.length); // 0-arrVestingPhases.length 

        tableArr = [];
        paseArr = [];
        for (var i = 0; i <= randInvestNum; i++) {
          let randPhaseNum = Math.floor(Math.random() * arrVestingPhases.length); // 0-arrVestingPhases.length
          if (paseArr.includes(randPhaseNum)) {
            i--;
            continue;      
          }
          paseArr.push(randPhaseNum);
          const phase = arrVestingPhases[randPhaseNum];
          try {          
            await vesting.connect(accounts[randPhaseNum+1]).claim(); // i+1 because 0 is admin account
          } catch (error) {}
          let balance = Number(await token.balanceOf(phase.beneficiary)) / 100000000;
          balance = balance.toFixed(0);
          tableArr.push({phaseName: phase.phaseName, balance: balance});  
        }

        const timestamp = await time.latest();
        console.log(new Date(timestamp*1000));
        console.table(tableArr);

        await time.increase(randMonthIncr * 30 * 86400);
        nexDate = await time.latest();

      }

      // At the end must be called claim() for all accounts at (nexDate) date; nexDate > finishDate because loop while
      for (let i = 0; i < arrVestingPhases.length; i++) {
        const phase = arrVestingPhases[i];
        try {          
          await vesting.connect(accounts[i+1]).claim(); // i+1 because 0 is admin account
        } catch (error) {} 
      }

    });

    it("Should get the right balances at the end", async function () {

      expect(await token.balanceOf(admin.address)).to.equal('4500000' + decimals);
      expect(await token.balanceOf(vesting.address)).to.equal(0);

      tableArr = [];
      for (let i = 0; i < arrVestingPhases.length; i++) {
        const phase = arrVestingPhases[i];
        let amount = parseInt(phase.amountAfterCliff) + parseInt(phase.amountTotal);
        amount = amount.toString();
        expect(await token.balanceOf(phase.beneficiary)).to.equal(amount); 
        let balance = Number(await token.balanceOf(phase.beneficiary)) / 100000000;
        balance = balance.toFixed(0);
        tableArr.push({phaseName: phase.phaseName, balance: balance}); 
      }

      console.log(`\x1b[33mFinal balances:\x1b[0m`);
      console.log(`Admin: \x1b[32m${await token.balanceOf(admin.address)}\x1b[0m`);
      console.log(`Vesting: \x1b[32m${await token.balanceOf(vesting.address)}\x1b[0m`);
      console.log(`Investors: \x1b[32m`);
      console.table(tableArr);
      console.log(`\x1b[0m `);

    });

  });
    
});
