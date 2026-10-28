import { describe, expect, it, vi } from 'vitest';

vi.mock("lodash/debounce", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/data_grid/data_grid", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/team_icon/team_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/constants", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "SEARCH_TIMEOUT_MILLISECONDS": vi.fn(() => vi.fn()) }),
}));

vi.mock("utils/utils", () => ({
  "imageURLForTeam": vi.fn(() => vi.fn()),
}));

vi.mock("./team_list.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
