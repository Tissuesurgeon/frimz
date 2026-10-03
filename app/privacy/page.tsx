import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage current="privacy" title="Privacy">
      <p>
        Frimz stores your account email, a password hash, conversations, messages, ideas, and a memory index in PostgreSQL. Durable memories are also written to Walrus
        Memory in a namespace derived from your account.
      </p>
      <p>
        You can inspect, edit, and forget memories. Forgetting hides a memory from retrieval. Walrus blobs are immutable, so the stored record itself remains on
        Walrus.
      </p>
      <p>
        Current thinking, the summary Frimz keeps for each idea, lives in PostgreSQL with every earlier version of it. It stays out of Walrus. Frimz builds
        it with the same AI model it uses for replies, from your conversations and memories about that idea, and you can edit or regenerate it at any time.
      </p>
      <p>Cursor and Walrus credentials stay on the server, out of the browser, API responses, and logs.</p>
      <p>
        Your conversations, ideas, memories, and current thinking are visible only to your account. A new account starts empty and fills as you talk with
        Frimz.
      </p>
    </LegalPage>
  );
}
