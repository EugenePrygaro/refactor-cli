import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "t": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "chain": vi.fn(() => vi.fn()), "sortBy": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/common/components/EmptyState", () => ({
  "EmptyState": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/common/components/LoadingAndErrorWrapper", () => ({
  "LoadingAndErrorWrapper": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/css/core/index.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "wrapper": vi.fn(() => vi.fn()), "wrapperTrim": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/reference/Reference.module.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "schemaSeparator": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/reference/components/List", () => ({
  "List": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/reference/components/List/List.module.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "empty": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/reference/components/ListItem", () => ({
  "ListItem": vi.fn(() => vi.fn()),
}));

vi.mock("../components/ReferenceHeader", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
