import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "ReactNode": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-bootstrap", () => ({
  "Modal": vi.fn(() => vi.fn()),
}));

vi.mock("react-intl", () => ({
  "FormattedDate": vi.fn(() => vi.fn()),
  "FormattedMessage": vi.fn(() => vi.fn()),
  "FormattedTime": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/client", () => ({
  "Client4": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/utils/user_utils", () => ({
  "getFullName": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/revoke_token_button", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/external_link", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/loading_screen", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/users/avatar", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/constants", () => ({
  "DeveloperLinks": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
