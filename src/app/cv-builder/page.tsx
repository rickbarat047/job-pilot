"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Textarea } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/form-controls";
import { Sparkles, Plus, X } from "lucide-react";
import { getDegreeSkills, DEGREE_SKILLS } from "@/lib/taxonomy";
export default function CvBuilderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Record<string, unknown>>({
    fullName: "", email: "", phone: "", city: "", state: "", country: "India",
    headline: "", summary: "", degree: "", university: "", graduationYear: "", cgpa: "",
    currentStatus: "Fresher", noticePeriod: "", linkedinUrl: "", githubUrl: "", portfolioUrl: "",
    languages: [], skills: [], experience: [], internships: [], projects: [], certifications: [], education: [],
  });
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [assisting, setAssisting] = useState(false);
  const [generated, setGenerated] = useState<{ pdfPath: string; docxPath: string } | null>(null);

  const matchingDegrees = useMemo(() => {
    const input = String(profile.degree ?? "").trim().toLowerCase();
    if (!input) return [];
    const words = input.split(/\s+/).filter(Boolean);
    return Object.keys(DEGREE_SKILLS)
      .filter((d) => d.toLowerCase() !== input && words.every((w) => d.toLowerCase().includes(w)))
      .slice(0, 10);
  }, [profile.degree]);

  const degreeSkills = useMemo(() => getDegreeSkills(String(profile.degree ?? "")), [profile.degree]);

  const addDegreeSkill = useCallback((skill: string) => {
    setProfile((current) => {
      const existing = Array.isArray(current.skills) ? current.skills.map((s: { name: string }) => s.name) : [];
      if (existing.includes(skill)) return current;
      return { ...current, skills: [...existing, skill].map((name) => ({ name })) };
    });
  }, []);

  const removeSkill = useCallback((skillName: string) => {
    setProfile((current) => {
      const existing = Array.isArray(current.skills) ? current.skills.map((s: { name: string }) => s.name) : [];
      return { ...current, skills: existing.filter((n) => n !== skillName).map((name) => ({ name })) };
    });
  }, []);

  async function assist() {
    setAssisting(true);
    setMessage("");
    const response = await fetch("/api/profile/ai-assist-cv", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetRole, profile }),
    });
    const data = await response.json();
    setAssisting(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to generate AI assistance.");
      return;
    }
    setProfile((current) => {
      const currentSkills = Array.isArray(current.skills) ? current.skills.map((s: { name: string }) => s.name) : [];
      const suggested = Array.isArray(data.suggestedSkills) ? data.suggestedSkills : [];
      const merged = [...new Set([...currentSkills, ...suggested])].map((name) => ({ name }));
      return { ...current, summary: data.summary || current.summary, skills: merged };
    });
    setMessage(`AI assistance added. Provider: ${data.provider}. Review and remove anything that is not accurate.`);
  }

  async function generate() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/profile/generate-cv", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetRole, profile }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to generate CV.");
      return;
    }
    setGenerated({ pdfPath: data.pdfPath, docxPath: data.docxPath });
    setMessage("AI CV generated. Download it below or open your profile.");
  }

  function update(field: string, value: unknown) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl">
        <Link href="/profile" className="inline-flex items-center gap-2 rounded-lg px-2 py-2 -ml-2 text-sm text-muted-foreground hover:text-foreground">
          <span aria-hidden>←</span> Back to profile
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">J</div>
          <span className="font-display text-base font-semibold">JobPilot</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-accent/20 px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AI CV builder
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Build an AI CV</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Fill in your real details. JobPilot formats them into an ATS-friendly CV and never invents experience, skills or education.
          </p>
        </div>
      </section>
      {message ? <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{message}</p> : null}
      <Card>
        <CardHeader><CardTitle>Target role</CardTitle></CardHeader>
        <CardContent>
          <Label>Role you are applying for</Label>
          <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Basic details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Full name</Label><Input value={String(profile.fullName ?? "")} onChange={(e) => update("fullName", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={String(profile.email ?? "")} onChange={(e) => update("email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={String(profile.phone ?? "")} onChange={(e) => update("phone", e.target.value)} /></div>
          <div><Label>City</Label><Input value={String(profile.city ?? "")} onChange={(e) => update("city", e.target.value)} /></div>
          <div><Label>Degree</Label><div className="relative"><Input value={String(profile.degree ?? "")} onChange={(e) => update("degree", e.target.value)} />{matchingDegrees.length > 0 && <div className="absolute left-0 right-0 mt-1 z-10 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto"><ul className="py-1">{matchingDegrees.map((d) => (<li key={d}><button type="button" onClick={() => { update("degree", d); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">{d}</button></li>))}</ul></div>}</div></div>
          <div><Label>University</Label><Input value={String(profile.university ?? "")} onChange={(e) => update("university", e.target.value)} /></div>
          <div><Label>Graduation year</Label><Input value={String(profile.graduationYear ?? "")} onChange={(e) => update("graduationYear", e.target.value)} /></div>
          <div><Label>CGPA / percentage</Label><Input value={String(profile.cgpa ?? "")} onChange={(e) => update("cgpa", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Skills and summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Skills (comma separated)</Label><Input value={Array.isArray(profile.skills) ? profile.skills.map((s: { name: string }) => s.name).join(", ") : ""} onChange={(e) => update("skills", e.target.value.split(",").map((s) => ({ name: s.trim() })).filter((s) => s.name))} /></div>
          {degreeSkills.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suggested skills for your degree ({String(profile.degree)})</Label>
              <div className="flex flex-wrap gap-2">
                {degreeSkills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => addDegreeSkill(skill)}
                    className="px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors"
                  >
                    {skill}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Click a skill to add it to your profile.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(profile.skills) ? profile.skills : []).map((s: { name: string }) => (
              <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
                {s.name}
                <button type="button" onClick={() => removeSkill(s.name)} className="ml-1 hover:text-destructive">
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
          <div><Label>Languages (comma separated)</Label><Input value={Array.isArray(profile.languages) ? profile.languages.join(", ") : ""} onChange={(e) => update("languages", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
          <div><Label>Professional summary</Label><Textarea value={String(profile.summary ?? "")} onChange={(e) => update("summary", e.target.value)} /></div>
          <Button type="button" variant="outline" onClick={assist} disabled={assisting}>{assisting ? "Generating assistance…" : "AI write summary and suggest skills"}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Experience and projects</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Internships / experience (optional — one per line: Role | Company | Description)</Label><Textarea value={Array.isArray(profile.internships) ? profile.internships.map((e: { role: string; company: string; description: string }) => `${e.role} | ${e.company} | ${e.description}`).join("\n") : ""} onChange={(e) => update("internships", e.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
            const parts = line.split("|").map((p) => p.trim());
            return { role: parts[0] || "Role", company: parts[1] || "Company", description: parts.slice(2).join(" | ") || "", startDate: null, endDate: null, location: null, highlights: [] };
          }))} /></div>
          <div><Label>Projects (optional — one per line: Name | Description | Technologies)</Label><Textarea value={Array.isArray(profile.projects) ? profile.projects.map((p: { name: string; description: string; technologies?: string[] }) => `${p.name} | ${p.description} | ${(p.technologies ?? []).join(", ")}`).join("\n") : ""} onChange={(e) => update("projects", e.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
            const parts = line.split("|").map((p) => p.trim());
            return { name: parts[0] || "Project", description: parts[1] || "", technologies: (parts[2] ?? "").split(",").map((t) => t.trim()).filter(Boolean), link: null };
          }))} /></div>
          <div><Label>Certifications (comma separated)</Label><Input value={Array.isArray(profile.certifications) ? profile.certifications.join(", ") : ""} onChange={(e) => update("certifications", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></div>
        </CardContent>
      </Card>
      {generated ? (
        <Card>
          <CardHeader><CardTitle>Generated CV</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a href={`/api/documents/${generated.pdfPath}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">Download PDF</a>
            <a href={`/api/documents/${generated.docxPath}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-transparent px-4 text-sm font-medium hover:bg-muted">Download DOCX</a>
            <Button variant="outline" onClick={() => router.push("/profile")}>Open profile</Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        JobPilot uses only the details you enter. It will not invent employers, degrees, certifications or skills. Review the AI-assisted summary before generating.
      </div>
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <Button onClick={generate} disabled={loading} className="w-full" size="lg">{loading ? "Generating CV…" : "Generate AI CV"}</Button>
      </div>
    </main>
    </div>
  );
}
