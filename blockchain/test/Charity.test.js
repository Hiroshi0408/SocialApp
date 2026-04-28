const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Status enum trong Charity.sol (khớp thứ tự declare).
const Status = {
  OPEN: 0n,
  FUNDED: 1n,
  EXECUTING: 2n,
  COMPLETED: 3n,
  FAILED: 4n,
  REFUNDED: 5n,
};

const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
const CAMPAIGN_CREATOR_ROLE = ethers.keccak256(
  ethers.toUtf8Bytes("CAMPAIGN_CREATOR_ROLE")
);

describe("Charity", function () {
  // Fixture mặc định: deploy contract + whitelist org, dùng lại được cho nhiều test.
  // admin   = DEFAULT_ADMIN_ROLE
  // operator = OPERATOR_ROLE (đại diện ví BE)
  // org      = CAMPAIGN_CREATOR_ROLE (đại diện ví tổ chức đã verified)
  async function deployCharityFixture() {
    const [admin, operator, org, donor1, donor2, stranger] = await ethers.getSigners();

    const Charity = await ethers.getContractFactory("Charity");
    const charity = await Charity.deploy(admin.address, operator.address);
    await charity.waitForDeployment();

    await charity.connect(admin).whitelistOrg(org.address);

    return { charity, admin, operator, org, donor1, donor2, stranger };
  }

  // Helper: tạo 1 campaign cơ bản từ org đã whitelist.
  // goal 1 ETH, duration 7 ngày, 2 milestones 0.6 + 0.4.
  async function createSampleCampaign(charity, org) {
    const goal = ethers.parseEther("1.0");
    const durationSec = 7 * 24 * 60 * 60;
    // 2 milestone 50/50 — đúng max boundary của MAX_MILESTONE_PERCENT (50%)
    const milestones = [ethers.parseEther("0.5"), ethers.parseEther("0.5")];
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("sample-metadata-v1"));

    const tx = await charity
      .connect(org)
      .createCampaign(goal, durationSec, milestones, metadataHash);
    const receipt = await tx.wait();

    return { goal, durationSec, milestones, metadataHash, tx, receipt };
  }

  // Helper: đẩy campaign 0 sang FUNDED bằng 2 donor.
  async function fundCampaign(charity, donor1, donor2) {
    await charity.connect(donor1).donate(0, { value: ethers.parseEther("0.6") });
    await charity.connect(donor2).donate(0, { value: ethers.parseEther("0.4") });
  }

  // ═══════════════════════════════════════════════════════════════════
  describe("Access control", function () {
    it("reject createCampaign from non-whitelisted address", async function () {
      const { charity, stranger } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      const milestones = [goal];
      const metadataHash = ethers.ZeroHash;

      await expect(
        charity
          .connect(stranger)
          .createCampaign(goal, 86400, milestones, metadataHash)
      )
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, CAMPAIGN_CREATOR_ROLE);
    });

    it("reject whitelistOrg from non-admin", async function () {
      const { charity, stranger, donor1 } = await loadFixture(deployCharityFixture);

      await expect(charity.connect(stranger).whitelistOrg(donor1.address))
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });

    it("reject unwhitelistOrg from non-admin", async function () {
      const { charity, stranger, org } = await loadFixture(deployCharityFixture);

      await expect(charity.connect(stranger).unwhitelistOrg(org.address))
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });

    it("reject markExecuting from non-operator", async function () {
      const { charity, org, donor1, donor2, stranger } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);

      await expect(charity.connect(stranger).markExecuting(0))
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, OPERATOR_ROLE);
    });

    it("reject unlockMilestone from non-operator", async function () {
      const { charity, operator, org, donor1, donor2, stranger } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);

      await expect(charity.connect(stranger).unlockMilestone(0, 0))
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, OPERATOR_ROLE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("createCampaign", function () {
    it("happy path: emit CampaignCreated, init state, push milestones, increment id", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      const durationSec = 7 * 24 * 60 * 60;
      const milestones = [ethers.parseEther("0.5"), ethers.parseEther("0.5")];
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("campaign-1"));

      const tx = await charity
        .connect(org)
        .createCampaign(goal, durationSec, milestones, metadataHash);

      // Lấy timestamp block thật để so deadline, không dùng Date.now.
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedDeadline = BigInt(block.timestamp + durationSec);

      await expect(tx)
        .to.emit(charity, "CampaignCreated")
        .withArgs(0n, org.address, goal, expectedDeadline, metadataHash);

      const campaign = await charity.campaigns(0);
      expect(campaign.beneficiary).to.equal(org.address);
      expect(campaign.goal).to.equal(goal);
      expect(campaign.raised).to.equal(0n);
      expect(campaign.deadline).to.equal(expectedDeadline);
      expect(campaign.status).to.equal(Status.OPEN);
      expect(campaign.exists).to.equal(true);

      expect(await charity.milestoneCount(0)).to.equal(2n);
      expect(await charity.nextCampaignId()).to.equal(1n);
    });

    it("revert when sum(milestones) != goal", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      const milestones = [ethers.parseEther("0.5"), ethers.parseEther("0.4")]; // 0.9 != 1.0

      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, ethers.ZeroHash)
      ).to.be.revertedWith("Sum(milestones) != goal");
    });

    it("revert when goal = 0", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      await expect(
        charity
          .connect(org)
          .createCampaign(0, 86400, [ethers.parseEther("0.1")], ethers.ZeroHash)
      ).to.be.revertedWith("Goal must be > 0");
    });

    it("revert when duration = 0", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      await expect(
        charity.connect(org).createCampaign(goal, 0, [goal], ethers.ZeroHash)
      ).to.be.revertedWith("Duration must be > 0");
    });

    it("revert when milestones array is empty", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      await expect(
        charity
          .connect(org)
          .createCampaign(ethers.parseEther("1.0"), 86400, [], ethers.ZeroHash)
      ).to.be.revertedWith("Invalid milestone count");
    });

    it("revert when only 1 milestone (< MIN_MILESTONES)", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      // 1 milestone gom 100% goal — pattern scam phổ biến, contract chặn
      const milestones = [goal];

      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid milestone count");
    });

    it("revert when milestones > MAX_MILESTONES (10)", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      // 11 milestone mỗi cái 0.1 ETH → sum = 1.1, goal = 1.1 để không vướng check sum trước.
      // Mỗi milestone = 0.1/1.1 = 9.09% < 50% nên không vướng max-percent check.
      const per = ethers.parseEther("0.1");
      const milestones = Array(11).fill(per);
      const goal = per * 11n;

      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid milestone count");
    });

    it("revert when any milestone amount = 0", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      // 3 milestone, milestone cuối = 0. Hai milestone đầu pass percent check (50% boundary)
      // → loop chạy đến milestone i=2 mới revert "Zero milestone amount".
      const milestones = [
        ethers.parseEther("0.5"),
        ethers.parseEther("0.5"),
        0n,
      ];

      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, ethers.ZeroHash)
      ).to.be.revertedWith("Zero milestone amount");
    });

    it("revert when 1 milestone > MAX_MILESTONE_PERCENT (50%)", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      // milestone đầu = 0.6 (60%) vượt 50% → revert ngay i=0
      const milestones = [ethers.parseEther("0.6"), ethers.parseEther("0.4")];

      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, ethers.ZeroHash)
      ).to.be.revertedWith("Milestone exceeds max percent");
    });

    it("happy path: 2 milestones at exact 50/50 boundary", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("2.0");
      const milestones = [ethers.parseEther("1.0"), ethers.parseEther("1.0")];
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("boundary-test"));

      // 50% là boundary — phải pass (require dùng <= max)
      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, metadataHash)
      ).to.emit(charity, "CampaignCreated");

      expect(await charity.milestoneCount(0)).to.equal(2n);
    });

    it("happy path: 3 milestones with varying percent", async function () {
      const { charity, org } = await loadFixture(deployCharityFixture);

      const goal = ethers.parseEther("1.0");
      // 30% / 50% / 20% — tất cả ≤ 50%, sum = goal
      const milestones = [
        ethers.parseEther("0.3"),
        ethers.parseEther("0.5"),
        ethers.parseEther("0.2"),
      ];
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("3-milestones"));

      await expect(
        charity.connect(org).createCampaign(goal, 86400, milestones, metadataHash)
      ).to.emit(charity, "CampaignCreated");

      expect(await charity.milestoneCount(0)).to.equal(3n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("donate", function () {
    it("happy path: track contribution, auto-transition OPEN→FUNDED when goal reached", async function () {
      const { charity, org, donor1, donor2 } = await loadFixture(deployCharityFixture);
      const { goal } = await createSampleCampaign(charity, org);

      // donor1 donate 0.4 — chưa đủ goal, vẫn OPEN
      const partial = ethers.parseEther("0.4");
      await expect(charity.connect(donor1).donate(0, { value: partial }))
        .to.emit(charity, "Donated")
        .withArgs(0n, donor1.address, partial, partial);

      let campaign = await charity.campaigns(0);
      expect(campaign.raised).to.equal(partial);
      expect(campaign.status).to.equal(Status.OPEN);
      expect(await charity.contributions(0, donor1.address)).to.equal(partial);

      // donor2 donate 0.6 — đủ goal 1 ETH, tự chuyển sang FUNDED
      const rest = ethers.parseEther("0.6");
      const tx = await charity.connect(donor2).donate(0, { value: rest });

      await expect(tx)
        .to.emit(charity, "Donated")
        .withArgs(0n, donor2.address, rest, goal);
      await expect(tx)
        .to.emit(charity, "StatusChanged")
        .withArgs(0n, Status.OPEN, Status.FUNDED);

      campaign = await charity.campaigns(0);
      expect(campaign.raised).to.equal(goal);
      expect(campaign.status).to.equal(Status.FUNDED);
      expect(await charity.contributions(0, donor2.address)).to.equal(rest);

      // Kiểm tra balance contract giữ tiền thật
      expect(await ethers.provider.getBalance(await charity.getAddress())).to.equal(goal);
    });

    it("revert when campaign does not exist", async function () {
      const { charity, donor1 } = await loadFixture(deployCharityFixture);

      await expect(
        charity.connect(donor1).donate(999, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Campaign not found");
    });

    it("revert when msg.value = 0", async function () {
      const { charity, org, donor1 } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);

      await expect(charity.connect(donor1).donate(0, { value: 0 })).to.be.revertedWith(
        "Zero value"
      );
    });

    it("revert after deadline passed", async function () {
      const { charity, org, donor1 } = await loadFixture(deployCharityFixture);
      const { durationSec } = await createSampleCampaign(charity, org);

      await time.increase(durationSec + 1);

      await expect(
        charity.connect(donor1).donate(0, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Deadline passed");
    });

    it("revert when campaign is FUNDED (not OPEN)", async function () {
      const { charity, org, donor1, donor2 } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);

      // Donor khác vẫn không donate được khi đã FUNDED.
      await expect(
        charity.connect(donor1).donate(0, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Not open");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("markFailed", function () {
    it("happy path: deadline passed + goal not met → FAILED", async function () {
      const { charity, org, donor1, stranger } = await loadFixture(deployCharityFixture);
      const { durationSec } = await createSampleCampaign(charity, org);

      await charity.connect(donor1).donate(0, { value: ethers.parseEther("0.3") });
      await time.increase(durationSec + 1);

      // Public function — stranger cũng gọi được.
      await expect(charity.connect(stranger).markFailed(0))
        .to.emit(charity, "StatusChanged")
        .withArgs(0n, Status.OPEN, Status.FAILED);

      const campaign = await charity.campaigns(0);
      expect(campaign.status).to.equal(Status.FAILED);
    });

    it("revert when deadline not reached", async function () {
      const { charity, org, donor1 } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);
      await charity.connect(donor1).donate(0, { value: ethers.parseEther("0.3") });

      await expect(charity.connect(donor1).markFailed(0)).to.be.revertedWith(
        "Deadline not reached"
      );
    });

    it("revert when goal was met (FUNDED, không được mark FAILED)", async function () {
      const { charity, org, donor1, donor2 } = await loadFixture(deployCharityFixture);
      const { durationSec } = await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await time.increase(durationSec + 1);

      // Status đã là FUNDED → check "Not open" fire trước.
      await expect(charity.connect(donor1).markFailed(0)).to.be.revertedWith("Not open");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("claimRefund", function () {
    it("happy path: donor nhận lại đúng amount, double claim revert", async function () {
      const { charity, org, donor1 } = await loadFixture(deployCharityFixture);
      const { durationSec } = await createSampleCampaign(charity, org);

      // Donate 0.3 ETH — dưới goal 1 ETH
      const amount = ethers.parseEther("0.3");
      await charity.connect(donor1).donate(0, { value: amount });

      // Tua thời gian qua deadline
      await time.increase(durationSec + 1);
      await charity.connect(donor1).markFailed(0);

      // Donor claim refund — track balance delta (trừ gas)
      const balanceBefore = await ethers.provider.getBalance(donor1.address);
      const tx = await charity.connect(donor1).claimRefund(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(donor1.address);

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(amount);
      expect(await charity.contributions(0, donor1.address)).to.equal(0n);

      await expect(tx)
        .to.emit(charity, "RefundClaimed")
        .withArgs(0n, donor1.address, amount);

      // Double claim phải revert — contributions đã zero nên sẽ fail "Nothing to refund"
      await expect(charity.connect(donor1).claimRefund(0)).to.be.revertedWith(
        "Nothing to refund"
      );
    });

    it("revert when campaign is FUNDED (chưa FAILED)", async function () {
      const { charity, org, donor1, donor2 } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);

      await expect(charity.connect(donor1).claimRefund(0)).to.be.revertedWith(
        "Not refundable"
      );
    });

    it("revert when markFailed chưa được gọi (status vẫn OPEN dù deadline qua)", async function () {
      const { charity, org, donor1 } = await loadFixture(deployCharityFixture);
      const { durationSec } = await createSampleCampaign(charity, org);
      await charity.connect(donor1).donate(0, { value: ethers.parseEther("0.3") });

      await time.increase(durationSec + 1);
      // Không gọi markFailed — claim phải revert.
      await expect(charity.connect(donor1).claimRefund(0)).to.be.revertedWith(
        "Not refundable"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("Milestone flow", function () {
    it("revert markExecuting when not FUNDED", async function () {
      const { charity, operator, org } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);

      // Status vẫn OPEN.
      await expect(charity.connect(operator).markExecuting(0)).to.be.revertedWith(
        "Not funded"
      );
    });

    it("markExecuting: FUNDED → EXECUTING", async function () {
      const { charity, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);

      await expect(charity.connect(operator).markExecuting(0))
        .to.emit(charity, "StatusChanged")
        .withArgs(0n, Status.FUNDED, Status.EXECUTING);

      expect((await charity.campaigns(0)).status).to.equal(Status.EXECUTING);
    });

    it("revert unlockMilestone when not EXECUTING", async function () {
      const { charity, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      // Không markExecuting — vẫn FUNDED.

      await expect(charity.connect(operator).unlockMilestone(0, 0)).to.be.revertedWith(
        "Not executing"
      );
    });

    it("revert unlockMilestone with bad idx", async function () {
      const { charity, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org); // 2 milestones
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);

      // idx = 2 (out of bounds, milestones[0..1]).
      await expect(charity.connect(operator).unlockMilestone(0, 2)).to.be.revertedWith(
        "Bad milestone index"
      );
    });

    it("unlockMilestone release đúng amount cho beneficiary (org)", async function () {
      const { charity, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      const { milestones } = await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);

      const orgBalanceBefore = await ethers.provider.getBalance(org.address);
      // Operator gọi — org không mất gas.
      const tx = await charity.connect(operator).unlockMilestone(0, 0);

      await expect(tx)
        .to.emit(charity, "MilestoneUnlocked")
        .withArgs(0n, 0n, milestones[0]);

      const orgBalanceAfter = await ethers.provider.getBalance(org.address);
      expect(orgBalanceAfter - orgBalanceBefore).to.equal(milestones[0]);

      // unlockedTotal tăng đúng amount, milestone[0].unlocked = true.
      const campaign = await charity.campaigns(0);
      expect(campaign.unlockedTotal).to.equal(milestones[0]);
      const mList = await charity.getMilestones(0);
      expect(mList[0].unlocked).to.equal(true);
      expect(mList[1].unlocked).to.equal(false);
      expect(campaign.status).to.equal(Status.EXECUTING); // chưa phải cuối
    });

    it("auto-transition EXECUTING → COMPLETED khi unlock milestone cuối", async function () {
      const { charity, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      const { goal } = await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);

      // Unlock milestone 0 (0.6) — vẫn EXECUTING.
      await charity.connect(operator).unlockMilestone(0, 0);
      expect((await charity.campaigns(0)).status).to.equal(Status.EXECUTING);

      // Unlock milestone 1 (0.4) — đủ goal → COMPLETED.
      const tx = await charity.connect(operator).unlockMilestone(0, 1);
      await expect(tx)
        .to.emit(charity, "StatusChanged")
        .withArgs(0n, Status.EXECUTING, Status.COMPLETED);

      const campaign = await charity.campaigns(0);
      expect(campaign.status).to.equal(Status.COMPLETED);
      expect(campaign.unlockedTotal).to.equal(goal);
    });

    it("revert double unlock cùng milestone", async function () {
      const { charity, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);

      await charity.connect(operator).unlockMilestone(0, 0);

      await expect(charity.connect(operator).unlockMilestone(0, 0)).to.be.revertedWith(
        "Already unlocked"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("adminForceFail", function () {
    it("happy path FUNDED → FAILED, donor sau đó claimRefund đủ contribution", async function () {
      const { charity, admin, org, donor1, donor2 } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);

      const tx = await charity.connect(admin).adminForceFail(0);
      await expect(tx)
        .to.emit(charity, "StatusChanged")
        .withArgs(0n, Status.FUNDED, Status.FAILED);

      expect((await charity.campaigns(0)).status).to.equal(Status.FAILED);

      // donor1 đã contribute 0.6 → claim full
      const donated1 = ethers.parseEther("0.6");
      const balBefore = await ethers.provider.getBalance(donor1.address);
      const claimTx = await charity.connect(donor1).claimRefund(0);
      const receipt = await claimTx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(donor1.address);
      expect(balAfter - balBefore + gasUsed).to.equal(donated1);
    });

    it("happy path EXECUTING (chưa unlock) → FAILED", async function () {
      const { charity, admin, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);

      // unlockedTotal vẫn 0 → admin được force-fail
      await expect(charity.connect(admin).adminForceFail(0))
        .to.emit(charity, "StatusChanged")
        .withArgs(0n, Status.EXECUTING, Status.FAILED);

      expect((await charity.campaigns(0)).status).to.equal(Status.FAILED);
    });

    it("revert khi đã unlock milestone (unlockedTotal > 0)", async function () {
      const { charity, admin, operator, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);
      await charity.connect(operator).markExecuting(0);
      await charity.connect(operator).unlockMilestone(0, 0); // giải ngân 0.6

      await expect(charity.connect(admin).adminForceFail(0)).to.be.revertedWith(
        "Already disbursed milestone"
      );
    });

    it("revert khi status OPEN (chưa FUNDED)", async function () {
      const { charity, admin, org, donor1 } = await loadFixture(deployCharityFixture);
      await createSampleCampaign(charity, org);
      await charity.connect(donor1).donate(0, { value: ethers.parseEther("0.3") });

      await expect(charity.connect(admin).adminForceFail(0)).to.be.revertedWith(
        "Cannot force-fail in current status"
      );
    });

    it("revert khi status FAILED (đã fail)", async function () {
      const { charity, admin, org, donor1 } = await loadFixture(deployCharityFixture);
      const { durationSec } = await createSampleCampaign(charity, org);
      await charity.connect(donor1).donate(0, { value: ethers.parseEther("0.3") });
      await time.increase(durationSec + 1);
      await charity.connect(donor1).markFailed(0);

      await expect(charity.connect(admin).adminForceFail(0)).to.be.revertedWith(
        "Cannot force-fail in current status"
      );
    });

    it("revert khi non-admin gọi", async function () {
      const { charity, operator, stranger, org, donor1, donor2 } = await loadFixture(
        deployCharityFixture
      );
      await createSampleCampaign(charity, org);
      await fundCampaign(charity, donor1, donor2);

      // operator có role OPERATOR_ROLE nhưng không có DEFAULT_ADMIN_ROLE
      await expect(charity.connect(operator).adminForceFail(0))
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(operator.address, DEFAULT_ADMIN_ROLE);

      await expect(charity.connect(stranger).adminForceFail(0))
        .to.be.revertedWithCustomError(charity, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, DEFAULT_ADMIN_ROLE);
    });

    it("revert khi campaign không tồn tại", async function () {
      const { charity, admin } = await loadFixture(deployCharityFixture);
      await expect(charity.connect(admin).adminForceFail(999)).to.be.revertedWith(
        "Campaign not found"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  describe("Reentrancy", function () {
    it("claimRefund block reentrancy (attacker không nhận được gấp đôi)", async function () {
      const { charity, org, admin } = await loadFixture(deployCharityFixture);

      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(await charity.getAddress());
      await attacker.waitForDeployment();

      const { durationSec } = await createSampleCampaign(charity, org);

      // Attacker donate 0.3 ETH (dưới goal 1 ETH → campaign sẽ FAIL).
      const donated = ethers.parseEther("0.3");
      await attacker.donate(0, { value: donated });

      // Qua deadline → markFailed.
      await time.increase(durationSec + 1);
      await charity.connect(admin).markFailed(0);

      // Attacker attack: gọi claimRefund → receive() thử reentry.
      const attackerAddr = await attacker.getAddress();
      const balBefore = await ethers.provider.getBalance(attackerAddr);

      await attacker.attack(0);

      const balAfter = await ethers.provider.getBalance(attackerAddr);

      // Attacker chỉ nhận đúng 1 lần amount (không gấp đôi).
      expect(balAfter - balBefore).to.equal(donated);

      // receive() đã chạy và reentry đã revert (bị ReentrancyGuard chặn).
      expect(await attacker.reentered()).to.equal(true);
      expect(await attacker.reentryReverted()).to.equal(true);

      // Contributions zero-out, contract không còn ETH của attacker.
      expect(await charity.contributions(0, attackerAddr)).to.equal(0n);
      expect(await ethers.provider.getBalance(await charity.getAddress())).to.equal(0n);
    });
  });
});
