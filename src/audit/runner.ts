import Ajv from "ajv";
import addFormats from "ajv-formats";
import { auditCollection, buildEnvMap, countRequests, AuditResult, Finding } from "./rules";

const POSTMAN_COLLECTION_MIN_SCHEMA = {
  type: "object",
  properties: {
    info: { type: "object" },
    item: { type: "array" }
  },
  required: ["info", "item"]
};

function summarize(findings: Finding[]) {
  let errors = 0, warnings = 0, infos = 0;
  for (const f of findings) {
    if (f.level === "ERROR") errors++;
    else if (f.level === "WARN") warnings++;
    else infos++;
  }
  return { errors, warnings, infos, total: findings.length };
}

export function runAudit(collectionJson: any, envJson: any | null): AuditResult {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(POSTMAN_COLLECTION_MIN_SCHEMA);
  const ok = validate(collectionJson);

  const findings: Finding[] = [];

  if (!ok) {
    findings.push({
      level: "ERROR",
      ruleId: "COLLECTION_INVALID_SHAPE",
      message: `Collection JSON does not match expected minimum shape (info + item). Errors: ${ajv.errorsText(validate.errors)}`
    });
  }

  const envMap = buildEnvMap(envJson);
  findings.push(...auditCollection(collectionJson, envMap));

  const requestCount = countRequests(collectionJson);

  return {
    summary: summarize(findings),
    findings,
    meta: {
      auditedAt: new Date().toISOString(),
      collectionName: collectionJson?.info?.name,
      requestCount
    }
  };
}
