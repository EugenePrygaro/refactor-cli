import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "SyntheticEvent": vi.fn(() => vi.fn()) }),
  "createRef": vi.fn(() => vi.fn()),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
  "defineMessages": vi.fn(() => vi.fn()),
  "injectIntl": vi.fn(() => vi.fn()),
}));

vi.mock("react-select", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/data_grid/data_grid", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/jobs", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/card/card", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "Header": vi.fn(() => vi.fn()), "Body": vi.fn(() => vi.fn()) }),
}));

vi.mock("components/card/title_and_button_card_header/title_and_button_card_header", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/admin_console/admin_header", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/menu/menu", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "ItemAction": vi.fn(() => vi.fn()) }),
}));

vi.mock("components/widgets/menu/menu_wrapper", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/browser_history", () => ({
  "getHistory": vi.fn(() => vi.fn()),
}));

vi.mock("utils/constants", () => ({
  "JobTypes": vi.fn(() => vi.fn()),
}));

vi.mock("./data_retention_settings.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
