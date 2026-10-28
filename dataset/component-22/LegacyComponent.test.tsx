import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("react-router-dom", () => ({
  "Link": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/button", () => ({
  "Button": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/types/groups", () => ({
  "GroupSource": vi.fn(() => vi.fn()),
  "PluginGroupSourcePrefix": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/group_settings/group_details/group_users_row", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/fa_next_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/fa_previous_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
