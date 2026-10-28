import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("lodash.debounce", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "forwardRef": vi.fn(() => vi.fn()) }),
  "Component": vi.fn(() => vi.fn()),
  "createContext": vi.fn(() => vi.fn()),
  "createRef": vi.fn(() => vi.fn()),
}));

vi.mock("react-dom", () => ({
  "flushSync": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "throttle": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/css/core/index.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "relative": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/env", () => ({
  "isCypressActive": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/utils/delay", () => ({
  "delay": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/utils/resize-observer", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "unsubscribe": vi.fn(() => vi.fn()), "subscribe": vi.fn(() => vi.fn()) }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
