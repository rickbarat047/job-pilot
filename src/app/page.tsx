import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Target, ShieldCheck, Sparkles, Search } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:py-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">J</div>
            <span className="font-display text-xl font-semibold">JobPilot AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/register" className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">Get started</Link>
          </div>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="accent">India-focused career agent</Badge>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-6xl">
              Find the right work, not just more work.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Upload your CV once. JobPilot discovers real vacancies across startups, manufacturers, services and software companies, scores them against your actual profile, and prepares truthful, ATS-ready applications you control.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create your agent</Link>
              <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-transparent px-6 text-sm font-medium hover:bg-muted">I already have an account</Link>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 text-sm">
              <div><div className="font-display text-2xl font-semibold">Real</div><div className="text-muted-foreground">Live ATS sources</div></div>
              <div><div className="font-display text-2xl font-semibold">Explainable</div><div className="text-muted-foreground">Match scores</div></div>
              <div><div className="font-display text-2xl font-semibold">Permissioned</div><div className="text-muted-foreground">You approve submissions</div></div>
            </div>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="space-y-4 p-6">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Strong match</div>
                <div className="mt-1 font-display text-xl font-semibold">Graduate Engineer Trainee — Bosch Group</div>
                <div className="mt-2 text-sm text-muted-foreground">Bengaluru, India · 86% match · Fresher friendly</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border"><div className="h-full w-[86%] bg-primary" /></div>
              </div>
              <div className="grid gap-3">
                {[
                  { icon: Search, title: "Broad discovery", text: "Automobile, software, operations, support, finance and more." },
                  { icon: Target, title: "Honest matching", text: "No fabricated qualifications, no fake experience." },
                  { icon: ShieldCheck, title: "Approval first", text: "Submissions stay under your control by default." },
                  { icon: Sparkles, title: "Tailored materials", text: "Resume, cover letter and recruiter email per role." },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
