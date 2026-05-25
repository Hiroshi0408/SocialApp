const { ethers } = require("hardhat");

const GAS_PRICE_GWEI = "3";

function costAtGasPrice(gasUsed) {
  const gasPrice = ethers.parseUnits(GAS_PRICE_GWEI, "gwei");
  return ethers.formatEther(gasUsed * gasPrice);
}

function printRow(label, gasUsed) {
  console.log(
    `${label.padEnd(34)} ${gasUsed.toString().padStart(8)} gas   ${costAtGasPrice(
      gasUsed
    )} ETH @ ${GAS_PRICE_GWEI} gwei`
  );
}

async function measure(label, txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  printRow(label, receipt.gasUsed);
  return receipt.gasUsed;
}

async function createCampaign(charity, org, goal, durationSec, milestones, metadataHash) {
  const id = await charity.nextCampaignId();
  const gas = await measure(
    "createCampaign",
    charity.connect(org).createCampaign(goal, durationSec, milestones, metadataHash)
  );
  return { id, gas };
}

async function main() {
  const [admin, operator, org, donor1, donor2] = await ethers.getSigners();

  const Charity = await ethers.getContractFactory("Charity");
  const charity = await Charity.deploy(admin.address, operator.address);
  await charity.waitForDeployment();

  const deployReceipt = await charity.deploymentTransaction().wait();

  const goal = ethers.parseEther("1.0");
  const durationSec = 7 * 24 * 60 * 60;
  const milestones = [ethers.parseEther("0.5"), ethers.parseEther("0.5")];
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("gas-measurement"));

  console.log("\nCharity.sol gas measurement");
  console.log(`Assumed gas price for ETH estimate: ${GAS_PRICE_GWEI} gwei\n`);
  printRow("deploy Charity", deployReceipt.gasUsed);

  await measure("whitelistOrg", charity.connect(admin).whitelistOrg(org.address));

  const happy = await createCampaign(
    charity,
    org,
    goal,
    durationSec,
    milestones,
    metadataHash
  );

  const donatePartialGas = await measure(
    "donate (OPEN, no transition)",
    charity.connect(donor1).donate(happy.id, { value: ethers.parseEther("0.4") })
  );
  const donateFundedGas = await measure(
    "donate (OPEN -> FUNDED)",
    charity.connect(donor2).donate(happy.id, { value: ethers.parseEther("0.6") })
  );
  const donateAvg = (donatePartialGas + donateFundedGas) / 2n;

  await measure("markExecuting", charity.connect(operator).markExecuting(happy.id));
  await measure("unlockMilestone (first)", charity.connect(operator).unlockMilestone(happy.id, 0));
  await measure(
    "unlockMilestone (last -> done)",
    charity.connect(operator).unlockMilestone(happy.id, 1)
  );

  const failed = await createCampaign(
    charity,
    org,
    goal,
    60,
    milestones,
    ethers.keccak256(ethers.toUtf8Bytes("failed-campaign"))
  );
  await measure(
    "donate for refund scenario",
    charity.connect(donor1).donate(failed.id, { value: ethers.parseEther("0.3") })
  );
  await ethers.provider.send("evm_increaseTime", [61]);
  await ethers.provider.send("evm_mine", []);
  await measure("markFailed", charity.connect(donor2).markFailed(failed.id));
  const claimRefundGas = await measure(
    "claimRefund",
    charity.connect(donor1).claimRefund(failed.id)
  );

  const forced = await createCampaign(
    charity,
    org,
    goal,
    durationSec,
    milestones,
    ethers.keccak256(ethers.toUtf8Bytes("force-fail-campaign"))
  );
  await charity.connect(donor1).donate(forced.id, { value: ethers.parseEther("1.0") });
  await measure("adminForceFail", charity.connect(admin).adminForceFail(forced.id));

  console.log("\nSlide-friendly summary");
  printRow("createCampaign", happy.gas);
  printRow("donate avg", donateAvg);
  printRow("claimRefund", claimRefundGas);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
