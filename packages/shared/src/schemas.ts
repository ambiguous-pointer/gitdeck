/**
 * zod request schemas — validated by the server, and a useful reference for the
 * client. Import the inferred types when writing API calls.
 */
import { z } from 'zod';

export const writableScopeSchema = z.enum(['local', 'global']);

const refName = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !/[\s~^:?*[\\]/.test(value) && !value.includes('..'), {
    message: 'Invalid git ref name',
  });

export const openRepoInputSchema = z.object({
  path: z.string().min(1),
});
export type OpenRepoInput = z.infer<typeof openRepoInputSchema>;

export const scanInputSchema = z.object({
  roots: z.array(z.string().min(1)).max(20).optional(),
  maxDepth: z.number().int().min(1).max(8).optional(),
});
export type ScanInput = z.infer<typeof scanInputSchema>;

export const stageInputSchema = z.object({
  paths: z.array(z.string().min(1)).max(5000).default([]),
  all: z.boolean().optional(),
});
export type StageInput = z.infer<typeof stageInputSchema>;

export const unstageInputSchema = stageInputSchema;
export type UnstageInput = z.infer<typeof unstageInputSchema>;

export const discardInputSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(5000),
  untracked: z.boolean().optional(),
});
export type DiscardInput = z.infer<typeof discardInputSchema>;

export const commitInputSchema = z.object({
  message: z.string().min(1).max(20000),
  amend: z.boolean().optional(),
  signoff: z.boolean().optional(),
  noVerify: z.boolean().optional(),
  stageAll: z.boolean().optional(),
  author: z
    .object({
      name: z.string().min(1),
      email: z.string().min(3),
    })
    .optional(),
});
export type CommitInput = z.infer<typeof commitInputSchema>;

export const resolveInputSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(5000),
  resolution: z.enum(['ours', 'theirs', 'mark-resolved']),
});
export type ResolveInput = z.infer<typeof resolveInputSchema>;

export const checkoutInputSchema = z.object({
  target: z.string().min(1),
  detach: z.boolean().optional(),
  force: z.boolean().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const branchCreateInputSchema = z.object({
  name: refName,
  startPoint: z.string().optional(),
  checkout: z.boolean().optional(),
});
export type BranchCreateInput = z.infer<typeof branchCreateInputSchema>;

export const branchRenameInputSchema = z.object({
  from: refName,
  to: refName,
});
export type BranchRenameInput = z.infer<typeof branchRenameInputSchema>;

export const branchDeleteInputSchema = z.object({
  name: refName,
  force: z.boolean().optional(),
  remote: z.boolean().optional(),
});
export type BranchDeleteInput = z.infer<typeof branchDeleteInputSchema>;

export const mergeInputSchema = z.object({
  branch: z.string().min(1),
  noFf: z.boolean().optional(),
  squash: z.boolean().optional(),
  message: z.string().optional(),
});
export type MergeInput = z.infer<typeof mergeInputSchema>;

export const rebaseInputSchema = z.object({
  onto: z.string().min(1),
  autostash: z.boolean().optional(),
});
export type RebaseInput = z.infer<typeof rebaseInputSchema>;

export const cherryPickInputSchema = z.object({
  commits: z.array(z.string().min(1)).min(1).max(100),
});
export type CherryPickInput = z.infer<typeof cherryPickInputSchema>;

export const revertInputSchema = z.object({
  commits: z.array(z.string().min(1)).min(1).max(100),
  noCommit: z.boolean().optional(),
});
export type RevertInput = z.infer<typeof revertInputSchema>;

export const resetInputSchema = z.object({
  target: z.string().min(1),
  mode: z.enum(['soft', 'mixed', 'hard']),
});
export type ResetInput = z.infer<typeof resetInputSchema>;

export const upstreamInputSchema = z.object({
  branch: refName,
  remote: z.string().min(1).nullable().optional(),
  remoteBranch: z.string().min(1).nullable().optional(),
});
export type UpstreamInput = z.infer<typeof upstreamInputSchema>;

export const fetchInputSchema = z.object({
  remote: z.string().optional(),
  prune: z.boolean().optional(),
  all: z.boolean().optional(),
});
export type FetchInput = z.infer<typeof fetchInputSchema>;

export const pullInputSchema = z.object({
  remote: z.string().optional(),
  branch: z.string().optional(),
  strategy: z.enum(['merge', 'rebase', 'ff-only']).optional(),
  autostash: z.boolean().optional(),
});
export type PullInput = z.infer<typeof pullInputSchema>;

export const pushInputSchema = z.object({
  remote: z.string().optional(),
  branch: z.string().optional(),
  setUpstream: z.boolean().optional(),
  force: z.enum(['none', 'with-lease']).optional(),
  tags: z.boolean().optional(),
});
export type PushInput = z.infer<typeof pushInputSchema>;

export const remoteAddInputSchema = z.object({
  name: refName,
  url: z.string().min(1),
  pushUrl: z.string().optional(),
});
export type RemoteAddInput = z.infer<typeof remoteAddInputSchema>;

export const remoteUpdateInputSchema = z.object({
  name: z.string().min(1),
  newName: refName.optional(),
  url: z.string().optional(),
  pushUrl: z.string().optional(),
});
export type RemoteUpdateInput = z.infer<typeof remoteUpdateInputSchema>;

export const remoteRemoveInputSchema = z.object({
  name: z.string().min(1),
});
export type RemoteRemoveInput = z.infer<typeof remoteRemoveInputSchema>;

export const tagCreateInputSchema = z.object({
  name: refName,
  message: z.string().optional(),
  target: z.string().optional(),
  push: z.boolean().optional(),
  remote: z.string().optional(),
});
export type TagCreateInput = z.infer<typeof tagCreateInputSchema>;

export const tagDeleteInputSchema = z.object({
  name: refName,
  remote: z.string().optional(),
});
export type TagDeleteInput = z.infer<typeof tagDeleteInputSchema>;

export const stashPushInputSchema = z.object({
  message: z.string().optional(),
  includeUntracked: z.boolean().optional(),
  keepIndex: z.boolean().optional(),
});
export type StashPushInput = z.infer<typeof stashPushInputSchema>;

export const stashIndexInputSchema = z.object({
  index: z.number().int().min(0).max(10000),
});
export type StashIndexInput = z.infer<typeof stashIndexInputSchema>;

export const worktreeAddInputSchema = z.object({
  path: z.string().min(1),
  branch: z.string().optional(),
  newBranch: refName.optional(),
  detach: z.boolean().optional(),
  startPoint: z.string().optional(),
  force: z.boolean().optional(),
});
export type WorktreeAddInput = z.infer<typeof worktreeAddInputSchema>;

export const worktreeRemoveInputSchema = z.object({
  path: z.string().min(1),
  force: z.boolean().optional(),
});
export type WorktreeRemoveInput = z.infer<typeof worktreeRemoveInputSchema>;

export const worktreeLockInputSchema = z.object({
  path: z.string().min(1),
  lock: z.boolean(),
  reason: z.string().optional(),
});
export type WorktreeLockInput = z.infer<typeof worktreeLockInputSchema>;

export const worktreePruneInputSchema = z.object({}).optional();
export type WorktreePruneInput = z.infer<typeof worktreePruneInputSchema>;

export const configSetInputSchema = z.object({
  scope: writableScopeSchema,
  key: z.string().min(1).max(255),
  value: z.string().max(10000),
});
export type ConfigSetInput = z.infer<typeof configSetInputSchema>;

export const configUnsetInputSchema = z.object({
  scope: writableScopeSchema,
  key: z.string().min(1).max(255),
});
export type ConfigUnsetInput = z.infer<typeof configUnsetInputSchema>;

export const settingsPatchInputSchema = z
  .object({
    scanRoots: z.array(z.string().min(1)).max(20).optional(),
    gitPath: z.string().min(1).max(1024).optional(),
    maxScanDepth: z.number().int().min(1).max(8).optional(),
    commandTimeoutMs: z.number().int().min(5_000).max(600_000).optional(),
    locale: z.enum(['zh', 'en']).optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb color')
      .optional(),
    confirmDangerous: z.boolean().optional(),
  })
  .strict();
export type SettingsPatchInput = z.infer<typeof settingsPatchInputSchema>;

export const execInputSchema = z.object({
  args: z.array(z.string().min(1).max(5000)).min(1).max(30),
});
export type ExecInput = z.infer<typeof execInputSchema>;

export const logQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  all: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  branch: z.string().optional(),
  path: z.string().optional(),
  search: z.string().optional(),
});
export type LogQueryInput = z.infer<typeof logQuerySchema>;

export const diffQueryInputSchema = z.object({
  scope: z.enum(['worktree', 'staged', 'commit', 'range']),
  path: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  /** Number of context lines around each hunk (server clamps to 0..1000). */
  context: z.coerce.number().int().min(0).max(1000).optional(),
});
export type DiffQueryInput = z.infer<typeof diffQueryInputSchema>;
