import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/css/core/index.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "flexFull": vi.fn(() => vi.fn()), "flex": vi.fn(() => vi.fn()), "flexColumn": vi.fn(() => vi.fn()), "relative": vi.fn(() => vi.fn()), "fullHeight": vi.fn(() => vi.fn()), "pb4": vi.fn(() => vi.fn()), "px4": vi.fn(() => vi.fn()), "flexBasisAuto": vi.fn(() => vi.fn()), "mlAuto": vi.fn(() => vi.fn()), "mrAuto": vi.fn(() => vi.fn()), "flexNoShrink": vi.fn(() => vi.fn()), "py4": vi.fn(() => vi.fn()), "py3": vi.fn(() => vi.fn()), "borderTop": vi.fn(() => vi.fn()), "mt4": vi.fn(() => vi.fn()), "alignCenter": vi.fn(() => vi.fn()), "ml2": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/css/core/z-index.module.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "Overlay": vi.fn(() => vi.fn()) }),
}));

vi.mock("./ModalHeader", () => ({
  "ModalHeader": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
