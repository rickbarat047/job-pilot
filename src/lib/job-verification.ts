/** Only these HTTP responses reliably mean a public posting has been removed. */
export function isDefinitivelyClosedPostingStatus(status: number): boolean {
  return status === 404 || status === 410;
}

/** Only listings currently marked active may be submitted by automation. */
export function isActiveForAutomatedApplication(status: string | null | undefined): boolean {
  return status === "active";
}
