import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "MouseEvent": vi.fn(() => vi.fn()), "PureComponent": vi.fn(() => vi.fn()), "ReactNode": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedDate": vi.fn(() => vi.fn()),
  "FormattedMessage": vi.fn(() => vi.fn()),
  "FormattedTime": vi.fn(() => vi.fn()),
  "defineMessages": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/button", () => ({
  "Button": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/constants", () => ({
  "General": vi.fn(() => vi.fn()),
}));

vi.mock("utils/i18n", () => ({
  "getMonthLong": vi.fn(() => vi.fn()),
}));

vi.mock("./device_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./more_info", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
