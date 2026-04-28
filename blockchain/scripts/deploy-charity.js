const hre = require("hardhat");

const MIN_BALANCE_ETH = "0.05"; // tối thiểu để deploy + verify an toàn

async function main() {
  console.log("=== Deploying Charity to Sepolia ===\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  // Balance guard — block nếu ví BE không đủ gas
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  const balanceEth = hre.ethers.formatEther(balance);
  console.log("Deployer (BE wallet):", deployerAddress);
  console.log("Balance:             ", balanceEth, "ETH");

  const minWei = hre.ethers.parseEther(MIN_BALANCE_ETH);
  if (balance < minWei) {
    throw new Error(
      `Insufficient balance. Have ${balanceEth} ETH, need ≥ ${MIN_BALANCE_ETH} ETH. ` +
        `Nạp faucet trước khi deploy.`
    );
  }

  // Admin + operator cùng ví BE cho đồ án (production sẽ tách — note báo cáo).
  const admin = deployerAddress;
  const operator = deployerAddress;
  console.log("\nConstructor args:");
  console.log("  admin   :", admin);
  console.log("  operator:", operator);

  console.log("\nCompiling...");
  await hre.run("compile");

  console.log("Deploying Charity.sol...");
  const Charity = await hre.ethers.getContractFactory("Charity");
  const charity = await Charity.deploy(admin, operator);
  await charity.waitForDeployment();

  const address = await charity.getAddress();
  const deployTx = charity.deploymentTransaction();

  console.log("\n=== DEPLOY SUCCESS ===");
  console.log("CHARITY_ADDRESS:", address);
  console.log("Tx hash:        ", deployTx.hash);
  console.log("Etherscan:       https://sepolia.etherscan.io/address/" + address);
  console.log("\nNext steps:");
  console.log("  1. Copy CHARITY_ADDRESS vào backend/.env");
  console.log(
    `  2. Verify: npx hardhat verify --network sepolia ${address} ${admin} ${operator}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n=== DEPLOY FAILED ===");
    console.error(error);
    process.exit(1);
  });
