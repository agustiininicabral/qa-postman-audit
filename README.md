# QA Postman Audit

A TypeScript command-line tool that statically audits exported Postman collections and optionally checks their environment variables. It produces JSON and HTML reports suitable for a QA review or CI pipeline.

![CI](https://github.com/agustiininicabral/qa-postman-audit/actions/workflows/ci.yml/badge.svg)

## What it checks

- Minimum collection structure: `info` and `item`.
- Missing collection schema and collection name.
- Requests without a non-empty Postman test script.
- Variables referenced in the collection but missing or disabled in a supplied environment.
- An explicitly supplied empty environment is still audited; it is not treated as if no environment were provided.
- Empty or unusually short request names.
- Request counts and nested item paths for findings.

The checks are intentionally lightweight. This is not a full validator for every Postman Collection schema rule and it does not execute requests or Postman scripts.

## Requirements

- Node.js 20 or newer.
- npm.

## Install and build

```bash
npm install
npm run build
npm test
```

The repository currently does not commit an npm lockfile; `npm install` resolves dependencies from `package.json`. For a fully reproducible release, commit and maintain `package-lock.json` and use `npm ci`.

## Run an audit

Audit the included example:

```bash
node dist/index.js --collection examples/sample-collection.json --out qa-audit-report
```

Provide an exported environment JSON to enable variable checks:

```bash
node dist/index.js \
  --collection path/to/collection.json \
  --environment path/to/environment.json \
  --out reports/my-audit
```

The output directory contains:

- `report.json` — machine-readable summary and findings.
- `report.html` — human-readable report.

Options:

- `--collection, -c`: required path to a Postman collection JSON file.
- `--environment, -e`: optional Postman environment JSON file.
- `--out, -o`: output directory (default: `qa-audit-report`).
- `--fail-on-warn`: exit with code 2 if warnings exist.
- `--fail-on-error`: exit with code 1 if errors exist.

Exit codes: `0` means the audit completed without a configured failure, `1` means errors were found, `2` means warnings triggered `--fail-on-warn`, and `99` means the input or execution failed unexpectedly.

## CI

GitHub Actions installs dependencies, compiles TypeScript, runs the Node.js unit tests, audits the sample collection, and uploads the JSON/HTML report as a workflow artifact. The CI example intentionally demonstrates a warning for a request without a test script; the workflow records the report rather than treating every warning as a failed build.

## Security and privacy

The tool reads local JSON files and does not send collection or environment contents to an external service. Avoid committing real environment exports, access tokens, passwords, or other secrets. Reports may include request names, variable names, and collection metadata.

## License

MIT. See [LICENSE](LICENSE).
