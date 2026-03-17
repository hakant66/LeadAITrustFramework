"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

type Status = "idle" | "sending" | "sent" | "error";

export default function RegisterPage() {
  const t = useTranslations("Auth.register");
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<Status>("idle");

  const queryStatus: Status | null = useMemo(() => {
    if (searchParams.get("check")) return "sent";
    if (searchParams.get("error")) return "error";
    return null;
  }, [searchParams]);

  const effectiveStatus = queryStatus ?? status;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const result = await signIn("email", { email, redirect: false });
    if (result?.ok) {
      setStatus("sent");
      setStep("code");
    } else {
      setStatus("error");
    }
  }

  function onVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const callbackUrl =
      searchParams.get("callbackUrl") ?? "/scorecard/admin/governance-dashboard-reporting";
    const url = `/api/auth/callback/email?callbackUrl=${encodeURIComponent(
      callbackUrl,
    )}&token=${encodeURIComponent(code.trim())}&email=${encodeURIComponent(
      email.trim(),
    )}`;
    window.location.href = url;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            {t("kicker")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-3 text-sm text-white/70">{t("subtitle")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm text-white/70">
              {t("emailLabel")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("emailPlaceholder")}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={effectiveStatus === "sending"}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {effectiveStatus === "sending" ? t("sending") : t("submit")}
            </button>
          </form>

          {step === "code" && (
            <form onSubmit={onVerifyCode} className="mt-6 space-y-4">
              <label className="block text-sm text-white/70">
                {t("codeLabel")}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={t("codePlaceholder")}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={!code.trim()}
                className="w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t("verify")}
              </button>
            </form>
          )}

          {effectiveStatus === "sent" && (
            <p className="mt-4 text-sm text-emerald-300">{t("sent")}</p>
          )}
          {effectiveStatus === "error" && (
            <p className="mt-4 text-sm text-rose-300">{t("error")}</p>
          )}
        </div>
      </div>
    </main>
  );
}
