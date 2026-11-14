"use client";

import { useState } from "react";
import { ApplicationActions } from "@/components/application-actions";
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
  questions,
}: {
  id: string;
  state: string;
  method: string;
  questions: Question[];
}) {
  const [hasUnsavedAnswers, setHasUnsavedAnswers] = useState(false);
  const editable = ["Draft Ready", "Awaiting Approval"].includes(state);

  return (
    <div className="space-y-4">
      <DataCard title="Actions" description="Application actions follow your review settings.">
        <ApplicationActions id={id} state={state} method={method} approvalDisabled={hasUnsavedAnswers} />
      </DataCard>
      <Card>
        <CardHeader><CardTitle>Application questions</CardTitle></CardHeader>
        <CardContent>
          <ApplicationQuestionsEditor
            applicationId={id}
            questions={questions}
            editable={editable}
            onDirtyChange={setHasUnsavedAnswers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
