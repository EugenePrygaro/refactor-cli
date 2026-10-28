import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "Children": vi.fn(() => vi.fn()) }),
  "PureComponent": vi.fn(() => vi.fn()),
  "Suspense": vi.fn(() => vi.fn()),
  "forwardRef": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "t": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "every": vi.fn(() => vi.fn()), "isObject": vi.fn(() => vi.fn()), "isEqual": vi.fn(() => vi.fn()), "pick": vi.fn(() => vi.fn()), "compose": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/common/components/ErrorBoundary", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("metabase/common/components/ErrorPages", () => ({
  "SmallGenericError": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/common/components/ExplicitSize", () => ({
  "ExplicitSize": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/css/core/index.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "fullHeight": vi.fn(() => vi.fn()), "flex": vi.fn(() => vi.fn()), "flexColumn": vi.fn(() => vi.fn()), "flexFull": vi.fn(() => vi.fn()), "flexBasisNone": vi.fn(() => vi.fn()), "spread": vi.fn(() => vi.fn()), "z2": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/embedding-sdk/config", () => ({
  "isEmbeddingSdk": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/metadata-store", () => ({
  "selectQuestionFromCardBuilder": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/plugins", () => ({
  "PLUGIN_CUSTOM_VIZ": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/redux", () => ({
  "connect": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/redux/downloads", () => ({
  "getIsDownloadingToImage": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/settings", () => ({
  "getTokenFeature": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/styled-components/selectors", () => ({
  "getFont": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/ui", () => ({
  "Box": vi.fn(() => vi.fn()),
  "Flex": vi.fn(() => vi.fn()),
  "Stack": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/utils/dashboard", () => ({
  "isQuestionCard": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/utils/formatting", () => ({
  "formatNumber": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/utils/memoize", () => ({
  "memoize": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/visualizations", () => ({
  "getVisualizationComponent": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/visualizations/components/ChartCaption", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("metabase/visualizations/components/ChartTooltip", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("metabase/visualizations/components/ClickActions", () => ({
  "ConnectedClickActionsPopover": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/visualizations/lib/action", () => ({
  "performDefaultAction": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/visualizations/lib/no-results", () => ({
  "hasNoResults": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/visualizations/types", () => ({
  "isRegularClickAction": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/viz-core", () => ({
  "ChartSettingsError": vi.fn(() => vi.fn()),
  "MinRowsError": vi.fn(() => vi.fn()),
  "extractRemappings": vi.fn(() => vi.fn()),
  "getCardKey": vi.fn(() => vi.fn()),
  "getComputedSettingsForSeries": vi.fn(() => vi.fn()),
  "getVisualizationTransformed": vi.fn(() => vi.fn()),
  "isSameSeries": vi.fn(() => vi.fn()),
  "prefetchVisualizationComponent": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib/v1/Question", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("metabase-types/guards/dashboard", () => ({
  "isVisualizerDashboardCard": vi.fn(() => vi.fn()),
}));

vi.mock("../EmptyVizState", () => ({
  "EmptyVizState": vi.fn(() => vi.fn()),
}));

vi.mock("./ChartSettingsErrorButton", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./ErrorView", () => ({
  "ErrorView": vi.fn(() => vi.fn()),
}));

vi.mock("./LoadingView", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./LoadingView/DashCardLoadingView", () => ({
  "DashCardLoadingView": vi.fn(() => vi.fn()),
}));

vi.mock("./NoResultsView", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("./VisualizationRenderedWrapper", () => ({
  "VisualizationRenderedWrapper": vi.fn(() => vi.fn()),
}));

vi.mock("./VisualizationRunningState", () => ({
  "VisualizationRunningState": vi.fn(() => vi.fn()),
}));

vi.mock("./Watermark", () => ({
  "Watermark": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
