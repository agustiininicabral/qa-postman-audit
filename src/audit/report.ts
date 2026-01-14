import { AuditResult } from "./rules";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderHtmlReport(result: AuditResult): string {
  const { summary, meta, findings } = result;

  const rows = findings.map(f => `
    <tr>
      <td>${esc(f.level)}</td>
      <td>${esc(f.ruleId)}</td>
      <td>${esc(f.message)}</td>
      <td>${esc(f.path ?? "")}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>QA Postman Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    .kpi { display: flex; gap: 16px; margin: 12px 0 18px; flex-wrap: wrap; }
    .card { border: 1px solid #ddd; border-radius: 10px; padding: 12px 14px; min-width: 160px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e2e2e2; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f6f6f6; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <h1>QA Postman Audit Report</h1>
  <div class="muted">
    <div><strong>Audited at:</strong> ${esc(meta.auditedAt)}</div>
    <div><strong>Collection:</strong> ${esc(meta.collectionName ?? "(unknown)")}</div>
    <div><strong>Requests:</strong> ${meta.requestCount}</div>
  </div>

  <div class="kpi">
    <div class="card"><strong>Errors</strong><div>${summary.errors}</div></div>
    <div class="card"><strong>Warnings</strong><div>${summary.warnings}</div></div>
    <div class="card"><strong>Info</strong><div>${summary.infos}</div></div>
    <div class="card"><strong>Total</strong><div>${summary.total}</div></div>
  </div>

  <h2>Findings</h2>
  <table>
    <thead>
      <tr>
        <th>Level</th>
        <th>Rule</th>
        <th>Message</th>
        <th>Path</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="4">No findings</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;
}
