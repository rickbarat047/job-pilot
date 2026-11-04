import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MatchScore } from "@/components/ui/match-score";
import { Progress } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/avatar";

export interface JobCardData {
  id: string;
  title: string;
  companyName: string;
  location: string;
  remoteStatus: string;
  employmentType: string;
  salaryText?: string | null;
  source: string;
  description?: string | null;
  overallScore?: number | null;
}

const SOURCE_LABELS: Record<string, string> = {
  smartrecruiters: "SmartRecruiters",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workable: "Workable",
  ashby: "Ashby",
  recruitee: "Recruitee",
  remotive: "Remotive",
  adzuna: "Adzuna",
  naukri: "Naukri",
  foundit: "Foundit",
  indeed: "Indeed",
  linkedin: "LinkedIn",
  company: "Company site",
  manual: "Added by you",
};

function sourceLabel(source: string) {
  const key = String(source || "").trim().toLowerCase();
  return SOURCE_LABELS[key] || key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isKnown(value?: string | null) {
  const text = String(value ?? "").trim();
  return Boolean(text) && !/^(unknown|n\/?a|none|null|undefined|-)$/i.test(text);
}

function sentenceCase(value: string) {
  const text = value.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function JobCard({ job, score, action }: { job: JobCardData; score?: number | null; action?: React.ReactNode }) {
  const facts = [job.companyName, job.location, isKnown(job.employmentType) ? sentenceCase(job.employmentType) : ""].filter(isKnown);
  const tags = [isKnown(job.remoteStatus) ? sentenceCase(job.remoteStatus) : "", isKnown(job.salaryText) ? String(job.salaryText).trim() : ""].filter(Boolean);
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={job.companyName} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${job.id}`} className="inline-block min-h-[36px] py-2 -my-2 text-base font-semibold leading-snug break-words hover:text-primary sm:text-lg">
            {job.title}
          </Link>
          <div className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground break-words sm:text-sm">
            {facts.join(" · ")}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">via {sourceLabel(job.source)}</Badge>
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        {typeof score === "number" ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <MatchScore score={score} />
            <span className="text-[10px] text-muted-foreground">match</span>
          </div>
        ) : null}
      </div>
      {typeof score === "number" ? <Progress value={score} className="mt-3" /> : null}
      {action ? <div className="mt-3 flex flex-wrap gap-2 [&>*]:min-w-[45%] [&>*]:flex-1">{action}</div> : null}
    </div>
  );
}
