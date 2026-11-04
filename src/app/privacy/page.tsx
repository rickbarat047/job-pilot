import Link from "next/link";

export const metadata = { title: "Privacy policy — JobPilot AI" };

const sections = [
  {
    title: "What we store",
    body: [
      "Your account details (name and email), the CV and documents you upload, your career profile, and the job matches, applications and activity generated as you use the product.",
      "Passwords are stored only as salted hashes and can never be read by us.",
    ],
  },
  {
    title: "How your data is used",
    body: [
      "To match you with real vacancies, prepare tailored resumes and cover letters, and manage your applications.",
      "We never sell your personal data, and we do not send unsolicited bulk outreach on your behalf.",
    ],
  },
  {
    title: "Approval-first by default",
    body: [
      "Nothing is submitted to an employer until you review and approve that specific submission.",
      "Automation actions are always shown as \"prepared\" or \"submitted\" — you can verify the real status at any time.",
    ],
  },
  {
    title: "No fabricated qualifications",
    body: [
      "JobPilot builds resumes, cover letters and application answers strictly from information in your real CV and profile.",
      "It does not invent work history, degrees, certifications, projects or skills you do not have.",
    ],
  },
  {
    title: "Your controls",
    body: [
      "You can update your profile, upload or replace your CV, pause or stop automation, and manage every application yourself.",
      "You can request deletion of your account and data by contacting us from your account email.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-6">
        <Link href="/" className="inline-block rounded-lg px-2 py-2 -ml-2 text-sm text-muted-foreground transition-colors hover:text-foreground">← Back to home</Link>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-3 text-muted-foreground">Plain language, because your data deserves it.</p>
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
