import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc = "https://monad-testnet.g.alchemy.com/v2/vHKGfKB9XNKdpiZATW1hysInS43CT5sZ";
const chain = { id: 10143, name: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as const;
const client = createPublicClient({ chain, transport: http(rpc) });

const OPERATOR = "0x43Da5854Ff2AE0fe388a503E3477c7f5bf3498A4" as const;

// All helper wallets that may have been funded
const helpers = [
  "0xcf2591a8f8a1c979fafa26fa507c8008baaee526ccd40b47f100c62f041ffd6b", // 0x15B2...
  "0x1a27569e8d346be3ad2b9e28cd1dea2e679532481b3957a2965fa2d25096614e", // 0x749E...
  // Earlier helpers (may still have some dust)
  "0x585e571d4e8e69a19c3b7ad0e763c1700d6710a6441b1b670d2a0109fe50c38c", // 0x9fB4...
  "0x5fb4d3d81f0e820f3c13057a4aaf360dfb0f7d2dcc6e1e33b63d1ee87f9d45e8", // 0x6504...
];

async function main() {
  let total = BigInt(0);

  for (const pk of helpers) {
    const acct = privateKeyToAccount(pk as `0x${string}`);
    const bal = await client.getBalance({ address: acct.address });

    if (bal > parseEther("0.005")) {
      const amount = bal - parseEther("0.005");
      console.log(`${acct.address}: ${formatEther(bal)} MON → transferring ${formatEther(amount)}`);

      const wallet = createWalletClient({ account: acct, chain, transport: http(rpc) });
      const tx = await wallet.sendTransaction({ to: OPERATOR, value: amount });
      await client.waitForTransactionReceipt({ hash: tx });
      total += amount;
    } else {
      console.log(`${acct.address}: ${formatEther(bal)} MON (too low)`);
    }
  }

  const opBal = await client.getBalance({ address: OPERATOR });
  console.log(`\nTransferred: ${formatEther(total)} MON`);
  console.log(`Operator balance: ${formatEther(opBal)} MON`);
  console.log(`Need: 10.5 MON (10 fee + 0.5 initial buy)`);
  console.log(`Remaining: ${(10.5 - Number(formatEther(opBal))).toFixed(4)} MON needed`);
}
main().catch(console.error);
