// Generated from Hey API output by scripts/generate-api-bindings.mjs. Do not edit.
'use client';

import { acceptWorkspaceInvitationMutation as heyAcceptWorkspaceInvitationMutation, addWorkspaceMemberMutation as heyAddWorkspaceMemberMutation, archiveNodeMutation as heyArchiveNodeMutation, archiveTaskMutation as heyArchiveTaskMutation, archiveWorkspaceMutation as heyArchiveWorkspaceMutation, bulkUpdateTasksMutation as heyBulkUpdateTasksMutation, createNodeMutation as heyCreateNodeMutation, createScopeFieldMutation as heyCreateScopeFieldMutation, createScopeStatusMutation as heyCreateScopeStatusMutation, createTaskMutation as heyCreateTaskMutation, createWorkspaceInvitationMutation as heyCreateWorkspaceInvitationMutation, getCurrentUserOptions as heyGetCurrentUserOptions, getCurrentUserQueryKey as heyGetCurrentUserQueryKey, getListResolvedFieldsOptions as heyGetListResolvedFieldsOptions, getListResolvedFieldsQueryKey as heyGetListResolvedFieldsQueryKey, getListResolvedStatusesOptions as heyGetListResolvedStatusesOptions, getListResolvedStatusesQueryKey as heyGetListResolvedStatusesQueryKey, getNodeOptions as heyGetNodeOptions, getNodeQueryKey as heyGetNodeQueryKey, getTaskOptions as heyGetTaskOptions, getTaskQueryKey as heyGetTaskQueryKey, getWorkspaceOptions as heyGetWorkspaceOptions, getWorkspaceQueryKey as heyGetWorkspaceQueryKey, listNodeGrantsInfiniteOptions as heyListNodeGrantsInfiniteOptions, listNodeGrantsInfiniteQueryKey as heyListNodeGrantsInfiniteQueryKey, listNodeGrantsOptions as heyListNodeGrantsOptions, listNodeGrantsQueryKey as heyListNodeGrantsQueryKey, listScopeFieldsOptions as heyListScopeFieldsOptions, listScopeFieldsQueryKey as heyListScopeFieldsQueryKey, listScopeStatusesOptions as heyListScopeStatusesOptions, listScopeStatusesQueryKey as heyListScopeStatusesQueryKey, listTaskActivityInfiniteOptions as heyListTaskActivityInfiniteOptions, listTaskActivityInfiniteQueryKey as heyListTaskActivityInfiniteQueryKey, listTaskActivityOptions as heyListTaskActivityOptions, listTaskActivityQueryKey as heyListTaskActivityQueryKey, listTasksInfiniteOptions as heyListTasksInfiniteOptions, listTasksInfiniteQueryKey as heyListTasksInfiniteQueryKey, listTasksOptions as heyListTasksOptions, listTasksQueryKey as heyListTasksQueryKey, listVisibleTreeInfiniteOptions as heyListVisibleTreeInfiniteOptions, listVisibleTreeInfiniteQueryKey as heyListVisibleTreeInfiniteQueryKey, listVisibleTreeOptions as heyListVisibleTreeOptions, listVisibleTreeQueryKey as heyListVisibleTreeQueryKey, listWorkspaceMembersInfiniteOptions as heyListWorkspaceMembersInfiniteOptions, listWorkspaceMembersInfiniteQueryKey as heyListWorkspaceMembersInfiniteQueryKey, listWorkspaceMembersOptions as heyListWorkspaceMembersOptions, listWorkspaceMembersQueryKey as heyListWorkspaceMembersQueryKey, listWorkspacesInfiniteOptions as heyListWorkspacesInfiniteOptions, listWorkspacesInfiniteQueryKey as heyListWorkspacesInfiniteQueryKey, listWorkspacesOptions as heyListWorkspacesOptions, listWorkspacesQueryKey as heyListWorkspacesQueryKey, moveNodeMutation as heyMoveNodeMutation, moveTaskMutation as heyMoveTaskMutation, removeNodeGrantMutation as heyRemoveNodeGrantMutation, removeScopeFieldMutation as heyRemoveScopeFieldMutation, removeScopeStatusMutation as heyRemoveScopeStatusMutation, removeWorkspaceMemberMutation as heyRemoveWorkspaceMemberMutation, reorderNodeMutation as heyReorderNodeMutation, reorderTaskMutation as heyReorderTaskMutation, restoreWorkspaceMutation as heyRestoreWorkspaceMutation, searchWorkspaceInfiniteOptions as heySearchWorkspaceInfiniteOptions, searchWorkspaceInfiniteQueryKey as heySearchWorkspaceInfiniteQueryKey, searchWorkspaceOptions as heySearchWorkspaceOptions, searchWorkspaceQueryKey as heySearchWorkspaceQueryKey, updateNodeMutation as heyUpdateNodeMutation, updateScopeFieldMutation as heyUpdateScopeFieldMutation, updateScopeStatusMutation as heyUpdateScopeStatusMutation, updateTaskMutation as heyUpdateTaskMutation, updateWorkspaceMemberMutation as heyUpdateWorkspaceMemberMutation, updateWorkspaceMutation as heyUpdateWorkspaceMutation, upsertNodeGrantMutation as heyUpsertNodeGrantMutation } from '@flowboard/api-client/tanstack-query';
import type { AcceptWorkspaceInvitationError, AcceptWorkspaceInvitationResponse, AddWorkspaceMemberError, AddWorkspaceMemberResponse, ArchiveNodeError, ArchiveNodeResponse, ArchiveTaskError, ArchiveTaskResponse, ArchiveWorkspaceError, ArchiveWorkspaceResponse, BulkUpdateTasksError, BulkUpdateTasksResponse, CreateNodeError, CreateNodeResponse, CreateScopeFieldError, CreateScopeFieldResponse, CreateScopeStatusError, CreateScopeStatusResponse, CreateTaskError, CreateTaskResponse, CreateWorkspaceInvitationError, CreateWorkspaceInvitationResponse, GetCurrentUserError, GetCurrentUserResponse, GetListResolvedFieldsError, GetListResolvedFieldsResponse, GetListResolvedStatusesError, GetListResolvedStatusesResponse, GetNodeError, GetNodeResponse, GetTaskError, GetTaskResponse, GetWorkspaceError, GetWorkspaceResponse, ListNodeGrantsError, ListNodeGrantsResponse, ListScopeFieldsError, ListScopeFieldsResponse, ListScopeStatusesError, ListScopeStatusesResponse, ListTaskActivityError, ListTaskActivityResponse, ListTasksError, ListTasksResponse, ListVisibleTreeError, ListVisibleTreeResponse, ListWorkspaceMembersError, ListWorkspaceMembersResponse, ListWorkspacesError, ListWorkspacesResponse, MoveNodeError, MoveNodeResponse, MoveTaskError, MoveTaskResponse, RemoveNodeGrantError, RemoveNodeGrantResponse, RemoveScopeFieldError, RemoveScopeFieldResponse, RemoveScopeStatusError, RemoveScopeStatusResponse, RemoveWorkspaceMemberError, RemoveWorkspaceMemberResponse, ReorderNodeError, ReorderNodeResponse, ReorderTaskError, ReorderTaskResponse, RestoreWorkspaceError, RestoreWorkspaceResponse, SearchWorkspaceError, SearchWorkspaceResponse, UpdateNodeError, UpdateNodeResponse, UpdateScopeFieldError, UpdateScopeFieldResponse, UpdateScopeStatusError, UpdateScopeStatusResponse, UpdateTaskError, UpdateTaskResponse, UpdateWorkspaceError, UpdateWorkspaceMemberError, UpdateWorkspaceMemberResponse, UpdateWorkspaceResponse, UpsertNodeGrantError, UpsertNodeGrantResponse } from '@flowboard/api-client/types';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, UseQueryOptions, UseQueryResult, UseInfiniteQueryOptions, UseInfiniteQueryResult, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { apiRequest, bindMutation, mergeQueryOptions, scopeQuery, scopeMutation } from '../lib/apiBindings';
import type { ApiContext, ApiParameters, ApiClientParameters } from '../lib/apiBindings';
import { useApiMutation } from '../lib/useApiMutation';
export { acceptWorkspaceInvitationMutationKey, addWorkspaceMemberMutationKey, archiveNodeMutationKey, archiveTaskMutationKey, archiveWorkspaceMutationKey, bulkUpdateTasksMutationKey, createNodeMutationKey, createScopeFieldMutationKey, createScopeStatusMutationKey, createTaskMutationKey, createWorkspaceInvitationMutationKey, getCurrentUserQueryKey, getListResolvedFieldsQueryKey, getListResolvedStatusesQueryKey, getNodeQueryKey, getTaskQueryKey, getWorkspaceQueryKey, listNodeGrantsInfiniteQueryKey, listNodeGrantsQueryKey, listScopeFieldsQueryKey, listScopeStatusesQueryKey, listTaskActivityInfiniteQueryKey, listTaskActivityQueryKey, listTasksInfiniteQueryKey, listTasksQueryKey, listVisibleTreeInfiniteQueryKey, listVisibleTreeQueryKey, listWorkspaceMembersInfiniteQueryKey, listWorkspaceMembersQueryKey, listWorkspacesInfiniteQueryKey, listWorkspacesQueryKey, moveNodeMutationKey, moveTaskMutationKey, removeNodeGrantMutationKey, removeScopeFieldMutationKey, removeScopeStatusMutationKey, removeWorkspaceMemberMutationKey, reorderNodeMutationKey, reorderTaskMutationKey, restoreWorkspaceMutationKey, searchWorkspaceInfiniteQueryKey, searchWorkspaceQueryKey, updateNodeMutationKey, updateScopeFieldMutationKey, updateScopeStatusMutationKey, updateTaskMutationKey, updateWorkspaceMemberMutationKey, updateWorkspaceMutationKey, upsertNodeGrantMutationKey } from '@flowboard/api-client/tanstack-query';


export type AcceptWorkspaceInvitationMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyAcceptWorkspaceInvitationMutation>['mutationFn']>>[0]>;
export type AcceptWorkspaceInvitationMutationParameters = ApiClientParameters<Parameters<typeof heyAcceptWorkspaceInvitationMutation>[0]>;
export type AcceptWorkspaceInvitationMutationOptions<TContext = unknown> = Omit<UseMutationOptions<AcceptWorkspaceInvitationResponse, AcceptWorkspaceInvitationError | Error, AcceptWorkspaceInvitationMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type AcceptWorkspaceInvitationMutationResult<TContext = unknown> = UseMutationResult<AcceptWorkspaceInvitationResponse, AcceptWorkspaceInvitationError | Error, AcceptWorkspaceInvitationMutationVariables, TContext>;
export function acceptWorkspaceInvitationMutation<TContext = unknown>(parameters: AcceptWorkspaceInvitationMutationParameters, options: AcceptWorkspaceInvitationMutationOptions<TContext> = {}) {
  return bindMutation(heyAcceptWorkspaceInvitationMutation(parameters), parameters.client, options);
}
export function useAcceptWorkspaceInvitationMutation<TContext = unknown>(input: ApiContext, options: AcceptWorkspaceInvitationMutationOptions<TContext> = {}): AcceptWorkspaceInvitationMutationResult<TContext> {
  return useApiMutation(scopeMutation(acceptWorkspaceInvitationMutation({ client: input.runtime.client }, options), input));
}


export type AddWorkspaceMemberMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyAddWorkspaceMemberMutation>['mutationFn']>>[0]>;
export type AddWorkspaceMemberMutationParameters = ApiClientParameters<Parameters<typeof heyAddWorkspaceMemberMutation>[0]>;
export type AddWorkspaceMemberMutationOptions<TContext = unknown> = Omit<UseMutationOptions<AddWorkspaceMemberResponse, AddWorkspaceMemberError | Error, AddWorkspaceMemberMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type AddWorkspaceMemberMutationResult<TContext = unknown> = UseMutationResult<AddWorkspaceMemberResponse, AddWorkspaceMemberError | Error, AddWorkspaceMemberMutationVariables, TContext>;
export function addWorkspaceMemberMutation<TContext = unknown>(parameters: AddWorkspaceMemberMutationParameters, options: AddWorkspaceMemberMutationOptions<TContext> = {}) {
  return bindMutation(heyAddWorkspaceMemberMutation(parameters), parameters.client, options);
}
export function useAddWorkspaceMemberMutation<TContext = unknown>(input: ApiContext, options: AddWorkspaceMemberMutationOptions<TContext> = {}): AddWorkspaceMemberMutationResult<TContext> {
  return useApiMutation(scopeMutation(addWorkspaceMemberMutation({ client: input.runtime.client }, options), input));
}


export type ArchiveNodeMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyArchiveNodeMutation>['mutationFn']>>[0]>;
export type ArchiveNodeMutationParameters = ApiClientParameters<Parameters<typeof heyArchiveNodeMutation>[0]>;
export type ArchiveNodeMutationOptions<TContext = unknown> = Omit<UseMutationOptions<ArchiveNodeResponse, ArchiveNodeError | Error, ArchiveNodeMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type ArchiveNodeMutationResult<TContext = unknown> = UseMutationResult<ArchiveNodeResponse, ArchiveNodeError | Error, ArchiveNodeMutationVariables, TContext>;
export function archiveNodeMutation<TContext = unknown>(parameters: ArchiveNodeMutationParameters, options: ArchiveNodeMutationOptions<TContext> = {}) {
  return bindMutation(heyArchiveNodeMutation(parameters), parameters.client, options);
}
export function useArchiveNodeMutation<TContext = unknown>(input: ApiContext, options: ArchiveNodeMutationOptions<TContext> = {}): ArchiveNodeMutationResult<TContext> {
  return useApiMutation(scopeMutation(archiveNodeMutation({ client: input.runtime.client }, options), input));
}


export type ArchiveTaskMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyArchiveTaskMutation>['mutationFn']>>[0]>;
export type ArchiveTaskMutationParameters = ApiClientParameters<Parameters<typeof heyArchiveTaskMutation>[0]>;
export type ArchiveTaskMutationOptions<TContext = unknown> = Omit<UseMutationOptions<ArchiveTaskResponse, ArchiveTaskError | Error, ArchiveTaskMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type ArchiveTaskMutationResult<TContext = unknown> = UseMutationResult<ArchiveTaskResponse, ArchiveTaskError | Error, ArchiveTaskMutationVariables, TContext>;
export function archiveTaskMutation<TContext = unknown>(parameters: ArchiveTaskMutationParameters, options: ArchiveTaskMutationOptions<TContext> = {}) {
  return bindMutation(heyArchiveTaskMutation(parameters), parameters.client, options);
}
export function useArchiveTaskMutation<TContext = unknown>(input: ApiContext, options: ArchiveTaskMutationOptions<TContext> = {}): ArchiveTaskMutationResult<TContext> {
  return useApiMutation(scopeMutation(archiveTaskMutation({ client: input.runtime.client }, options), input));
}


export type ArchiveWorkspaceMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyArchiveWorkspaceMutation>['mutationFn']>>[0]>;
export type ArchiveWorkspaceMutationParameters = ApiClientParameters<Parameters<typeof heyArchiveWorkspaceMutation>[0]>;
export type ArchiveWorkspaceMutationOptions<TContext = unknown> = Omit<UseMutationOptions<ArchiveWorkspaceResponse, ArchiveWorkspaceError | Error, ArchiveWorkspaceMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type ArchiveWorkspaceMutationResult<TContext = unknown> = UseMutationResult<ArchiveWorkspaceResponse, ArchiveWorkspaceError | Error, ArchiveWorkspaceMutationVariables, TContext>;
export function archiveWorkspaceMutation<TContext = unknown>(parameters: ArchiveWorkspaceMutationParameters, options: ArchiveWorkspaceMutationOptions<TContext> = {}) {
  return bindMutation(heyArchiveWorkspaceMutation(parameters), parameters.client, options);
}
export function useArchiveWorkspaceMutation<TContext = unknown>(input: ApiContext, options: ArchiveWorkspaceMutationOptions<TContext> = {}): ArchiveWorkspaceMutationResult<TContext> {
  return useApiMutation(scopeMutation(archiveWorkspaceMutation({ client: input.runtime.client }, options), input));
}


export type BulkUpdateTasksMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyBulkUpdateTasksMutation>['mutationFn']>>[0]>;
export type BulkUpdateTasksMutationParameters = ApiClientParameters<Parameters<typeof heyBulkUpdateTasksMutation>[0]>;
export type BulkUpdateTasksMutationOptions<TContext = unknown> = Omit<UseMutationOptions<BulkUpdateTasksResponse, BulkUpdateTasksError | Error, BulkUpdateTasksMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type BulkUpdateTasksMutationResult<TContext = unknown> = UseMutationResult<BulkUpdateTasksResponse, BulkUpdateTasksError | Error, BulkUpdateTasksMutationVariables, TContext>;
export function bulkUpdateTasksMutation<TContext = unknown>(parameters: BulkUpdateTasksMutationParameters, options: BulkUpdateTasksMutationOptions<TContext> = {}) {
  return bindMutation(heyBulkUpdateTasksMutation(parameters), parameters.client, options);
}
export function useBulkUpdateTasksMutation<TContext = unknown>(input: ApiContext, options: BulkUpdateTasksMutationOptions<TContext> = {}): BulkUpdateTasksMutationResult<TContext> {
  return useApiMutation(scopeMutation(bulkUpdateTasksMutation({ client: input.runtime.client }, options), input));
}


export type CreateNodeMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyCreateNodeMutation>['mutationFn']>>[0]>;
export type CreateNodeMutationParameters = ApiClientParameters<Parameters<typeof heyCreateNodeMutation>[0]>;
export type CreateNodeMutationOptions<TContext = unknown> = Omit<UseMutationOptions<CreateNodeResponse, CreateNodeError | Error, CreateNodeMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type CreateNodeMutationResult<TContext = unknown> = UseMutationResult<CreateNodeResponse, CreateNodeError | Error, CreateNodeMutationVariables, TContext>;
export function createNodeMutation<TContext = unknown>(parameters: CreateNodeMutationParameters, options: CreateNodeMutationOptions<TContext> = {}) {
  return bindMutation(heyCreateNodeMutation(parameters), parameters.client, options);
}
export function useCreateNodeMutation<TContext = unknown>(input: ApiContext, options: CreateNodeMutationOptions<TContext> = {}): CreateNodeMutationResult<TContext> {
  return useApiMutation(scopeMutation(createNodeMutation({ client: input.runtime.client }, options), input));
}


export type CreateScopeFieldMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyCreateScopeFieldMutation>['mutationFn']>>[0]>;
export type CreateScopeFieldMutationParameters = ApiClientParameters<Parameters<typeof heyCreateScopeFieldMutation>[0]>;
export type CreateScopeFieldMutationOptions<TContext = unknown> = Omit<UseMutationOptions<CreateScopeFieldResponse, CreateScopeFieldError | Error, CreateScopeFieldMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type CreateScopeFieldMutationResult<TContext = unknown> = UseMutationResult<CreateScopeFieldResponse, CreateScopeFieldError | Error, CreateScopeFieldMutationVariables, TContext>;
export function createScopeFieldMutation<TContext = unknown>(parameters: CreateScopeFieldMutationParameters, options: CreateScopeFieldMutationOptions<TContext> = {}) {
  return bindMutation(heyCreateScopeFieldMutation(parameters), parameters.client, options);
}
export function useCreateScopeFieldMutation<TContext = unknown>(input: ApiContext, options: CreateScopeFieldMutationOptions<TContext> = {}): CreateScopeFieldMutationResult<TContext> {
  return useApiMutation(scopeMutation(createScopeFieldMutation({ client: input.runtime.client }, options), input));
}


export type CreateScopeStatusMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyCreateScopeStatusMutation>['mutationFn']>>[0]>;
export type CreateScopeStatusMutationParameters = ApiClientParameters<Parameters<typeof heyCreateScopeStatusMutation>[0]>;
export type CreateScopeStatusMutationOptions<TContext = unknown> = Omit<UseMutationOptions<CreateScopeStatusResponse, CreateScopeStatusError | Error, CreateScopeStatusMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type CreateScopeStatusMutationResult<TContext = unknown> = UseMutationResult<CreateScopeStatusResponse, CreateScopeStatusError | Error, CreateScopeStatusMutationVariables, TContext>;
export function createScopeStatusMutation<TContext = unknown>(parameters: CreateScopeStatusMutationParameters, options: CreateScopeStatusMutationOptions<TContext> = {}) {
  return bindMutation(heyCreateScopeStatusMutation(parameters), parameters.client, options);
}
export function useCreateScopeStatusMutation<TContext = unknown>(input: ApiContext, options: CreateScopeStatusMutationOptions<TContext> = {}): CreateScopeStatusMutationResult<TContext> {
  return useApiMutation(scopeMutation(createScopeStatusMutation({ client: input.runtime.client }, options), input));
}


export type CreateTaskMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyCreateTaskMutation>['mutationFn']>>[0]>;
export type CreateTaskMutationParameters = ApiClientParameters<Parameters<typeof heyCreateTaskMutation>[0]>;
export type CreateTaskMutationOptions<TContext = unknown> = Omit<UseMutationOptions<CreateTaskResponse, CreateTaskError | Error, CreateTaskMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type CreateTaskMutationResult<TContext = unknown> = UseMutationResult<CreateTaskResponse, CreateTaskError | Error, CreateTaskMutationVariables, TContext>;
export function createTaskMutation<TContext = unknown>(parameters: CreateTaskMutationParameters, options: CreateTaskMutationOptions<TContext> = {}) {
  return bindMutation(heyCreateTaskMutation(parameters), parameters.client, options);
}
export function useCreateTaskMutation<TContext = unknown>(input: ApiContext, options: CreateTaskMutationOptions<TContext> = {}): CreateTaskMutationResult<TContext> {
  return useApiMutation(scopeMutation(createTaskMutation({ client: input.runtime.client }, options), input));
}


export type CreateWorkspaceInvitationMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyCreateWorkspaceInvitationMutation>['mutationFn']>>[0]>;
export type CreateWorkspaceInvitationMutationParameters = ApiClientParameters<Parameters<typeof heyCreateWorkspaceInvitationMutation>[0]>;
export type CreateWorkspaceInvitationMutationOptions<TContext = unknown> = Omit<UseMutationOptions<CreateWorkspaceInvitationResponse, CreateWorkspaceInvitationError | Error, CreateWorkspaceInvitationMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type CreateWorkspaceInvitationMutationResult<TContext = unknown> = UseMutationResult<CreateWorkspaceInvitationResponse, CreateWorkspaceInvitationError | Error, CreateWorkspaceInvitationMutationVariables, TContext>;
export function createWorkspaceInvitationMutation<TContext = unknown>(parameters: CreateWorkspaceInvitationMutationParameters, options: CreateWorkspaceInvitationMutationOptions<TContext> = {}) {
  return bindMutation(heyCreateWorkspaceInvitationMutation(parameters), parameters.client, options);
}
export function useCreateWorkspaceInvitationMutation<TContext = unknown>(input: ApiContext, options: CreateWorkspaceInvitationMutationOptions<TContext> = {}): CreateWorkspaceInvitationMutationResult<TContext> {
  return useApiMutation(scopeMutation(createWorkspaceInvitationMutation({ client: input.runtime.client }, options), input));
}


export type GetCurrentUserQueryParameters = ApiClientParameters<Parameters<typeof heyGetCurrentUserOptions>[0]>;
export type GetCurrentUserQueryInput = ApiContext & ApiParameters<GetCurrentUserQueryParameters>;
export type GetCurrentUserQueryKey = ReturnType<typeof heyGetCurrentUserQueryKey>;
export type GetCurrentUserQueryOptions = Omit<UseQueryOptions<GetCurrentUserResponse, GetCurrentUserError | Error, GetCurrentUserResponse, GetCurrentUserQueryKey>, 'queryKey' | 'queryFn'>;
export type GetCurrentUserQueryResult = UseQueryResult<GetCurrentUserResponse, GetCurrentUserError | Error>;
export function getCurrentUserOptions(parameters: GetCurrentUserQueryParameters, options: GetCurrentUserQueryOptions = {}) {
  return mergeQueryOptions(heyGetCurrentUserOptions(parameters), options);
}
export function useGetCurrentUserQuery(input: GetCurrentUserQueryInput, options: GetCurrentUserQueryOptions = {}): GetCurrentUserQueryResult {
  return useQuery<GetCurrentUserResponse, GetCurrentUserError | Error, GetCurrentUserResponse, GetCurrentUserQueryKey>(scopeQuery(getCurrentUserOptions(apiRequest(input) as GetCurrentUserQueryParameters, options), input));
}


export type GetListResolvedFieldsQueryParameters = ApiClientParameters<Parameters<typeof heyGetListResolvedFieldsOptions>[0]>;
export type GetListResolvedFieldsQueryInput = ApiContext & ApiParameters<GetListResolvedFieldsQueryParameters>;
export type GetListResolvedFieldsQueryKey = ReturnType<typeof heyGetListResolvedFieldsQueryKey>;
export type GetListResolvedFieldsQueryOptions = Omit<UseQueryOptions<GetListResolvedFieldsResponse, GetListResolvedFieldsError | Error, GetListResolvedFieldsResponse, GetListResolvedFieldsQueryKey>, 'queryKey' | 'queryFn'>;
export type GetListResolvedFieldsQueryResult = UseQueryResult<GetListResolvedFieldsResponse, GetListResolvedFieldsError | Error>;
export function getListResolvedFieldsOptions(parameters: GetListResolvedFieldsQueryParameters, options: GetListResolvedFieldsQueryOptions = {}) {
  return mergeQueryOptions(heyGetListResolvedFieldsOptions(parameters), options);
}
export function useGetListResolvedFieldsQuery(input: GetListResolvedFieldsQueryInput, options: GetListResolvedFieldsQueryOptions = {}): GetListResolvedFieldsQueryResult {
  return useQuery<GetListResolvedFieldsResponse, GetListResolvedFieldsError | Error, GetListResolvedFieldsResponse, GetListResolvedFieldsQueryKey>(scopeQuery(getListResolvedFieldsOptions(apiRequest(input) as GetListResolvedFieldsQueryParameters, options), input));
}


export type GetListResolvedStatusesQueryParameters = ApiClientParameters<Parameters<typeof heyGetListResolvedStatusesOptions>[0]>;
export type GetListResolvedStatusesQueryInput = ApiContext & ApiParameters<GetListResolvedStatusesQueryParameters>;
export type GetListResolvedStatusesQueryKey = ReturnType<typeof heyGetListResolvedStatusesQueryKey>;
export type GetListResolvedStatusesQueryOptions = Omit<UseQueryOptions<GetListResolvedStatusesResponse, GetListResolvedStatusesError | Error, GetListResolvedStatusesResponse, GetListResolvedStatusesQueryKey>, 'queryKey' | 'queryFn'>;
export type GetListResolvedStatusesQueryResult = UseQueryResult<GetListResolvedStatusesResponse, GetListResolvedStatusesError | Error>;
export function getListResolvedStatusesOptions(parameters: GetListResolvedStatusesQueryParameters, options: GetListResolvedStatusesQueryOptions = {}) {
  return mergeQueryOptions(heyGetListResolvedStatusesOptions(parameters), options);
}
export function useGetListResolvedStatusesQuery(input: GetListResolvedStatusesQueryInput, options: GetListResolvedStatusesQueryOptions = {}): GetListResolvedStatusesQueryResult {
  return useQuery<GetListResolvedStatusesResponse, GetListResolvedStatusesError | Error, GetListResolvedStatusesResponse, GetListResolvedStatusesQueryKey>(scopeQuery(getListResolvedStatusesOptions(apiRequest(input) as GetListResolvedStatusesQueryParameters, options), input));
}


export type GetNodeQueryParameters = ApiClientParameters<Parameters<typeof heyGetNodeOptions>[0]>;
export type GetNodeQueryInput = ApiContext & ApiParameters<GetNodeQueryParameters>;
export type GetNodeQueryKey = ReturnType<typeof heyGetNodeQueryKey>;
export type GetNodeQueryOptions = Omit<UseQueryOptions<GetNodeResponse, GetNodeError | Error, GetNodeResponse, GetNodeQueryKey>, 'queryKey' | 'queryFn'>;
export type GetNodeQueryResult = UseQueryResult<GetNodeResponse, GetNodeError | Error>;
export function getNodeOptions(parameters: GetNodeQueryParameters, options: GetNodeQueryOptions = {}) {
  return mergeQueryOptions(heyGetNodeOptions(parameters), options);
}
export function useGetNodeQuery(input: GetNodeQueryInput, options: GetNodeQueryOptions = {}): GetNodeQueryResult {
  return useQuery<GetNodeResponse, GetNodeError | Error, GetNodeResponse, GetNodeQueryKey>(scopeQuery(getNodeOptions(apiRequest(input) as GetNodeQueryParameters, options), input));
}


export type GetTaskQueryParameters = ApiClientParameters<Parameters<typeof heyGetTaskOptions>[0]>;
export type GetTaskQueryInput = ApiContext & ApiParameters<GetTaskQueryParameters>;
export type GetTaskQueryKey = ReturnType<typeof heyGetTaskQueryKey>;
export type GetTaskQueryOptions = Omit<UseQueryOptions<GetTaskResponse, GetTaskError | Error, GetTaskResponse, GetTaskQueryKey>, 'queryKey' | 'queryFn'>;
export type GetTaskQueryResult = UseQueryResult<GetTaskResponse, GetTaskError | Error>;
export function getTaskOptions(parameters: GetTaskQueryParameters, options: GetTaskQueryOptions = {}) {
  return mergeQueryOptions(heyGetTaskOptions(parameters), options);
}
export function useGetTaskQuery(input: GetTaskQueryInput, options: GetTaskQueryOptions = {}): GetTaskQueryResult {
  return useQuery<GetTaskResponse, GetTaskError | Error, GetTaskResponse, GetTaskQueryKey>(scopeQuery(getTaskOptions(apiRequest(input) as GetTaskQueryParameters, options), input));
}


export type GetWorkspaceQueryParameters = ApiClientParameters<Parameters<typeof heyGetWorkspaceOptions>[0]>;
export type GetWorkspaceQueryInput = ApiContext & ApiParameters<GetWorkspaceQueryParameters>;
export type GetWorkspaceQueryKey = ReturnType<typeof heyGetWorkspaceQueryKey>;
export type GetWorkspaceQueryOptions = Omit<UseQueryOptions<GetWorkspaceResponse, GetWorkspaceError | Error, GetWorkspaceResponse, GetWorkspaceQueryKey>, 'queryKey' | 'queryFn'>;
export type GetWorkspaceQueryResult = UseQueryResult<GetWorkspaceResponse, GetWorkspaceError | Error>;
export function getWorkspaceOptions(parameters: GetWorkspaceQueryParameters, options: GetWorkspaceQueryOptions = {}) {
  return mergeQueryOptions(heyGetWorkspaceOptions(parameters), options);
}
export function useGetWorkspaceQuery(input: GetWorkspaceQueryInput, options: GetWorkspaceQueryOptions = {}): GetWorkspaceQueryResult {
  return useQuery<GetWorkspaceResponse, GetWorkspaceError | Error, GetWorkspaceResponse, GetWorkspaceQueryKey>(scopeQuery(getWorkspaceOptions(apiRequest(input) as GetWorkspaceQueryParameters, options), input));
}


export type ListNodeGrantsInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heyListNodeGrantsInfiniteOptions>[0]>;
export type ListNodeGrantsInfiniteQueryInput = ApiContext & ApiParameters<ListNodeGrantsInfiniteQueryParameters>;
export type ListNodeGrantsPageKey = ReturnType<typeof heyListNodeGrantsInfiniteQueryKey>;
export type ListNodeGrantsPageParam = ReturnType<typeof heyListNodeGrantsInfiniteOptions>['initialPageParam'];
export type ListNodeGrantsPageData = InfiniteData<ListNodeGrantsResponse, ListNodeGrantsPageParam>;
export type ListNodeGrantsInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<ListNodeGrantsResponse, ListNodeGrantsError | Error, ListNodeGrantsPageData, ListNodeGrantsPageKey, ListNodeGrantsPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ListNodeGrantsInfiniteHookOptions = ListNodeGrantsInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<ListNodeGrantsResponse, ListNodeGrantsError | Error, ListNodeGrantsPageData, ListNodeGrantsPageKey, ListNodeGrantsPageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ListNodeGrantsInfiniteQueryResult = UseInfiniteQueryResult<ListNodeGrantsPageData, ListNodeGrantsError | Error>;
export function listNodeGrantsInfiniteOptions(parameters: ListNodeGrantsInfiniteQueryParameters, options: ListNodeGrantsInfiniteQueryOptions = {}) {
  const definition = heyListNodeGrantsInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useListNodeGrantsInfiniteQuery(input: ListNodeGrantsInfiniteQueryInput, options: ListNodeGrantsInfiniteHookOptions): ListNodeGrantsInfiniteQueryResult {
  const definition = scopeQuery(listNodeGrantsInfiniteOptions(apiRequest(input) as ListNodeGrantsInfiniteQueryParameters), input);
  return useInfiniteQuery<ListNodeGrantsResponse, ListNodeGrantsError | Error, ListNodeGrantsPageData, ListNodeGrantsPageKey, ListNodeGrantsPageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type ListNodeGrantsQueryParameters = ApiClientParameters<Parameters<typeof heyListNodeGrantsOptions>[0]>;
export type ListNodeGrantsQueryInput = ApiContext & ApiParameters<ListNodeGrantsQueryParameters>;
export type ListNodeGrantsQueryKey = ReturnType<typeof heyListNodeGrantsQueryKey>;
export type ListNodeGrantsQueryOptions = Omit<UseQueryOptions<ListNodeGrantsResponse, ListNodeGrantsError | Error, ListNodeGrantsResponse, ListNodeGrantsQueryKey>, 'queryKey' | 'queryFn'>;
export type ListNodeGrantsQueryResult = UseQueryResult<ListNodeGrantsResponse, ListNodeGrantsError | Error>;
export function listNodeGrantsOptions(parameters: ListNodeGrantsQueryParameters, options: ListNodeGrantsQueryOptions = {}) {
  return mergeQueryOptions(heyListNodeGrantsOptions(parameters), options);
}
export function useListNodeGrantsQuery(input: ListNodeGrantsQueryInput, options: ListNodeGrantsQueryOptions = {}): ListNodeGrantsQueryResult {
  return useQuery<ListNodeGrantsResponse, ListNodeGrantsError | Error, ListNodeGrantsResponse, ListNodeGrantsQueryKey>(scopeQuery(listNodeGrantsOptions(apiRequest(input) as ListNodeGrantsQueryParameters, options), input));
}


export type ListScopeFieldsQueryParameters = ApiClientParameters<Parameters<typeof heyListScopeFieldsOptions>[0]>;
export type ListScopeFieldsQueryInput = ApiContext & ApiParameters<ListScopeFieldsQueryParameters>;
export type ListScopeFieldsQueryKey = ReturnType<typeof heyListScopeFieldsQueryKey>;
export type ListScopeFieldsQueryOptions = Omit<UseQueryOptions<ListScopeFieldsResponse, ListScopeFieldsError | Error, ListScopeFieldsResponse, ListScopeFieldsQueryKey>, 'queryKey' | 'queryFn'>;
export type ListScopeFieldsQueryResult = UseQueryResult<ListScopeFieldsResponse, ListScopeFieldsError | Error>;
export function listScopeFieldsOptions(parameters: ListScopeFieldsQueryParameters, options: ListScopeFieldsQueryOptions = {}) {
  return mergeQueryOptions(heyListScopeFieldsOptions(parameters), options);
}
export function useListScopeFieldsQuery(input: ListScopeFieldsQueryInput, options: ListScopeFieldsQueryOptions = {}): ListScopeFieldsQueryResult {
  return useQuery<ListScopeFieldsResponse, ListScopeFieldsError | Error, ListScopeFieldsResponse, ListScopeFieldsQueryKey>(scopeQuery(listScopeFieldsOptions(apiRequest(input) as ListScopeFieldsQueryParameters, options), input));
}


export type ListScopeStatusesQueryParameters = ApiClientParameters<Parameters<typeof heyListScopeStatusesOptions>[0]>;
export type ListScopeStatusesQueryInput = ApiContext & ApiParameters<ListScopeStatusesQueryParameters>;
export type ListScopeStatusesQueryKey = ReturnType<typeof heyListScopeStatusesQueryKey>;
export type ListScopeStatusesQueryOptions = Omit<UseQueryOptions<ListScopeStatusesResponse, ListScopeStatusesError | Error, ListScopeStatusesResponse, ListScopeStatusesQueryKey>, 'queryKey' | 'queryFn'>;
export type ListScopeStatusesQueryResult = UseQueryResult<ListScopeStatusesResponse, ListScopeStatusesError | Error>;
export function listScopeStatusesOptions(parameters: ListScopeStatusesQueryParameters, options: ListScopeStatusesQueryOptions = {}) {
  return mergeQueryOptions(heyListScopeStatusesOptions(parameters), options);
}
export function useListScopeStatusesQuery(input: ListScopeStatusesQueryInput, options: ListScopeStatusesQueryOptions = {}): ListScopeStatusesQueryResult {
  return useQuery<ListScopeStatusesResponse, ListScopeStatusesError | Error, ListScopeStatusesResponse, ListScopeStatusesQueryKey>(scopeQuery(listScopeStatusesOptions(apiRequest(input) as ListScopeStatusesQueryParameters, options), input));
}


export type ListTaskActivityInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heyListTaskActivityInfiniteOptions>[0]>;
export type ListTaskActivityInfiniteQueryInput = ApiContext & ApiParameters<ListTaskActivityInfiniteQueryParameters>;
export type ListTaskActivityPageKey = ReturnType<typeof heyListTaskActivityInfiniteQueryKey>;
export type ListTaskActivityPageParam = ReturnType<typeof heyListTaskActivityInfiniteOptions>['initialPageParam'];
export type ListTaskActivityPageData = InfiniteData<ListTaskActivityResponse, ListTaskActivityPageParam>;
export type ListTaskActivityInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<ListTaskActivityResponse, ListTaskActivityError | Error, ListTaskActivityPageData, ListTaskActivityPageKey, ListTaskActivityPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ListTaskActivityInfiniteHookOptions = ListTaskActivityInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<ListTaskActivityResponse, ListTaskActivityError | Error, ListTaskActivityPageData, ListTaskActivityPageKey, ListTaskActivityPageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ListTaskActivityInfiniteQueryResult = UseInfiniteQueryResult<ListTaskActivityPageData, ListTaskActivityError | Error>;
export function listTaskActivityInfiniteOptions(parameters: ListTaskActivityInfiniteQueryParameters, options: ListTaskActivityInfiniteQueryOptions = {}) {
  const definition = heyListTaskActivityInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useListTaskActivityInfiniteQuery(input: ListTaskActivityInfiniteQueryInput, options: ListTaskActivityInfiniteHookOptions): ListTaskActivityInfiniteQueryResult {
  const definition = scopeQuery(listTaskActivityInfiniteOptions(apiRequest(input) as ListTaskActivityInfiniteQueryParameters), input);
  return useInfiniteQuery<ListTaskActivityResponse, ListTaskActivityError | Error, ListTaskActivityPageData, ListTaskActivityPageKey, ListTaskActivityPageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type ListTaskActivityQueryParameters = ApiClientParameters<Parameters<typeof heyListTaskActivityOptions>[0]>;
export type ListTaskActivityQueryInput = ApiContext & ApiParameters<ListTaskActivityQueryParameters>;
export type ListTaskActivityQueryKey = ReturnType<typeof heyListTaskActivityQueryKey>;
export type ListTaskActivityQueryOptions = Omit<UseQueryOptions<ListTaskActivityResponse, ListTaskActivityError | Error, ListTaskActivityResponse, ListTaskActivityQueryKey>, 'queryKey' | 'queryFn'>;
export type ListTaskActivityQueryResult = UseQueryResult<ListTaskActivityResponse, ListTaskActivityError | Error>;
export function listTaskActivityOptions(parameters: ListTaskActivityQueryParameters, options: ListTaskActivityQueryOptions = {}) {
  return mergeQueryOptions(heyListTaskActivityOptions(parameters), options);
}
export function useListTaskActivityQuery(input: ListTaskActivityQueryInput, options: ListTaskActivityQueryOptions = {}): ListTaskActivityQueryResult {
  return useQuery<ListTaskActivityResponse, ListTaskActivityError | Error, ListTaskActivityResponse, ListTaskActivityQueryKey>(scopeQuery(listTaskActivityOptions(apiRequest(input) as ListTaskActivityQueryParameters, options), input));
}


export type ListTasksInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heyListTasksInfiniteOptions>[0]>;
export type ListTasksInfiniteQueryInput = ApiContext & ApiParameters<ListTasksInfiniteQueryParameters>;
export type ListTasksPageKey = ReturnType<typeof heyListTasksInfiniteQueryKey>;
export type ListTasksPageParam = ReturnType<typeof heyListTasksInfiniteOptions>['initialPageParam'];
export type ListTasksPageData = InfiniteData<ListTasksResponse, ListTasksPageParam>;
export type ListTasksInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<ListTasksResponse, ListTasksError | Error, ListTasksPageData, ListTasksPageKey, ListTasksPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ListTasksInfiniteHookOptions = ListTasksInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<ListTasksResponse, ListTasksError | Error, ListTasksPageData, ListTasksPageKey, ListTasksPageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ListTasksInfiniteQueryResult = UseInfiniteQueryResult<ListTasksPageData, ListTasksError | Error>;
export function listTasksInfiniteOptions(parameters: ListTasksInfiniteQueryParameters, options: ListTasksInfiniteQueryOptions = {}) {
  const definition = heyListTasksInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useListTasksInfiniteQuery(input: ListTasksInfiniteQueryInput, options: ListTasksInfiniteHookOptions): ListTasksInfiniteQueryResult {
  const definition = scopeQuery(listTasksInfiniteOptions(apiRequest(input) as ListTasksInfiniteQueryParameters), input);
  return useInfiniteQuery<ListTasksResponse, ListTasksError | Error, ListTasksPageData, ListTasksPageKey, ListTasksPageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type ListTasksQueryParameters = ApiClientParameters<Parameters<typeof heyListTasksOptions>[0]>;
export type ListTasksQueryInput = ApiContext & ApiParameters<ListTasksQueryParameters>;
export type ListTasksQueryKey = ReturnType<typeof heyListTasksQueryKey>;
export type ListTasksQueryOptions = Omit<UseQueryOptions<ListTasksResponse, ListTasksError | Error, ListTasksResponse, ListTasksQueryKey>, 'queryKey' | 'queryFn'>;
export type ListTasksQueryResult = UseQueryResult<ListTasksResponse, ListTasksError | Error>;
export function listTasksOptions(parameters: ListTasksQueryParameters, options: ListTasksQueryOptions = {}) {
  return mergeQueryOptions(heyListTasksOptions(parameters), options);
}
export function useListTasksQuery(input: ListTasksQueryInput, options: ListTasksQueryOptions = {}): ListTasksQueryResult {
  return useQuery<ListTasksResponse, ListTasksError | Error, ListTasksResponse, ListTasksQueryKey>(scopeQuery(listTasksOptions(apiRequest(input) as ListTasksQueryParameters, options), input));
}


export type ListVisibleTreeInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heyListVisibleTreeInfiniteOptions>[0]>;
export type ListVisibleTreeInfiniteQueryInput = ApiContext & ApiParameters<ListVisibleTreeInfiniteQueryParameters>;
export type ListVisibleTreePageKey = ReturnType<typeof heyListVisibleTreeInfiniteQueryKey>;
export type ListVisibleTreePageParam = ReturnType<typeof heyListVisibleTreeInfiniteOptions>['initialPageParam'];
export type ListVisibleTreePageData = InfiniteData<ListVisibleTreeResponse, ListVisibleTreePageParam>;
export type ListVisibleTreeInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<ListVisibleTreeResponse, ListVisibleTreeError | Error, ListVisibleTreePageData, ListVisibleTreePageKey, ListVisibleTreePageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ListVisibleTreeInfiniteHookOptions = ListVisibleTreeInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<ListVisibleTreeResponse, ListVisibleTreeError | Error, ListVisibleTreePageData, ListVisibleTreePageKey, ListVisibleTreePageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ListVisibleTreeInfiniteQueryResult = UseInfiniteQueryResult<ListVisibleTreePageData, ListVisibleTreeError | Error>;
export function listVisibleTreeInfiniteOptions(parameters: ListVisibleTreeInfiniteQueryParameters, options: ListVisibleTreeInfiniteQueryOptions = {}) {
  const definition = heyListVisibleTreeInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useListVisibleTreeInfiniteQuery(input: ListVisibleTreeInfiniteQueryInput, options: ListVisibleTreeInfiniteHookOptions): ListVisibleTreeInfiniteQueryResult {
  const definition = scopeQuery(listVisibleTreeInfiniteOptions(apiRequest(input) as ListVisibleTreeInfiniteQueryParameters), input);
  return useInfiniteQuery<ListVisibleTreeResponse, ListVisibleTreeError | Error, ListVisibleTreePageData, ListVisibleTreePageKey, ListVisibleTreePageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type ListVisibleTreeQueryParameters = ApiClientParameters<Parameters<typeof heyListVisibleTreeOptions>[0]>;
export type ListVisibleTreeQueryInput = ApiContext & ApiParameters<ListVisibleTreeQueryParameters>;
export type ListVisibleTreeQueryKey = ReturnType<typeof heyListVisibleTreeQueryKey>;
export type ListVisibleTreeQueryOptions = Omit<UseQueryOptions<ListVisibleTreeResponse, ListVisibleTreeError | Error, ListVisibleTreeResponse, ListVisibleTreeQueryKey>, 'queryKey' | 'queryFn'>;
export type ListVisibleTreeQueryResult = UseQueryResult<ListVisibleTreeResponse, ListVisibleTreeError | Error>;
export function listVisibleTreeOptions(parameters: ListVisibleTreeQueryParameters, options: ListVisibleTreeQueryOptions = {}) {
  return mergeQueryOptions(heyListVisibleTreeOptions(parameters), options);
}
export function useListVisibleTreeQuery(input: ListVisibleTreeQueryInput, options: ListVisibleTreeQueryOptions = {}): ListVisibleTreeQueryResult {
  return useQuery<ListVisibleTreeResponse, ListVisibleTreeError | Error, ListVisibleTreeResponse, ListVisibleTreeQueryKey>(scopeQuery(listVisibleTreeOptions(apiRequest(input) as ListVisibleTreeQueryParameters, options), input));
}


export type ListWorkspaceMembersInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heyListWorkspaceMembersInfiniteOptions>[0]>;
export type ListWorkspaceMembersInfiniteQueryInput = ApiContext & ApiParameters<ListWorkspaceMembersInfiniteQueryParameters>;
export type ListWorkspaceMembersPageKey = ReturnType<typeof heyListWorkspaceMembersInfiniteQueryKey>;
export type ListWorkspaceMembersPageParam = ReturnType<typeof heyListWorkspaceMembersInfiniteOptions>['initialPageParam'];
export type ListWorkspaceMembersPageData = InfiniteData<ListWorkspaceMembersResponse, ListWorkspaceMembersPageParam>;
export type ListWorkspaceMembersInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<ListWorkspaceMembersResponse, ListWorkspaceMembersError | Error, ListWorkspaceMembersPageData, ListWorkspaceMembersPageKey, ListWorkspaceMembersPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ListWorkspaceMembersInfiniteHookOptions = ListWorkspaceMembersInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<ListWorkspaceMembersResponse, ListWorkspaceMembersError | Error, ListWorkspaceMembersPageData, ListWorkspaceMembersPageKey, ListWorkspaceMembersPageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ListWorkspaceMembersInfiniteQueryResult = UseInfiniteQueryResult<ListWorkspaceMembersPageData, ListWorkspaceMembersError | Error>;
export function listWorkspaceMembersInfiniteOptions(parameters: ListWorkspaceMembersInfiniteQueryParameters, options: ListWorkspaceMembersInfiniteQueryOptions = {}) {
  const definition = heyListWorkspaceMembersInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useListWorkspaceMembersInfiniteQuery(input: ListWorkspaceMembersInfiniteQueryInput, options: ListWorkspaceMembersInfiniteHookOptions): ListWorkspaceMembersInfiniteQueryResult {
  const definition = scopeQuery(listWorkspaceMembersInfiniteOptions(apiRequest(input) as ListWorkspaceMembersInfiniteQueryParameters), input);
  return useInfiniteQuery<ListWorkspaceMembersResponse, ListWorkspaceMembersError | Error, ListWorkspaceMembersPageData, ListWorkspaceMembersPageKey, ListWorkspaceMembersPageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type ListWorkspaceMembersQueryParameters = ApiClientParameters<Parameters<typeof heyListWorkspaceMembersOptions>[0]>;
export type ListWorkspaceMembersQueryInput = ApiContext & ApiParameters<ListWorkspaceMembersQueryParameters>;
export type ListWorkspaceMembersQueryKey = ReturnType<typeof heyListWorkspaceMembersQueryKey>;
export type ListWorkspaceMembersQueryOptions = Omit<UseQueryOptions<ListWorkspaceMembersResponse, ListWorkspaceMembersError | Error, ListWorkspaceMembersResponse, ListWorkspaceMembersQueryKey>, 'queryKey' | 'queryFn'>;
export type ListWorkspaceMembersQueryResult = UseQueryResult<ListWorkspaceMembersResponse, ListWorkspaceMembersError | Error>;
export function listWorkspaceMembersOptions(parameters: ListWorkspaceMembersQueryParameters, options: ListWorkspaceMembersQueryOptions = {}) {
  return mergeQueryOptions(heyListWorkspaceMembersOptions(parameters), options);
}
export function useListWorkspaceMembersQuery(input: ListWorkspaceMembersQueryInput, options: ListWorkspaceMembersQueryOptions = {}): ListWorkspaceMembersQueryResult {
  return useQuery<ListWorkspaceMembersResponse, ListWorkspaceMembersError | Error, ListWorkspaceMembersResponse, ListWorkspaceMembersQueryKey>(scopeQuery(listWorkspaceMembersOptions(apiRequest(input) as ListWorkspaceMembersQueryParameters, options), input));
}


export type ListWorkspacesInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heyListWorkspacesInfiniteOptions>[0]>;
export type ListWorkspacesInfiniteQueryInput = ApiContext & ApiParameters<ListWorkspacesInfiniteQueryParameters>;
export type ListWorkspacesPageKey = ReturnType<typeof heyListWorkspacesInfiniteQueryKey>;
export type ListWorkspacesPageParam = ReturnType<typeof heyListWorkspacesInfiniteOptions>['initialPageParam'];
export type ListWorkspacesPageData = InfiniteData<ListWorkspacesResponse, ListWorkspacesPageParam>;
export type ListWorkspacesInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<ListWorkspacesResponse, ListWorkspacesError | Error, ListWorkspacesPageData, ListWorkspacesPageKey, ListWorkspacesPageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ListWorkspacesInfiniteHookOptions = ListWorkspacesInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<ListWorkspacesResponse, ListWorkspacesError | Error, ListWorkspacesPageData, ListWorkspacesPageKey, ListWorkspacesPageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ListWorkspacesInfiniteQueryResult = UseInfiniteQueryResult<ListWorkspacesPageData, ListWorkspacesError | Error>;
export function listWorkspacesInfiniteOptions(parameters: ListWorkspacesInfiniteQueryParameters, options: ListWorkspacesInfiniteQueryOptions = {}) {
  const definition = heyListWorkspacesInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useListWorkspacesInfiniteQuery(input: ListWorkspacesInfiniteQueryInput, options: ListWorkspacesInfiniteHookOptions): ListWorkspacesInfiniteQueryResult {
  const definition = scopeQuery(listWorkspacesInfiniteOptions(apiRequest(input) as ListWorkspacesInfiniteQueryParameters), input);
  return useInfiniteQuery<ListWorkspacesResponse, ListWorkspacesError | Error, ListWorkspacesPageData, ListWorkspacesPageKey, ListWorkspacesPageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type ListWorkspacesQueryParameters = ApiClientParameters<Parameters<typeof heyListWorkspacesOptions>[0]>;
export type ListWorkspacesQueryInput = ApiContext & ApiParameters<ListWorkspacesQueryParameters>;
export type ListWorkspacesQueryKey = ReturnType<typeof heyListWorkspacesQueryKey>;
export type ListWorkspacesQueryOptions = Omit<UseQueryOptions<ListWorkspacesResponse, ListWorkspacesError | Error, ListWorkspacesResponse, ListWorkspacesQueryKey>, 'queryKey' | 'queryFn'>;
export type ListWorkspacesQueryResult = UseQueryResult<ListWorkspacesResponse, ListWorkspacesError | Error>;
export function listWorkspacesOptions(parameters: ListWorkspacesQueryParameters, options: ListWorkspacesQueryOptions = {}) {
  return mergeQueryOptions(heyListWorkspacesOptions(parameters), options);
}
export function useListWorkspacesQuery(input: ListWorkspacesQueryInput, options: ListWorkspacesQueryOptions = {}): ListWorkspacesQueryResult {
  return useQuery<ListWorkspacesResponse, ListWorkspacesError | Error, ListWorkspacesResponse, ListWorkspacesQueryKey>(scopeQuery(listWorkspacesOptions(apiRequest(input) as ListWorkspacesQueryParameters, options), input));
}


export type MoveNodeMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyMoveNodeMutation>['mutationFn']>>[0]>;
export type MoveNodeMutationParameters = ApiClientParameters<Parameters<typeof heyMoveNodeMutation>[0]>;
export type MoveNodeMutationOptions<TContext = unknown> = Omit<UseMutationOptions<MoveNodeResponse, MoveNodeError | Error, MoveNodeMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type MoveNodeMutationResult<TContext = unknown> = UseMutationResult<MoveNodeResponse, MoveNodeError | Error, MoveNodeMutationVariables, TContext>;
export function moveNodeMutation<TContext = unknown>(parameters: MoveNodeMutationParameters, options: MoveNodeMutationOptions<TContext> = {}) {
  return bindMutation(heyMoveNodeMutation(parameters), parameters.client, options);
}
export function useMoveNodeMutation<TContext = unknown>(input: ApiContext, options: MoveNodeMutationOptions<TContext> = {}): MoveNodeMutationResult<TContext> {
  return useApiMutation(scopeMutation(moveNodeMutation({ client: input.runtime.client }, options), input));
}


export type MoveTaskMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyMoveTaskMutation>['mutationFn']>>[0]>;
export type MoveTaskMutationParameters = ApiClientParameters<Parameters<typeof heyMoveTaskMutation>[0]>;
export type MoveTaskMutationOptions<TContext = unknown> = Omit<UseMutationOptions<MoveTaskResponse, MoveTaskError | Error, MoveTaskMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type MoveTaskMutationResult<TContext = unknown> = UseMutationResult<MoveTaskResponse, MoveTaskError | Error, MoveTaskMutationVariables, TContext>;
export function moveTaskMutation<TContext = unknown>(parameters: MoveTaskMutationParameters, options: MoveTaskMutationOptions<TContext> = {}) {
  return bindMutation(heyMoveTaskMutation(parameters), parameters.client, options);
}
export function useMoveTaskMutation<TContext = unknown>(input: ApiContext, options: MoveTaskMutationOptions<TContext> = {}): MoveTaskMutationResult<TContext> {
  return useApiMutation(scopeMutation(moveTaskMutation({ client: input.runtime.client }, options), input));
}


export type RemoveNodeGrantMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyRemoveNodeGrantMutation>['mutationFn']>>[0]>;
export type RemoveNodeGrantMutationParameters = ApiClientParameters<Parameters<typeof heyRemoveNodeGrantMutation>[0]>;
export type RemoveNodeGrantMutationOptions<TContext = unknown> = Omit<UseMutationOptions<RemoveNodeGrantResponse, RemoveNodeGrantError | Error, RemoveNodeGrantMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type RemoveNodeGrantMutationResult<TContext = unknown> = UseMutationResult<RemoveNodeGrantResponse, RemoveNodeGrantError | Error, RemoveNodeGrantMutationVariables, TContext>;
export function removeNodeGrantMutation<TContext = unknown>(parameters: RemoveNodeGrantMutationParameters, options: RemoveNodeGrantMutationOptions<TContext> = {}) {
  return bindMutation(heyRemoveNodeGrantMutation(parameters), parameters.client, options);
}
export function useRemoveNodeGrantMutation<TContext = unknown>(input: ApiContext, options: RemoveNodeGrantMutationOptions<TContext> = {}): RemoveNodeGrantMutationResult<TContext> {
  return useApiMutation(scopeMutation(removeNodeGrantMutation({ client: input.runtime.client }, options), input));
}


export type RemoveScopeFieldMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyRemoveScopeFieldMutation>['mutationFn']>>[0]>;
export type RemoveScopeFieldMutationParameters = ApiClientParameters<Parameters<typeof heyRemoveScopeFieldMutation>[0]>;
export type RemoveScopeFieldMutationOptions<TContext = unknown> = Omit<UseMutationOptions<RemoveScopeFieldResponse, RemoveScopeFieldError | Error, RemoveScopeFieldMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type RemoveScopeFieldMutationResult<TContext = unknown> = UseMutationResult<RemoveScopeFieldResponse, RemoveScopeFieldError | Error, RemoveScopeFieldMutationVariables, TContext>;
export function removeScopeFieldMutation<TContext = unknown>(parameters: RemoveScopeFieldMutationParameters, options: RemoveScopeFieldMutationOptions<TContext> = {}) {
  return bindMutation(heyRemoveScopeFieldMutation(parameters), parameters.client, options);
}
export function useRemoveScopeFieldMutation<TContext = unknown>(input: ApiContext, options: RemoveScopeFieldMutationOptions<TContext> = {}): RemoveScopeFieldMutationResult<TContext> {
  return useApiMutation(scopeMutation(removeScopeFieldMutation({ client: input.runtime.client }, options), input));
}


export type RemoveScopeStatusMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyRemoveScopeStatusMutation>['mutationFn']>>[0]>;
export type RemoveScopeStatusMutationParameters = ApiClientParameters<Parameters<typeof heyRemoveScopeStatusMutation>[0]>;
export type RemoveScopeStatusMutationOptions<TContext = unknown> = Omit<UseMutationOptions<RemoveScopeStatusResponse, RemoveScopeStatusError | Error, RemoveScopeStatusMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type RemoveScopeStatusMutationResult<TContext = unknown> = UseMutationResult<RemoveScopeStatusResponse, RemoveScopeStatusError | Error, RemoveScopeStatusMutationVariables, TContext>;
export function removeScopeStatusMutation<TContext = unknown>(parameters: RemoveScopeStatusMutationParameters, options: RemoveScopeStatusMutationOptions<TContext> = {}) {
  return bindMutation(heyRemoveScopeStatusMutation(parameters), parameters.client, options);
}
export function useRemoveScopeStatusMutation<TContext = unknown>(input: ApiContext, options: RemoveScopeStatusMutationOptions<TContext> = {}): RemoveScopeStatusMutationResult<TContext> {
  return useApiMutation(scopeMutation(removeScopeStatusMutation({ client: input.runtime.client }, options), input));
}


export type RemoveWorkspaceMemberMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyRemoveWorkspaceMemberMutation>['mutationFn']>>[0]>;
export type RemoveWorkspaceMemberMutationParameters = ApiClientParameters<Parameters<typeof heyRemoveWorkspaceMemberMutation>[0]>;
export type RemoveWorkspaceMemberMutationOptions<TContext = unknown> = Omit<UseMutationOptions<RemoveWorkspaceMemberResponse, RemoveWorkspaceMemberError | Error, RemoveWorkspaceMemberMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type RemoveWorkspaceMemberMutationResult<TContext = unknown> = UseMutationResult<RemoveWorkspaceMemberResponse, RemoveWorkspaceMemberError | Error, RemoveWorkspaceMemberMutationVariables, TContext>;
export function removeWorkspaceMemberMutation<TContext = unknown>(parameters: RemoveWorkspaceMemberMutationParameters, options: RemoveWorkspaceMemberMutationOptions<TContext> = {}) {
  return bindMutation(heyRemoveWorkspaceMemberMutation(parameters), parameters.client, options);
}
export function useRemoveWorkspaceMemberMutation<TContext = unknown>(input: ApiContext, options: RemoveWorkspaceMemberMutationOptions<TContext> = {}): RemoveWorkspaceMemberMutationResult<TContext> {
  return useApiMutation(scopeMutation(removeWorkspaceMemberMutation({ client: input.runtime.client }, options), input));
}


export type ReorderNodeMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyReorderNodeMutation>['mutationFn']>>[0]>;
export type ReorderNodeMutationParameters = ApiClientParameters<Parameters<typeof heyReorderNodeMutation>[0]>;
export type ReorderNodeMutationOptions<TContext = unknown> = Omit<UseMutationOptions<ReorderNodeResponse, ReorderNodeError | Error, ReorderNodeMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type ReorderNodeMutationResult<TContext = unknown> = UseMutationResult<ReorderNodeResponse, ReorderNodeError | Error, ReorderNodeMutationVariables, TContext>;
export function reorderNodeMutation<TContext = unknown>(parameters: ReorderNodeMutationParameters, options: ReorderNodeMutationOptions<TContext> = {}) {
  return bindMutation(heyReorderNodeMutation(parameters), parameters.client, options);
}
export function useReorderNodeMutation<TContext = unknown>(input: ApiContext, options: ReorderNodeMutationOptions<TContext> = {}): ReorderNodeMutationResult<TContext> {
  return useApiMutation(scopeMutation(reorderNodeMutation({ client: input.runtime.client }, options), input));
}


export type ReorderTaskMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyReorderTaskMutation>['mutationFn']>>[0]>;
export type ReorderTaskMutationParameters = ApiClientParameters<Parameters<typeof heyReorderTaskMutation>[0]>;
export type ReorderTaskMutationOptions<TContext = unknown> = Omit<UseMutationOptions<ReorderTaskResponse, ReorderTaskError | Error, ReorderTaskMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type ReorderTaskMutationResult<TContext = unknown> = UseMutationResult<ReorderTaskResponse, ReorderTaskError | Error, ReorderTaskMutationVariables, TContext>;
export function reorderTaskMutation<TContext = unknown>(parameters: ReorderTaskMutationParameters, options: ReorderTaskMutationOptions<TContext> = {}) {
  return bindMutation(heyReorderTaskMutation(parameters), parameters.client, options);
}
export function useReorderTaskMutation<TContext = unknown>(input: ApiContext, options: ReorderTaskMutationOptions<TContext> = {}): ReorderTaskMutationResult<TContext> {
  return useApiMutation(scopeMutation(reorderTaskMutation({ client: input.runtime.client }, options), input));
}


export type RestoreWorkspaceMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyRestoreWorkspaceMutation>['mutationFn']>>[0]>;
export type RestoreWorkspaceMutationParameters = ApiClientParameters<Parameters<typeof heyRestoreWorkspaceMutation>[0]>;
export type RestoreWorkspaceMutationOptions<TContext = unknown> = Omit<UseMutationOptions<RestoreWorkspaceResponse, RestoreWorkspaceError | Error, RestoreWorkspaceMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type RestoreWorkspaceMutationResult<TContext = unknown> = UseMutationResult<RestoreWorkspaceResponse, RestoreWorkspaceError | Error, RestoreWorkspaceMutationVariables, TContext>;
export function restoreWorkspaceMutation<TContext = unknown>(parameters: RestoreWorkspaceMutationParameters, options: RestoreWorkspaceMutationOptions<TContext> = {}) {
  return bindMutation(heyRestoreWorkspaceMutation(parameters), parameters.client, options);
}
export function useRestoreWorkspaceMutation<TContext = unknown>(input: ApiContext, options: RestoreWorkspaceMutationOptions<TContext> = {}): RestoreWorkspaceMutationResult<TContext> {
  return useApiMutation(scopeMutation(restoreWorkspaceMutation({ client: input.runtime.client }, options), input));
}


export type SearchWorkspaceInfiniteQueryParameters = ApiClientParameters<Parameters<typeof heySearchWorkspaceInfiniteOptions>[0]>;
export type SearchWorkspaceInfiniteQueryInput = ApiContext & ApiParameters<SearchWorkspaceInfiniteQueryParameters>;
export type SearchWorkspacePageKey = ReturnType<typeof heySearchWorkspaceInfiniteQueryKey>;
export type SearchWorkspacePageParam = ReturnType<typeof heySearchWorkspaceInfiniteOptions>['initialPageParam'];
export type SearchWorkspacePageData = InfiniteData<SearchWorkspaceResponse, SearchWorkspacePageParam>;
export type SearchWorkspaceInfiniteQueryOptions = Omit<UseInfiniteQueryOptions<SearchWorkspaceResponse, SearchWorkspaceError | Error, SearchWorkspacePageData, SearchWorkspacePageKey, SearchWorkspacePageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type SearchWorkspaceInfiniteHookOptions = SearchWorkspaceInfiniteQueryOptions & Pick<UseInfiniteQueryOptions<SearchWorkspaceResponse, SearchWorkspaceError | Error, SearchWorkspacePageData, SearchWorkspacePageKey, SearchWorkspacePageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type SearchWorkspaceInfiniteQueryResult = UseInfiniteQueryResult<SearchWorkspacePageData, SearchWorkspaceError | Error>;
export function searchWorkspaceInfiniteOptions(parameters: SearchWorkspaceInfiniteQueryParameters, options: SearchWorkspaceInfiniteQueryOptions = {}) {
  const definition = heySearchWorkspaceInfiniteOptions(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function useSearchWorkspaceInfiniteQuery(input: SearchWorkspaceInfiniteQueryInput, options: SearchWorkspaceInfiniteHookOptions): SearchWorkspaceInfiniteQueryResult {
  const definition = scopeQuery(searchWorkspaceInfiniteOptions(apiRequest(input) as SearchWorkspaceInfiniteQueryParameters), input);
  return useInfiniteQuery<SearchWorkspaceResponse, SearchWorkspaceError | Error, SearchWorkspacePageData, SearchWorkspacePageKey, SearchWorkspacePageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}


export type SearchWorkspaceQueryParameters = ApiClientParameters<Parameters<typeof heySearchWorkspaceOptions>[0]>;
export type SearchWorkspaceQueryInput = ApiContext & ApiParameters<SearchWorkspaceQueryParameters>;
export type SearchWorkspaceQueryKey = ReturnType<typeof heySearchWorkspaceQueryKey>;
export type SearchWorkspaceQueryOptions = Omit<UseQueryOptions<SearchWorkspaceResponse, SearchWorkspaceError | Error, SearchWorkspaceResponse, SearchWorkspaceQueryKey>, 'queryKey' | 'queryFn'>;
export type SearchWorkspaceQueryResult = UseQueryResult<SearchWorkspaceResponse, SearchWorkspaceError | Error>;
export function searchWorkspaceOptions(parameters: SearchWorkspaceQueryParameters, options: SearchWorkspaceQueryOptions = {}) {
  return mergeQueryOptions(heySearchWorkspaceOptions(parameters), options);
}
export function useSearchWorkspaceQuery(input: SearchWorkspaceQueryInput, options: SearchWorkspaceQueryOptions = {}): SearchWorkspaceQueryResult {
  return useQuery<SearchWorkspaceResponse, SearchWorkspaceError | Error, SearchWorkspaceResponse, SearchWorkspaceQueryKey>(scopeQuery(searchWorkspaceOptions(apiRequest(input) as SearchWorkspaceQueryParameters, options), input));
}


export type UpdateNodeMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpdateNodeMutation>['mutationFn']>>[0]>;
export type UpdateNodeMutationParameters = ApiClientParameters<Parameters<typeof heyUpdateNodeMutation>[0]>;
export type UpdateNodeMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpdateNodeResponse, UpdateNodeError | Error, UpdateNodeMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpdateNodeMutationResult<TContext = unknown> = UseMutationResult<UpdateNodeResponse, UpdateNodeError | Error, UpdateNodeMutationVariables, TContext>;
export function updateNodeMutation<TContext = unknown>(parameters: UpdateNodeMutationParameters, options: UpdateNodeMutationOptions<TContext> = {}) {
  return bindMutation(heyUpdateNodeMutation(parameters), parameters.client, options);
}
export function useUpdateNodeMutation<TContext = unknown>(input: ApiContext, options: UpdateNodeMutationOptions<TContext> = {}): UpdateNodeMutationResult<TContext> {
  return useApiMutation(scopeMutation(updateNodeMutation({ client: input.runtime.client }, options), input));
}


export type UpdateScopeFieldMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpdateScopeFieldMutation>['mutationFn']>>[0]>;
export type UpdateScopeFieldMutationParameters = ApiClientParameters<Parameters<typeof heyUpdateScopeFieldMutation>[0]>;
export type UpdateScopeFieldMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpdateScopeFieldResponse, UpdateScopeFieldError | Error, UpdateScopeFieldMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpdateScopeFieldMutationResult<TContext = unknown> = UseMutationResult<UpdateScopeFieldResponse, UpdateScopeFieldError | Error, UpdateScopeFieldMutationVariables, TContext>;
export function updateScopeFieldMutation<TContext = unknown>(parameters: UpdateScopeFieldMutationParameters, options: UpdateScopeFieldMutationOptions<TContext> = {}) {
  return bindMutation(heyUpdateScopeFieldMutation(parameters), parameters.client, options);
}
export function useUpdateScopeFieldMutation<TContext = unknown>(input: ApiContext, options: UpdateScopeFieldMutationOptions<TContext> = {}): UpdateScopeFieldMutationResult<TContext> {
  return useApiMutation(scopeMutation(updateScopeFieldMutation({ client: input.runtime.client }, options), input));
}


export type UpdateScopeStatusMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpdateScopeStatusMutation>['mutationFn']>>[0]>;
export type UpdateScopeStatusMutationParameters = ApiClientParameters<Parameters<typeof heyUpdateScopeStatusMutation>[0]>;
export type UpdateScopeStatusMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpdateScopeStatusResponse, UpdateScopeStatusError | Error, UpdateScopeStatusMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpdateScopeStatusMutationResult<TContext = unknown> = UseMutationResult<UpdateScopeStatusResponse, UpdateScopeStatusError | Error, UpdateScopeStatusMutationVariables, TContext>;
export function updateScopeStatusMutation<TContext = unknown>(parameters: UpdateScopeStatusMutationParameters, options: UpdateScopeStatusMutationOptions<TContext> = {}) {
  return bindMutation(heyUpdateScopeStatusMutation(parameters), parameters.client, options);
}
export function useUpdateScopeStatusMutation<TContext = unknown>(input: ApiContext, options: UpdateScopeStatusMutationOptions<TContext> = {}): UpdateScopeStatusMutationResult<TContext> {
  return useApiMutation(scopeMutation(updateScopeStatusMutation({ client: input.runtime.client }, options), input));
}


export type UpdateTaskMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpdateTaskMutation>['mutationFn']>>[0]>;
export type UpdateTaskMutationParameters = ApiClientParameters<Parameters<typeof heyUpdateTaskMutation>[0]>;
export type UpdateTaskMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpdateTaskResponse, UpdateTaskError | Error, UpdateTaskMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpdateTaskMutationResult<TContext = unknown> = UseMutationResult<UpdateTaskResponse, UpdateTaskError | Error, UpdateTaskMutationVariables, TContext>;
export function updateTaskMutation<TContext = unknown>(parameters: UpdateTaskMutationParameters, options: UpdateTaskMutationOptions<TContext> = {}) {
  return bindMutation(heyUpdateTaskMutation(parameters), parameters.client, options);
}
export function useUpdateTaskMutation<TContext = unknown>(input: ApiContext, options: UpdateTaskMutationOptions<TContext> = {}): UpdateTaskMutationResult<TContext> {
  return useApiMutation(scopeMutation(updateTaskMutation({ client: input.runtime.client }, options), input));
}


export type UpdateWorkspaceMemberMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpdateWorkspaceMemberMutation>['mutationFn']>>[0]>;
export type UpdateWorkspaceMemberMutationParameters = ApiClientParameters<Parameters<typeof heyUpdateWorkspaceMemberMutation>[0]>;
export type UpdateWorkspaceMemberMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpdateWorkspaceMemberResponse, UpdateWorkspaceMemberError | Error, UpdateWorkspaceMemberMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpdateWorkspaceMemberMutationResult<TContext = unknown> = UseMutationResult<UpdateWorkspaceMemberResponse, UpdateWorkspaceMemberError | Error, UpdateWorkspaceMemberMutationVariables, TContext>;
export function updateWorkspaceMemberMutation<TContext = unknown>(parameters: UpdateWorkspaceMemberMutationParameters, options: UpdateWorkspaceMemberMutationOptions<TContext> = {}) {
  return bindMutation(heyUpdateWorkspaceMemberMutation(parameters), parameters.client, options);
}
export function useUpdateWorkspaceMemberMutation<TContext = unknown>(input: ApiContext, options: UpdateWorkspaceMemberMutationOptions<TContext> = {}): UpdateWorkspaceMemberMutationResult<TContext> {
  return useApiMutation(scopeMutation(updateWorkspaceMemberMutation({ client: input.runtime.client }, options), input));
}


export type UpdateWorkspaceMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpdateWorkspaceMutation>['mutationFn']>>[0]>;
export type UpdateWorkspaceMutationParameters = ApiClientParameters<Parameters<typeof heyUpdateWorkspaceMutation>[0]>;
export type UpdateWorkspaceMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpdateWorkspaceResponse, UpdateWorkspaceError | Error, UpdateWorkspaceMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpdateWorkspaceMutationResult<TContext = unknown> = UseMutationResult<UpdateWorkspaceResponse, UpdateWorkspaceError | Error, UpdateWorkspaceMutationVariables, TContext>;
export function updateWorkspaceMutation<TContext = unknown>(parameters: UpdateWorkspaceMutationParameters, options: UpdateWorkspaceMutationOptions<TContext> = {}) {
  return bindMutation(heyUpdateWorkspaceMutation(parameters), parameters.client, options);
}
export function useUpdateWorkspaceMutation<TContext = unknown>(input: ApiContext, options: UpdateWorkspaceMutationOptions<TContext> = {}): UpdateWorkspaceMutationResult<TContext> {
  return useApiMutation(scopeMutation(updateWorkspaceMutation({ client: input.runtime.client }, options), input));
}


export type UpsertNodeGrantMutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof heyUpsertNodeGrantMutation>['mutationFn']>>[0]>;
export type UpsertNodeGrantMutationParameters = ApiClientParameters<Parameters<typeof heyUpsertNodeGrantMutation>[0]>;
export type UpsertNodeGrantMutationOptions<TContext = unknown> = Omit<UseMutationOptions<UpsertNodeGrantResponse, UpsertNodeGrantError | Error, UpsertNodeGrantMutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type UpsertNodeGrantMutationResult<TContext = unknown> = UseMutationResult<UpsertNodeGrantResponse, UpsertNodeGrantError | Error, UpsertNodeGrantMutationVariables, TContext>;
export function upsertNodeGrantMutation<TContext = unknown>(parameters: UpsertNodeGrantMutationParameters, options: UpsertNodeGrantMutationOptions<TContext> = {}) {
  return bindMutation(heyUpsertNodeGrantMutation(parameters), parameters.client, options);
}
export function useUpsertNodeGrantMutation<TContext = unknown>(input: ApiContext, options: UpsertNodeGrantMutationOptions<TContext> = {}): UpsertNodeGrantMutationResult<TContext> {
  return useApiMutation(scopeMutation(upsertNodeGrantMutation({ client: input.runtime.client }, options), input));
}
