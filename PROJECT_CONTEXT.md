# Project Context: refactor-cli

This document is an onboarding guide for developers and AI coding agents. It
describes the repository's current implementation and its known limitations.
When this document conflicts with source code, tests, or the dataset manifest,
the source code and tests are authoritative.

## 1. Project purpose

`refactor-cli` is a TypeScript command-line research tool for transforming
legacy React class components into functional React components with Hooks by
using an LLM. It runs a selected model against a dataset, restores masked JSX,
verifies generated candidates, measures source and candidate code, saves
successful results, and records run metadata plus per-component and per-attempt
CSV reports.

The project is an experimental evaluation pipeline, not a guarantee of
semantics-preserving automated refactoring. In particular, JSX masking reduces
the code sent to the model but also hides the JSX expressions themselves.

## 2. Repository map

| Path | Responsibility |
|---|---|
| `src/index.ts` | CLI arguments, component discovery, sequential job execution, output files, metrics, and CSV reporting |
| `src/ast/parser.ts` | Shared Babel parser configured for TypeScript and JSX |
| `src/ast/classDetector.ts` | Detects React class declarations/expressions by superclass and `render` method or function-valued class property |
| `src/ast/slicer.ts` | Import/context slicing, JSX masking, dependency-contract extraction, and JSX restoration/adaptation |
| `src/llm/LLMProvider.ts` | LLM interfaces and token usage types |
| `src/llm/promptBuilder.ts` | Shared provider prompt and response-cleaning logic |
| `src/llm/promptTokenCounts.ts` | Token count rows, eta calculation, and CSV serialization |
| `src/llm/ProviderFactory.ts` | Provider selection and environment-variable configuration |
| `src/llm/GeminiProvider.ts` | Gemini API calls using the shared prompt builder |
| `src/llm/OpenAIProvider.ts` | OpenAI API calls using the shared prompt builder |
| `src/llm/OllamaProvider.ts` | Native Ollama `/api/chat` and `/api/show` calls, context sizing, and model digest |
| `scripts/count-prompt-tokens.ts` | Counts sliced/full prompts for GPT-4o-mini, optional Gemini, and configured Ollama |
| `src/pipeline/RefactorPipeline.ts` | Mask → generate → restore → verify loop and transient API retries |
| `src/verification/linter.ts` | ESLint verification for React Hooks rules |
| `src/verification/tester.ts` | Temporary candidate-file creation and local Vitest execution |
| `src/metrics/normalize.ts` | TypeScript stripping and fixed Prettier normalization for comparable metrics |
| `src/metrics/metricsPrettierConfig.ts` | Fixed formatting options used for every before/after metric run |
| `src/metrics/calculator.ts` | Safe aggregate/per-function metrics, Coleman–Oman MI, and metric result type |
| `src/metrics/reactMetrics.ts` | Class, `this`, built-in Hook, and custom Hook counts |
| `src/reporting/CsvReporter.ts` | CSV report schema and append logic |
| `src/reporting/AttemptCsvReporter.ts` | Per-attempt CSV rows, including model version and suspected context truncation |
| `scripts/dataset-boundary-plugin.ts` | Vite plugin that substitutes dataset component dependency boundaries with local mocks |
| `scripts/run-dataset-contracts.ts` | Runs local behavioral contracts against the legacy component baseline |
| `scripts/run-contract-coverage.ts` | Runs those same contracts with legacy components as candidates and writes coverage CSV |
| `scripts/run-reference-tests.ts` | Runs selected upstream Jest suites for components with reference-test metadata |
| `dataset/manifest.json` | Dataset component IDs, categories, complexity, rationale, and upstream-control metadata |
| `dataset/README.md` | Dataset-specific usage, contract-test, and upstream-control notes |
| `analysis/analyze.py` | Loads run reports and computes tables and plots for RQ1-RQ4 |
| `analysis/test_analyze.py` | Unit tests for report loading, exclusions, and RQ calculations |
| `requirements.txt` | Python analysis dependencies |

Most source modules have focused Vitest tests beside them.

## 3. Dataset

The checked-in dataset is a stratified sample of **24 components**, not a full
checkout of Mattermost or Metabase. It spans multiple UI categories and
complexity levels. `component-44` through `component-50` contain no React class
component; use `--class-only` when the experiment should include only detected
class-component targets. Consult `dataset/manifest.json` for the authoritative
component list, metadata, selection rationale, and upstream-control flags.

Each component directory normally contains:

- `LegacyComponent.tsx` — the source component (not every source is a class
  component; see the scope note above);
- `LegacyComponent.test.tsx` — a behavioral contract test;
- sometimes `source-manifest.json` and source/test metadata for upstream
  reference testing.

The behavioral contract tests exercise both the legacy component and a
`ModernComponent` candidate against shared user-visible expectations. The Vite
boundary plugin intercepts non-React imports from dataset component modules and
uses `dataset/support/boundary-mocks.tsx` to provide boundary mocks. This keeps
these local contracts runnable without installing every dependency of the
upstream projects.

**Important:** `npm run test:contracts` currently validates the test harness by
temporarily putting the legacy source in the generated-component slot. A
passing contract run proves that the contracts and harness work; it does not
prove that an LLM-generated `ModernComponent` passes.

Upstream Jest controls are retained only for `component-32`, `component-39`,
and `component-43`. Those tests execute in their corresponding upstream source
repositories and require the upstream Jest installation and dependencies.
They are separate from the local Vitest contract runner.

See `dataset/README.md` for dataset-specific details and examples.

## 4. CLI and configuration

The package scripts are:

```sh
npm start -- [options]
npm test
npm run test:contracts
npm run coverage:contracts
npm run tokens:count
npm run test:reference -- <component-directory> [candidate-component-file]
```

`npm start` runs `tsx src/index.ts`. The CLI options are:

| Option | Meaning | Default |
|---|---|---|
| `--dataset <path>` | Dataset root directory | `./dataset` |
| `--provider <provider>` | `gemini`, `openai`, or `ollama` | `ACTIVE_LLM`, then `gemini` |
| `--model <model>` | Override provider model ID | Provider-specific environment variable/default |
| `--seed <seed>` | Set the generation seed when supported | Unset |
| `--out <path>` | Root for run results | `./results` |
| `--components <ids>` | Comma-separated component IDs, e.g. `component-06,component-51` | All discovered components |
| `--class-only` | Exclude inputs that do not match the React class-component detector; excluded rows are recorded without calling the model | Off |
| `--run-id <id>` | Explicit run directory name | Generated from provider, model, time, and a random suffix |

Example:

```sh
npm start -- --provider ollama --model qwen2.5-coder:7b --components component-51,component-54
```

The provider factory supports:

- **Gemini** — `GEMINI_API_KEY`, optional `GEMINI_MODEL`;
- **OpenAI** — `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`
  and `OPENAI_MODEL`;
- **Ollama** — `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, optional `OLLAMA_NUM_CTX`
  (default `32768`); no API key required. Ollama uses native `/api/chat` and
  `/api/show` endpoints, removing an optional trailing `/v1` from the base URL.

`.env.example` lists the supported variable names. Put credentials in the
local `.env`; do not commit secrets. Qwen is a model choice, not a separate
provider implementation.

### Running Qwen in Colab

Start Ollama in the Colab runtime with the context length set to 32768:

```sh
OLLAMA_CONTEXT_LENGTH=32768 ollama serve
```

In another cell, pull the model:

```sh
ollama pull qwen2.5-coder:7b
```

Set `OLLAMA_BASE_URL` to the reachable Ollama endpoint and
`OLLAMA_MODEL=qwen2.5-coder:7b`. Record the GPU name in the run notes. Run
`npm run tokens:count` in Colab with Ollama configured so Qwen token counts are
included in `results/tokens/prompt-tokens.csv`.

## 5. End-to-end refactoring flow

### 5.1 Discover and initialize a job

The CLI validates selected component IDs and discovers one source component
file and one matching test file in each selected component directory. Jobs are
processed sequentially. For a `Legacy...` source, the generated component is
named with the corresponding `Modern...` prefix.

The CLI creates a unique run directory under the output root, initializes a
`RefactorPipeline`, and initializes the component and attempt CSV reporters.
It writes `run.json` with the ISO timestamp, Git commit hash (or `null`), run
ID, provider, configured model, Ollama model digest when the selected provider
exposes it, seed, temperature (`0.1`), maximum attempts (`3`), and Ollama
context size.
The response-reported model version for Gemini/OpenAI and the digest for
Ollama are also recorded on individual `attempts.csv` rows.

### 5.2 Normalize and measure the original source

The CLI calculates legacy metrics in a separate error-handling block before the
refactoring pipeline. `calculateMetrics` returns either `{ ok: true, metrics }`
or `{ ok: false, error }`; a metrics failure is recorded and does not prevent
the LLM run.

`normalizeForMetrics` uses Babel's TypeScript transform with TSX enabled to
remove TypeScript-only syntax while retaining JSX. It also lowers optional
chaining, which the current `typhonjs-escomplex` parser cannot process in some
AST expressions. Prettier then applies the fixed options in
`src/metrics/metricsPrettierConfig.ts`. Both legacy and generated source go
through this exact same path before measurement.

The result includes:

- aggregate cyclomatic complexity, escomplex MI (`miEscomplex`), logical and
  physical SLOC, and Halstead effort and volume;
- function count, mean and maximum per-function cyclomatic complexity, mean
  per-function Halstead volume, and mean per-function logical SLOC;
- Coleman–Oman classic MI and its 0–100 normalized value;
- class declaration count, remaining `this` expression count, calls to the
  eight tracked built-in Hooks, and custom Hook calls.

`miClassic` is calculated from the per-function averages using
`171 − 5.2·ln(avg Halstead volume) − 0.23·avg CC − 16.2·ln(avg logical SLOC)`,
clamped above at 171. The project keeps it alongside `miEscomplex`: escomplex
uses mean Halstead **effort**, a 171 scale, and has an operator-precedence quirk
where the 0.23 factor is not applied to `ln(CC)`.

### 5.3 Mask JSX and collect its dependency contract

`RefactorPipeline.runWithAttempts` reads the source and calls `maskJSX` in
`src/ast/slicer.ts`. The parser uses Babel with the `typescript` and `jsx`
plugins.

The slicer finds top-level JSX elements or fragments that have a `return`
statement in their ancestor chain and no JSX ancestor. It saves each exact
source range in an in-memory map and replaces the source range with a JSX
placeholder such as `<JSX_MASK_0 />`.

Before masking each range, an AST visitor collects references to:

- `this.props.name` as a required prop;
- `this.state.name` as a required state binding;
- `this.name` as a required method/handler, except for `state` and `props`;
- whole-object or computed state/props accesses as unresolved accesses.

Lists are deduplicated and sorted. The dependency contract is attached to the
LLM context. `sliceContext` then separates imports from the rest of the
masked source; the providers receive imports and component code as distinct
prompt sections.

The pipeline logs the change in source **characters**, not a measured
before/after token count. Provider usage supplies token counts for actual
requests. To estimate the first-attempt token savings without generation, run
`npm run tokens:count`; it compares sliced and whole-file prompts for each
dataset component and writes `results/tokens/prompt-tokens.csv`. Its coefficient
is `eta = 1 - tokens_sliced / tokens_full`. GPT-4o-mini uses `o200k_base`;
Gemini uses `models.countTokens` when `GEMINI_API_KEY` is configured; Ollama
uses `/api/generate` with `num_predict: 1` when its model and base URL are set.
Missing optional Gemini or Ollama configuration causes a warning and skips
that model, not the GPT count.

### 5.4 Ask the LLM to refactor

The provider prompt asks for a functional component and includes:

- original imports;
- masked component code;
- the dependency contract, when applicable;
- the previous verification error, on repair attempts.

When placeholders exist, the provider prompt asks the model to preserve every
placeholder exactly once. Providers use temperature `0.1`. Gemini and OpenAI
use their respective APIs; Ollama uses its native chat API.

The dependency contract is guidance for generation, not a post-generation
guarantee that every required binding was declared correctly.

The optional `--class-only` switch limits generation to source files containing
a class declaration or expression that syntactically extends `Component`,
`PureComponent`, `React.Component`, or `React.PureComponent` and declares a
`render` method or a `render` class property whose value is an arrow or regular
function expression. `report.csv` records the detector result in
`is_class_component`; a non-matching input receives `Excluded` status and skips
the LLM and verification pipeline. The default remains off.

For Ollama, `OLLAMA_NUM_CTX` sets the native chat context window. Each attempt
records a `context_truncation_suspected` flag when `prompt_eval_count` is at
least `num_ctx - 256`. The run's `run.json` stores the model digest obtained
once from `/api/show`; `attempts.csv` records the model version returned by the
provider for every attempt.

### 5.5 Restore JSX and adapt static class references

Before verification, `restoreJSX` parses the model response and validates that
every expected placeholder appears exactly once. Missing, duplicated, or
unknown placeholders cause restoration to fail; the pipeline does not guess
where missing JSX belongs.

The original JSX is restored from its stored source text, preserving its
formatting. During insertion, the slicer uses AST ranges to adapt some static
class references inside that JSX:

- `this.state.counter` → `counter`;
- `this.props.title` → `title`;
- `this.handleClick` → `handleClick`.

Computed or whole-object references are not rewritten because their intended
functional binding cannot be inferred safely.

### 5.6 Verify the candidate

Default verification order is:

1. **Syntax:** Babel parses the restored TSX.
2. **Lint:** ESLint runs `react-hooks/rules-of-hooks` and
   `react-hooks/exhaustive-deps`, both configured as errors.
3. **Tests:** `runTests` writes the candidate to a temporary generated-component
   path and runs the selected existing test with Vitest in the current local
   process/repository context. It removes the temporary candidate afterward.

Verification stops at the first failing step. This Vitest run is not a
containerized or security sandbox. Its boundary behavior depends on the
configured Vite plugin and the test/import structure.

### 5.7 Repair attempts and API retries

The default pipeline allows up to **three generation attempts**. If JSX
restoration or a verification step fails, the error is added to the LLM context
and a new generation attempt begins with the same masked source and dependency
contract.

Transient provider/network failures have a separate retry mechanism. By
default, up to three retries are made with exponential backoff, capped at
30 seconds. These API retries are counted separately from generation attempts.
Non-transient provider errors (including HTTP 400/context-size errors) are
recorded as failed generation attempts and can be followed by another
generation attempt. Empty or non-code responses are recorded as `Format`
failures. HTTP 401/403 and model/deployment-not-found 404 errors are fatal and
stop the overall CLI run after the current report row is written.

Each generation attempt has an `AttemptRecord` with per-stage results and
durations, failure stage/category, a capped error excerpt plus its full length,
API retry count, model-call latency, token usage, test outcomes, raw response
length, and response-cleaning status. The records are returned on both
successful pipeline results and `PipelineError`, and serialized into the CSV's
`attempt_records` column. Verification feedback sent to the model is capped at
4,000 characters by default; truncation preserves the head and tail around a
`…truncated…` marker.

The test runner reports legacy and generated behavior cases separately. A
failed legacy contract means the dataset baseline is invalid: that component
stops immediately with status `Invalid`, rather than spending more model
attempts or blaming the generated candidate. Other test-runner crashes are
recorded as retryable `Infrastructure` attempt failures.

### 5.8 Save results and report

On pipeline success, the CLI writes the permanent generated file under the run
output directory and marks the component `Success` before computing candidate
metrics in a separate error-handling block. A candidate-metrics failure is
recorded in `after_metrics_error`; it cannot turn a verified result into
`Fail` or prevent the already-generated file from being saved.

On component failure, the CLI records `Fail` (or `Invalid` for a failed legacy
baseline), error details, failure stage, attempt/retry counts, attempt records,
available token usage, and source metrics. It continues to the next component
unless a fatal provider configuration error stops the run. After processing,
the CLI exits with an error if a component failed or the run was stopped.

Each run directory contains:

- `run.json` — run ID, provider, configured model, Ollama model digest when
  available, ISO timestamp, Git commit hash (or `null`), seed, temperature,
  maximum attempts, and Ollama context size;
- `report.csv` — one row per selected component, including
  `is_class_component`, status, duration, attempts, API retries, all
  before/after aggregate, per-function, MI, and React migration metrics,
  metric errors, aggregate token usage, failure stage, and failure reason;
- `attempts.csv` — one row per generation attempt, including stage outcomes
  and durations, categorized error, per-attempt tokens and latency, test
  outcomes, model version, and `context_truncation_suspected`.

Failed candidates are **not** permanently saved by the normal CLI flow; the
temporary file used for Vitest is cleaned up.

## 6. Testing and validation

### Unit tests and dataset contracts

```sh
npm test
```

This runs Vitest tests under `src` and `scripts`, then runs all local dataset
contracts. It does not call an LLM and does not measure generated-code quality.

To run only the contracts:

```sh
npm run test:contracts
```

### Upstream reference tests

```sh
npm run test:reference -- dataset/component-43
npm run test:reference -- dataset/component-43 path/to/candidate.tsx
```

Omitting the candidate path runs the upstream component as a baseline. Supplying
a candidate path runs the referenced upstream Jest suites against that
candidate. This requires the relevant source repository and its Jest
dependencies to be available locally.

### Type checking

```sh
npx tsc --noEmit
```

There is no dedicated build script in `package.json`.

### RQ1-RQ4 analysis

Install the Python 3.11 analysis dependencies, then run the analyzer:

```sh
python -m pip install -r requirements.txt
python analysis/analyze.py
```

By default, the analyzer discovers direct child directories of `results/`
that contain all three files: `run.json`, `report.csv`, and `attempts.csv`.
Explicit run folders and alternate paths can be supplied:

```sh
python analysis/analyze.py results/<run-id-1> results/<run-id-2>
python analysis/analyze.py --results-root path/to/results --tokens path/to/prompt-tokens.csv --out analysis/out
```

`analysis/out/` receives CSV tables and PNG plots:

| Research question | Outputs | Calculation |
|---|---|---|
| RQ1 | `rq1_success_by_attempt.csv`, `rq1_success_by_attempt.png` | Per run and model, cumulative success rate by attempt limit 1, 2, and 3. Rates use `Success` and `Fail` component rows as the denominator; the table reports the across-run mean, sample SD (0 when there is only one run), and run count. A successful attempt is identified by its attempt row having `failure_stage=None`. |
| RQ2 | `rq2_metric_comparison.csv`, `rq2_metric_boxplots.png` | `Success` components only. Reports before/after means and medians for CC, logical SLOC, Halstead volume/effort, classic MI, and escomplex MI. Wilcoxon signed-rank is performed on complete before/after pairs; `n` is the number of paired components. |
| RQ3 | `rq3_success_attempt_counts.csv`, `rq3_tokens_per_component.csv`, `rq3_tokens_and_eta.csv`, `rq3_attempts_tokens_eta.png` | Histogram counts successful components by the first attempt row with `failure_stage=None`; token counts are summed over attempt rows per component. Eta mean and median are calculated per model from `results/tokens/prompt-tokens.csv`. |
| RQ4 | `rq4_model_summary.csv`, `rq4_error_category_distribution.csv`, `rq4_error_categories.png` | Per model, one-pass success, final success, average attempt latency, and error-category proportions. The stacked bar visualizes attempt-category proportions; blank categories are represented as `none`. |

`Invalid` and `Excluded` component rows are printed as counts and removed from
the analysis inputs. Missing metric pairs are omitted from the corresponding
RQ2 statistic. The token prompt CSV is a dataset/model estimate and is not
joined to individual run attempts. Results are descriptive/statistical
summaries, not proof of semantic equivalence or causal model differences.
Analysis tests can be run with:

```sh
python -m unittest discover -s analysis -p "test_*.py" -v
```

## 7. Known limitations and interpretation cautions

These are important when changing the pipeline or interpreting experiment
results:

1. **JSX selection is based on a `return` ancestor, not a React `render()`
   method check.** It may also mask JSX returned by other functions; JSX outside
   a returned expression may remain visible to the model.
2. **The model cannot inspect the masked JSX.** The dependency contract lists
   some names, but it does not expose JSX control flow, expressions, component
   structure, or event semantics. The model may declare a binding incorrectly
   or fail to preserve behavior.
3. **Dependency classification is approximate.** Most static `this.foo`
   references are treated as methods/handlers; class fields and special
   instance properties can be misclassified. Dynamic and whole-object accesses
   are reported as unresolved.
4. **Reference adaptation is intentionally limited.** It handles selected
   static member chains but cannot safely convert every class pattern, binding,
   callback, context access, dynamic key, or `.bind(this)` usage.
5. **Lint is narrow.** It checks two React Hooks rules rather than the complete
   ESLint/TypeScript configuration of the upstream application.
6. **Local Vitest execution is not isolated.** It uses the current project
   process and Vite configuration; it is not a container or OS-level sandbox.
7. **A passing contract baseline is not an LLM result.** The dataset contract
   runner temporarily substitutes legacy code to test the harness. Run the
   actual CLI with a provider to evaluate generated output.
8. **The class detector is syntactic, not semantic.** It recognizes only the
   listed direct superclass spellings and a `render` method or function-valued
   class property.
   Aliases such as `class X extends BaseComponent` are not inferred from
   imports. `--class-only` is off by default, so non-class files remain in the
   candidate scope unless explicitly excluded.
9. **Token counts are estimates for the constructed prompt.** Provider-side
   framing, system messages, or tokenizer differences may make actual request
   usage differ. `npm run tokens:count` writes
   `results/tokens/prompt-tokens.csv`; see the CLI/analysis sections for the
   model-specific counting methods.
10. **Legacy contract coverage can be measured with `npm run coverage:contracts`.**
   This runs the existing contracts with each legacy component as the candidate
   and writes statement, branch, and line percentages to
   `results/coverage/contract-coverage.csv`. Contract files are not changed.
11. **RQ success-attempt analysis depends on complete attempt records.** Runs
    missing `attempts.csv`, `run.json`, or `report.csv` are not auto-discovered;
    older or incomplete runs must be repaired or handled separately.
12. **A failure does not preserve the candidate by default.** Normal CLI output
    saves a component only after success, while the temporary verification file
    is removed.
13. **Metrics are code metrics, not behavioral correctness metrics.** Lower
    complexity or higher maintainability does not prove semantic equivalence.
    TypeScript is stripped and all files are formatted consistently for metric
    comparison. Metrics can still fail; their errors are reported separately
    and must not be interpreted as a refactoring failure.

## 8. Guidance for AI coding agents

- Read this file, then the relevant implementation and tests before changing
  behavior. Treat the source and tests as authoritative if details have drifted.
- Keep changes scoped. Do not remove or rewrite dataset components, provenance,
  source manifests, or user-generated results unless the task explicitly asks.
- Preserve the distinction between local contract tests, upstream reference
  tests, and actual LLM pipeline runs; they establish different evidence.
- For AST changes, add tests for TypeScript/TSX, nested JSX, fragments,
  conditional returns, placeholder loss/duplication, and exact source
  restoration as applicable.
- For pipeline changes, verify both what the LLM receives and what the
  verification steps receive.
- Do not claim a refactor passed behavior tests merely because a harness test
  passed against the legacy component.
- Do not read, print, or commit `.env` secrets. Use `.env.example` for the
  configuration schema.
- Run the narrow relevant tests first, then `npx tsc --noEmit` and `npm test`
  when the change affects shared behavior.
- Do not commit unless explicitly requested.

## 9. Documentation maintenance

Update this document when the CLI contract, supported providers, dataset
structure, verification behavior, metrics, or retry semantics change. Update
`dataset/README.md` for changes specific to selecting, validating, or using the
dataset.
