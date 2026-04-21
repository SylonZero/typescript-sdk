/**
 * Synthetic tool catalog used by the benchmark and demo.
 *
 * The shapes are modelled on the MindStaq MCP service to give realistic
 * token-cost numbers: rich `inputSchema` with enums, format hints,
 * nested objects, and ID-format documentation in `description`.
 *
 * 40 tools span 5 domains × 8 verbs (create/get/list/update/delete +
 * link/unlink/search), roughly matching the surface of any moderately
 * complex SaaS application wrapped as MCP tools.
 */

import type { Tool } from '../src/types.js';

const ID_RE = '^[0-9a-fA-F]{24}$';

const ISO_DATE = {
    type: 'string',
    format: 'date-time',
    description: 'ISO 8601 date-time, e.g. 2026-04-21T15:00:00.000Z'
} as const;

const PAGINATION = {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    offset: { type: 'integer', minimum: 0, default: 0 }
} as const;

// -----------------------------------------------------------------------------
// Project tools
// -----------------------------------------------------------------------------

const PROJECT_TOOLS: Tool[] = [
    {
        name: 'project_create',
        title: 'Create Project',
        description:
            'Create a new project with a chosen methodology (Agile, Waterfall, or Manual). The project becomes the parent scope for tasks, issues, and member assignments. Team members listed in `teamMemberIds` receive contributor permissions automatically.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceId: { type: 'string', pattern: ID_RE, description: 'Workspace ID' },
                name: { type: 'string', minLength: 1, maxLength: 200 },
                description: { type: 'string', maxLength: 5000 },
                methodology: { type: 'string', enum: ['agile', 'waterfall', 'manual'] },
                startDate: ISO_DATE,
                dueDate: ISO_DATE,
                projectLeadId: { type: 'string', pattern: ID_RE },
                teamMemberIds: { type: 'array', items: { type: 'string', pattern: ID_RE } }
            },
            required: ['workspaceId', 'name', 'methodology']
        },
        annotations: { tags: ['projects', 'create'], destructiveHint: false, readOnlyHint: false }
    },
    {
        name: 'project_get',
        title: 'Get Project',
        description: 'Retrieve full project details by ID, including methodology, dates, lead, and member roster.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                workspaceId: { type: 'string', pattern: ID_RE }
            },
            required: ['projectId']
        },
        annotations: { tags: ['projects', 'read'], readOnlyHint: true }
    },
    {
        name: 'project_list',
        title: 'List Projects',
        description: 'List projects in a workspace, with status, progress, and traffic-light alert color.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceId: { type: 'string', pattern: ID_RE },
                status: { type: 'string', enum: ['active', 'archived', 'completed', 'all'], default: 'active' },
                ...PAGINATION
            },
            required: ['workspaceId']
        },
        annotations: { tags: ['projects', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'project_update',
        title: 'Update Project',
        description: 'Modify project name, dates, lead, or team members. Pass only the fields to change.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                name: { type: 'string', maxLength: 200 },
                description: { type: 'string', maxLength: 5000 },
                startDate: ISO_DATE,
                dueDate: ISO_DATE,
                projectLeadId: { type: 'string', pattern: ID_RE },
                teamMemberIds: { type: 'array', items: { type: 'string', pattern: ID_RE } }
            },
            required: ['projectId']
        },
        annotations: { tags: ['projects', 'update'] }
    },
    {
        name: 'project_delete',
        title: 'Delete Project',
        description: 'Soft-delete a project. The project is retained in the trash for 30 days before permanent removal.',
        inputSchema: {
            type: 'object',
            properties: { projectId: { type: 'string', pattern: ID_RE } },
            required: ['projectId']
        },
        annotations: { tags: ['projects', 'delete'], destructiveHint: true }
    },
    {
        name: 'project_search',
        title: 'Search Projects',
        description: 'Full-text search across project names and descriptions in a workspace.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceId: { type: 'string', pattern: ID_RE },
                query: { type: 'string', minLength: 1 },
                ...PAGINATION
            },
            required: ['workspaceId', 'query']
        },
        annotations: { tags: ['projects', 'search', 'read'], readOnlyHint: true }
    },
    {
        name: 'project_link_member',
        title: 'Add Project Member',
        description: 'Add a member to a project with a specific role (owner, contributor, viewer).',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                userId: { type: 'string', pattern: ID_RE },
                role: { type: 'string', enum: ['owner', 'contributor', 'viewer'] }
            },
            required: ['projectId', 'userId', 'role']
        },
        annotations: { tags: ['projects', 'members', 'create'] }
    },
    {
        name: 'project_unlink_member',
        title: 'Remove Project Member',
        description: 'Remove a member from a project. The member loses all role-based access immediately.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                userId: { type: 'string', pattern: ID_RE }
            },
            required: ['projectId', 'userId']
        },
        annotations: { tags: ['projects', 'members', 'delete'], destructiveHint: true }
    }
];

// -----------------------------------------------------------------------------
// Task tools — include rich nested schemas for realism
// -----------------------------------------------------------------------------

const TASK_TOOLS: Tool[] = [
    {
        name: 'task_create',
        title: 'Create Task',
        description:
            'Create a new task under a project or task group. Supports estimated effort, assignee, dates, and progress. Hierarchy is established by `parentTaskId`; pass undefined to create a top-level task in the project.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                parentTaskId: { type: 'string', pattern: ID_RE },
                title: { type: 'string', minLength: 1, maxLength: 500 },
                description: { type: 'string', maxLength: 10000 },
                assigneeId: { type: 'string', pattern: ID_RE },
                startDate: ISO_DATE,
                dueDate: ISO_DATE,
                estimatedEffort: { type: 'number', minimum: 0, description: 'Effort in hours' },
                percentComplete: { type: 'integer', minimum: 0, maximum: 100, default: 0 },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
            },
            required: ['projectId', 'title']
        },
        annotations: { tags: ['tasks', 'create'] }
    },
    {
        name: 'task_create_bulk',
        title: 'Create Multiple Tasks',
        description:
            'Create up to 100 tasks in a single call, optionally as children of a shared parent. More efficient than repeated `task_create` calls when ingesting a project plan.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                parentTaskId: { type: 'string', pattern: ID_RE },
                tasks: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 100,
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', minLength: 1, maxLength: 500 },
                            description: { type: 'string', maxLength: 10000 },
                            assigneeId: { type: 'string', pattern: ID_RE },
                            startDate: ISO_DATE,
                            dueDate: ISO_DATE,
                            estimatedEffort: { type: 'number', minimum: 0 },
                            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
                        },
                        required: ['title']
                    }
                }
            },
            required: ['projectId', 'tasks']
        },
        annotations: { tags: ['tasks', 'create', 'bulk'] }
    },
    {
        name: 'task_get',
        title: 'Get Task',
        description: 'Retrieve a task with its full hierarchy, assignee, dates, and current progress.',
        inputSchema: {
            type: 'object',
            properties: { taskId: { type: 'string', pattern: ID_RE } },
            required: ['taskId']
        },
        annotations: { tags: ['tasks', 'read'], readOnlyHint: true }
    },
    {
        name: 'task_list_by_project',
        title: 'List Tasks for Project',
        description: 'List all tasks for a project, optionally filtered by status, assignee, or date range.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'blocked', 'all'] },
                assigneeId: { type: 'string', pattern: ID_RE },
                dueBefore: ISO_DATE,
                dueAfter: ISO_DATE,
                ...PAGINATION
            },
            required: ['projectId']
        },
        annotations: { tags: ['tasks', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'task_list_my_active',
        title: 'List My Active Tasks',
        description: 'List the current authenticated user\'s active tasks across all projects.',
        inputSchema: {
            type: 'object',
            properties: { ...PAGINATION }
        },
        annotations: { tags: ['tasks', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'task_update',
        title: 'Update Task',
        description: 'Update task status, progress, dates, assignee, or priority. Pass only the fields to change.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', pattern: ID_RE },
                title: { type: 'string', maxLength: 500 },
                description: { type: 'string', maxLength: 10000 },
                assigneeId: { type: 'string', pattern: ID_RE },
                startDate: ISO_DATE,
                dueDate: ISO_DATE,
                percentComplete: { type: 'integer', minimum: 0, maximum: 100 },
                status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'blocked'] },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
            },
            required: ['taskId']
        },
        annotations: { tags: ['tasks', 'update'] }
    },
    {
        name: 'task_complete',
        title: 'Complete Task',
        description: 'Mark a task as completed and set percentComplete to 100. Convenience wrapper.',
        inputSchema: {
            type: 'object',
            properties: { taskId: { type: 'string', pattern: ID_RE } },
            required: ['taskId']
        },
        annotations: { tags: ['tasks', 'update'], idempotentHint: true }
    },
    {
        name: 'task_delete',
        title: 'Delete Task',
        description: 'Soft-delete a task and any subtasks beneath it.',
        inputSchema: {
            type: 'object',
            properties: { taskId: { type: 'string', pattern: ID_RE } },
            required: ['taskId']
        },
        annotations: { tags: ['tasks', 'delete'], destructiveHint: true }
    },
    {
        name: 'task_search',
        title: 'Search Tasks',
        description: 'Full-text search across task titles and descriptions in a workspace or project.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceId: { type: 'string', pattern: ID_RE },
                projectId: { type: 'string', pattern: ID_RE },
                query: { type: 'string', minLength: 1 },
                ...PAGINATION
            },
            required: ['query']
        },
        annotations: { tags: ['tasks', 'search', 'read'], readOnlyHint: true }
    }
];

// -----------------------------------------------------------------------------
// Issue tools (smaller, but with similar schema density)
// -----------------------------------------------------------------------------

const ISSUE_TOOLS: Tool[] = [
    {
        name: 'issue_create',
        title: 'Create Issue',
        description: 'Create an issue, risk, or blocker on a project. Severity drives the project alert color.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                kind: { type: 'string', enum: ['issue', 'risk', 'blocker'] },
                title: { type: 'string', minLength: 1, maxLength: 500 },
                description: { type: 'string', maxLength: 10000 },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                ownerId: { type: 'string', pattern: ID_RE },
                dueDate: ISO_DATE
            },
            required: ['projectId', 'kind', 'title', 'severity']
        },
        annotations: { tags: ['issues', 'create'] }
    },
    {
        name: 'issue_get',
        title: 'Get Issue',
        description: 'Retrieve an issue, risk, or blocker by ID with full timeline.',
        inputSchema: {
            type: 'object',
            properties: { issueId: { type: 'string', pattern: ID_RE } },
            required: ['issueId']
        },
        annotations: { tags: ['issues', 'read'], readOnlyHint: true }
    },
    {
        name: 'issue_list_by_project',
        title: 'List Issues for Project',
        description: 'List all issues, risks, and blockers for a project, optionally filtered by kind, status, or severity.',
        inputSchema: {
            type: 'object',
            properties: {
                projectId: { type: 'string', pattern: ID_RE },
                kind: { type: 'string', enum: ['issue', 'risk', 'blocker', 'all'] },
                status: { type: 'string', enum: ['open', 'mitigated', 'closed', 'all'] },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                ...PAGINATION
            },
            required: ['projectId']
        },
        annotations: { tags: ['issues', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'issue_update',
        title: 'Update Issue',
        description: 'Update issue status, severity, owner, or description.',
        inputSchema: {
            type: 'object',
            properties: {
                issueId: { type: 'string', pattern: ID_RE },
                title: { type: 'string', maxLength: 500 },
                description: { type: 'string', maxLength: 10000 },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                status: { type: 'string', enum: ['open', 'mitigated', 'closed'] },
                ownerId: { type: 'string', pattern: ID_RE }
            },
            required: ['issueId']
        },
        annotations: { tags: ['issues', 'update'] }
    },
    {
        name: 'issue_close',
        title: 'Close Issue',
        description: 'Close an issue, risk, or blocker.',
        inputSchema: {
            type: 'object',
            properties: {
                issueId: { type: 'string', pattern: ID_RE },
                resolution: { type: 'string', maxLength: 2000 }
            },
            required: ['issueId']
        },
        annotations: { tags: ['issues', 'update'] }
    },
    {
        name: 'issue_delete',
        title: 'Delete Issue',
        description: 'Soft-delete an issue.',
        inputSchema: {
            type: 'object',
            properties: { issueId: { type: 'string', pattern: ID_RE } },
            required: ['issueId']
        },
        annotations: { tags: ['issues', 'delete'], destructiveHint: true }
    }
];

// -----------------------------------------------------------------------------
// OKR / strategic management tools
// -----------------------------------------------------------------------------

const OKR_TOOLS: Tool[] = [
    {
        name: 'program_create',
        title: 'Create Program',
        description: 'Create a strategic program in the company database. Programs are the parent scope for objectives.',
        inputSchema: {
            type: 'object',
            properties: {
                companyId: { type: 'string', pattern: ID_RE },
                name: { type: 'string', minLength: 1, maxLength: 200 },
                description: { type: 'string', maxLength: 5000 },
                ownerId: { type: 'string', pattern: ID_RE },
                fiscalQuarter: { type: 'string', pattern: '^FY\\d{2,4}-Q[1-4]$' }
            },
            required: ['companyId', 'name']
        },
        annotations: { tags: ['okrs', 'programs', 'create'] }
    },
    {
        name: 'objective_create',
        title: 'Create Objective',
        description: 'Create an objective under a program. Objectives are qualitative goals; key results measure them.',
        inputSchema: {
            type: 'object',
            properties: {
                programId: { type: 'string', pattern: ID_RE },
                name: { type: 'string', minLength: 1, maxLength: 500 },
                description: { type: 'string', maxLength: 5000 },
                ownerId: { type: 'string', pattern: ID_RE }
            },
            required: ['programId', 'name']
        },
        annotations: { tags: ['okrs', 'objectives', 'create'] }
    },
    {
        name: 'key_result_create_bulk',
        title: 'Create Key Results',
        description:
            'Create up to 10 key results for an objective. Each key result has a metric, target, and current value used to compute objective progress.',
        inputSchema: {
            type: 'object',
            properties: {
                objectiveId: { type: 'string', pattern: ID_RE },
                keyResults: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 10,
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', minLength: 1, maxLength: 500 },
                            metricType: { type: 'string', enum: ['count', 'percent', 'currency', 'binary'] },
                            target: { type: 'number' },
                            currentValue: { type: 'number', default: 0 },
                            unit: { type: 'string', maxLength: 30 }
                        },
                        required: ['name', 'metricType', 'target']
                    }
                }
            },
            required: ['objectiveId', 'keyResults']
        },
        annotations: { tags: ['okrs', 'keyresults', 'create', 'bulk'] }
    },
    {
        name: 'objective_list',
        title: 'List Objectives',
        description: 'List objectives for a program, with current progress.',
        inputSchema: {
            type: 'object',
            properties: {
                programId: { type: 'string', pattern: ID_RE },
                ...PAGINATION
            },
            required: ['programId']
        },
        annotations: { tags: ['okrs', 'objectives', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'key_result_update',
        title: 'Update Key Result',
        description: 'Update a key result\'s current value, target, or owner. Used for periodic check-ins.',
        inputSchema: {
            type: 'object',
            properties: {
                keyResultId: { type: 'string', pattern: ID_RE },
                currentValue: { type: 'number' },
                target: { type: 'number' },
                ownerId: { type: 'string', pattern: ID_RE }
            },
            required: ['keyResultId']
        },
        annotations: { tags: ['okrs', 'keyresults', 'update'] }
    },
    {
        name: 'program_list',
        title: 'List Programs',
        description: 'List all strategic programs in the company database.',
        inputSchema: {
            type: 'object',
            properties: {
                companyId: { type: 'string', pattern: ID_RE },
                fiscalQuarter: { type: 'string', pattern: '^FY\\d{2,4}-Q[1-4]$' },
                ...PAGINATION
            },
            required: ['companyId']
        },
        annotations: { tags: ['okrs', 'programs', 'read', 'list'], readOnlyHint: true }
    }
];

// -----------------------------------------------------------------------------
// Meta tools (auth, workspace context)
// -----------------------------------------------------------------------------

const META_TOOLS: Tool[] = [
    {
        name: 'auth_check',
        title: 'Check Authentication',
        description: 'Verify the current authentication context and return the user, workspace, and granted scopes.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { tags: ['auth', 'read'], readOnlyHint: true }
    },
    {
        name: 'workspace_list',
        title: 'List Workspaces',
        description: 'List all workspaces accessible to the current user.',
        inputSchema: {
            type: 'object',
            properties: { ...PAGINATION }
        },
        annotations: { tags: ['workspaces', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'workspace_set_active',
        title: 'Set Active Workspace',
        description: 'Set the active workspace for the current session. Subsequent tools will scope to this workspace by default.',
        inputSchema: {
            type: 'object',
            properties: { workspaceId: { type: 'string', pattern: ID_RE } },
            required: ['workspaceId']
        },
        annotations: { tags: ['workspaces', 'update'] }
    },
    {
        name: 'user_get_me',
        title: 'Get Current User',
        description: 'Retrieve the current authenticated user\'s profile, including roles and workspace memberships.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { tags: ['users', 'read'], readOnlyHint: true }
    },
    {
        name: 'user_search',
        title: 'Search Users',
        description: 'Search users in the active workspace by name, email, or role.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceId: { type: 'string', pattern: ID_RE },
                query: { type: 'string', minLength: 1 },
                role: { type: 'string', enum: ['admin', 'member', 'viewer', 'guest', 'all'] },
                ...PAGINATION
            },
            required: ['query']
        },
        annotations: { tags: ['users', 'search', 'read'], readOnlyHint: true }
    },
    {
        name: 'comment_create',
        title: 'Add Comment',
        description: 'Add a comment to any entity (project, task, issue, objective). Mentions in `mentionedUserIds` trigger notifications.',
        inputSchema: {
            type: 'object',
            properties: {
                entityType: { type: 'string', enum: ['project', 'task', 'issue', 'objective', 'keyresult'] },
                entityId: { type: 'string', pattern: ID_RE },
                body: { type: 'string', minLength: 1, maxLength: 10000 },
                mentionedUserIds: { type: 'array', items: { type: 'string', pattern: ID_RE } }
            },
            required: ['entityType', 'entityId', 'body']
        },
        annotations: { tags: ['comments', 'create'] }
    },
    {
        name: 'comment_list',
        title: 'List Comments',
        description: 'List comments on an entity, ordered chronologically.',
        inputSchema: {
            type: 'object',
            properties: {
                entityType: { type: 'string', enum: ['project', 'task', 'issue', 'objective', 'keyresult'] },
                entityId: { type: 'string', pattern: ID_RE },
                ...PAGINATION
            },
            required: ['entityType', 'entityId']
        },
        annotations: { tags: ['comments', 'read', 'list'], readOnlyHint: true }
    },
    {
        name: 'activity_stream',
        title: 'Get Activity Stream',
        description:
            'Retrieve the activity stream (audit log) for an entity or workspace. Includes creates, updates, status changes, and member changes.',
        inputSchema: {
            type: 'object',
            properties: {
                workspaceId: { type: 'string', pattern: ID_RE },
                entityType: { type: 'string', enum: ['project', 'task', 'issue', 'objective', 'workspace'] },
                entityId: { type: 'string', pattern: ID_RE },
                since: ISO_DATE,
                ...PAGINATION
            }
        },
        annotations: { tags: ['activity', 'read'], readOnlyHint: true }
    }
];

// -----------------------------------------------------------------------------
// Combined catalog
// -----------------------------------------------------------------------------

export const SAMPLE_TOOLS: Tool[] = [
    ...PROJECT_TOOLS,
    ...TASK_TOOLS,
    ...ISSUE_TOOLS,
    ...OKR_TOOLS,
    ...META_TOOLS
];
