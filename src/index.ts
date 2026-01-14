import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runAudit } from "./audit/runner";
import { renderHtmlReport } from "./audit/report";

function safeReadJson(path: string): any {
  const raw = readFileSync(path, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON file: ${path}`);
  }
}

const program = new Command();

program
  .name("qa-postman-audit")
  .description("Audit Postman collections and generate professional QA reports for CI/CD")
  .requiredOption("-c, --collection <path>", "Path to Postman collection JSON")
  .option("-e, --environment <path>", "Path to Postman environment JSON (optional)")
  .option("-o, --out <dir>", "Output directory for reports", "qa-audit-report")
  .option("--fail-on-warn", "Exit with code 2 if warnings exist", false)
  .option("--fail-on-error", "Exit with code 1 if errors exist", true);

program.parse(process.argv);

(async () => {
  const opts = program.opts();
  const collectionPath = resolve(opts.collection);
  const envPath = opts.environment ? resolve(opts.environment) : null;
  const outDir = resolve(opts.out);

  const collectionJson = safeReadJson(collectionPath);
  const envJson = envPath ? safeReadJson(envPath) : null;

  const result = runAudit(collectionJson, envJson);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const jsonOut = resolve(outDir, "report.json");
  const htmlOut = resolve(outDir, "report.html");

  writeFileSync(jsonOut, JSON.stringify(result, null, 2), "utf-8");
  writeFileSync(htmlOut, renderHtmlReport(result), "utf-8");

  console.log(`Report generated:\n- ${jsonOut}\n- ${htmlOut}`);

  const hasErrors = result.summary.errors > 0;
  const hasWarnings = result.summary.warnings > 0;

  if (opts.failOnError && hasErrors) process.exit(1);
  if (opts.failOnWarn && hasWarnings) process.exit(2);

  process.exit(0);
})().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(99);
});
