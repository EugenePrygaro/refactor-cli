import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()), "ReactNode": vi.fn(() => vi.fn()), "Fragment": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-dom", () => ({
  "createPortal": vi.fn(() => vi.fn()),
}));

vi.mock("react-intl", () => ({
  "injectIntl": vi.fn(() => vi.fn()),
}));

vi.mock("mattermost-redux/constants/apps", () => ({
  "AppCallResponseTypes": vi.fn(() => vi.fn()),
}));

vi.mock("components/plugin_marketplace/marketplace_modal", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/menu/menu", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "ItemSubMenu": vi.fn(() => vi.fn()), "ItemAction": vi.fn(() => vi.fn()) }),
}));

vi.mock("components/widgets/menu/menu_wrapper", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("plugins/pluggable", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/apps", () => ({
  "createCallContext": vi.fn(() => vi.fn()),
}));

vi.mock("utils/constants", () => ({
  "Constants": vi.fn(() => vi.fn()),
  "Locations": vi.fn(() => vi.fn()),
  "ModalIdentifiers": vi.fn(() => vi.fn()),
}));

vi.mock("utils/post_utils", () => ({
  "isSystemMessage": vi.fn(() => vi.fn()),
}));

vi.mock("./actions_menu_button", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./actions_menu_empty_popover", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./actions_menu_icon", () => ({
  "ActionsMenuIcon": vi.fn(() => vi.fn()),
}));

vi.mock("./actions_menu.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
