import { describe, expect, it, vi } from 'vitest';

vi.mock("classnames", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), {  }),
}));

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
  "useCallback": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "t": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "findWhere": vi.fn(() => vi.fn()), "uniq": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/api", () => ({
  "cardApi": vi.fn(() => vi.fn()),
  "databaseApi": vi.fn(() => vi.fn()),
  "useLazyListDatabaseSchemaTablesQuery": vi.fn(() => vi.fn()),
  "useLazyListDatabaseSchemasQuery": vi.fn(() => vi.fn()),
  "useListDatabasesQuery": vi.fn(() => vi.fn()),
  "useSearchQuery": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/api/utils/run-rtk-endpoint", () => ({
  "runRtkEndpoint": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/common/components/EmptyState", () => ({
  "EmptyState": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/common/components/LoadingAndErrorWrapper", () => ({
  "LoadingAndErrorWrapper": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/css/core/index.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "flex": vi.fn(() => vi.fn()), "alignCenter": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/current-user", () => ({
  "canUserCreateQueries": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/metadata-store", () => ({
  "getShallowQuestions": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/redux", () => ({
  "connect": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/redux/tables", () => ({
  "fetchTableMetadata": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/settings", () => ({
  "getSetting": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/ui", () => ({
  "Box": vi.fn(() => vi.fn()),
  "Popover": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib/v1/metadata/utils/saved-questions", () => ({
  "SAVED_QUESTIONS_VIRTUAL_DB_ID": vi.fn(() => vi.fn()),
  "getQuestionIdFromVirtualTableId": vi.fn(() => vi.fn()),
  "isVirtualCardId": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib/v1/metadata/utils/schema", () => ({
  "parseSchemaId": vi.fn(() => vi.fn()),
}));

vi.mock("./DataSelectorDataBucketPicker", () => ({
  "DataSelectorDataBucketPicker": vi.fn(() => vi.fn()),
}));

vi.mock("./DataSelectorDatabasePicker", () => ({
  "DataSelectorDatabasePicker": vi.fn(() => vi.fn()),
}));

vi.mock("./DataSelectorDatabaseSchemaPicker", () => ({
  "DataSelectorDatabaseSchemaPicker": vi.fn(() => vi.fn()),
}));

vi.mock("./DataSelectorFieldPicker", () => ({
  "DataSelectorFieldPicker": vi.fn(() => vi.fn()),
}));

vi.mock("./DataSelectorSchemaPicker", () => ({
  "DataSelectorSchemaPicker": vi.fn(() => vi.fn()),
}));

vi.mock("./DataSelectorTablePicker", () => ({
  "DataSelectorTablePicker": vi.fn(() => vi.fn()),
}));

vi.mock("./TriggerComponents", () => ({
  "DatabaseTrigger": vi.fn(() => vi.fn()),
  "FieldTrigger": vi.fn(() => vi.fn()),
  "TableTrigger": vi.fn(() => vi.fn()),
  "Trigger": vi.fn(() => vi.fn()),
}));

vi.mock("./constants", () => ({
  "CONTAINER_WIDTH": vi.fn(() => vi.fn()),
  "DATA_BUCKET": vi.fn(() => vi.fn()),
}));

vi.mock("./entity-lookups", () => ({
  "getEntityLookups": vi.fn(() => vi.fn()),
}));

vi.mock("./saved-entity-picker/SavedEntityPicker", () => ({
  "SavedEntityPicker": vi.fn(() => vi.fn()),
}));

vi.mock("./utils", () => ({
  "getDataTypes": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
