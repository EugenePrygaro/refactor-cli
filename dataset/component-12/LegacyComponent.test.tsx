import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "RefObject": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
  "injectIntl": vi.fn(() => vi.fn()),
}));

vi.mock("components/widgets/icons/fa_next_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/fa_previous_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/loading/loading_spinner", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./data_grid_header", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./data_grid_row", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./data_grid_search", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./data_grid.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
