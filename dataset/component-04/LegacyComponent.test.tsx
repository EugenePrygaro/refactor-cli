import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-bootstrap", () => ({
  "Modal": vi.fn(() => vi.fn()),
}));

vi.mock("react-intl", () => ({
  "injectIntl": vi.fn(() => vi.fn()),
  "FormattedMessage": vi.fn(() => vi.fn()),
  "defineMessage": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/types/groups", () => ({
  "SyncableType": vi.fn(() => vi.fn()),
}));

vi.mock("components/html_entities/nbsp", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/multiselect/multiselect", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("images/groups-avatar.png", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/a11y_utils", () => ({
  "focusElement": vi.fn(() => vi.fn()),
}));

vi.mock("utils/constants", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "SEARCH_TIMEOUT_MILLISECONDS": vi.fn(() => vi.fn()) }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
