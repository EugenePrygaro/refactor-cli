import { describe, expect, it, vi } from 'vitest';

vi.mock("leaflet-draw", () => ({
}));

vi.mock("leaflet/dist/leaflet.css", () => ({
}));

vi.mock("./LeafletMap.module.css", () => ({
}));

vi.mock("leaflet", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "LatLngBounds": vi.fn(() => vi.fn()), "Map": vi.fn(() => vi.fn()), "Control": vi.fn(() => vi.fn()), "Draw": vi.fn(() => vi.fn()), "MapOptions": vi.fn(() => vi.fn()), "map": vi.fn(() => vi.fn()), "FeatureGroup": vi.fn(() => vi.fn()), "tileLayer": vi.fn(() => vi.fn()), "latLngBounds": vi.fn(() => vi.fn()), "DrawEvents": vi.fn(() => vi.fn()), "Rectangle": vi.fn(() => vi.fn()), "ControlOptions": vi.fn(() => vi.fn()), "DrawOptions": vi.fn(() => vi.fn()) }),
}));

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
  "createRef": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "findWhere": vi.fn(() => vi.fn()), "findIndex": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/utils/settings", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "get": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/utils/types", () => ({
  "isNullOrUndefined": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib", () => ({
  "queryDisplayInfo": vi.fn(() => vi.fn()),
  "updateLatLonFilter": vi.fn(() => vi.fn()),
  "fromLegacyColumn": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-types/guards/common", () => ({
  "isObject": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
