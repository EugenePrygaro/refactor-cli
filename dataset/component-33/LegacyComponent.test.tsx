import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
}));

vi.mock("react-dnd", () => ({
  "DropTarget": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/common/collections/utils", () => ({
  "canPlaceEntityInCollection": vi.fn(() => vi.fn()),
  "canonicalCollectionId": vi.fn(() => vi.fn()),
  "isRootTrashCollection": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/common/hooks", () => ({
  "isMovable": vi.fn(() => vi.fn()),
}));

vi.mock("./DropArea", () => ({
  "DropArea": vi.fn(() => vi.fn()),
}));

vi.mock(".", () => ({
  "MoveableDragTypes": vi.fn(() => vi.fn()),
  "isItemDragPayload": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
