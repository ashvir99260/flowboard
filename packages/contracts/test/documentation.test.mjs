import { expect, test } from '@jest/globals';
import { z } from 'zod';

import {
  ActiveWorkspaceSchema,
  ArchiveTaskSchema,
  AuthExamples,
  CreateNodeSchema,
  CreateScopeFieldSchema,
  CreateTaskSchema,
  EmptyAuthBodySchema,
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  ErrorExamples,
  HealthExamples,
  HealthQuerySchema,
  ListFieldParamsSchema,
  ListTasksQuerySchema,
  LivenessSchema,
  LogInSchema,
  MemberPageQuerySchema,
  MoveNodeSchema,
  MoveTaskSchema,
  NodeEnvelopeSchema,
  NodeParamsSchema,
  NodeSchema,
  NodeVersionSchema,
  ReadinessSchema,
  ReorderTaskSchema,
  ResolvedFieldCollectionSchema,
  ScopeFieldCollectionSchema,
  ScopeFieldEnvelopeSchema,
  ScopeFieldParamsSchema,
  SessionEnvelopeSchema,
  SignUpSchema,
  TaskEnvelopeSchema,
  TaskListParamsSchema,
  TaskMutationEnvelopeSchema,
  TaskPageSchema,
  TaskParamsSchema,
  TaskSchema,
  UpdateNodeSchema,
  UpdateScopeFieldSchema,
  UpdateTaskSchema,
  UserSelfSchema,
  ValidationIssueSchema,
} from '../dist/index.js';

const schemas = {
  ActiveWorkspaceSchema,
  MemberPageQuerySchema,
  TaskMutationEnvelopeSchema,
  ArchiveTaskSchema,
  UpdateTaskSchema,
  CreateTaskSchema,
  MoveTaskSchema,
  ReorderTaskSchema,
  TaskSchema,
  TaskPageSchema,
  TaskEnvelopeSchema,
  TaskParamsSchema,
  TaskListParamsSchema,
  ListTasksQuerySchema,
  CreateScopeFieldSchema,
  UpdateScopeFieldSchema,
  ScopeFieldParamsSchema,
  ListFieldParamsSchema,
  ScopeFieldCollectionSchema,
  ResolvedFieldCollectionSchema,
  ScopeFieldEnvelopeSchema,

  EmptyAuthBodySchema,
  ErrorCodeSchema,
  ErrorEnvelopeSchema,
  HealthQuerySchema,
  LivenessSchema,
  LogInSchema,
  CreateNodeSchema,
  MoveNodeSchema,
  NodeSchema,
  NodeParamsSchema,
  NodeEnvelopeSchema,
  NodeVersionSchema,
  UpdateNodeSchema,
  ReadinessSchema,
  SessionEnvelopeSchema,
  SignUpSchema,
  UserSelfSchema,
  ValidationIssueSchema,
};

test('all documented contract and field examples satisfy their actual validators', () => {
  const visit = (schema, path) => {
    const metadata = schema.meta();
    if (metadata && Object.hasOwn(metadata, 'example')) {
      expect({ path, valid: schema.safeParse(metadata.example).success }).toEqual({
        path,
        valid: true,
      });
      expect(metadata.title).toBeTruthy();
      expect(metadata.description).toBeTruthy();
    }

    if (schema instanceof z.ZodObject)
      for (const [key, field] of Object.entries(schema.shape)) visit(field, `${path}.${key}`);

    if (schema instanceof z.ZodArray) visit(schema.element, `${path}[]`);

    if (
      schema instanceof z.ZodNullable ||
      schema instanceof z.ZodOptional ||
      schema instanceof z.ZodDefault
    )
      visit(schema.unwrap(), path);
  };
  for (const [name, schema] of Object.entries(schemas)) visit(schema, name);
});

test('operation examples are valid and contain no usable authentication credentials', () => {
  expect(SignUpSchema.safeParse(AuthExamples.signUp).success).toBe(true);
  expect(LogInSchema.safeParse(AuthExamples.logIn).success).toBe(true);
  expect(SessionEnvelopeSchema.safeParse(AuthExamples.session).success).toBe(true);
  expect(LivenessSchema.safeParse(HealthExamples.liveness).success).toBe(true);
  expect(ReadinessSchema.safeParse(HealthExamples.readiness).success).toBe(true);
  for (const value of Object.values(ErrorExamples))
    expect(ErrorEnvelopeSchema.safeParse(value).success).toBe(true);
  expect(AuthExamples.session.data.accessToken).toBe('example-only.access-token.not-valid');
  expect(AuthExamples.logIn.password).not.toBe('FlowboardDemo123!');
});
