import type { WalrusClient } from "./walrus-memory-store";

export function walrusConfigured() {
  return Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID);
}

export async function createWalrusClient(): Promise<WalrusClient> {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (!key || !accountId) {
    throw new Error("Walrus Memory is not configured");
  }
  const memwalModule = (await import("@mysten-incubation/memwal")) as {
    MemWal: {
      create: (config: {
        key: string;
        accountId: string;
        serverUrl?: string;
        namespace?: string;
      }) => {
        rememberAndWait: (text: string, namespace?: string) => Promise<{ blob_id: string }>;
        recall: (params: {
          query: string;
          limit?: number;
          namespace?: string;
          maxDistance?: number;
        }) => Promise<{ results: Array<{ blob_id: string; text: string; distance: number }> }>;
      };
    };
  };
  const client = memwalModule.MemWal.create({
    key,
    accountId,
    serverUrl: process.env.MEMWAL_SERVER_URL || "https://relayer-staging.memory.walrus.xyz",
    namespace: "frimz",
  });
  return {
    rememberAndWait: (text, namespace) => client.rememberAndWait(text, namespace),
    recall: (params) => client.recall(params),
  };
}
