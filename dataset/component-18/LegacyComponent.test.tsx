import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "PureComponent": vi.fn(() => vi.fn()), "ReactNode": vi.fn(() => vi.fn()) }),
}));

vi.mock("react-intl", () => ({
  "FormattedMessage": vi.fn(() => vi.fn()),
}));

vi.mock("@mattermost/compass-ui/components/feature-discovery-panel", () => ({
  "FeatureDiscoveryPanel": vi.fn(() => vi.fn()),
}));

vi.mock("components/admin_console/license_settings/trial_banner/trial_banner", () => ({
  "EmbargoedEntityTrialError": vi.fn(() => vi.fn()),
}));

vi.mock("components/alert_banner", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/external_link", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/loading/loading_spinner", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("components/widgets/tag/sku_tag", () => ({
  "licenseSkuToLabel": vi.fn(() => vi.fn()),
}));

vi.mock("utils/constants", () => ({
  "AboutLinks": vi.fn(() => vi.fn()),
  "LicenseLinks": vi.fn(() => vi.fn()),
}));

vi.mock("utils/contact_support_sales", () => ({
  "goToMattermostContactSalesForm": vi.fn(() => vi.fn()),
}));

vi.mock("./feature_discovery.scss", () => ({
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
