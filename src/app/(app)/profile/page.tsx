"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Textarea } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Upload } from "lucide-react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [generatedCvs, setGeneratedCvs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const [profileResponse, versionsResponse] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/resume-versions"),
      ]);
      const profileData = await profileResponse.json();
      const versionsData = await versionsResponse.json();
      if (profileData.profile) setProfile(profileData.profile);
      if (versionsData.versions) setGeneratedCvs(versionsData.versions);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
    const data = await response.json();
    setSaving(false);
    if (response.ok) { setProfile(data.profile); setMessage("Profile saved."); } else setMessage(data.error || "Unable to save.");
  }

  async function upload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/profile", { method: "POST", body: formData });
    const data = await response.json();
    setUploading(false);
    if (response.ok) { setProfile(data.profile); setMessage("CV parsed and profile updated."); } else setMessage(data.error || "Unable to parse CV.");
  }

  async function analyze() {
    setAnalyzing(true);
    const response = await fetch("/api/profile/career-analysis", { method: "POST" });
    const data = await response.json();
    setAnalyzing(false);
    if (response.ok) setAnalysis(data);
  }

  const skills = Array.isArray(profile.skills) ? profile.skills.map((s: { name: string }) => s.name).filter(Boolean) : [];
  const completeness = (() => {
    const fields = ["fullName", "email", "phone", "city", "degree", "university", "summary", "headline"];
    const filled = fields.filter((field) => String(profile[field] ?? "").trim()).length;
    const skillScore = skills.length > 0 ? 1 : 0;
    return Math.round(((filled + skillScore) / (fields.length + 1)) * 100);
  })();
  const initials = String(profile.fullName ?? "U").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-accent/20 px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
              {initials}
            </span>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Career profile</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your single source of truth. Every tailored CV, match score and application is built from this.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{completeness}% complete</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/cv-builder" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
              <Sparkles className="mr-2 h-4 w-4" /> Build an AI CV
            </a>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Upload or update CV</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">PDF, DOC, DOCX or TXT. We extract facts only — nothing is invented.</p>
          </div>
          <Upload className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/40 px-6 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30">
            <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <FileText className="h-5 w-5" />
            {uploading ? "Parsing your CV…" : "Choose a file or drag it here"}
          </label>
          {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <p className="text-sm text-muted-foreground">Edit anything the parser missed. Changes flow into every future application.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Full name</Label><Input value={String(profile.fullName ?? "")} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={String(profile.email ?? "")} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={String(profile.phone ?? "")} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <div><Label>City</Label><Input value={String(profile.city ?? "")} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></div>
            <div><Label>Degree</Label><Input value={String(profile.degree ?? "")} onChange={(e) => setProfile({ ...profile, degree: e.target.value })} /></div>
            <div><Label>University</Label><Input value={String(profile.university ?? "")} onChange={(e) => setProfile({ ...profile, university: e.target.value })} /></div>
            <div><Label>Graduation year</Label><Input value={String(profile.graduationYear ?? "")} onChange={(e) => setProfile({ ...profile, graduationYear: e.target.value })} /></div>
            <div><Label>CGPA</Label><Input value={String(profile.cgpa ?? "")} onChange={(e) => setProfile({ ...profile, cgpa: e.target.value })} /></div>
          </div>
          <div><Label>Headline</Label><Input value={String(profile.headline ?? "")} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} /></div>
          <div><Label>Summary</Label><Textarea value={String(profile.summary ?? "")} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} /></div>
          <div><Label>Skills (comma separated)</Label><Input value={skills.join(", ")} onChange={(e) => setProfile({ ...profile, skills: e.target.value.split(",").map((s) => ({ name: s.trim() })).filter((s) => s.name) })} /></div>
          <div><Label>Languages (comma separated)</Label><Input value={Array.isArray(profile.languages) ? profile.languages.join(", ") : ""} onChange={(e) => setProfile({ ...profile, languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
          {message ? <p className="text-sm text-primary">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Generated CVs</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Master CVs created from your verified profile.</p>
          </div>
          <Badge variant="secondary">{generatedCvs.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {generatedCvs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generated CVs yet. Use the AI CV Builder to create one.</p>
          ) : null}
          {generatedCvs.map((cv) => (
            <div key={cv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/30">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium">{cv.title}</div>
                  <div className="text-xs text-muted-foreground">{cv.kind} · {new Date(cv.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {cv.pdf ? <a href={`/api/documents/${cv.pdf}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-xs font-medium hover:bg-muted">PDF</a> : null}
                {cv.docx ? <a href={`/api/documents/${cv.docx}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-xs font-medium hover:bg-muted">DOCX</a> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>AI career discovery</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Suggest career paths from your verified skills and experience.</p>
          </div>
          <Button onClick={analyze} disabled={analyzing}>{analyzing ? "Analyzing…" : "Analyze"}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{String(analysis.summary ?? "")}</p>
              {Array.isArray(analysis.paths) ? analysis.paths.map((path: { label: string; fitScore: number; rationale: string; bridgeSkills?: string[] }) => (
                <div key={path.label} className="rounded-2xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/30">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{path.label}</div>
                    <Badge variant="secondary">{path.fitScore}%</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{path.rationale}</p>
                  {path.bridgeSkills?.length ? <p className="mt-1 text-xs text-muted-foreground">Bridge skills: {path.bridgeSkills.join(", ")}</p> : null}
                </div>
              )) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run an analysis to see career paths tailored to your profile.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
