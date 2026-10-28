import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("lodash/isNil", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/button", () => ({
  "Button": vi.fn(() => vi.fn()),
}));

vi.mock("components/confirm_modal", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/globe_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/lock_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/menu/menu", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "ItemAction": vi.fn(() => vi.fn()) }),
}));

vi.mock("components/widgets/menu/menu_wrapper", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/utils", () => ({
  "localizeMessage": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
