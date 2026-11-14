/** Only these HTTP responses reliably mean a public posting has been removed. */
export function isDefinitivelyClosedPostingStatus(status: number): boolean {
  return status === 404 || status === 410;
}
