import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "ReactNode": vi.fn(() => vi.fn()), "PureComponent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "defineMessages": vi.fn(() => vi.fn()),
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/button", () => ({
  "buttonClassNames": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/blockable_link", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/admin_console/data_retention_settings/dropdown_options/dropdown_options", () => ({
  "keepForeverOption": vi.fn(() => vi.fn()),
  "yearsOption": vi.fn(() => vi.fn()),
  "daysOption": vi.fn(() => vi.fn()),
  "FOREVER": vi.fn(() => vi.fn()),
  "YEARS": vi.fn(() => vi.fn()),
  "DAYS": vi.fn(() => vi.fn()),
  "hoursOption": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/set_by_env", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/card/card", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "Body": vi.fn(() => vi.fn()) }),
}));

vi.mock("components/save_button", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/admin_console/admin_header", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/inputs/dropdown_input_hybrid", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/browser_history", () => ({
  "getHistory": vi.fn(() => vi.fn()),
}));

vi.mock("./global_policy_form.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
