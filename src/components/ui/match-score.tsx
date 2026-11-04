import { cn } from "@/lib/utils";

export function MatchScore({ score, className }: { score: number; className?: string }) {
  const tone =
    score >= 75
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : score >= 55
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-secondary text-secondary-foreground";
  return (
    <span
      className={cn(
        "inline-flex min-w-11 items-center justify-center rounded-full px-2 py-1 font-semibold tabular-nums",
        tone,
        className,
      )}
      title={`Match score ${score}%`}
    >
      {score}%
    </span>
  );
}
