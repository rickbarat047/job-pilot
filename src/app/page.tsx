import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { Reveal } from "@/components/reveal";
import {
  Search, Target, ShieldCheck, FileText, Bot, Sparkles, ArrowRight, CheckCircle2,
  Building2, Lock, Eye, Mic, BookOpenText, MessagesSquare, PenLine,
} from "lucide-react";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#capabilities" },
  { label: "Privacy", href: "#privacy" },
];

const trustPoints = [
  { icon: ShieldCheck, title: "Approval-first applications", body: "Nothing is submitted until you review and approve it." },
  { icon: FileText, title: "Honest CV-based matching", body: "Scores come from your real CV. Nothing is invented or inflated." },
  { icon: Eye, title: "No fabricated experience", body: "JobPilot never adds qualifications, dates or skills you don't have." },
  { icon: Building2, title: "Relevant opportunities across India", body: "Trusted employers and boards — engineering to operations." },
  { icon: Lock, title: "User-controlled activity", body: "You decide what the agent does, and can stop it at any time." },
];

const steps = [
  { title: "Upload your CV", body: "We extract your real skills, experience and education — never rewriting your history." },
  { title: "Discover relevant opportunities", body: "Live vacancies across India are scanned and scored against your actual profile." },
  { title: "Prepare tailored applications", body: "Resume, cover letter and recruiter notes drafted for each specific role." },
  { title: "Review and approve applications", body: "Nothing sends itself. You approve, edit, or skip every single submission." },
];

/* Illustrative preview content — clearly labeled, never mixed with real product data. */
const previewMatches = [
  { title: "Graduate Software Engineer", company: "Fintech scale-up · Bengaluru", score: 87, tag: "Strong match" },
  { title: "Associate Software Engineer", company: "Global IT services · Hyderabad", score: 74, tag: "Good match" },
  { title: "Backend Developer Intern", company: "SaaS platform · Remote (India)", score: 66, tag: "Worth a look" },
];
const previewTracker = [
  { role: "Graduate Software Engineer", state: "Awaiting your approval" },
  { role: "Data Analyst (Entry)", state: "Resume tailored" },
  { role: "Support Engineer", state: "Cover letter drafted" },
];

function PreviewFrame({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_60px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="truncate text-xs font-medium text-foreground">{title}</span>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="space-y-2.5 p-4">{children}</div>
    </div>
  );
}

function MatchRow({ item }: { item: (typeof previewMatches)[number] }) {
  const tone = item.score >= 80 ? "text-emerald-600 dark:text-emerald-400" : item.score >= 70 ? "text-foreground" : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="truncate text-xs text-muted-foreground">{item.company}</div>
        </div>
        <div className={`shrink-0 text-sm font-semibold tabular-nums ${tone}`}>{item.score}%</div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary" style={{ width: `${item.score}%` }} />
        </div>
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{item.tag}</span>
      </div>
    </div>
  );
}

const capabilities = [
  { icon: Search, title: "AI job discovery", body: "Broad, continuous searches across engineering, IT, business, support, operations and non-core roles — scored as they land.", featured: true },
  { icon: Target, title: "Smart career matching", body: "Explainable scores built from skills, experience, education, location and preferences." },
  { icon: PenLine, title: "Resume customization", body: "ATS-friendly tailored resumes — grounded in your real CV, never embellished." },
  { icon: FileText, title: "Cover letter generation", body: "Role-specific cover letters drafted from your profile for every application." },
  { icon: Bot, title: "Application management", body: "Track every application, its documents and its next action in one place." },
  { icon: Mic, title: "Interview preparation", body: "Company research, role-specific questions and answers drawn from your genuine background." },
  { icon: BookOpenText, title: "Company research", body: "Compact company briefs so you walk into every interview informed." },
  { icon: MessagesSquare, title: "Follow-up assistance", body: "Polite, personal follow-up drafts after applications and interviews." },
];

export default function LandingPage() {
  return (
    <main id="top" className="min-h-dvh">
      <MarketingNav links={navLinks} />

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-6 md:pt-16 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <Reveal className="space-y-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Built for India&apos;s next generation of professionals
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-foreground sm:text-5xl md:text-[3.4rem]">
              Your next opportunity.{" "}
              <span className="text-primary">Already in motion.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Discover relevant jobs across India, create tailored applications, and manage your entire
              job search with an intelligent career assistant that keeps you in control.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_14px_32px_-14px_color-mix(in_srgb,var(--primary)_60%,transparent)] transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto">
                Start your job search <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98] sm:w-auto">
                Explore how it works
              </a>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {["Approval-first", "CV-true matching", "Made for India"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Illustrative product preview */}
          <Reveal delay={0.12} className="relative overflow-x-clip">
            <div className="absolute -inset-6 -z-10 hidden rounded-[2rem] bg-gradient-to-br from-accent/70 via-transparent to-transparent sm:block" aria-hidden="true" />
            <div className="space-y-3">
              <p className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Illustrative preview</p>
              <PreviewFrame title="Job discovery" label="Demo data">
                {previewMatches.map((item) => (
                  <MatchRow key={item.title} item={item} />
                ))}
              </PreviewFrame>
              <PreviewFrame title="Application tracker" label="Demo data">
                <div className="space-y-2.5">
                  {previewTracker.map((item, index) => (
                    <div key={item.role} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.role}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.state}</div>
                      </div>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </PreviewFrame>
              <PreviewFrame title="Resume readiness" label="Demo data">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FileText className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Tailored resume prepared</div>
                    <div className="text-xs text-muted-foreground">Matched to the role description — ready for your review</div>
                  </div>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                </div>
              </PreviewFrame>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust */}
      <section id="product" className="scroll-mt-20 border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-18">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Trust by design</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">An assistant you can actually hand your career to.</h2>
          </Reveal>
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trustPoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <Reveal key={point.title} delay={index * 0.05}>
                  <div className="h-full rounded-2xl border border-border bg-background p-5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-medium text-foreground">{point.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                  </div>
                </Reveal>
              );
            })}
            <Reveal delay={0.25}>
              <div className="flex h-full flex-col justify-between rounded-2xl bg-[#111827] p-5 text-white">
                <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                <p className="mt-6 font-display text-xl font-medium leading-snug">
                  If it isn&apos;t true, JobPilot won&apos;t write it.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Our matching and documents are built strictly from what your CV already says.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works — connected timeline */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 md:py-24 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">From CV to interview, in four calm steps</h2>
          <p className="mt-3 text-muted-foreground">JobPilot does the legwork. You stay the decision maker on every submission.</p>
        </Reveal>
        <ol className="relative mt-10 grid gap-6 md:grid-cols-4 md:gap-5">
          <span className="absolute left-[17px] top-2 bottom-2 w-px bg-border md:hidden" aria-hidden="true" />
          <span className="absolute left-[9%] right-[9%] top-[17px] hidden h-px bg-border md:block" aria-hidden="true" />
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.06}>
              <li className="relative flex gap-4 md:flex-col md:gap-0">
                <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card font-display text-sm font-semibold text-primary shadow-[0_0_0_6px_var(--background)]">
                  {index + 1}
                </span>
                <div className="min-w-0 md:mt-4">
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Capabilities — varied bento layout */}
      <section id="capabilities" className="scroll-mt-20 border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Capabilities</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Everything a job seeker needs. Nothing they don&apos;t.</h2>
          </Reveal>
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item, index) => {
              const Icon = item.icon;
              const featured = item.featured;
              return (
                <Reveal key={item.title} delay={index * 0.04} className={featured ? "sm:col-span-2 sm:row-span-2" : undefined}>
                  <div className={`flex h-full min-w-0 flex-col rounded-2xl border border-border bg-background p-5 ${featured ? "sm:justify-end sm:bg-gradient-to-b sm:from-background sm:to-accent/60 sm:p-7" : ""}`}>
                    <span className={`grid w-9 shrink-0 place-items-center rounded-xl text-primary ${featured ? "h-10 bg-primary text-primary-foreground sm:h-11 sm:w-11" : "h-9 bg-primary/10"}`}>
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <h3 className={`mt-4 font-semibold text-foreground ${featured ? "text-lg sm:mt-6" : ""}`}>{item.title}</h3>
                    <p className={`mt-1.5 text-sm leading-relaxed text-muted-foreground ${featured ? "max-w-md" : ""}`}>{item.body}</p>
                    {featured ? (
                      <Link href="/register" className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-2 text-sm font-medium text-primary transition-colors hover:opacity-80">
                        Try job discovery <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Privacy — dark section */}
      <section id="privacy" className="scroll-mt-20 bg-[#111827] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24 sm:px-6">
          <Reveal className="space-y-4">
            <p className="text-sm font-medium text-emerald-400">Privacy and user control</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">Your approval is the last word. Every time.</h2>
            <p className="leading-relaxed text-slate-300">
              JobPilot prepares applications; it never sends them on its own. Your CV and documents stay yours, and the agent only acts on what you allow.
            </p>
            <Link href="/privacy" className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-2 text-sm font-medium text-emerald-400 transition-opacity hover:opacity-80">
              Read the full privacy policy <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="grid gap-3">
              {[
                "You control your application submissions",
                "No fabricated qualifications — ever",
                "Your data stays protected and portable",
                "Applications require approval by default",
                "Manage or delete your information yourself",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Ready to move?</h2>
            <p className="mt-3 text-muted-foreground">Create your free agent and start from your real CV. Applications stay under your control.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-medium text-primary-foreground shadow-[0_14px_32px_-14px_color-mix(in_srgb,var(--primary)_60%,transparent)] transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto">
                Start your job search <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-7 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98] sm:w-auto">
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">J</span>
            <span className="font-display font-semibold text-foreground">JobPilot AI</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
            <a href="/login" className="transition-colors hover:text-foreground">Sign in</a>
            <a href="/register" className="transition-colors hover:text-foreground">Get started</a>
            <a href="/privacy" className="transition-colors hover:text-foreground">Privacy policy</a>
            <a href="/terms" className="transition-colors hover:text-foreground">Terms</a>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} JobPilot AI</p>
        </div>
      </footer>
    </main>
  );
}
