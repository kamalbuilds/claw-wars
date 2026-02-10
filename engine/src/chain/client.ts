import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type HttpTransport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const chainLogger = logger.child("Chain");

const monad = {
  id: config.monad.chainId,
  name: config.monad.chainId === 10143 ? "Monad Testnet" : "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [config.monad.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "MonadExplorer",
      url: config.monad.chainId === 10143
        ? "https://testnet.monadexplorer.com"
        : "https://monadexplorer.com",
    },
  },
} satisfies Chain;

export { monad };

export const publicClient: PublicClient<Transport, typeof monad> =
  createPublicClient({
    chain: monad,
    transport: http(config.monad.rpcUrl),
  });

function createOperatorWalletClient(): WalletClient<
  HttpTransport,
  typeof monad
> | null {
  if (!config.operator.privateKey || config.operator.privateKey === "0x_your_private_key_here") {
    chainLogger.warn(
      "No operator private key configured. On-chain transactions will fail."
    );
    return null;
  }

  try {
    const account = privateKeyToAccount(
      config.operator.privateKey as `0x${string}`
    );
    chainLogger.info(`Operator wallet initialized: ${account.address}`);

    return createWalletClient({
      account,
      chain: monad,
      transport: http(config.monad.rpcUrl),
    });
  } catch (err) {
    chainLogger.error("Failed to create operator wallet client", err);
    return null;
  }
}

export const walletClient = createOperatorWalletClient();

export function getOperatorAddress(): `0x${string}` | null {
  if (!walletClient || !walletClient.account) return null;
  return walletClient.account.address;
}
