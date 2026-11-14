import Link from "next/link";

export const metadata = { title: "Privacy policy — JobPilot AI" };

const sections = [
  {
    title: "Information in JobPilot",
    body: [
      "JobPilot stores your account details, uploaded CVs, career profile and preferences, job matches, application drafts and status history, and any integrations you configure. Passwords are stored as salted hashes.",
      "Depending on the deployment, your data is processed by the hosting, database and file-storage providers used to run JobPilot.",
    ],
  },
  {
    title: "When information is shared",
    body: [
      "Public job sources are queried without sending them your candidate profile. If an AI provider is configured, relevant profile details and job-posting text are sent to that provider for career analysis or draft generation. Without an AI provider, JobPilot uses its built-in deterministic fallback.",
      "If you choose an email or browser application method, the approved application information and documents are sent through the configured email service or browser worker to the employer. A configured email provider may also receive your address and digest content to deliver notifications.",
      "Information already delivered to employers or third-party providers is subject to their handling and retention practices and cannot be recalled by deleting your JobPilot account.",
    ],
  },
  {
    title: "Application controls",
    body: [
      "The default is approval for each application. If you deliberately choose rule-based auto-apply, JobPilot may submit drafts that match the categories and score threshold you configured. Sensitive or unanswered questions are held for your review, and JobPilot never accepts offers or signs contracts.",
      "A generated application is a draft. Review its facts, answers and documents before approving it. AI wording can be inaccurate even when prompted to use your profile, so verify the final materials yourself.",
    ],
  },
  {
    title: "Export, deletion and retention",
    body: [
      "Use Settings → Data control to export your account information or delete your account. Deletion removes the account and associated records and files from JobPilot's active storage. Infrastructure providers may retain residual copies in backups under their own retention schedules.",
      "You can update your profile and preferences or change automation permissions at any time before deleting the account.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-6">
        <Link href="/" className="inline-block rounded-lg px-2 py-2 -ml-2 text-sm text-muted-foreground transition-colors hover:text-foreground">← Back to home</Link>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-3 text-muted-foreground">What JobPilot stores, where it is shared, and how to control it.</p>
        <div className="mt-9 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-xl font-semibold tracking-tight">{section.title}</h2>
              <div className="mt-2.5 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
