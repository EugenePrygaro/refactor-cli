import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type ExportMap = Record<string, unknown>;

interface ContractContext {
    view: ReturnType<typeof render>;
    spies: Record<string, ReturnType<typeof vi.fn>>;
}

interface DatasetContract {
    exportName: string;
    createProps: (spies: ContractContext['spies']) => Record<string, unknown>;
    verify: (context: ContractContext) => void | Promise<void>;
    createElement?: (
        component: unknown,
        props: Record<string, unknown>,
    ) => React.ReactElement;
}

const contracts: Record<string, DatasetContract> = {
    'component-06': {
        exportName: 'default',
        createProps: (spies) => ({
            multilSelectKey: 'members',
            userStatuses: {},
            intl: { formatMessage: (message: { defaultMessage: string }) => message.defaultMessage },
            onSubmitCallback: spies.onSubmitCallback,
            profiles: [{ id: 'user-1', username: 'alice', delete_at: 0 }],
            savingEnabled: true,
            saving: false,
            actions: {
                getProfiles: spies.getProfiles,
                getProfilesNotInGroup: spies.getProfilesNotInGroup,
                loadStatusesForProfilesList: spies.loadStatusesForProfilesList,
                searchProfiles: spies.searchProfiles,
            },
        }),
        verify: async ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'alice' }));
            fireEvent.click(view.getByRole('button', { name: 'Create Group' }));
            await waitFor(() =>
                expect(spies.onSubmitCallback).toHaveBeenCalledWith([
                    expect.objectContaining({ id: 'user-1', username: 'alice' }),
                ]),
            );
        },
    },
    'component-08': {
        exportName: 'default',
        createProps: (spies) => ({
            channels: [{
                id: 'channel-1',
                name: 'general',
                display_name: 'General',
                team_display_name: 'Engineering',
                policy_auto_add: false,
            }],
            totalCount: 1,
            searchTerm: '',
            filters: {},
            onRemoveCallback: spies.onRemoveCallback,
            channelsToRemove: {},
            channelsToAdd: {},
            onPolicyActiveStatusChange: spies.onPolicyActiveStatusChange,
            policyActiveStatusChanges: [],
            saving: false,
            hideTeamColumn: true,
            intl: { formatMessage: (message: { defaultMessage: string }) => message.defaultMessage },
            actions: {
                searchChannels: spies.searchChannels,
                setChannelListSearch: spies.setChannelListSearch,
                setChannelListFilters: spies.setChannelListFilters,
            },
        }),
        verify: ({ view, spies }) => {
            fireEvent.click(view.getByTestId('auto-add-checkbox-channel-1'));
            expect(spies.onPolicyActiveStatusChange).toHaveBeenCalledWith([
                { id: 'channel-1', active: true },
            ]);
        },
    },
    'component-12': {
        exportName: 'default',
        createProps: (spies) => ({
            rows: [{ cells: { name: 'First row' } }],
            columns: [{ name: 'Name', field: 'name', fixed: true }],
            startCount: 1,
            endCount: 1,
            total: 2,
            loading: false,
            nextPage: spies.nextPage,
            previousPage: spies.previousPage,
            intl: { formatMessage: (message: { defaultMessage: string }) => message.defaultMessage },
        }),
        verify: ({ view, spies }) => {
            expect(view.getByTestId('dataGrid')).toBeTruthy();
            expect(view.getByText('First row')).toBeTruthy();
            fireEvent.click(view.getByRole('button', { name: 'Next page' }));
            expect(spies.nextPage).toHaveBeenCalledOnce();
        },
    },
    'component-17': {
        exportName: 'default',
        createProps: (spies) => ({
            teams: [{ id: 'team-1', name: 'engineering', display_name: 'Engineering' }],
            totalCount: 1,
            searchTerm: '',
            policyId: 'policy-1',
            onRemoveCallback: spies.onRemoveCallback,
            teamsToRemove: {},
            teamsToAdd: {},
            actions: {
                searchTeams: spies.searchTeams,
                getDataRetentionCustomPolicyTeams: spies.getDataRetentionCustomPolicyTeams,
                setTeamListSearch: spies.setTeamListSearch,
            },
        }),
        verify: ({ view, spies }) => {
            expect(view.getByText('Engineering')).toBeTruthy();
            fireEvent.click(view.getByRole('link', { name: 'Remove' }));
            expect(spies.onRemoveCallback).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'team-1' }),
            );
        },
    },
    'component-18': {
        exportName: 'default',
        createProps: (spies) => ({
            featureName: 'audit logs',
            minimumSKURequiredForFeature: 'enterprise',
            title: { id: 'feature.title', defaultMessage: 'Audit logs' },
            copy: { id: 'feature.copy', defaultMessage: 'Track important events' },
            learnMoreURL: 'https://example.test/learn-more',
            featureDiscoveryImage: React.createElement('span', null, 'Illustration'),
            prevTrialLicense: {},
            actions: {
                getPrevTrialLicense: spies.getPrevTrialLicense,
                getCloudSubscription: spies.getCloudSubscription,
                openModal: spies.openModal,
            },
            isEnterpriseReady: true,
            isCloud: false,
            isCloudTrial: false,
            hadPrevCloudTrial: false,
            isSubscriptionLoaded: true,
            isPaidSubscription: false,
            openTrialForm: spies.openTrialForm,
        }),
        verify: ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'Start trial' }));
            expect(spies.openTrialForm).toHaveBeenCalledOnce();
        },
    },
    'component-25': {
        exportName: 'default',
        createProps: (spies) => ({
            license: { IsLicensed: 'false', SkuShortName: 'Team Edition' },
            enterpriseReady: true,
            upgradedFromTE: false,
            totalUsers: 3,
            isDisabled: false,
            prevTrialLicense: {},
            environmentConfig: {},
            actions: {
                getLicenseConfig: spies.getLicenseConfig,
                uploadLicense: spies.uploadLicense,
                removeLicense: spies.removeLicense,
                getPrevTrialLicense: spies.getPrevTrialLicense,
                upgradeToE0: spies.upgradeToE0,
                upgradeToE0Status: spies.upgradeToE0Status,
                isAllowedToUpgradeToEnterprise: spies.isAllowedToUpgradeToEnterprise,
                restartServer: spies.restartServer,
                ping: spies.ping,
                openModal: spies.openModal,
                getServerLimits: spies.getServerLimits,
                getFilteredUsersStats: spies.getFilteredUsersStats,
            },
        }),
        verify: ({ view, spies }) => {
            expect(view.getByText('Edition and License')).toBeTruthy();
            expect(spies.getLicenseConfig).toHaveBeenCalledOnce();
            expect(spies.getPrevTrialLicense).toHaveBeenCalledOnce();
        },
    },
    'component-27': {
        exportName: 'default',
        createProps: (spies) => ({
            user: {
                id: 'user-1',
                username: 'alice',
                first_name: 'Alice',
                last_name: 'Example',
                email: 'alice@example.test',
                last_picture_update: 0,
            },
            userAccessTokens: {},
            onExited: spies.onExited,
            actions: { getUserAccessTokensForUser: spies.getUserAccessTokensForUser },
        }),
        verify: ({ view, spies }) => {
            expect(view.getByText('No personal access tokens.')).toBeTruthy();
            expect(spies.getUserAccessTokensForUser).toHaveBeenCalledWith(
                'user-1',
                0,
                200,
            );
        },
    },
    'component-32': {
        exportName: 'AccordionList',
        createProps: (spies) => ({
            sections: [{
                name: 'Status',
                items: [{ id: 'item-1', name: 'Open' }],
            }],
            itemIsSelected: () => false,
            onChange: spies.onChange,
        }),
        verify: ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'Open' }));
            expect(spies.onChange).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'item-1', name: 'Open' }),
            );
        },
    },
    'component-36': {
        exportName: 'ModalContent',
        createProps: () => ({
            'data-testid': 'modal-content',
            title: 'Dialog title',
            footer: 'Apply',
            children: 'Dialog body',
        }),
        verify: ({ view }) => {
            expect(view.getByTestId('modal-content').textContent).toContain(
                'Dialog body',
            );
            expect(view.getByText('Dialog title')).toBeTruthy();
            expect(view.getByText('Apply')).toBeTruthy();
        },
    },
    'component-38': {
        exportName: 'TextWidget',
        createProps: (spies) => ({
            value: 'before',
            setValue: spies.setValue,
            isEditing: false,
            focusChanged: spies.focusChanged,
        }),
        verify: ({ view, spies }) => {
            const input = view.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'after' } });
            fireEvent.blur(input);
            expect(spies.setValue).toHaveBeenCalledWith('after');
            expect(spies.focusChanged).toHaveBeenCalledWith(false);
        },
    },
    'component-39': {
        exportName: 'UnconnectedDataSelector',
        createProps: (spies) => ({
            steps: ['DATABASE'],
            triggerElement: React.createElement('button', null, 'Choose database'),
            databases: [{ id: 1, name: 'Primary', engine: 'postgres' }],
            availableModels: [],
            entityLookups: {
                database: () => undefined,
                databaseSchemas: () => [],
                databaseTables: () => [],
                field: () => undefined,
                fieldName: () => '',
                schema: () => undefined,
                schemaTables: () => [],
                table: () => undefined,
                tableFields: () => [],
                tableSchema: () => undefined,
            },
            hasLoadedDatabasesWithTablesSaved: true,
            hasLoadedDatabasesWithSaved: true,
            hasLoadedDatabasesWithTables: true,
            hasDataAccess: true,
            hasNestedQueriesEnabled: false,
            fetchDatabases: spies.fetchDatabases,
            fetchFields: spies.fetchFields,
            fetchQuestion: spies.fetchQuestion,
            fetchSchemas: spies.fetchSchemas,
            fetchSchemaTables: spies.fetchSchemaTables,
            loading: false,
            loaded: true,
            allLoading: false,
            setDatabaseFn: spies.setDatabaseFn,
        }),
        verify: async ({ view, spies }) => {
            expect(view.getByRole('button', { name: 'Choose database' })).toBeTruthy();
            await waitFor(() =>
                expect(spies.setDatabaseFn).toHaveBeenCalledWith(1),
            );
        },
    },
    'component-43': {
        exportName: 'default',
        createProps: () => ({ rawSeries: [], width: 320, height: 180 }),
        verify: ({ view }) => {
            expect(view.getByTestId('visualization-root')).toBeTruthy();
            expect(view.getByText('Loading')).toBeTruthy();
        },
    },
    'component-44': {
        exportName: 'default',
        createProps: (spies) => ({
            id: 'visibility',
            values: [
                { key: 'Visible', value: 'visible', testId: 'visible-option' },
                { key: 'Hidden', value: 'hidden', testId: 'hidden-option' },
            ],
            value: 'visible',
            onChange: spies.onChange,
        }),
        verify: ({ view, spies }) => {
            const hidden = view.getByRole('radio', { name: 'Hidden' });
            expect((view.getByRole('radio', { name: 'Visible' }) as HTMLInputElement).checked).toBe(true);
            fireEvent.click(hidden);
            expect(spies.onChange).toHaveBeenCalledOnce();
        },
    },
    'component-45': {
        exportName: 'default',
        createProps: (spies) => ({
            saving: false,
            saveNeeded: true,
            onClick: spies.onClick,
            onCancel: spies.onCancel,
        }),
        verify: ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'Save' }));
            fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
            expect(spies.onClick).toHaveBeenCalledOnce();
            expect(spies.onCancel).toHaveBeenCalledOnce();
        },
    },
    'component-46': {
        exportName: 'default',
        createProps: (spies) => {
            spies.getAppliedSchemaMigrations.mockResolvedValue({
                data: [
                    { version: '20260101', name: 'add-index' },
                    { version: '20260202', name: 'update-schema' },
                ],
            });
            return {
                createHelpText: React.createElement('span', null, 'Migration history'),
                actions: { getAppliedSchemaMigrations: spies.getAppliedSchemaMigrations },
            };
        },
        verify: async ({ view, spies }) => {
            await waitFor(() =>
                expect(view.getByText('add-index')).toBeTruthy(),
            );
            expect(view.getByText('20260202')).toBeTruthy();
            expect(spies.getAppliedSchemaMigrations).toHaveBeenCalledOnce();
        },
    },
    'component-47': {
        exportName: 'TabsTab',
        createProps: (spies) => ({
            value: 'tab-1',
            closable: true,
            onClose: spies.onClose,
            children: 'Details',
        }),
        verify: ({ view, spies }) => {
            const tab = view.getByRole('tab', { name: 'Details' });
            fireEvent.keyDown(tab, { key: 'Backspace' });
            expect(spies.onClose).toHaveBeenCalledWith('tab-1');
        },
    },
    'component-48': {
        exportName: 'TableVisibilityToggle',
        createProps: (spies) => ({
            table: { id: 12, display_name: 'Orders', visibility_type: null },
            onUpdate: spies.onUpdate,
        }),
        verify: async ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'Hide table' }));
            await waitFor(() =>
                expect(spies.onUpdate).toHaveBeenCalledOnce(),
            );
        },
    },
    'component-49': {
        exportName: 'ForgotPassword',
        createProps: () => ({
            location: { search: '?email=alice%40example.test' },
        }),
        verify: async ({ view }) => {
            expect((view.getByRole('textbox', { name: 'Email' }) as HTMLInputElement).value).toBe(
                'alice@example.test',
            );
            fireEvent.click(
                view.getByRole('button', { name: 'Send reset instructions' }),
            );
            await waitFor(() =>
                expect(
                    view.getByText(/we'll send instructions on how to reset your password/i),
                ).toBeTruthy(),
            );
        },
    },
    'component-50': {
        exportName: 'default',
        createProps: () => ({
            parameters: [
                { id: 'p1', name: 'Region', type: 'text', default: 'North' },
                { id: 'p2', name: 'Status', type: 'text', default: ['Open', 'Pending'] },
            ],
        }),
        verify: ({ view }) => {
            expect(view.getByText('Filter values')).toBeTruthy();
            expect(view.getByText('Region: North')).toBeTruthy();
            expect(view.getByText('Status: Open and Pending')).toBeTruthy();
        },
    },
    'component-51': {
        exportName: 'ExplicitSize',
        createProps: () => ({}),
        createElement: (component) => {
            const explicitSize = component as (
                options?: Record<string, unknown>,
            ) => (
                child: React.ComponentType<{
                    width: number | null;
                    height: number | null;
                }>,
            ) => React.ComponentType;
            const Wrapped = explicitSize({ refreshMode: 'none' })(
                React.forwardRef<
                    HTMLDivElement,
                    { width: number | null; height: number | null }
                >(({ width, height }, ref) => {
                    const setBounds = (element: HTMLDivElement | null) => {
                        if (element) {
                            element.getBoundingClientRect = () =>
                                ({
                                    width: 320,
                                    height: 180,
                                }) as DOMRect;
                        }
                        if (typeof ref === 'function') {
                            ref(element);
                        } else if (ref) {
                            ref.current = element;
                        }
                    };
                    return React.createElement(
                        'div',
                        { ref: setBounds, 'data-testid': 'measured-size' },
                        `${width}x${height}`,
                    );
                }),
            );
            return React.createElement(Wrapped);
        },
        verify: async ({ view }) => {
            await waitFor(() =>
                expect(view.getByTestId('measured-size').textContent).toBe(
                    '320x180',
                ),
            );
        },
    },
    'component-52': {
        exportName: 'default',
        createProps: (spies) => ({
            team: { id: 'team-1', name: 'engineering' },
            hook: { id: 'hook-1', display_name: 'Existing hook' },
            hookId: 'hook-1',
            enableIncomingWebhooks: true,
            enablePostUsernameOverride: true,
            enablePostIconOverride: true,
            actions: {
                getIncomingHook: spies.getIncomingHook,
                updateIncomingHook: spies.updateIncomingHook,
            },
        }),
        verify: async ({ view, spies }) => {
            expect(spies.getIncomingHook).toHaveBeenCalledWith('hook-1');
            fireEvent.click(view.getByRole('button', { name: 'Update' }));
            await waitFor(() =>
                expect(spies.updateIncomingHook).toHaveBeenCalledWith(
                    expect.objectContaining({
                        id: 'hook-1',
                        display_name: 'Updated hook',
                    }),
                ),
            );
        },
    },
    'component-53': {
        exportName: 'TagEditorParam',
        createProps: (spies) => ({
            tag: {
                id: 'tag-1',
                name: 'customer_id',
                type: 'dimension',
                dimension: undefined,
                'widget-type': undefined,
            },
            parameter: { id: 'tag-1', isMultiSelect: false },
            databases: [],
            setTemplateTag: spies.setTemplateTag,
            setTemplateTagConfig: spies.setTemplateTagConfig,
            setParameterValue: spies.setParameterValue,
        }),
        verify: async ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'Number' }));
            await waitFor(() => {
                expect(spies.setTemplateTag).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'number',
                        dimension: undefined,
                        'widget-type': undefined,
                    }),
                );
                expect(spies.setParameterValue).toHaveBeenCalledWith(
                    'tag-1',
                    null,
                );
                expect(spies.setTemplateTagConfig).toHaveBeenCalledOnce();
            });
        },
    },
    'component-54': {
        exportName: 'default',
        createProps: () => ({
            database: { id: 2, name: 'Analytics' },
            tables: [
                {
                    id: 3,
                    db_id: 2,
                    name: 'Zulu',
                    schema: 'alpha',
                    initial_sync_status: 'complete',
                },
                {
                    id: 4,
                    db_id: 2,
                    name: 'Alpha',
                    schema: 'alpha',
                    initial_sync_status: 'complete',
                },
                {
                    id: 5,
                    db_id: 2,
                    name: 'Pending',
                    schema: 'beta',
                    initial_sync_status: 'incomplete',
                },
            ],
        }),
        verify: ({ view }) => {
            const items = view.getAllByTestId('table-list-item');
            expect(items.map((item) => item.textContent)).toEqual([
                'Alpha',
                'Zulu',
                'Pending',
            ]);
            expect(view.getByRole('link', { name: 'Alpha' }).getAttribute('href')).toBe(
                '/reference/databases/2/tables/4',
            );
            expect(items[2].getAttribute('data-disabled')).toBe('true');
        },
    },
    'component-55': {
        exportName: 'default',
        createProps: (spies) => ({
            appBindings: [],
            appsEnabled: false,
            handleDropdownOpened: spies.handleDropdownOpened,
            intl: {
                formatMessage: (message: { defaultMessage: string }) =>
                    message.defaultMessage,
            },
            isMenuOpen: true,
            isMobileView: false,
            isSysAdmin: false,
            location: 'CENTER',
            pluginMenuItems: [
                {
                    id: 'run-action',
                    pluginId: 'test-plugin',
                    text: 'Run action',
                    action: spies.onAction,
                    filter: () => true,
                },
            ],
            post: { id: 'post-1', channel_id: 'channel-1' },
            teamId: 'team-1',
            canOpenMarketplace: false,
            pluginMenuItemComponents: [],
            actions: {
                openModal: spies.openModal,
                postEphemeralCallResponseForPost:
                    spies.postEphemeralCallResponseForPost,
                handleBindingClick: spies.handleBindingClick,
                openAppsModal: spies.openAppsModal,
                fetchBindings: spies.fetchBindings,
            },
        }),
        verify: ({ view, spies }) => {
            fireEvent.click(view.getByRole('button', { name: 'Run action' }));
            expect(spies.onAction).toHaveBeenCalledWith('post-1');
        },
    },
};

function getComponent(
    componentExports: ExportMap,
    exportName: string,
): React.ElementType {
    const component = componentExports[exportName];
    if (
        typeof component !== 'function' &&
        (typeof component !== 'object' ||
            component === null ||
            !('$$typeof' in component))
    ) {
        throw new Error(`Expected ${exportName} to export a React component.`);
    }
    return component as React.ElementType;
}

function createSpies(): ContractContext['spies'] {
    return new Proxy(
        {} as Record<string, ReturnType<typeof vi.fn>>,
        {
            get: (target, property: string) => {
                if (!(property in target)) {
                    target[property] = vi.fn(async () => ({
                        data: { channels: [], teams: [] },
                    }));
                }
                return target[property];
            },
        },
    );
}

export function registerDatasetBehavior(
    componentId: string,
    legacyExports: ExportMap,
    modernExports: ExportMap,
): void {
    const contract = contracts[componentId];
    if (!contract) {
        throw new Error(`No behavioral contract is registered for ${componentId}.`);
    }

    describe(`${componentId} behavioral contract`, () => {
        for (const [label, componentExports] of [
            ['legacy', legacyExports],
            ['generated', modernExports],
        ] as const) {
            it(`satisfies the shared ${label} behavior`, async () => {
                const spies = createSpies();
                const Component = getComponent(
                    componentExports,
                    contract.exportName,
                );
                const props = contract.createProps(spies);
                const element = contract.createElement
                    ? contract.createElement(Component, props)
                    : React.createElement(
                          Component,
                          props as React.Attributes & Record<string, unknown>,
                      );
                const view = render(element);
                try {
                    await contract.verify({ view, spies });
                } finally {
                    view.unmount();
                }
            });
        }
    });
}
