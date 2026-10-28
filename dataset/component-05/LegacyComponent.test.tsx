import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-bootstrap", () => ({
  "Modal": vi.fn(() => vi.fn()),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/button", () => ({
  "Button": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/utils/user_utils", () => ({
  "getFullName": vi.fn(() => vi.fn()),
}));

vi.mock("components/suggestion/modal_suggestion_list", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/suggestion/search_channel_with_permissions_provider", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/suggestion/suggestion_box", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/utils", () => ({
  "placeCaretAtEnd": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
