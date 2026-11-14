"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Question {
  id: string;
  question: string;
  answer: string;
  requiresApproval: boolean;
  sensitive: boolean;
}

export function ApplicationQuestionsEditor({ applicationId, questions, editable, onDirtyChange }: {
  applicationId: string;
  questions: Question[];
  editable: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map((question) => [question.id, question.answer])));
  const [saving, setSaving] = useState(false);

  function updateAnswer(id: string, answer: string) {
    const next = { ...answers, [id]: answer };
    setAnswers(next);
    onDirtyChange?.(questions.some((question) => (next[question.id] ?? "") !== question.answer));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/questions`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: questions.map(({ id }) => ({ id, answer: answers[id] ?? "" })) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save answers.");
      onDirtyChange?.(false);
      toast.success("Application answers saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save answers.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Review and edit these drafts before approving. Questions that need personal details or a decision stay blank until you answer them.
      </p>
      {questions.length === 0 ? <p className="text-sm text-muted-foreground">No questions generated.</p> : null}
      {questions.map((question) => (
        <div key={question.id} className="rounded-xl border border-border p-3 text-sm">
          <label htmlFor={`answer-${question.id}`} className="font-medium">{question.question}</label>
          {editable ? (
            <textarea
              id={`answer-${question.id}`}
              className="mt-2 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={answers[question.id] ?? ""}
              onChange={(event) => updateAnswer(question.id, event.target.value)}
              maxLength={10000}
              placeholder="Add or edit your answer"
            />
          ) : answers[question.id] ? (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{answers[question.id]}</p>
          ) : (
            <p className="mt-1 text-amber-700 dark:text-amber-400">Needs your input on the employer’s application form.</p>
          )}
          {question.sensitive || question.requiresApproval ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">This personal answer is never filled in automatically. Review it on the employer’s application form.</p> : null}
        </div>
      ))}
      {editable && questions.length > 0 ? <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save answers"}</Button> : null}
    </div>
  );
}
