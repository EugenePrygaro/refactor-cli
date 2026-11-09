# Component dataset

The dataset is a stratified 24-component sample rather than a full upstream
checkout. The selection spans multiple component types and complexity levels;
see [manifest.json](./manifest.json) for the selection and upstream control
components.

Components `component-44` through `component-50` contain no React class
component. They remain in the dataset unless a run explicitly uses
`--class-only`.

## Local behavioral contracts

Each component's `LegacyComponent.test.tsx` imports both the source component
and a generated `ModernComponent`. It runs the same user-visible behavior
against both versions. Imports outside the component are intercepted by the
dataset boundary plugin; React and the test DOM remain real, while Redux,
network/API, routing, styling, and heavy UI boundaries are isolated.

Run the application/unit tests and the local dataset contracts with:

```sh
npm test
```

Run only the dataset contracts with:

```sh
npm run test:contracts
```

## Selecting components for an LLM run

By default, the pipeline processes every component. Use `--components` with a
comma-separated list of dataset IDs to run only a subset:

```sh
npm start -- --provider gemini --components component-51,component-54
```

The IDs must match component directories listed in [manifest.json](./manifest.json).
Unknown IDs are rejected before the run output directory is created.

Use `--class-only` to exclude inputs unless their source contains a class
declaration or expression extending `Component`, `PureComponent`,
`React.Component`, or `React.PureComponent` and declaring a `render` method.
Excluded inputs are reported with status `Excluded` and are not sent to the
LLM.

The contract runner temporarily uses each legacy component as the generated
candidate so the test harness can be validated independently. Normal pipeline
runs provide their generated code in the same `ModernComponent` slot.

Generate statement, branch, and line coverage for the existing behavioral
contracts while using the legacy source as the candidate:

```sh
npm run coverage:contracts
```

The command writes `results/coverage/contract-coverage.csv`; it does not modify
the contract tests.

## Upstream controls

Upstream test archives are retained only for `component-32`, `component-39`,
and `component-43`. Run them selectively with the existing reference runner
after installing the corresponding upstream repository dependencies:

```sh
npm run test:reference -- dataset/component-43
```
