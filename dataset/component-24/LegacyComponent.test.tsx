import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "ReactNode": vi.fn(() => vi.fn()), "ReactElement": vi.fn(() => vi.fn()), "PureComponent": vi.fn(() => vi.fn()), "MouseEvent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/shared/components/button", () => ({
  "Button": vi.fn(() => vi.fn()),
}));

vi.mock("components/widgets/icons/fa_next_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/icons/fa_previous_icon", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/constants", () => ({
  "JobTypes": vi.fn(() => vi.fn()),
}));

vi.mock("./job_cancel_button", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./job_download_link", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./job_finish_at", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./job_run_length", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./job_status", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./table.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
