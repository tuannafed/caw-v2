import {
  Ban,
  CheckCircle2,
  Compass,
  type LucideIcon,
  Pause,
  Search,
  Settings,
  TestTube,
} from 'lucide-react';

import type { Phase, Task } from './task-parser';

export interface Stage {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

// Stage-based columns matching the task lifecycle.
// Mapping from the `status:` field in `overview.yaml` → stage column.
export const STAGES: Stage[] = [
  { key: 'pending', label: 'Pending', icon: Pause, color: '#718096' },
  { key: 'planning', label: 'Planning', icon: Compass, color: '#805ad5' },
  { key: 'coding', label: 'Coding', icon: Settings, color: '#dd6b20' },
  { key: 'testing', label: 'Testing', icon: TestTube, color: '#3182ce' },
  { key: 'review', label: 'Review', icon: Search, color: '#d69e2e' },
  { key: 'blocked', label: 'Blocked', icon: Ban, color: '#c53030' },
  { key: 'done', label: 'Done', icon: CheckCircle2, color: '#48bb78' },
];

const STATUS_TO_STAGE: Record<string, string> = {
  pending: 'pending',
  'plan-pending': 'pending',
  // v2 DB story status: planned | in_progress | implemented | changed | retired
  planned: 'pending',

  planning: 'planning',
  'plan-done': 'planning',

  coding: 'coding',
  'code-pending': 'coding',
  'code-done': 'coding',
  'in-progress': 'coding',
  in_progress: 'coding',
  changed: 'coding', // v2: story re-opened / being amended

  // v2: story has shipped its implementation.
  implemented: 'done',
  retired: 'done', // v2: closed / superseded

  testing: 'testing',
  'red-done': 'testing',
  'tests-done': 'testing',
  'tests-skipped': 'testing',

  reviewing: 'review',
  'review-pending': 'review',
  'ready-to-review': 'review',

  blocked: 'blocked',
  'needs-rework': 'blocked',
  'review-blocked': 'blocked',

  // Review passed / shippable / shipped — all land in Done.
  'review-done': 'done',
  'review-approved': 'done',
  approved: 'done',
  'ready-to-commit': 'done',
  verified: 'done',
  done: 'done',
  completed: 'done',
};

// Human-readable label for a raw `status:` value — shown on the card footer
// so two tasks in the same column can still be told apart at a glance.
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  'plan-pending': 'Plan pending',
  planning: 'Planning',
  'plan-done': 'Plan ready',
  coding: 'Coding',
  'code-pending': 'Code pending',
  'code-done': 'Code done',
  'in-progress': 'In progress',
  in_progress: 'In progress',
  testing: 'Testing',
  'red-done': 'Tests red',
  'tests-done': 'Tests passing',
  'tests-skipped': 'Tests skipped',
  reviewing: 'Reviewing',
  'review-pending': 'Review pending',
  'ready-to-review': 'Ready to review',
  blocked: 'Blocked',
  'needs-rework': 'Needs rework',
  'review-blocked': 'Review blocked',
  'review-done': 'Reviewed',
  'review-approved': 'Review approved',
  approved: 'Approved',
  'ready-to-commit': 'Ready to commit',
  verified: 'Verified',
  done: 'Done',
  completed: 'Completed',
};

export function statusLabel(status: string): string {
  const s = (status || 'pending').toLowerCase().trim();
  return STATUS_LABELS[s] || s.replace(/[-_]/g, ' ');
}

export function getStageKey(task: Task): string {
  const status = (task.status || 'pending').toLowerCase().trim();
  return STATUS_TO_STAGE[status] || 'pending';
}

export function groupByStage(tasks: Task[]): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  for (const stage of STAGES) groups[stage.key] = [];
  for (const t of tasks) {
    const key = getStageKey(t);
    (groups[key] || groups.pending).push(t);
  }
  return groups;
}

export interface Stats {
  total: number;
  inProgress: number;
  done: number;
  pending: number;
  blocked: number;
}

export function computeStats(tasks: Task[]): Stats {
  const total = tasks.length;
  let inProgress = 0;
  let done = 0;
  let pending = 0;
  let blocked = 0;
  for (const t of tasks) {
    const stage = getStageKey(t);
    if (stage === 'done') done++;
    else if (stage === 'blocked') blocked++;
    else if (stage === 'pending') pending++;
    else inProgress++;
  }
  return { total, inProgress, done, pending, blocked };
}

export function phaseProgress(task: Task): { done: number; total: number; label: string } | null {
  const phases = task.phases || [];
  if (phases.length === 0) return null;
  const done = phases.filter((p: Phase) => {
    const s = (p.status || '').toLowerCase();
    return s === 'done' || s === 'skipped';
  }).length;
  return { done, total: phases.length, label: `${done}/${phases.length} phases` };
}

// Color of the stage column a task currently sits in — used to tint the
// status pill on the card so it reads at a glance.
export function stageColor(task: Task): string {
  const key = getStageKey(task);
  return STAGES.find((s) => s.key === key)?.color || '#718096';
}

export function laneColor(lane: string): string {
  const v = (lane || '').toLowerCase();
  // v2 DB lanes: tiny | normal | high_risk. v1 lanes: tiny | standard | risky.
  if (v === 'risky' || v === 'high_risk') return '#fc8181';
  if (v === 'standard' || v === 'normal') return '#63b3ed';
  if (v === 'tiny') return '#68d391';
  return '#718096';
}

export function shortDate(s: string): string {
  if (!s) return '';
  return s.split(/[ T]/)[0];
}
