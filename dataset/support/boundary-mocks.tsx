import React, { type ReactNode } from 'react';

type BoundaryComponent = React.ComponentType<Record<string, unknown>> & {
    Header?: React.ComponentType<Record<string, unknown>>;
    Body?: React.ComponentType<Record<string, unknown>>;
    Title?: React.ComponentType<Record<string, unknown>>;
    Footer?: React.ComponentType<Record<string, unknown>>;
    ItemAction?: React.ComponentType<Record<string, unknown>>;
    ItemSubMenu?: React.ComponentType<Record<string, unknown>>;
};

export interface DatasetImportDescriptor {
    exportName: string;
    localName: string;
    isComponent: boolean;
    isNamespace: boolean;
}

function classNames(...values: unknown[]): string {
    return values
        .flatMap((value) => {
            if (typeof value === 'string') {
                return [value];
            }
            if (Array.isArray(value)) {
                return [classNames(...value)];
            }
            if (value && typeof value === 'object') {
                return Object.entries(value)
                    .filter(([, enabled]) => enabled)
                    .map(([name]) => name);
            }
            return [];
        })
        .filter(Boolean)
        .join(' ');
}

function boundaryComponent(name: string) {
    const Boundary = (props: Record<string, unknown>) => {
        const children = props.children as ReactNode;
        if (name === 'Modal' && props.show === false) {
            return null;
        }

        if (name === 'FormattedMessage') {
            return React.createElement(
                React.Fragment,
                null,
                props.defaultMessage ?? props.id ?? children,
            );
        }

        if (name === 'AbstractIncomingWebhook') {
            return React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: () =>
                        (
                            props.action as
                                | ((hook: Record<string, unknown>) => void)
                                | undefined
                        )?.({
                            id: 'different-id',
                            display_name: 'Updated hook',
                            channel_id: 'channel-1',
                        }),
                },
                'Update',
            );
        }

        if (name === 'LoadingScreen') {
            return React.createElement('div', null, 'Loading');
        }

        if (name === 'VariableTypeSelect') {
            return React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: () =>
                        (
                            props.onChange as
                                | ((value: string) => void)
                                | undefined
                        )?.('number'),
                },
                'Number',
            );
        }

        if (name === 'LoadingAndErrorWrapper') {
            if (props.loading) {
                return React.createElement('div', null, 'Loading');
            }
            return typeof children === 'function'
                ? (children as () => ReactNode)()
                : children;
        }

        if (name === 'ListItem') {
            const itemProps: Record<string, unknown> = {
                'data-testid': props['data-testid'],
            };
            if (props.disabled) {
                itemProps['data-disabled'] = 'true';
            }
            const label = React.createElement(
                'span',
                null,
                props.name as ReactNode,
            );
            return React.createElement(
                'li',
                itemProps,
                props.disabled
                    ? label
                    : React.createElement('a', { href: props.url }, label),
            );
        }

        if (name === 'ReferenceHeader') {
            return React.createElement('h2', null, props.name as ReactNode);
        }

        if (name === 'List') {
            return React.createElement('ul', null, children);
        }

        if (name === 'EmptyState') {
            return React.createElement('div', null, props.message as ReactNode);
        }

        if (name === 'Menu.ItemAction' || name === 'Menu.ItemSubMenu') {
            return React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: props.onClick as
                        | React.MouseEventHandler<HTMLButtonElement>
                        | undefined,
                },
                (props.text as ReactNode) ?? children,
            );
        }

        if (name === 'FormattedDate' || name === 'FormattedTime') {
            return React.createElement(
                React.Fragment,
                null,
                String(props.value ?? ''),
            );
        }

        if (name === 'LoadingView') {
            return React.createElement('div', null, 'Loading');
        }

        if (name === 'MultiSelect') {
            const options = Array.isArray(props.options) ? props.options : [];
            const optionRenderer = props.optionRenderer;
            const renderOption =
                typeof optionRenderer === 'function'
                    ? (option: unknown) =>
                          (optionRenderer as (...args: unknown[]) => ReactNode)(
                              option,
                              false,
                              props.handleAdd,
                              () => undefined,
                          )
                    : (option: unknown) =>
                          React.createElement(
                              'div',
                              null,
                              String(
                                  (option as Record<string, unknown>).label ??
                                      (option as Record<string, unknown>).username ??
                                      '',
                              ),
                          );

            return React.createElement(
                'div',
                { 'data-boundary': name },
                React.createElement('input', {
                    'aria-label': 'Search',
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                        (props.handleInput as ((value: string) => void) | undefined)?.(
                            event.target.value,
                        ),
                }),
                ...options.map(renderOption),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        disabled: props.savingEnabled === false,
                        onClick: props.handleSubmit as
                            | React.MouseEventHandler<HTMLButtonElement>
                            | undefined,
                    },
                    labelText(props.buttonSubmitText) || 'Submit',
                ),
            );
        }

        if (name === 'MultiSelectOption') {
            const option = props.option as
                | Record<string, unknown>
                | undefined;
            return React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: () =>
                        (
                            props.onAdd as
                                | ((value: unknown) => void)
                                | undefined
                        )?.(option),
                },
                String(option?.username ?? option?.label ?? ''),
            );
        }

        if (name === 'Radio') {
            return React.createElement(
                'label',
                { 'data-boundary': name },
                React.createElement('input', {
                    type: 'radio',
                    checked: props.checked,
                    disabled: props.disabled,
                    name: props.name,
                    value: props.value,
                    onChange: props.onChange as
                        | React.ChangeEventHandler<HTMLInputElement>
                        | undefined,
                }),
                children,
            );
        }

        if (name === 'SaveButton') {
            return React.createElement(
                'button',
                {
                    type: 'button',
                    disabled: props.disabled,
                    onClick: props.onClick as
                        | React.MouseEventHandler<HTMLButtonElement>
                        | undefined,
                },
                props.saving
                    ? (props.savingMessage as ReactNode) ?? 'Saving'
                    : children ?? 'Save',
            );
        }

        if (name === 'Tabs.Tab') {
            return React.createElement(
                'button',
                {
                    type: 'button',
                    role: 'tab',
                    value: props.value,
                    'data-closable': props['data-closable'],
                    onKeyDown: props.onKeyDown as
                        | React.KeyboardEventHandler<HTMLButtonElement>
                        | undefined,
                },
                children,
                props.rightSection as ReactNode,
            );
        }

        if (name === 'ForgotPasswordForm') {
            const onSubmit = props.onSubmit as
                | ((email: string) => void)
                | undefined;
            return React.createElement(
                'div',
                { 'data-boundary': name },
                React.createElement('input', {
                    'aria-label': 'Email',
                    defaultValue: props.initialEmail,
                }),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () =>
                            onSubmit?.(
                                String(props.initialEmail ?? 'user@example.test'),
                            ),
                    },
                    'Send reset instructions',
                ),
            );
        }

        if (name === 'AccordionListCell') {
            const row = props.row as
                | {
                      type?: string;
                      item?: Record<string, unknown>;
                      section?: Record<string, unknown>;
                      sectionIndex?: number;
                  }
                | undefined;
            if (row?.type === 'header') {
                return React.createElement(
                    'button',
                    {
                        type: 'button',
                        'aria-expanded': (
                            props.sectionIsExpanded as
                                | ((index: number) => boolean)
                                | undefined
                        )?.(row.sectionIndex ?? 0),
                        onClick: () =>
                            (
                                props.onChangeSection as
                                    | ((section: unknown, index: number) => void)
                                    | undefined
                            )?.(row.section, row.sectionIndex ?? 0),
                    },
                    String(row.section?.name ?? ''),
                );
            }
            if (row?.type === 'item') {
                return React.createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: () =>
                            (
                                props.onChange as
                                    | ((item: unknown) => void)
                                    | undefined
                            )?.(row.item),
                    },
                    String(row.item?.name ?? row.item?.label ?? ''),
                );
            }
            return null;
        }

        if (name === 'DataGrid') {
            const rows = Array.isArray(props.rows) ? props.rows : [];
            return React.createElement(
                'div',
                { 'data-boundary': name },
                ...rows.map((row) => {
                    const cells = (row as { cells?: Record<string, unknown> })
                        .cells;
                    return React.createElement(
                        'div',
                        null,
                        ...Object.values(cells ?? {}).map((cell) =>
                            React.isValidElement(cell)
                                ? cell
                                : React.createElement(
                                      'span',
                                      null,
                                      String(cell ?? ''),
                                  ),
                        ),
                    );
                }),
            );
        }

        if (name === 'ActionIcon') {
            return React.createElement(
                'button',
                {
                    ...Object.fromEntries(
                        ['aria-label', 'className', 'disabled', 'onClick', 'type'].map(
                            (key) => [key, props[key]],
                        ),
                    ),
                    type: 'button',
                },
                children,
            );
        }

        if (name === 'DataGridRow') {
            const row = props.row as
                | { cells?: Record<string, unknown> }
                | undefined;
            const columns = Array.isArray(props.columns)
                ? (props.columns as { field: string }[])
                : [];
            return React.createElement(
                'div',
                { role: 'row' },
                ...columns.map((column) =>
                    React.createElement(
                        'span',
                        { role: 'cell' },
                        row?.cells?.[column.field] as ReactNode,
                    ),
                ),
            );
        }

        if (name === 'Checkbox') {
            return React.createElement(
                'label',
                { 'data-boundary': name },
                React.createElement('input', {
                    ...Object.fromEntries(
                        ['checked', 'disabled', 'id', 'onChange', 'type'].map(
                            (key) => [key, props[key]],
                        ),
                    ),
                    type: 'checkbox',
                    'data-testid': props['data-testid'],
                }),
                children,
            );
        }

        if (name === 'FeatureDiscoveryPanel') {
            const primaryAction = props.primaryAction as
                | {
                      onClick?: () => void;
                      children?: ReactNode;
                      'data-testid'?: string;
                  }
                | undefined;
            const secondaryAction = props.secondaryAction as
                | { children?: ReactNode }
                | undefined;
            return React.createElement(
                'section',
                null,
                props.children as ReactNode,
                primaryAction &&
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            'data-testid': primaryAction['data-testid'],
                            onClick: primaryAction.onClick,
                        },
                        primaryAction.children,
                    ),
                secondaryAction?.children,
            );
        }

        const tagName = /button/i.test(name)
            ? 'button'
            : /link|anchor/i.test(name)
              ? 'a'
              : 'div';
        const safeProps: Record<string, unknown> = {
            'data-boundary': name,
        };
        for (const key of [
            'aria-label',
            'className',
            'disabled',
            'href',
            'id',
            'onClick',
            'onChange',
            'onKeyDown',
            'role',
            'title',
            'type',
        ]) {
            if (props[key] !== undefined) {
                safeProps[key] = props[key];
            }
        }
        if (props['data-testid'] !== undefined) {
            safeProps['data-testid'] = props['data-testid'];
        }
        if (tagName === 'a' && safeProps.href === undefined) {
            safeProps.href = '#';
        }
        return React.createElement(tagName, safeProps, children);
    };

    Boundary.displayName = `DatasetBoundary(${name})`;
    return Boundary;
}

function labelText(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object') {
        const descriptor = value as Record<string, unknown>;
        return String(descriptor.defaultMessage ?? descriptor.id ?? '');
    }
    return '';
}

function utility(name: string) {
    switch (name) {
        case 'connect':
        case 'ExplicitSize':
            return () => (component: unknown) => component;
        case 'injectIntl':
            return (component: unknown) => component;
        case 'defineMessage':
            return (message: unknown) => message;
        case 'defineMessages':
            return (messages: unknown) => messages;
        case 'useIntl':
            return () => ({
                formatMessage: (message: Record<string, unknown>) =>
                    String(message.defaultMessage ?? message.id ?? ''),
            });
        case 'useDispatch':
            return () => () => ({ unwrap: async () => undefined });
        case 'useSetting':
            return (setting: string) => setting === 'email-configured?';
        case 'useGetFieldQuery':
            return () => ({ data: undefined });
        case 'useLatest':
            return (value: unknown) => ({ current: value });
        case 'useUpdateTableMutation':
            return () => [
                async () => ({ error: undefined }),
                { isLoading: false },
            ];
        case 'useMetadataToasts':
            return () => ({
                sendErrorToast: () => undefined,
                sendSuccessToast: () => undefined,
                sendUndoToast: () => undefined,
            });
        case 'forgotPassword':
            return (email: string) => ({ type: 'forgotPassword', payload: email });
        case 'conjunct':
            return (values: unknown[], conjunction: string) =>
                values.map(String).join(` ${conjunction} `);
        case 'formatDateValue':
            return (_parameter: unknown, value: string) => value;
        case 'isNotNull':
            return (value: unknown) => value !== null && value !== undefined;
        case 'isCypressActive':
            return false;
        case 'getHistory':
            return () => ({ push: () => undefined });
        case 't':
            return (strings: TemplateStringsArray, ...values: unknown[]) =>
                strings.reduce(
                    (result, string, index) =>
                        result + string + String(values[index] ?? ''),
                    '',
                );
        case 'memoize':
            return (callback: unknown) => callback;
        case 'delay':
            return () => 0;
        case 'getFullName':
            return (user: Record<string, unknown>) =>
                [user.first_name, user.last_name].filter(Boolean).join(' ');
        case 'getNextCursor':
        case 'getPrevCursor':
            return () => null;
        case 'searchFilter':
            return ({ sections }: { sections: unknown[] }) =>
                sections.map((section, sectionIndex) => ({
                    section,
                    sectionIndex,
                    items: (
                        (section as { items?: unknown[] }).items ?? []
                    ).map((item, itemIndex) => ({ item, itemIndex })),
                }));
        case 'getDataTypes':
        case 'getEntityLookups':
            return () => ({});
        case 'filterProfilesStartingWithTerm':
            return (profiles: Record<string, unknown>[], term: string) =>
                profiles.filter((profile) =>
                    String(profile.username ?? '')
                        .toLowerCase()
                        .startsWith(term.toLowerCase()),
                );
        case 'isEqual':
            return (left: unknown, right: unknown) =>
                JSON.stringify(left) === JSON.stringify(right);
        case 'findIndex':
            return (items: unknown[], predicate: (...args: unknown[]) => boolean) =>
                items.findIndex(predicate);
        case 'findWhere':
            return (
                items: Record<string, unknown>[],
                criteria: Record<string, unknown>,
            ) =>
                items.find((item) =>
                    Object.entries(criteria).every(
                        ([key, value]) => item[key] === value,
                    ),
                );
        case 'uniq':
            return (items: unknown[]) => [...new Set(items)];
        case 'pick':
            return (value: Record<string, unknown>, keys: string[]) =>
                Object.fromEntries(
                    keys.filter((key) => key in value).map((key) => [key, value[key]]),
                );
        case 'some':
        case 'every':
            return (items: unknown[], predicate: (...args: unknown[]) => boolean) =>
                name === 'some'
                    ? items.some(predicate)
                    : items.every(predicate);
        case 'compose':
            return (...functions: ((value: unknown) => unknown)[]) =>
                (value: unknown) =>
                    functions.reduceRight(
                        (result, callback) => callback(result),
                        value,
                    );
        case 'throttle':
            return (callback: unknown) => callback;
        case 'isQuestionCard':
            return (card: Record<string, unknown> | undefined) =>
                Boolean(card?.id);
        case 'hasNoResults':
            return () => false;
        case 'isRegularClickAction':
            return () => false;
        case 'isVirtualCardId':
        case 'isLicenseExpired':
        case 'isLicenseExpiring':
        case 'isTrialLicense':
        case 'isEnterpriseLicense':
        case 'isEmbeddingSdk':
        case 'canUserCreateQueries':
            return () => false;
        case 'licenseSKUWithFirstLetterCapitalized':
        case 'licenseSkuToLabel':
            return (value: unknown) => String(value ?? '');
        case 'formatNumber':
            return (value: unknown) => String(value ?? '');
        case 'getQuestionIdFromVirtualTableId':
        case 'parseSchemaId':
        case 'getCardKey':
            return (value: unknown) => value;
        case 'getComputedSettingsForSeries':
        case 'extractRemappings':
            return () => ({});
        case 'getVisualizationTransformed':
            return () => ({});
        case 'isSameSeries':
            return () => true;
        case 'getVisualizationComponent':
            return () => boundaryComponent('VisualizationComponent');
        case 'PLUGIN_CUSTOM_VIZ':
            return {
                useAutoLoadCustomVizPlugin: () => ({ loading: false }),
            };
        case 'prefetchVisualizationComponent':
        case 'performDefaultAction':
        case 'forceRedraw':
        case 'reportReadyToParent':
        case 'getPrevTrialLicense':
        case 'getLicenseConfig':
            return () => undefined;
        default:
            if (name.startsWith('useLazy')) {
                return () => [async () => undefined, { data: [], isLoading: false }];
            }
            if (name.startsWith('use')) {
                return () => ({ data: [], isLoading: false, isFetching: false });
            }
            if (name.startsWith('is') || name.startsWith('can')) {
                return () => false;
            }
            return () => undefined;
    }
}

function underscoreMock() {
    return new Proxy(
        {},
        {
            get: (_target, property) => underscoreUtility(String(property)),
        },
    );
}

function sortBy(values: unknown[], iteratee: unknown): unknown[] {
    const getValue =
        typeof iteratee === 'function'
            ? (value: unknown) =>
                  (iteratee as (item: unknown) => unknown)(value)
            : (value: unknown) =>
                  (value as Record<string, unknown>)[String(iteratee)];
    return values
        .map((value, index) => ({ value, index, key: getValue(value) }))
        .sort((left, right) => {
            if (left.key == null && right.key != null) {
                return -1;
            }
            if (left.key != null && right.key == null) {
                return 1;
            }
            if (left.key === right.key) {
                return left.index - right.index;
            }
            return left.key! < right.key! ? -1 : 1;
        })
        .map(({ value }) => value);
}

function underscoreUtility(name: string) {
    if (name === 'sortBy') {
        return sortBy;
    }
    if (name === 'chain') {
        return (values: unknown[]) => {
            let current = [...values];
            const chain = {
                sortBy(iteratee: unknown) {
                    current = sortBy(current, iteratee);
                    return chain;
                },
                value() {
                    return current;
                },
            };
            return chain;
        };
    }
    return utility(name);
}

function constantsMock() {
    return new Proxy(
        {},
        {
            get: (_target, property) =>
                property === 'SEARCH_TIMEOUT_MILLISECONDS'
                    ? 0
                    : String(property),
        },
    );
}

function cssModuleMock() {
    return new Proxy(
        {},
        {
            get: (_target, property) => String(property),
        },
    );
}

export function createDatasetBoundaryModule(
    modulePath: string,
    imports: DatasetImportDescriptor[],
): Record<string, unknown> {
    const exports: Record<string, unknown> = {};
    const componentExports = new Set(
        imports.filter((item) => item.isComponent).map((item) => item.exportName),
    );

    if (modulePath.includes('resize-observer')) {
        exports.default = {
            subscribe: () => undefined,
            unsubscribe: () => undefined,
        };
    } else if (modulePath.endsWith('.css') || modulePath.endsWith('.scss')) {
        exports.default = cssModuleMock();
    } else if (modulePath.includes('classnames')) {
        exports.default = classNames;
    } else if (modulePath.includes('debounce')) {
        exports.default = (callback: (...args: unknown[]) => unknown) =>
            Object.assign(callback, { cancel: () => undefined });
    } else if (modulePath.includes('underscore')) {
        exports.default = underscoreMock();
    } else if (modulePath.includes('constants')) {
        exports.default = constantsMock();
    } else if (imports.some((item) => item.exportName === 'default')) {
        exports.default = componentExports.has('default')
            ? boundaryComponent('default')
            : utility(modulePath.split('/').pop() ?? 'default');
    }

    for (const item of imports) {
        if (item.exportName === 'default') {
            if (item.isComponent) {
                exports.default =
                    item.localName === 'Menu'
                        ? menuBoundary()
                        : boundaryComponent(item.localName);
            }
            continue;
        }
        if (item.isNamespace) {
            continue;
        } else if (componentExports.has(item.exportName)) {
            exports[item.exportName] =
                item.localName === 'Modal'
                    ? modalBoundary()
                    : item.localName === 'Popover'
                      ? popoverBoundary()
                    : item.localName === 'MantineTabs'
                      ? tabsBoundary()
                    : item.localName === 'Menu'
                      ? menuBoundary()
                    : boundaryComponent(item.localName);
        } else if (item.exportName === 'Client4') {
            exports.Client4 = new Proxy(
                {},
                {
                    get: () => () => '',
                },
            );
        } else {
            exports[item.exportName] = utility(item.exportName);
        }
    }

    if (imports.some((item) => item.isNamespace)) {
        Object.assign(exports, underscoreMock());
    }

    return exports;
}

function menuBoundary() {
    const Menu = boundaryComponent('Menu') as BoundaryComponent;
    Menu.ItemAction = boundaryComponent('Menu.ItemAction');
    Menu.ItemSubMenu = boundaryComponent('Menu.ItemSubMenu');
    return Menu;
}

function modalBoundary() {
    const Modal = boundaryComponent('Modal') as BoundaryComponent;
    Modal.Header = boundaryComponent('Modal.Header');
    Modal.Body = boundaryComponent('Modal.Body');
    Modal.Title = boundaryComponent('Modal.Title');
    Modal.Footer = boundaryComponent('Modal.Footer');
    return Modal;
}

function popoverBoundary() {
    const Popover = boundaryComponent('Popover') as BoundaryComponent & {
        Target?: React.ComponentType<Record<string, unknown>>;
        Dropdown?: React.ComponentType<Record<string, unknown>>;
    };
    Popover.Target = boundaryComponent('Popover.Target');
    Popover.Dropdown = boundaryComponent('Popover.Dropdown');
    return Popover;
}

function tabsBoundary() {
    const Tabs = boundaryComponent('Tabs') as BoundaryComponent & {
        Tab?: React.ComponentType<Record<string, unknown>>;
    };
    Tabs.Tab = boundaryComponent('Tabs.Tab');
    return Tabs;
}
