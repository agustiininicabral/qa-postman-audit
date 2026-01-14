export type FindingLevel = "ERROR" | "WARN" | "INFO";

export type Finding = {
  level: FindingLevel;
  ruleId: string;
  message: string;
  path?: string; // e.g., "item[2].item[0]"
};

export type AuditResult = {
  summary: { errors: number; warnings: number; infos: number; total: number };
  findings: Finding[];
  meta: {
    auditedAt: string;
    collectionName?: string;
    requestCount: number;
  };
};

export type EnvVarMap = Record<string, string>;

export function buildEnvMap(envJson: any | null): EnvVarMap {
  const map: EnvVarMap = {};
  if (!envJson || !Array.isArray(envJson.values)) return map;

  for (const v of envJson.values) {
    if (v && typeof v.key === "string") map[v.key] = String(v.value ?? "");
  }
  return map;
}

export function countRequests(collection: any): number {
  let count = 0;
  function walkItems(items: any[]): void {
    for (const it of items) {
      if (!it) continue;
      if (it.request) count++;
      if (Array.isArray(it.item)) walkItems(it.item);
    }
  }
  if (collection && Array.isArray(collection.item)) walkItems(collection.item);
  return count;
}

export function flattenRequests(collection: any): Array<{ node: any; path: string }> {
  const out: Array<{ node: any; path: string }> = [];
  function walk(items: any[], basePath: string): void {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = `${basePath}[${i}]`;
      if (it?.request) out.push({ node: it, path: p });
      if (Array.isArray(it?.item)) walk(it.item, `${p}.item`);
    }
  }
  if (collection && Array.isArray(collection.item)) walk(collection.item, "item");
  return out;
}

const VAR_REGEX = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

export function extractVarsFromString(input: string): string[] {
  const vars: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = VAR_REGEX.exec(input)) !== null) {
    vars.push(m[1]);
  }
  return [...new Set(vars)];
}

export function auditCollection(collection: any, envMap: EnvVarMap): Finding[] {
  const findings: Finding[] = [];

  // Rule: basic Postman v2.1-ish shape
  if (!collection?.info?.schema) {
    findings.push({
      level: "WARN",
      ruleId: "COLLECTION_SCHEMA_MISSING",
      message: "Collection info.schema is missing (non-standard export or old format)."
    });
  }

  const collectionName = collection?.info?.name;
  if (!collectionName || typeof collectionName !== "string") {
    findings.push({
      level: "WARN",
      ruleId: "COLLECTION_NAME_MISSING",
      message: "Collection info.name is missing. Add a meaningful collection name."
    });
  }

  const reqNodes = flattenRequests(collection);

  // Rule: each request should have tests (basic)
  for (const { node, path } of reqNodes) {
    const requestName = node?.name ?? "(unnamed request)";
    const events = Array.isArray(node?.event) ? node.event : [];
    const testEvent = events.find((e: any) => e?.listen === "test");
    const hasTestScript =
      !!testEvent &&
      Array.isArray(testEvent?.script?.exec) &&
      testEvent.script.exec.join("\n").trim().length > 0;

    if (!hasTestScript) {
      findings.push({
        level: "WARN",
        ruleId: "REQUEST_TESTS_MISSING",
        message: `Request "${requestName}" has no test script. Add pm.test(...) assertions.`,
        path
      });
    }
  }

  // Rule: variable references must exist in env (if env provided)
  const envProvided = Object.keys(envMap).length > 0;
  if (envProvided) {
    const allVars: Set<string> = new Set();
    const asText = JSON.stringify(collection);
    for (const v of extractVarsFromString(asText)) allVars.add(v);

    for (const v of allVars) {
      if (!(v in envMap)) {
        findings.push({
          level: "ERROR",
          ruleId: "ENV_VAR_MISSING",
          message: `Variable "{{${v}}}" is used in the collection but is missing in the environment.`
        });
      }
    }
  } else {
    findings.push({
      level: "INFO",
      ruleId: "ENV_NOT_PROVIDED",
      message: "No environment provided; variable existence checks were skipped."
    });
  }

  // Rule: request naming convention (simple example)
  for (const { node, path } of reqNodes) {
    const name = String(node?.name ?? "");
    if (name.trim().length === 0) {
      findings.push({
        level: "WARN",
        ruleId: "REQUEST_NAME_EMPTY",
        message: "A request has an empty name. Use a descriptive name like 'GET /users - list'.",
        path
      });
      continue;
    }
    if (name.length < 6) {
      findings.push({
        level: "INFO",
        ruleId: "REQUEST_NAME_TOO_SHORT",
        message: `Request name "${name}" looks very short; consider adding endpoint + purpose.`,
        path
      });
    }
  }

  return findings;
}
