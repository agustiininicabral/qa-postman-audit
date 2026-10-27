const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildEnvMap,
  countRequests,
  extractVarsFromString,
  flattenRequests,
} = require("../dist/audit/rules");
const { runAudit } = require("../dist/audit/runner");
const { renderHtmlReport } = require("../dist/audit/report");

const sampleCollection = {
  info: {
    name: "Test collection",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [
    {
      name: "Folder",
      item: [
        {
          name: "GET /users",
          request: { method: "GET", url: "{{baseUrl}}/users" },
          event: [
            {
              listen: "test",
              script: { exec: ["pm.test('status', () => pm.response.to.have.status(200));"] },
            },
          ],
        },
        { name: "POST /users", request: { method: "POST", url: "{{baseUrl}}/users" } },
      ],
    },
  ],
};

test("counts and flattens nested requests with stable paths", () => {
  assert.equal(countRequests(sampleCollection), 2);
  const requests = flattenRequests(sampleCollection);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].path, "item[0].item[0]");
  assert.equal(requests[1].path, "item[0].item[1]");
});

test("handles malformed collection containers without throwing", () => {
  assert.equal(countRequests(null), 0);
  assert.deepEqual(flattenRequests({ item: "not-an-array" }), []);
});

test("extracts unique Postman variables from text", () => {
  assert.deepEqual(
    extractVarsFromString("{{baseUrl}}/users/{{ user.id }}?x={{baseUrl}}"),
    ["baseUrl", "user.id"],
  );
});

test("builds environment maps from valid entries and ignores malformed values", () => {
  assert.deepEqual(
    buildEnvMap({
      values: [
        { key: "baseUrl", value: "https://example.test" },
        { key: "empty", value: null },
        { key: "disabled", value: "ignored", enabled: false },
        { key: 10, value: "ignored" },
        null,
      ],
    }),
    { baseUrl: "https://example.test", empty: "" },
  );
  assert.deepEqual(buildEnvMap({}), {});
});

test("reports missing environment variables as errors", () => {
  const result = runAudit(sampleCollection, {
    values: [{ key: "otherVariable", value: "present" }],
  });

  assert.equal(result.meta.collectionName, "Test collection");
  assert.equal(result.meta.requestCount, 2);
  assert.ok(result.findings.some((finding) => finding.ruleId === "ENV_VAR_MISSING"));
  assert.ok(result.summary.errors >= 1);
});

test("reports missing request test scripts as warnings", () => {
  const result = runAudit(sampleCollection, null);

  assert.ok(
    result.findings.some(
      (finding) =>
        finding.ruleId === "REQUEST_TESTS_MISSING" &&
        finding.path === "item[0].item[1]",
    ),
  );
  assert.ok(result.findings.some((finding) => finding.ruleId === "ENV_NOT_PROVIDED"));
});

test("flags an invalid collection shape instead of crashing", () => {
  const result = runAudit({ info: {}, item: "invalid" }, null);

  assert.ok(result.findings.some((finding) => finding.ruleId === "COLLECTION_INVALID_SHAPE"));
  assert.equal(result.meta.requestCount, 0);
});

test("escapes angle brackets in report content", () => {
  const result = {
    summary: { errors: 1, warnings: 0, infos: 0, total: 1 },
    meta: {
      auditedAt: "2026-01-01T00:00:00.000Z",
      collectionName: "<sample>",
      requestCount: 0,
    },
    findings: [
      {
        level: "ERROR",
        ruleId: "TEST",
        message: "<sample finding>",
        path: "item[0]",
      },
    ],
  };

  const html = renderHtmlReport(result);

  assert.ok(html.includes("&lt;sample&gt;"));
  assert.ok(html.includes("&lt;sample finding&gt;"));
  assert.ok(!html.includes("<sample finding>"));
});

test("treats an explicitly supplied empty environment as provided", () => {
  const result = runAudit(sampleCollection, { values: [] });

  assert.ok(result.findings.some((finding) => finding.ruleId === "ENV_VAR_MISSING"));
  assert.ok(!result.findings.some((finding) => finding.ruleId === "ENV_NOT_PROVIDED"));
});

test("treats disabled environment variables as missing", () => {
  const result = runAudit(sampleCollection, {
    values: [{ key: "baseUrl", value: "https://example.test", enabled: false }],
  });

  assert.ok(
    result.findings.some(
      (finding) =>
        finding.ruleId === "ENV_VAR_MISSING" &&
        finding.message.includes("baseUrl"),
    ),
  );
});
