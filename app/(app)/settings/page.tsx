import { SettingsForm } from "@/components/settings/settings-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl tracking-tight">Settings</h1>
      <div className="mt-8">
        <SettingsForm />
      </div>
    </main>
  );
}
