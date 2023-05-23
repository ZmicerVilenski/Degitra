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
  
  describe("Digitra Token & Vesting. Additiona tests.", function () {
  
    let token, vesting, admin, accounts, arrVestingPhases = [];
    const decimals = '00000000';
  
    async function deploy() {
      accounts = await ethers.getSigners();
      admin = accounts[0];
      const Token = await ethers.getContractFactory("Token");
      token = await Token.deploy("Digitra.com", 'DGTA');
      const Vesting = await ethers.getContractFactory("TokenVesting");
      vesting = await Vesting.deploy(token.address);  
    }
  
    describe("Deployment, fill the balances, check setters and getters", function () {
  
      it("Reset network", async function () {
        await hre.network.provider.send("hardhat_reset");
        await loadFixture(deploy);
      });

      it("Check Token address", async function () {
        expect(await vesting.tokenAddress()).to.equal(token.address);
      });
  
      it("Should get the right balances", async function () {
        const amount = '300000000' + decimals; // 300 000 000 Tokens with 8 decimals
        expect(await token.balanceOf(admin.address)).to.equal(amount);
        expect(await token.balanceOf(vesting.address)).to.equal(0);
        await token.transfer(vesting.address, amount);
        expect(await token.balanceOf(admin.address)).to.equal(0);
        expect(await token.balanceOf(vesting.address)).to.equal(amount);
      });
  
    });
  
    describe("Fill vesting phases", function () {
  
      it("Load data", async function () {
        
        const amountTotal = '500' + decimals, // Total - cliff
            amountAfterCliff = '500' + decimals, // After cliff
            durationDays = 90,
            cliffDays = 30;
        const tx = await vesting.createVestingSchedule(accounts[1].address, durationDays, cliffDays, amountTotal, amountAfterCliff);
        console.log(`      Phase (Test) tx.hash: `, tx.hash);
    
        arrVestingPhases.push({beneficiary: accounts[1].address, durationDays: durationDays, cliffDays: cliffDays, amountTotal: amountTotal, amountAfterCliff: amountAfterCliff, phaseName: 'Test'});

      });
  
    });
  
    describe("Check Withdrawable amount", function () {

      it("Releasable amount befor vesting start", async function () {
        for (var i = 0; i < arrVestingPhases.length; i++) {
          const invest = arrVestingPhases[i].beneficiary;
          expect(await vesting.computeReleasableAmount(invest)).to.equal(0);  
        }
      });
  
      it("Releasable amount after vesting start. Before 1st cliff.", async function () {
        await time.increaseTo(1685232000); // Sun May 28 2023 00:00:00 GMT+0000
        for (var i = 0; i < arrVestingPhases.length; i++) {
          expect(await vesting.computeReleasableAmount(arrVestingPhases[i].beneficiary)).to.equal(0);  
        }
      });

      it("Releasable amount + 30 days from vesting begin. After cliff.", async function () {
  
        await time.increase(30 * 86400);
        for (var i = 0; i < arrVestingPhases.length; i++) {
          const phase = arrVestingPhases[i];
          const amount = phase.amountAfterCliff; // 500
          expect(await vesting.computeReleasableAmount(phase.beneficiary)).to.equal(amount);  
        }
  
      });

      it("Releasable amount + 60 days from vesting begin.", async function () {
  
        await time.increase(30 * 86400);
        for (var i = 0; i < arrVestingPhases.length; i++) {
          const phase = arrVestingPhases[i];
          const amount = '750' + decimals; 
          expect(await vesting.computeReleasableAmount(phase.beneficiary)).to.equal(amount);  
        }
  
      });

      it("Releasable amount + 90 days from vesting begin. End of vesting", async function () {
  
        await time.increase(30 * 86400);
        for (var i = 0; i < arrVestingPhases.length; i++) {
          const phase = arrVestingPhases[i];
          const amount = '1000' + decimals; 
          expect(await vesting.computeReleasableAmount(phase.beneficiary)).to.equal(amount);  
        }
  
      })
      
    });
  
    describe("Claim", function () {
  
      // it("Reset network", async function () {
      //   await hre.network.provider.send("hardhat_reset");
      //   await loadFixture(deploy);
      // });

      // it("Load data", async function () {
      //   const tx = await vesting.createVestingSchedule(accounts[1].address, durationDays, cliffDays, amountTotal, amountAfterCliff);
      //   console.log(`      Phase (Test) tx.hash: `, tx.hash);
      // });

      // it("Claim after vesting start. 1 day.", async function () {

      //   await time.increaseTo(1685232000); // Sun May 28 2023 00:00:00 GMT+0000
      //   for (var i = 0; i < arrVestingPhases.length; i++) {
      //       expect(vesting.connect(accounts[i+1]).claim()).to.be.revertedWith("TokenVesting: nothing to claim")  
      //   }

      // });
  
      // it("Claim for 1st month.", async function () {
  
      //   await time.increase(30 * 86400); 
      //   for (var i = 0; i < arrVestingPhases.length; i++) {
      //       const phase = arrVestingPhases[i];
      //       await vesting.connect(accounts[i+1]).claim();
      //       const amount = '500' + decimals;
      //       expect(await token.balanceOf(phase.beneficiary)).to.equal(amount);
      //   }

      // });

      // it("Claim for 2nd month.", async function () {
  
      //   await time.increase(30 * 86400); 
      //   for (var i = 0; i < arrVestingPhases.length; i++) {
      //       const phase = arrVestingPhases[i];
      //       await vesting.connect(accounts[i+1]).claim();
      //       const amount = '750' + decimals;
      //       expect(await token.balanceOf(phase.beneficiary)).to.equal(amount);
      //   }

      // });

      // it("Claim for 3d month.", async function () {
  
      //   await time.increase(30 * 86400); 
      //   for (var i = 0; i < arrVestingPhases.length; i++) {
      //       const phase = arrVestingPhases[i];
      //       await vesting.connect(accounts[i+1]).claim();
      //       const amount = '1000' + decimals;
      //       expect(await token.balanceOf(phase.beneficiary)).to.equal(amount);
      //   }

      // });
  
    });
      
  });
  