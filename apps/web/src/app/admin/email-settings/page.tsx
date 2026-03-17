"use client";

import { useEffect, useState } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";

type EmailSettingsOut = {
  email_from: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username?: string | null;
  use_ssl: boolean;
  smtp_url_masked: string;
  source: string;
  can_save: boolean;
};

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<EmailSettingsOut | null>(null);
  const [smtpUrl, setSmtpUrl] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [testToEmail, setTestToEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/email-settings`, {
        cache: "no-store",
        credentials: "include",
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Failed to load email settings");
      }
      const data = JSON.parse(text) as EmailSettingsOut;
      setSettings(data);
      setEmailFrom(data.email_from || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email settings");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/email-settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_server: smtpUrl.trim(),
          email_from: emailFrom.trim(),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Failed to save email settings");
      }
      const data = JSON.parse(text) as EmailSettingsOut;
      setSettings(data);
      setSmtpUrl("");
      setMessage("Email settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save email settings");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/email-settings/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: testToEmail.trim() }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Failed to send test email");
      }
      setMessage(`Test email sent to ${testToEmail.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Email Settings" subtitle="System Admin" />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="text-sm text-slate-500">Loading settings...</div>
        ) : (
          <div className="space-y-4">
            {!settings?.can_save ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Saving is disabled until `SMTP_SETTINGS_ENCRYPTION_KEY` is configured on core-svc.
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Active Source
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {settings?.source || "unknown"}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Active SMTP (masked)
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {settings?.smtp_url_masked || "—"}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  SMTP URL
                </label>
                <input
                  type="password"
                  value={smtpUrl}
                  onChange={(event) => setSmtpUrl(event.target.value)}
                  placeholder="smtp://username:password@smtp.example.com:587"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="mt-1 text-xs text-slate-500">
                  Enter a full SMTP URL; it will be stored encrypted in the database.
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                  Email From
                </label>
                <input
                  value={emailFrom}
                  onChange={(event) => setEmailFrom(event.target.value)}
                  placeholder="LeadAI <contact@theleadai.co.uk>"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !settings?.can_save || !smtpUrl.trim() || !emailFrom.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Test Recipient
                  </label>
                  <input
                    type="email"
                    value={testToEmail}
                    onChange={(event) => setTestToEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={sendTest}
                    disabled={testing || !testToEmail.trim()}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {testing ? "Sending..." : "Send Test Email"}
                  </button>
                </div>
              </div>
            </div>

            {message ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
