import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
  "useEffect": vi.fn(() => vi.fn()),
  "useMemo": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "t": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/ui", () => ({
  "Center": vi.fn(() => vi.fn()),
  "Loader": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/ui/colors", () => ({
  "color": vi.fn(() => vi.fn()),
}));

vi.mock("../../lib/describe-error", () => ({
  "describeError": vi.fn(() => vi.fn()),
}));

vi.mock("../../lib/read-name-from-url", () => ({
  "readNameFromUrl": vi.fn(() => vi.fn()),
}));

vi.mock("../../lib/report-error-to-parent", () => ({
  "reportErrorToParent": vi.fn(() => vi.fn()),
}));

vi.mock("../../lib/report-ready-to-parent", () => ({
  "reportReadyToParent": vi.fn(() => vi.fn()),
}));

vi.mock("../../lib/use-data-app-bundle", () => ({
  "useDataAppBundle": vi.fn(() => vi.fn()),
}));

vi.mock("../DataAppProvider/DataAppProvider", () => ({
  "DataAppProvider": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
