import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("lodash/isEqual", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "RefObject": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()), "ChangeEvent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
  "injectIntl": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/admin_sidebar/admin_sidebar_category", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/admin_sidebar/admin_sidebar_section", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/admin_sidebar_header", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/search_keyword_marking", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/common/scrollbars", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/quick_input", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/search_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/admin_console_index", () => ({
  "generateIndex": vi.fn(() => vi.fn()),
}));

vi.mock("utils/browser_history", () => ({
  "getHistory": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
