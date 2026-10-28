import { describe, expect, it, vi } from 'vitest';

vi.mock("react", () => ({
  "Component": vi.fn(() => vi.fn()),
}));

vi.mock("ttag", () => ({
  "t": vi.fn(() => vi.fn()),
}));

vi.mock("underscore", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "isEqual": vi.fn(() => vi.fn()) }),
}));

vi.mock("metabase/api", () => ({
  "fieldApi": vi.fn(() => vi.fn()),
  "skipToken": vi.fn(() => vi.fn()),
  "useGetFieldQuery": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/api/utils/run-rtk-endpoint", () => ({
  "runRtkEndpoint": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/parameters/components/TemporalUnitSettings", () => ({
  "TemporalUnitSettings": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/parameters/components/ValuesSourceSettings", () => ({
  "ValuesSourceSettings": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/parameters/utils/parameter-type", () => ({
  "isSingleOrMultiSelectable": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/redux", () => ({
  "connect": vi.fn(() => vi.fn()),
}));

vi.mock("metabase/ui", () => ({
  "Box": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib", () => ({
  "queryDisplayInfo": vi.fn(() => vi.fn()),
  "templateTags": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib/v1/parameters/utils/parameter-source", () => ({
  "canUseCustomSource": vi.fn(() => vi.fn()),
}));

vi.mock("metabase-lib/v1/parameters/utils/template-tag-options", () => ({
  "getDefaultParameterOptions": vi.fn(() => vi.fn()),
  "getDefaultParameterWidgetType": vi.fn(() => vi.fn()),
  "getParameterOptionsForField": vi.fn(() => vi.fn()),
}));

vi.mock("./TagEditorParam.module.css", () => ({
  default: Object.assign(vi.fn(() => vi.fn()), { "TagContainer": vi.fn(() => vi.fn()), "TagName": vi.fn(() => vi.fn()) }),
}));

vi.mock("./TagEditorParamParts", () => ({
  "DefaultRequiredValueControl": vi.fn(() => vi.fn()),
  "FieldMappingSelect": vi.fn(() => vi.fn()),
  "FilterWidgetLabelInput": vi.fn(() => vi.fn()),
  "FilterWidgetTypeSelect": vi.fn(() => vi.fn()),
  "TableMappingSelect": vi.fn(() => vi.fn()),
  "VariableTypeSelect": vi.fn(() => vi.fn()),
}));

vi.mock("./TagEditorParamParts/FieldAliasInput", () => ({
  "FieldAliasInput": vi.fn(() => vi.fn()),
}));

vi.mock("./TagEditorParamParts/ParameterMultiSelectInput", () => ({
  "ParameterMultiSelectInput": vi.fn(() => vi.fn()),
}));

vi.mock("./TagEditorParamParts/TagEditorParam", () => ({
  "ContainerLabel": vi.fn(() => vi.fn()),
  "InputContainer": vi.fn(() => vi.fn()),
}));

import * as ModernComponent from './ModernComponent';

describe('ModernComponent', () => {
    it('loads with isolated dependency mocks', () => {
        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);
    });
});
