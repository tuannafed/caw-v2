import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Inbox,
  SearchX,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  groupByStage,
  laneColor,
  phaseProgress,
  STAGES,
  shortDate,
} from '@/lib/status'
import type { Task } from '@/lib/task-parser'
import { cn } from '@/lib/utils'

interface TasksListProps {
  tasks: Task[]
  onOpen: (id: string) => void
}

function TaskRow({
  task,
  onOpen,
  stageColor,
}: {
  task: Task
  onOpen: (id: string) => void
  stageColor: string
}) {
  const progress = phaseProgress(task)
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0
  const hasProgress = !!progress
  const laneClr = laneColor(task.lane)
  const date = shortDate(task.updated || task.created)

  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        'group w-full text-left grid items-center gap-4 pr-5 py-3 pl-3',
        'grid-cols-[1fr_160px_100px_90px_110px]',
        'border-b border-border/30 last:border-b-0',
        'hover:bg-muted/20 transition-colors',
        'focus-visible:outline-none focus-visible:bg-muted/20',
      )}
      style={{ borderLeft: `3px solid ${stageColor}` }}
    >
      {/* Name + id */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-foreground truncate leading-snug">
            {task.title}
          </div>
          <div className="text-[11px] text-muted-foreground/70 font-mono truncate mt-0.5">
            {task.id}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2.5">
        {hasProgress ? (
          <>
            <div className="h-1.5 flex-1 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: stageColor }}
              />
            </div>
            <span
              className="text-[12px] font-semibold tabular-nums shrink-0 w-9 text-right"
              style={{ color: stageColor }}
            >
              {pct}%
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Lane */}
      <div>
        {task.lane ? (
          <Badge
            className="border-0 text-[11px] font-semibold capitalize px-2.5 py-0.5"
            style={{ backgroundColor: `${laneClr}28`, color: laneClr }}
          >
            {task.lane.charAt(0).toUpperCase() + task.lane.slice(1)}
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Type */}
      <div className="text-[12px] text-muted-foreground/80 capitalize truncate">
        {task.type || '—'}
      </div>

      {/* Updated date */}
      <div className="flex items-center gap-1.5 text-muted-foreground/70">
        {date ? (
          <>
            <Calendar className="size-3 shrink-0" />
            <span className="text-[12px]">{date}</span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </div>
    </button>
  )
}

export function TasksList({ tasks, onOpen }: TasksListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (tasks.length === 0) {
    return (
      <div className="px-4 sm:px-6 pb-6">
        <div className="rounded-xl border border-border/40 flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="size-12 rounded-xl border border-border/60 flex items-center justify-center">
            <Inbox className="size-5 text-muted-foreground/70" />
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            No tasks yet
          </div>
          <div className="text-[12px] text-muted-foreground/70">
            Create one with <code className="font-mono">/caw-plan</code>
          </div>
        </div>
      </div>
    )
  }

  const groups = groupByStage(tasks)

  const COL = '1fr 160px 100px 90px 110px'

  return (
    <div className="px-4 sm:px-6 pb-6 space-y-3">
      {/* Single sticky column header */}
      <div
        className="grid gap-4 pr-5 py-2 pl-6 rounded-lg bg-muted/10 border border-border/30 sticky top-0 z-10"
        style={{ gridTemplateColumns: COL }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Task
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Progress
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Lane
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Type
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Updated
        </span>
      </div>

      {/* No search results */}
      {STAGES.every((s) => (groups[s.key] || []).length === 0) && (
        <div className="rounded-xl border border-border/40 flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="size-12 rounded-xl border border-border/60 flex items-center justify-center">
            <SearchX className="size-5 text-muted-foreground/70" />
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            No results
          </div>
          <div className="text-[12px] text-muted-foreground/70">
            Try a different search term
          </div>
        </div>
      )}

      {STAGES.map((stage) => {
        const stageTasks = groups[stage.key] || []
        if (stageTasks.length === 0) return null
        const isCollapsed = collapsed[stage.key]
        const Icon = stage.icon

        return (
          <div
            key={stage.key}
            className="rounded-xl overflow-hidden border border-border/50"
            style={{
              boxShadow: `0 0 0 1px ${stage.color}18 inset`,
            }}
          >
            {/* Section header */}
            <button
              type="button"
              onClick={() =>
                setCollapsed((c) => ({ ...c, [stage.key]: !c[stage.key] }))
              }
              className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-muted/20"
              style={{
                background: `linear-gradient(to right, ${stage.color}14, transparent)`,
                borderBottom: isCollapsed
                  ? 'none'
                  : `1px solid ${stage.color}20`,
                borderLeft: `3px solid ${stage.color}`,
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground/60 shrink-0" />
              )}
              <Icon
                size={14}
                style={{ color: stage.color }}
                className="shrink-0"
              />
              <span
                className="text-[13px] font-semibold"
                style={{ color: stage.color }}
              >
                {stage.label}
              </span>
              <span
                className="text-[11px] font-semibold rounded px-1.5 py-0.5 ml-0.5"
                style={{
                  backgroundColor: `${stage.color}30`,
                  color: stage.color,
                }}
              >
                {stageTasks.length}
              </span>
            </button>

            {/* Rows */}
            {!isCollapsed && (
              <div>
                {stageTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onOpen={onOpen}
                    stageColor={stage.color}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
