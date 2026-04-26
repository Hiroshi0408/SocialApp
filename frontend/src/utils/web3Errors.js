const SEPOLIA_CHAIN_ID = "0xaa36a7";

/**
 * Parse lỗi từ ethers v6 / MetaMask thành type chuẩn.
 * @returns {{ type: "rejected"|"insufficient"|"rpc", rawMessage: string|null }}
 */
export function parseWeb3Error(err) {
  // User bấm Reject trong MetaMask
  if (
    err.code === "ACTION_REJECTED" ||
    err.code === 4001 ||
    err?.info?.error?.code === 4001
  ) {
    return { type: "rejected", rawMessage: null };
  }

  // Số dư không đủ (on-chain hoặc pre-flight MetaMask)
  if (
    err.code === "INSUFFICIENT_FUNDS" ||
    err?.info?.error?.code === -32000
  ) {
    return { type: "insufficient", rawMessage: null };
  }

  // Fallback: lỗi RPC / provider / unknown
  return {
    type: "rpc",
    rawMessage: err.reason || err.shortMessage || err.message || null,
  };
}

/**
 * Kiểm tra chainId hiện tại trước khi gửi tx.
 * Throw error với code "WRONG_NETWORK" nếu không phải Sepolia.
 */
export async function assertSepolia() {
  if (!window.ethereum) {
    const err = new Error("MetaMask not found");
    err.code = "NO_PROVIDER";
    throw err;
  }
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId !== SEPOLIA_CHAIN_ID) {
    const err = new Error("Wrong network");
    err.code = "WRONG_NETWORK";
    throw err;
  }
}
