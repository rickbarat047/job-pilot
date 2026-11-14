"use client";

import { useState } from "react";
import { ApplicationActions } from "@/components/application-actions";
import { ApplicationMaterialsEditor } from "@/components/application-materials-editor";
import { ApplicationQuestionsEditor } from "@/components/application-questions-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataCard } from "@/components/ui/data-card";

interface Question {
  id: string;
  question: string;
  answer: string;
  requiresApproval: boolean;
  sensitive: boolean;
}

export function ApplicationReview({
  id,
  state,
  method,
  applicationUrl,
  questions,
  materials,
}: {
  id: string;
  state: string;
  method: string;
  applicationUrl: string;
  questions: Question[];
  materials: {
    summary: string;
    coverLetterText: string;
    emailSubject?: string;
    emailBody?: string;
    emailTo?: string;
  };
}) {
  const [unsavedQuestions, setUnsavedQuestions] = useState(false);
  const [unsavedMaterials, setUnsavedMaterials] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const hasUnsavedEdits = unsavedQuestions || unsavedMaterials;
  const editable = ["Draft Ready", "Awaiting Approval"].includes(state);

  function onQuestionsDirty(dirty: boolean) {
    if (dirty) setReviewed(false);
    setUnsavedQuestions(dirty);
  }

  function onMaterialsDirty(dirty: boolean) {
    if (dirty) setReviewed(false);
    setUnsavedMaterials(dirty);
  }

  return (
    <div className="space-y-4">
      <DataCard title="Actions" description="Application actions follow your review settings.">
        <ApplicationActions id={id} state={state} method={method} applicationUrl={applicationUrl} approvalDisabled={hasUnsavedEdits || !reviewed} />
      </DataCard>
      <Card>
        <CardHeader><CardTitle>Review your application text</CardTitle></CardHeader>
        <CardContent>
          <ApplicationMaterialsEditor applicationId={id} materials={materials} editable={editable} onDirtyChange={onMaterialsDirty} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Application questions</CardTitle></CardHeader>
        <CardContent>
          <ApplicationQuestionsEditor
            applicationId={id}
            questions={questions}
            editable={editable}
            onDirtyChange={onQuestionsDirty}
          />
        </CardContent>
      </Card>
      {editable ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
            disabled={hasUnsavedEdits}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="font-medium">I reviewed these application materials and answers.</span>
            <span className="mt-1 block text-xs text-muted-foreground">Check that the role is right and every detail matches your background before approving.</span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
