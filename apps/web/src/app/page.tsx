// apps/web/src/app/page.tsx
"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const highlights = [
  {
    title: "Proactive compliance",
    description:
      "Guardrails that surface gaps before regulators or customers do.",
    icon: ShieldCheck,
  },
  {
    title: "Live risk scorecards",
    description:
      "One-click snapshots of infra posture, data lineage, and drift.",
    icon: LineChart,
  },
  {
    title: "AI-informed workflows",
    description: "LLMs summarize incidents and map fixes to affected teams.",
    icon: Sparkles,
  },
  {
    title: "Centralized AI Product Governance",
    description:
      "Embeds compliance into the Product team, not just Legal/Risk. Focuses on efficiency and market-driven trust signals.",
    icon: Boxes,
  },
];

function DevAuthCard() {
  const router = useRouter();
  const [phase, setPhase] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  const handleCredentialsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Enter both email and password to continue.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setPhase("otp");
    }, 400);
  };

  const handleOtpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOtpError(null);

    if (!/^\d{6}$/.test(otp.trim())) {
      setOtpError("Enter the 6 digit code sent to your inbox.");
      return;
    }

    setOtpSubmitting(true);
    setTimeout(() => {
      router.push("/scorecard");
    }, 300);
  };

  const resetFlow = () => {
    setPhase("credentials");
    setOtp("");
    setOtpError(null);
    setPassword("");
    setSubmitting(false);
    setOtpSubmitting(false);
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur text-white">
      <h2 className="text-xl font-semibold text-white">LeadAI Console</h2>
      <p className="mt-1 text-sm text-slate-400">
        Use team credentials to unlock the mock console preview.
      </p>

      {phase === "credentials" ? (
        <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4">
          <label
            className="text-sm font-medium text-slate-200"
            htmlFor="email"
          >
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="alex@lead.ai"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />

          <label
            className="text-sm font-medium text-slate-200"
            htmlFor="password"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="hunter2!"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />

          {error ? (
            <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Checking..." : "Continue"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Verify OTP
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Enter the six digit passcode we just "sent" to{" "}
              {email || "your inbox"}.
            </p>
          </div>
          <input
            id="otp"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-center text-lg tracking-widest text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />

          {otpError ? (
            <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {otpError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={otpSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {otpSubmitting ? "Signing in..." : "Verify & Launch"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={resetFlow}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
          >
            Start over
          </button>
        </form>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_55%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16 lg:flex-row lg:items-center lg:gap-16 lg:px-12">
        <section className="flex-1">
          <a
            href="https://www.theleadai.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open LeadAI site in new window"
          >
            <Image
              src="/LeadAI.webp"
              alt="LeadAI"
              width={160}
              height={48}
              className="h-10 w-auto transition hover:opacity-80"
              priority
            />
          </a>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            LeadAI
            <span className="text-emerald-700 dark:text-emerald-200/80">
              Trust &amp; Innovation (T&amp;I) Compliance Framework
            </span>
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            Governance that keeps your AI infrastructure audit-ready.
          </h1>
          <p className="mt-6 max-w-xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            LeadAI watches your pipelines end-to-end, translating telemetry
            into living compliance scorecards. Ship faster, ship safer, and
            give your auditors the paper trail they demand.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/scorecard"
              className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              View Scorecards
            </a>
            <a
              href="/chat"
              className="inline-flex items-center rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-200"
            >
              Open AI Chatbot
            </a>
            <a
              href="/aireadinesscheck"
              className="inline-flex items-center rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-200"
            >
              AI Readiness Check
            </a>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {highlights.map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="mt-12 flex justify-center lg:mt-0 lg:w-[420px]">
          <DevAuthCard />
        </aside>
      </div>
    </main>
  );
}
