import { WalrusMemoryStore } from "./walrus/walrus-memory-store";
import { createWalrusClient, walrusConfigured } from "./walrus/walrus-client";
import { PostgresMemoryIndex } from "./memory-index";

export function getMemoryStore() {
  if (!walrusConfigured()) return null;
  return new WalrusMemoryStore(
    {
      rememberAndWait: async (text, namespace) => {
        const client = await createWalrusClient();
        return client.rememberAndWait(text, namespace);
      },
      recall: async (params) => {
        const client = await createWalrusClient();
        return client.recall(params);
      },
    },
    new PostgresMemoryIndex(),
  );
}
