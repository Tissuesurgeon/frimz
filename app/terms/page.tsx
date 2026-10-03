import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage current="terms" title="Terms">
      <p>Frimz is a thinking partner, and you remain the decision maker. Replies are suggestions for you to weigh, and they can be wrong.</p>
      <p>You are responsible for what you share in a conversation. Keep secrets you would rather not store as memory out of your messages.</p>
      <p>
        These notes describe how this deployment behaves. For legal questions, consult a lawyer. The software is offered as it is, with no warranty beyond what it
        actually does.
      </p>
    </LegalPage>
  );
}
