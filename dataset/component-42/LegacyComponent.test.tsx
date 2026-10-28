import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "find": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/viz-core", () => ({
  "getSettingsWidgets": vi.fn(() => vi.fn()),
  "updateSettings": vi.fn(() => vi.fn()),
}));

vi.mock("../ChartSettingsWidget", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
