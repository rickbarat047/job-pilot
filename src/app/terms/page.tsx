import Link from "next/link";

export const metadata = { title: "Terms of service — JobPilot AI" };

const sections = [
  {
    title: "Using JobPilot AI",
    body: "JobPilot AI is an assistant that helps you discover real vacancies, prepare tailored application materials and track your job search. You are responsible for the accuracy of the CV and profile information you provide.",
  },
  {
    title: "Application permissions",
    body: "The default setting requires your approval for each submission. Rule-based auto-apply requires autonomy level 4, a separate permission to submit without per-application review, at least one selected role category and a match-score threshold. Sensitive or unanswered questions remain paused for review. JobPilot never accepts offers or signs contracts for you.",
  },
  {
    title: "Review your materials",
    body: "JobPilot uses your profile to prepare application drafts, but automated wording and match scores can be inaccurate. Review the facts, answers and documents before applying. Do not use the product to misrepresent your qualifications, and only upload documents you have the right to use.",
  },
  {
    title: "No guarantees of employment",
    body: "Match scores indicate relevance against your profile, not hiring outcomes. We cannot guarantee that any application results in an interview or offer.",
  },
  {
    title: "Availability and changes",
    body: "Job discovery depends on third-party job boards and employers, whose listings may change or disappear. Features may evolve as the product improves.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-6">
        <Link href="/" className="inline-block rounded-lg px-2 py-2 -ml-2 text-sm text-muted-foreground transition-colors hover:text-foreground">← Back to home</Link>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.02em]">Terms of service</h1>
        <p className="mt-3 text-muted-foreground">The short version, in plain language.</p>
        <div className="mt-9 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
