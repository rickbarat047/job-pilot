"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Materials {
  summary: string;
  coverLetterText: string;
  emailSubject?: string;
  emailBody?: string;
  emailTo?: string;
}

export function ApplicationMaterialsEditor({ applicationId, materials, editable, onDirtyChange }: {
  applicationId: string;
  materials: Materials;
  editable: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [original, setOriginal] = useState(materials);
  const [form, setForm] = useState(materials);
  const [saving, setSaving] = useState(false);
  const dirty = (value: Materials) => Object.keys(original).some((key) => value[key as keyof Materials] !== original[key as keyof Materials]);

  function update(patch: Partial<Materials>) {
    const next = { ...form, ...patch };
    setForm(next);
    onDirtyChange?.(dirty(next));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/materials`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save materials.");
      setOriginal(form);
      onDirtyChange?.(false);
      toast.success("Application materials saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save materials.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Read and edit the generated text before approval. Your listed experience, education, projects and skills remain based on your profile.
      </p>
      <div>
        <label htmlFor="resume-summary" className="text-sm font-medium">Resume summary</label>
        {editable ? (
          <textarea id="resume-summary" className="mt-1 min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={2000} value={form.summary} disabled={saving} onChange={(event) => update({ summary: event.target.value })} />
        ) : <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{form.summary}</p>}
      </div>
      <div>
        <label htmlFor="cover-letter-text" className="text-sm font-medium">Cover letter</label>
        {editable ? (
          <textarea id="cover-letter-text" className="mt-1 min-h-64 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={12000} value={form.coverLetterText} disabled={saving} onChange={(event) => update({ coverLetterText: event.target.value })} />
        ) : <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{form.coverLetterText}</p>}
      </div>
      {form.emailSubject !== undefined && form.emailBody !== undefined ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="text-sm font-medium">Recruiter email draft</div>
          {form.emailTo ? <p className="text-xs text-muted-foreground">Recipient: {form.emailTo}</p> : null}
          {editable ? (
            <>
              <div><label htmlFor="recruiter-email-subject" className="text-xs font-medium">Subject</label><input id="recruiter-email-subject" className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={300} value={form.emailSubject} disabled={saving} onChange={(event) => update({ emailSubject: event.target.value })} /></div>
              <div><label htmlFor="recruiter-email-body" className="text-xs font-medium">Message</label><textarea id="recruiter-email-body" className="mt-1 min-h-48 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={12000} value={form.emailBody} disabled={saving} onChange={(event) => update({ emailBody: event.target.value })} /></div>
            </>
          ) : <p className="whitespace-pre-wrap text-sm text-muted-foreground">{form.emailBody}</p>}
        </div>
      ) : null}
      {editable ? <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save material edits"}</Button> : null}
    </div>
  );
}
