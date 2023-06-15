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

describe("\n\n\n -= 1. Digitra Token & Vesting. Testing a case where investors will claim tokens every month on time.", function () {

  let token, vesting, phases, admin, accounts, arrVestingPhases = [];
  const decimals = '00000000';
  const startTimestamp = 1688169600; // Sat Jul 01 2023 00:00:00 GMT+0000

  async function deploy() {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Digitra.com", 'DGTA');
    const Vesting = await ethers.getContractFactory("TokenVesting");
    vesting = await Vesting.deploy(token.address, startTimestamp);
    await token.approve(vesting.address, await token.totalSupply());
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
      console.log(`      Phase (${phaseName}) tx.hash: `, tx.hash);

      arrVestingPhases.push({ beneficiary: accounts[i].address, durationDays: phase.durationDays, cliffDays: phase.cliffDays, amountTotal: amountTotal, amountAfterCliff: amountAfterCliff, phaseName: phaseName });

    };
  };

  describe("Deployment, fill the balances, check setters and getters", function () {

    it("Check Token address", async function () {
      await loadFixture(deploy);
      // expect(await vesting.tokenAddress()).to.equal(token.address);
      const timestamp = await time.latest();
      console.log('1.', new Date(timestamp * 1000));
    });

    it("Should get the right balances", async function () {
      const amount = '295500000' + decimals; // 295 500 000 Tokens with 8 decimals (300 - 4.5 mln)
      expect(await token.balanceOf(admin.address)).to.equal('300000000' + decimals);
      expect(await token.balanceOf(vesting.address)).to.equal(0);
      // await token.transfer(vesting.address, amount);
      // expect(await token.balanceOf(admin.address)).to.equal('4500000' + decimals);
      // expect(await token.balanceOf(vesting.address)).to.equal(amount);
    });

  });

  describe("Fill vesting phases", function () {

    it("Load data", async function () {
      // await loadFixture(loadVestingDataFromYaml);
      // await loadFixture(addSchedules);      
      loadVestingDataFromYaml();
      addSchedules();
    });

    // it("Admin/Not admin withdraw", async function () {

    //   // Admin
    //   await vesting.withdraw('1' + decimals);
    //   expect(await token.balanceOf(admin.address)).to.equal('4500001' + decimals);
    //   expect(await token.balanceOf(vesting.address)).to.equal('295499999' + decimals);
    //   // Not admin
    //   await expect(vesting.connect(accounts[1]).withdraw('1')).to.be.revertedWith("TokenVesting: Caller is not an admin");

    //   await token.transfer(vesting.address, '1' + decimals);

    // });

  });

  describe("Check Withdrawable amount", function () {

    // accounts[1] - Long-term reserve     - cliffDays: 30 - amountTotal: "74 668 025" - amountAfterCliff: "2 196 118"
    // accounts[2] - Private Sale (Seed)   - cliffDays: 0  - amountTotal: " 6 428 571" - amountAfterCliff: "  714 286"
    // accounts[3] - Public Sale (Up to)   - cliffDays: 0  - amountTotal: " 3 600 000" - amountAfterCliff: "  900 000"
    // accounts[4] - New Clients Incentive - cliffDays: 0  - amountTotal: "27 710 000" - amountAfterCliff: "4 890 000"
    // accounts[5] - Trade-to-Earn Airdrop - cliffDays: 0  - amountTotal: "23 114 400" - amountAfterCliff: "5 778 600"
    // accounts[6] - Marketing & Liquidity - cliffDays: 0  - amountTotal: "51 000 000" - amountAfterCliff: "9 000 000"
    // accounts[7] - Team incentives       - cliffDays: 30 - amountTotal: "58 983 051" - amountAfterCliff: "1 016 949"
    // accounts[8] - Ecosystem Growth      - cliffDays: 30 - amountTotal: "28 695 652" - amountAfterCliff: "1 304 348"


    // it("getVestingSchedule", async function () {
    //   for (var i = 0; i < arrVestingPhases.length; i++) {
    //     const invest = arrVestingPhases[i].beneficiary;
    //     const schedule = await vesting.getVestingSchedule(invest);     
    //     console.log(`Vesting schedule for investor: ${invest} = ${schedule}`);  
    //   }
    //   // console.log(arrVestingPhases);
    // });

    it("Releasable amount befor vesting start", async function () {
      for (var i = 0; i < arrVestingPhases.length; i++) {
        const invest = arrVestingPhases[i].beneficiary;
        expect(await vesting.computeReleasableAmount(invest)).to.equal(0);
      }
    });

    it("Releasable amount after vesting start. Before 1st cliff.", async function () {

      await time.increaseTo(startTimestamp);

      for (var i = 0; i < arrVestingPhases.length; i++) {
        const phase = arrVestingPhases[i];
        let amount = 0;
        if (!phase.cliffDays) {
          amount = phase.amountAfterCliff;
        }
        expect(await vesting.computeReleasableAmount(phase.beneficiary)).to.equal(amount);
      }

    });

    // it("computeReleasableAmount", async function () {
    //   for (var i = 0; i < arrVestingPhases.length; i++) {
    //     const invest = arrVestingPhases[i].beneficiary;
    //     const releasAmount = await vesting.computeReleasableAmount(invest);     
    //     console.log(`Releasable amount for investor: ${invest} = ${releasAmount}`); 
    //   }
    // });

  });

  describe("Claim", function () {

    it("Claim after cliff. 1 day.", async function () {

      tableArr = [];
      for (var i = 0; i < arrVestingPhases.length; i++) {
        const phase = arrVestingPhases[i];
        let amount = 0;
        if (phase.cliffDays) {
          await expect(vesting.connect(accounts[i + 1]).claim()).to.be.revertedWith("TokenVesting: nothing to claim"); // i+1 because 0 is admin account
        } else {
          amount = phase.amountAfterCliff;
          await vesting.connect(accounts[i + 1]).claim(); // i+1 because 0 is admin account
        }
        const bal = await token.balanceOf(phase.beneficiary);
        expect(bal).to.equal(amount);

        let balance = Number(bal) / 100000000;
        balance = balance.toFixed(0);
        tableArr.push({ phaseName: phase.phaseName, balance: balance });
      }

      // Claim from not investor account
      await expect(vesting.connect(accounts[9]).claim()).to.be.revertedWith("TokenVesting: only investors can claim");

      const timestamp = await time.latest();
      console.log(new Date(timestamp * 1000));
      console.table(tableArr);

    });

    it("Claim for next 5 years.", async function () {

      // 60 = 5 years
      for (var month = 1; month < 60; month++) {

        await time.increase(30 * 86400);

        tableArr = [];
        for (var i = 0; i < arrVestingPhases.length; i++) {
          const phase = arrVestingPhases[i];
          // try {          
          if (phase.durationDays / 30 >= month) {
            await vesting.connect(accounts[i + 1]).claim(); // i+1 because 0 is admin account
          }
          // } catch (error) {

          // }

          let balance = Number(await token.balanceOf(phase.beneficiary)) / 100000000;
          balance = balance.toFixed(0);
          tableArr.push({ phaseName: phase.phaseName, balance: balance });
        }

        const timestamp = await time.latest();
        console.log(new Date(timestamp * 1000));
        console.table(tableArr);

      }

    });

    it("Should get the right balances at the end", async function () {
      expect(await token.balanceOf(admin.address)).to.equal('4500000' + decimals);
      expect(await token.balanceOf(vesting.address)).to.equal(0);
    });

  });

});
