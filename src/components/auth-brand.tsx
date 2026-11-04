import { ShieldCheck, FileText, Target } from "lucide-react";

/**
 * Shared brand panel for the split-screen auth layout (desktop only).
 * Pure marketing content — never mixes in real user data.
 */
export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#111827] text-white lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:p-10">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-emerald-400/[0.07] blur-3xl" aria-hidden="true" />

      <div className="relative flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 font-bold text-emerald-400">J</span>
        <span className="font-display text-lg font-semibold tracking-tight">JobPilot AI</span>
      </div>

      <div className="relative max-w-sm space-y-6">
        <h2 className="font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em]">
          Your next opportunity. Already in motion.
        </h2>
        <ul className="space-y-3.5 text-sm text-slate-300">
          {[
            { icon: Target, text: "Real vacancies across India, scored against your actual CV" },
            { icon: FileText, text: "Tailored resumes and cover letters for every role" },
            { icon: ShieldCheck, text: "Approval-first — nothing is ever submitted without you" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-emerald-400">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="relative text-xs leading-relaxed text-slate-400">
        Built for India&apos;s next generation of professionals. Applications stay under your control, by default.
      </p>
    </div>
  );
}
