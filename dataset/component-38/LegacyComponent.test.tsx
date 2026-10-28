import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
  "createRef": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "t": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/utils/dom", () => ({
  "forceRedraw": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
