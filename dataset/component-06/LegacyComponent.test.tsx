import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "defineMessage": vi.fn(() => vi.fn()),
  "injectIntl": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/utils/user_utils", () => ({
  "filterProfilesStartingWithTerm": vi.fn(() => vi.fn()),
}));

vi.mock("components/multiselect/multiselect", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/constants", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "SEARCH_TIMEOUT_MILLISECONDS": vi.fn(() => vi.fn()) }),
}));

vi.mock("./multiselect_option/multiselect_option", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
