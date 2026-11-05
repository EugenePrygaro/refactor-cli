import { defineConfig } from 'vitest/config';
import { datasetBoundaryPlugin } from './scripts/dataset-boundary-plugin';

export default defineConfig({
    plugins: [datasetBoundaryPlugin()],
});
