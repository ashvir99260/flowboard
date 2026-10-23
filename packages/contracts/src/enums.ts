import { z } from 'zod';

export const WorkspaceRoleSchema = z.enum(['admin', 'member']);

export const NodeTypeSchema = z.enum(['workspace', 'space', 'folder', 'list']);

export const ContainerTypeSchema = z.enum(['space', 'folder', 'list']);

export const ScopeTypeSchema = NodeTypeSchema;

export const PrioritySchema = z.enum(['urgent', 'high', 'normal', 'low', 'none']);

export const StatusCategorySchema = z.enum(['not_started', 'active', 'done', 'closed']);

export const CustomFieldTypeSchema = z.enum([
  'text',
  'number',
  'single_select',
  'multi_select',
  'date',
  'checkbox',
]);

export const PermissionModeSchema = z.enum(['allow', 'deny']);

export const VisibilitySchema = z.enum(['public', 'private']);

export const PermissionActionSchema = z.enum([
  'workspace.read',
  'member.list',
  'member.manage',
  'grant.manage',
  'container.read',
  'container.write',
  'task.read',
  'task.write',
  'configuration.read',
  'configuration.write',
  'activity.read',
  'list.subscribe',
]);

export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export type Priority = z.infer<typeof PrioritySchema>;

export type ScopeType = z.infer<typeof ScopeTypeSchema>;

export type PermissionAction = z.infer<typeof PermissionActionSchema>;

export type NodeType = z.infer<typeof NodeTypeSchema>;

export type ContainerType = z.infer<typeof ContainerTypeSchema>;

export type StatusCategory = z.infer<typeof StatusCategorySchema>;

export type CustomFieldType = z.infer<typeof CustomFieldTypeSchema>;

export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export type Visibility = z.infer<typeof VisibilitySchema>;
