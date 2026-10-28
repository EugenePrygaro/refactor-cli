import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
}));

vi.mock("react-dnd", () => ({
  "DragLayer": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "msgid": vi.fn(() => vi.fn()),
  "ngettext": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/ui", () => ({
  "Box": vi.fn(() => vi.fn()),
  "Paper": vi.fn(() => vi.fn()),
  "Portal": vi.fn(() => vi.fn()),
  "Text": vi.fn(() => vi.fn()),
}));

vi.mock("./ItemsDragLayer.module.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "preview": vi.fn(() => vi.fn()), "dragLayer": vi.fn(() => vi.fn()) }),
}));

vi.mock(".", () => ({
  "isItemDragPayload": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
