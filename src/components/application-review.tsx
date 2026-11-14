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
  const hasUnsavedEdits = unsavedQuestions || unsavedMaterials;
  const editable = ["Draft Ready", "Awaiting Approval"].includes(state);

  return (
    <div className="space-y-4">
      <DataCard title="Actions" description="Application actions follow your review settings.">
        <ApplicationActions id={id} state={state} method={method} applicationUrl={applicationUrl} approvalDisabled={hasUnsavedEdits} />
      </DataCard>
      <Card>
        <CardHeader><CardTitle>Review your application text</CardTitle></CardHeader>
        <CardContent>
          <ApplicationMaterialsEditor applicationId={id} materials={materials} editable={editable} onDirtyChange={setUnsavedMaterials} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Application questions</CardTitle></CardHeader>
        <CardContent>
          <ApplicationQuestionsEditor
            applicationId={id}
            questions={questions}
            editable={editable}
            onDirtyChange={setUnsavedQuestions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
