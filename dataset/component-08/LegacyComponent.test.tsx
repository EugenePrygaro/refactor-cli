import { describe, expect, it, vi } from 'vitest';

vi.mock("lodash/debounce", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("lodash/isEqual", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
  "injectIntl": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/compass-ui/components/checkbox", () => ({
  "Checkbox": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/tooltip", () => ({
  "WithTooltip": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/data_grid/data_grid", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/filter/team_filter_dropdown", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/channel_type_icon", () => ({
  "ChannelIcon": vi.fn(() => vi.fn()),
}));

vi.mock("utils/constants", () => ({
  "Constants": vi.fn(() => vi.fn()),
}));

vi.mock("./channel_list.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
