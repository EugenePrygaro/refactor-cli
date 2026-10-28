import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "RefObject": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-bootstrap", () => ({
  "Modal": vi.fn(() => vi.fn()),
}));

vi.mock("react-intl", () => ({
  "injectIntl": vi.fn(() => vi.fn()),
  "FormattedMessage": vi.fn(() => vi.fn()),
  "defineMessage": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/client", () => ({
  "Client4": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/utils/user_utils", () => ({
  "isGuest": vi.fn(() => vi.fn()),
}));

vi.mock("components/multiselect/multiselect", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/profile_picture", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/tag/bot_tag", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/tag/guest_tag", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/utils", () => ({
  "displayEntireNameForUser": vi.fn(() => vi.fn()),
}));

vi.mock("./add_users_to_team_modal.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
