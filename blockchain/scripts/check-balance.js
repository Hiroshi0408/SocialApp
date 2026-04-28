const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();
  const balance = await hre.ethers.provider.getBalance(address);
  console.log("BE wallet address:", address);
  console.log("Sepolia balance:  ", hre.ethers.formatEther(balance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
