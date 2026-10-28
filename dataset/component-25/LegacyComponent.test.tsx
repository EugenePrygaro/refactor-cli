import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "RefObject": vi.fn(() => vi.fn()), "createRef": vi.fn(() => vi.fn()), "MouseEvent": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
  "defineMessages": vi.fn(() => vi.fn()),
}));

vi.mock("components/external_link", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/admin_console/admin_header", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("utils/constants", () => ({
  "AboutLinks": vi.fn(() => vi.fn()),
  "CloudLinks": vi.fn(() => vi.fn()),
  "LicenseSkus": vi.fn(() => vi.fn()),
  "ModalIdentifiers": vi.fn(() => vi.fn()),
}));

vi.mock("utils/license_utils", () => ({
  "isLicenseExpired": vi.fn(() => vi.fn()),
  "isLicenseExpiring": vi.fn(() => vi.fn()),
  "isTrialLicense": vi.fn(() => vi.fn()),
  "licenseSKUWithFirstLetterCapitalized": vi.fn(() => vi.fn()),
  "isEnterpriseLicense": vi.fn(() => vi.fn()),
}));

vi.mock("./enterprise_edition/enterprise_edition_left_panel", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
  "messages": vi.fn(() => vi.fn()),
}));

vi.mock("./enterprise_edition/enterprise_edition_right_panel", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./modals/confirm_license_removal_modal", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./modals/ee_license_modal", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./modals/upload_license_modal", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./renew_license_card/renew_license_card", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./starter_edition/starter_left_panel", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
  "messages": vi.fn(() => vi.fn()),
}));

vi.mock("./starter_edition/starter_right_panel", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./team_edition/team_edition_left_panel", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./team_edition/team_edition_right_panel", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./trial_banner/trial_banner", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./trial_license_card/trial_license_card", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./user_seat_alert_banner", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./license_settings.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
