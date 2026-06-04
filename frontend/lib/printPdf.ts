// Dependency-free "Export PDF": opens a clean, print-styled window and triggers
// the browser's print dialog (Save as PDF). Works for any Markdown/plain text.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function printPdf(title: string, text: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups to export as PDF.");
    return;
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
         max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111;
         line-height: 1.6; }
  h1 { font-size: 20px; margin: 0 0 20px; }
  .content { white-space: pre-wrap; word-wrap: break-word; font-size: 14px; }
  @media print { body { margin: 0; } }
</style></head>
<body><h1>${escapeHtml(title)}</h1>
<div class="content">${escapeHtml(text || "")}</div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
