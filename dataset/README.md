# Component dataset

The dataset is a stratified 24-component sample rather than a full upstream
checkout. The selection spans multiple component types and complexity levels;
see [manifest.json](./manifest.json) for the selection and upstream control
components.

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

The contract runner temporarily uses each legacy component as the generated
candidate so the test harness can be validated independently. Normal pipeline
runs provide their generated code in the same `ModernComponent` slot.

## Upstream controls

Upstream test archives are retained only for `component-32`, `component-39`,
and `component-43`. Run them selectively with the existing reference runner
after installing the corresponding upstream repository dependencies:

```sh
npm run test:reference -- dataset/component-43
```
