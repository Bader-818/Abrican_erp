/** Open a fetched Blob (e.g. a PDF) in a new browser tab. */
export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  // Revoke after a delay so the new tab has time to load it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
