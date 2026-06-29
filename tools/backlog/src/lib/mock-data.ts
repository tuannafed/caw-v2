import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from './task-parser';

export function isDevMode(root: string): boolean {
  return !existsSync(join(root, 'docs', 'caw'));
}

export const MOCK_TASKS: Task[] = [
  {
    id: 'task-001-user-auth',
    title: 'Implement JWT Authentication with Refresh Tokens',
    status: 'done',
    lane: 'normal',
    type: 'feature',
    next_phase: '',
    created: '2026-05-10T09:00:00Z',
    updated: '2026-05-18T23:59:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/auth/auth.service.ts' },
      { id: 'phase-2', status: 'done', files: 'src/auth/auth.controller.ts' },
      { id: 'phase-3', status: 'done', files: 'src/auth/strategies/*.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-002-email-service',
    title: 'Transactional Email Service (SMTP + AWS SES)',
    status: 'done',
    lane: 'high_risk',
    type: 'feature',
    next_phase: '',
    created: '2026-05-12T10:00:00Z',
    updated: '2026-05-19T23:50:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/email/email.service.ts' },
      { id: 'phase-2', status: 'done', files: 'src/email/templates/*.hbs' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-003-stripe-webhooks',
    title: 'Stripe Webhook Integration & Payment Event Processing',
    status: 'done',
    lane: 'high_risk',
    type: 'feature',
    next_phase: '',
    created: '2026-05-13T08:30:00Z',
    updated: '2026-05-20T17:00:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/payments/stripe.service.ts' },
      { id: 'phase-2', status: 'done', files: 'src/payments/webhooks.controller.ts' },
      { id: 'phase-3', status: 'done', files: 'src/payments/events/*.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-004-file-upload',
    title: 'S3 File Upload with Presigned URLs and Access Control',
    status: 'blocked',
    lane: 'normal',
    type: 'feature',
    next_phase: 'phase-2',
    created: '2026-05-14T11:00:00Z',
    updated: '2026-05-21T15:00:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/storage/s3.service.ts' },
      { id: 'phase-2', status: 'blocked', files: 'src/storage/upload.controller.ts' },
      { id: 'phase-3', status: 'pending', files: 'src/storage/policies/*.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-005-websocket',
    title: 'Real-time Notifications via Socket.io Gateway',
    status: 'blocked',
    lane: 'high_risk',
    type: 'feature',
    next_phase: 'phase-1',
    created: '2026-05-15T09:00:00Z',
    updated: '2026-05-21T19:00:00Z',
    phases: [
      { id: 'phase-1', status: 'blocked', files: 'src/gateway/notifications.gateway.ts' },
      { id: 'phase-2', status: 'pending', files: 'src/gateway/rooms.service.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-006-rbac',
    title: 'Role-Based Access Control with CASL Permissions',
    status: 'blocked',
    lane: 'normal',
    type: 'refactor',
    next_phase: 'phase-3',
    created: '2026-05-16T10:00:00Z',
    updated: '2026-05-22T11:15:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/casl/casl-ability.factory.ts' },
      { id: 'phase-2', status: 'done', files: 'src/casl/policies.guard.ts' },
      { id: 'phase-3', status: 'blocked', files: 'src/casl/prisma-ability.ts' },
      { id: 'phase-4', status: 'pending', files: 'src/casl/decorators/*.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-007-audit-log',
    title: 'Audit Log System for Compliance Tracking',
    status: 'coding',
    lane: 'normal',
    type: 'feature',
    next_phase: 'phase-2',
    created: '2026-05-17T08:00:00Z',
    updated: '2026-05-22T10:00:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/audit/audit.entity.ts' },
      { id: 'phase-2', status: 'in-progress', files: 'src/audit/audit.service.ts' },
      { id: 'phase-3', status: 'pending', files: 'src/audit/audit.interceptor.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-008-search',
    title: 'Full-Text Search with PostgreSQL tsvector',
    status: 'plan-done',
    lane: 'normal',
    type: 'feature',
    next_phase: 'phase-1',
    created: '2026-05-20T09:00:00Z',
    updated: '2026-05-22T09:00:00Z',
    phases: [
      { id: 'phase-1', status: 'pending', files: 'src/search/search.service.ts' },
      { id: 'phase-2', status: 'pending', files: 'src/search/search.controller.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-009-rate-limit',
    title: 'API Rate Limiting with Redis + BullMQ',
    status: 'review-pending',
    lane: 'high_risk',
    type: 'feature',
    next_phase: '',
    created: '2026-05-18T08:00:00Z',
    updated: '2026-05-21T14:00:00Z',
    phases: [
      { id: 'phase-1', status: 'done', files: 'src/throttle/throttle.guard.ts' },
      { id: 'phase-2', status: 'done', files: 'src/throttle/throttle.service.ts' },
    ],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
  {
    id: 'task-010-health',
    title: 'Health Check Endpoint with DB + Redis probes',
    status: 'tests-done',
    lane: 'normal',
    type: 'chore',
    next_phase: '',
    created: '2026-05-19T10:00:00Z',
    updated: '2026-05-21T16:00:00Z',
    phases: [{ id: 'phase-1', status: 'done', files: 'src/health/health.controller.ts' }],
    sections: { plan: '', code: '', tests: '', review: '', overview: '' },
  },
];

export const MOCK_OVERVIEW = {
  name: 'caw-backlog',
  description:
    'Astro + React Kanban UI for the CAW agent workflow. Displays story tasks and project info.',
  team: 'CAW',
  archetype: 'nestjs-rest-api-monolith',
  generatedAt: '2026-05-10 09:00 UTC',
  lastUpdated: '2026-05-22',
  tags: ['Backend API', 'TypeScript', 'NestJS', 'PostgreSQL'],
  stack: [
    { name: 'TypeScript', version: '5.9', role: 'Language', icon: 'typescript' },
    { name: 'NestJS', version: '11', role: 'Backend', icon: 'nestjs' },
    { name: 'PostgreSQL', version: '14', role: 'Database', icon: 'postgresql' },
    { name: 'Redis', version: '7', role: 'Cache', icon: 'redis' },
    { name: 'Prisma', version: '6', role: 'ORM', icon: 'prisma' },
    { name: 'AWS', version: 'S3/SES', role: 'Cloud', icon: 'aws' },
  ],
};

export const MOCK_PROJECT_FILES = {
  knowledge: {
    path: 'docs/caw/knowledge.md',
    exists: true,
    content: `# Project Knowledge\n\n## Tailwind v4 + CSS Variables\n\nUse \`@theme inline\` to expose CSS variables to Tailwind. The \`oklch\` color space is used throughout for perceptual uniformity.\n\n## Card Border Glow\n\nThe \`.card-border-glow\` pattern uses \`background-clip: padding-box, border-box\` with two background layers — solid card color + gradient — to achieve the orange gradient border effect without pseudo-elements.\n\n## Hydration\n\nAlways initialize React state with SSR-safe values (no \`window\` access). Sync from \`localStorage\`/\`location.hash\` in \`useEffect\`.\n`,
  },
  claudeMd: {
    path: 'CLAUDE.md',
    exists: true,
    content: `# CLAUDE.md\n\nThis file provides guidance to Claude Code when working in this repository.\n\n## What This Is\n\nThe \`backlog\` tool is an Astro 6 + React 19 Kanban UI that ships inside the \`caw\` template hub.\n\n## Dev Setup\n\n\`\`\`bash\ncd tools/backlog\npnpm install\npnpm dev\n# open http://localhost:4321\n\`\`\`\n`,
  },
  rules: [
    {
      layer: 'common',
      files: [
        {
          path: '.claude/rules/common/commit-conventions.md',
          exists: true,
          content: `# Commit Conventions\n\nUse conventional commits: \`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`chore:\`\n`,
        },
        {
          path: '.claude/rules/common/harness-contract.md',
          exists: true,
          content: `# Harness Contract\n\nAgents emit structured decisions to \`docs/caw/decisions/\`.\n`,
        },
      ],
    },
    {
      layer: 'project',
      files: [
        {
          path: '.claude/rules/project.md',
          exists: true,
          content: `# Project Rules\n\n- Always use pnpm, never npm/yarn\n- Tailwind v4 only — no \`@apply\` for new styles\n- No \`bg-card\` on \`.card-border-glow\` elements\n`,
        },
      ],
    },
  ],
};
