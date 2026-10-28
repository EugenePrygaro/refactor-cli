import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
  "createRef": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "findIndex": vi.fn(() => vi.fn()), "some": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/ui", () => ({
  "Box": vi.fn(() => vi.fn()),
}));

vi.mock("./AccordionList.module.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "accordionListRoot": vi.fn(() => vi.fn()), "hasSearch": vi.fn(() => vi.fn()) }),
}));

vi.mock("./AccordionListCell", () => ({
  "AccordionListCell": vi.fn(() => vi.fn()),
}));

vi.mock("./utils", () => ({
  "getNextCursor": vi.fn(() => vi.fn()),
  "getPrevCursor": vi.fn(() => vi.fn()),
  "searchFilter": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
