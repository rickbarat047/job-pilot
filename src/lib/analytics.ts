// Lightweight analytics helper. Plausible is loaded via a script tag in layout.tsx
// when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. This helper is a no-op otherwise.

type PlausibleFn = (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;

function plausible(): PlausibleFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { plausible?: PlausibleFn };
  return typeof w.plausible === "function" ? w.plausible : null;
}

export function trackEvent(event: string, props?: Record<string, string | number | boolean>) {
  const fn = plausible();
  if (!fn) return;
  try {
    fn(event, props ? { props } : undefined);
  } catch {
    // Analytics is best-effort; never break the app.
  }
}

// Convenience wrappers for the key conversion events.
export const analytics = {
  signup: () => trackEvent("Signup"),
  login: () => trackEvent("Login"),
  discoveryRun: (jobs: number) => trackEvent("Discovery Run", { jobs }),
  applicationApproved: () => trackEvent("Application Approved"),
  applicationSubmitted: (method: string) => trackEvent("Application Submitted", { method }),
  interviewScheduled: () => trackEvent("Interview Scheduled"),
  cvUploaded: () => trackEvent("CV Uploaded"),
  jobSaved: () => trackEvent("Job Saved"),
  exportCsv: () => trackEvent("Export CSV"),
};