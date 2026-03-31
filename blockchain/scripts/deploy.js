const hre = require("hardhat");

async function main() {
  console.log("Deploying ContentRegistry...");

  // Lấy contract factory
  const ContentRegistry = await hre.ethers.getContractFactory(
    "ContentRegistry",
  );

  // Deploy
  const contract = await ContentRegistry.deploy();
  await contract.waitForDeployment();

  // Lấy địa chỉ contract sau khi deploy
  const address = await contract.getAddress();
  console.log("ContentRegistry deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
