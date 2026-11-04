"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Textarea } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/form-controls";
import { Checkbox } from "@/components/ui/misc";
import { Progress } from "@/components/ui/misc";

const STEPS = ["Upload CV", "Career profile", "Preferences", "Flexibility", "Permissions"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  const [permissions, setPermissions] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [p, pref, perm] = await Promise.all([
        fetch("/api/profile").then((r) => r.json()),
        fetch("/api/preferences").then((r) => r.json()),
        fetch("/api/settings/permissions").then((r) => r.json()),
      ]);
      if (p.profile) setProfile(p.profile);
      if (pref.preferences) setPreferences(pref.preferences);
      if (perm.permissions) setPermissions(perm.permissions);
    })();
  }, []);

  async function uploadCv(file: File) {
    setLoading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/profile", { method: "POST", body: formData });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to parse CV.");
      return;
    }
    setProfile(data.profile);
    setWarnings(data.warnings ?? []);
    setMessage("CV parsed. Review and edit the extracted profile.");
  }

  async function saveProfile() {
    setLoading(true);
    const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error || "Unable to save profile.");
    setProfile(data.profile);
    setMessage("Profile saved.");
  }

  async function savePreferences() {
    setLoading(true);
    const response = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(preferences) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error || "Unable to save preferences.");
    setPreferences(data.preferences);
    setMessage("Preferences saved.");
  }

  async function savePermissions() {
    setLoading(true);
    const response = await fetch("/api/settings/permissions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(permissions) });
    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      return setMessage(data.error || "Unable to save permissions.");
    }
    setMessage("Permissions saved.");
    router.push("/dashboard");
    router.refresh();
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Set up JobPilot</h1>
        <p className="text-muted-foreground">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        <Progress value={progress} className="mt-3" />
      </div>
      {message ? <p className="mb-4 text-sm text-primary">{message}</p> : null}
      {warnings.length ? (
        <Card className="mb-4">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
            {warnings.map((warning) => <p key={warning}>• {warning}</p>)}
          </CardContent>
        </Card>
      ) : null}

      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload your CV</CardTitle>
              <CardDescription>PDF, DOC, DOCX, TXT, or an image. We extract facts only; nothing is invented.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/40 px-5 py-7 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30">
                <input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCv(e.target.files[0])} />
                <span>Choose a CV file (PDF, DOC, DOCX, TXT or image)</span>
              </label>
              <Button onClick={() => setStep(1)}>Continue to profile details</Button>
              <p className="text-xs text-muted-foreground">Nothing uploaded yet? Continue and add your CV later from your profile.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Build an AI CV</CardTitle>
              <CardDescription>Fill in your real details and JobPilot will generate an ATS-friendly CV.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Best if you do not already have a CV. Experience and projects are optional for freshers.</p>
              <Button variant="outline" onClick={() => router.push("/cv-builder")}>Build CV with AI</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Career profile</CardTitle><CardDescription>Edit the extracted information.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Full name</Label><Input value={String(profile.fullName ?? "")} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={String(profile.email ?? "")} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={String(profile.phone ?? "")} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
              <div><Label>City</Label><Input value={String(profile.city ?? "")} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={String(profile.state ?? "")} onChange={(e) => setProfile({ ...profile, state: e.target.value })} /></div>
              <div><Label>Country</Label><Input value={String(profile.country ?? "India")} onChange={(e) => setProfile({ ...profile, country: e.target.value })} /></div>
              <div><Label>Degree</Label><Input value={String(profile.degree ?? "")} onChange={(e) => setProfile({ ...profile, degree: e.target.value })} /></div>
              <div><Label>University</Label><Input value={String(profile.university ?? "")} onChange={(e) => setProfile({ ...profile, university: e.target.value })} /></div>
              <div><Label>Graduation year</Label><Input value={String(profile.graduationYear ?? "")} onChange={(e) => setProfile({ ...profile, graduationYear: e.target.value })} /></div>
              <div><Label>CGPA / percentage</Label><Input value={String(profile.cgpa ?? "")} onChange={(e) => setProfile({ ...profile, cgpa: e.target.value })} /></div>
              <div><Label>Current status</Label><Input value={String(profile.currentStatus ?? "Fresher")} onChange={(e) => setProfile({ ...profile, currentStatus: e.target.value })} /></div>
              <div><Label>Notice period</Label><Input value={String(profile.noticePeriod ?? "")} onChange={(e) => setProfile({ ...profile, noticePeriod: e.target.value })} /></div>
              <div><Label>LinkedIn URL</Label><Input value={String(profile.linkedinUrl ?? "")} onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })} /></div>
              <div><Label>GitHub URL</Label><Input value={String(profile.githubUrl ?? "")} onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })} /></div>
            </div>
            <div><Label>Headline</Label><Input value={String(profile.headline ?? "")} onChange={(e) => setProfile({ ...profile, headline: e.target.value })} /></div>
            <div><Label>Summary</Label><Textarea value={String(profile.summary ?? "")} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} /></div>
            <div><Label>Skills (comma separated)</Label><Input value={Array.isArray(profile.skills) ? profile.skills.map((s: { name: string }) => s.name).join(", ") : ""} onChange={(e) => setProfile({ ...profile, skills: e.target.value.split(",").map((s) => ({ name: s.trim() })).filter((s) => s.name) })} /></div>
            <div><Label>Languages (comma separated)</Label><Input value={Array.isArray(profile.languages) ? profile.languages.join(", ") : ""} onChange={(e) => setProfile({ ...profile, languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={async () => { await saveProfile(); setStep(2); }}>Save and continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Job preferences</CardTitle><CardDescription>Tell JobPilot what you are open to.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Target roles (comma separated)</Label><Input value={Array.isArray(preferences.targetRoles) ? preferences.targetRoles.join(", ") : ""} onChange={(e) => setPreferences({ ...preferences, targetRoles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            <div><Label>Preferred locations (comma separated)</Label><Input value={Array.isArray(preferences.preferredLocations) ? preferences.preferredLocations.join(", ") : ""} onChange={(e) => setPreferences({ ...preferences, preferredLocations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            <div><Label>Industries (comma separated)</Label><Input value={Array.isArray(preferences.industries) ? preferences.industries.join(", ") : ""} onChange={(e) => setPreferences({ ...preferences, industries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            <div><Label>Minimum expected salary (LPA)</Label><Input type="number" value={String(preferences.minSalaryLpa ?? "")} onChange={(e) => setPreferences({ ...preferences, minSalaryLpa: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(preferences.allIndia)} onChange={(e) => setPreferences({ ...preferences, allIndia: e.target.checked })} /> All India</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(preferences.remoteIndia)} onChange={(e) => setPreferences({ ...preferences, remoteIndia: e.target.checked })} /> Remote India</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(preferences.internationalRemote)} onChange={(e) => setPreferences({ ...preferences, internationalRemote: e.target.checked })} /> International remote</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(preferences.salaryFlexible)} onChange={(e) => setPreferences({ ...preferences, salaryFlexible: e.target.checked })} /> Salary flexible</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(preferences.paidInternship)} onChange={(e) => setPreferences({ ...preferences, paidInternship: e.target.checked })} /> Paid internships</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(preferences.unpaidInternship)} onChange={(e) => setPreferences({ ...preferences, unpaidInternship: e.target.checked })} /> Unpaid internships</label>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={async () => { await savePreferences(); setStep(3); }}>Save and continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Career flexibility</CardTitle><CardDescription>JobPilot can broaden your search if you allow it.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["anyIndustry", "Open to any industry"],
              ["anyRole", "Open to any suitable role"],
              ["willingToLearn", "Willing to learn new skills"],
              ["willingToRelocate", "Willing to relocate"],
              ["willingToRemote", "Willing to work remotely"],
              ["entryLevel", "Willing to accept entry-level roles"],
              ["startups", "Willing to work in startups"],
              ["nonCore", "Willing to work in non-core engineering roles"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean((preferences.flexibility as any)?.[key])}
                  onChange={(e) => setPreferences({ ...preferences, flexibility: { ...(preferences.flexibility as object), [key]: e.target.checked } })}
                />
                {label}
              </label>
            ))}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={async () => { await savePreferences(); setStep(4); }}>Save and continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Automation permissions</CardTitle><CardDescription>Default is apply with approval. You can change this later.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Autonomy level</Label>
              <Select value={String(permissions.autonomyLevel ?? 3)} onChange={(e) => setPermissions({ ...permissions, autonomyLevel: Number(e.target.value) })}>
                <option value="1">1 — Discovery only</option>
                <option value="2">2 — Discover + prepare</option>
                <option value="3">3 — Apply with approval (recommended)</option>
                <option value="4">4 — Rule-based auto-apply</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(permissions.demoMode)} onChange={(e) => setPermissions({ ...permissions, demoMode: e.target.checked })} /> Demo mode (no real submissions or emails)</label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={savePermissions} disabled={loading}>{loading ? "Saving…" : "Finish setup"}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}