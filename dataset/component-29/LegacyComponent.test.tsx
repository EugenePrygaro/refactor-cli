import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "JSX": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("utils/constants", () => ({
  "PermissionsScope": vi.fn(() => vi.fn()),
}));

vi.mock("./permission_checkbox", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./permission_description", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./permission_row", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./strings/groups", () => ({
  "groupRolesStrings": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
