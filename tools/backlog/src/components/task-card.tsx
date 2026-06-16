import { ArrowRight, Calendar, Layers, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { laneColor, phaseProgress, shortDate, stageColor, statusLabel } from '@/lib/status';
import type { Task } from '@/lib/task-parser';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onOpen: (id: string) => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const progress = phaseProgress(task);
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const laneClr = laneColor(task.lane);
  const stageClr = stageColor(task);
  const date = shortDate(task.updated || task.created);
  const done = progress && progress.done === progress.total;
  const remaining = progress ? progress.total - progress.done : 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        'group w-full text-left rounded-xl bg-card p-4',
        'transition-all duration-200',
        'hover:-translate-y-0.5',
        'focus-visible:outline-none',
      )}
      style={{
        border: '1px solid color-mix(in oklch, var(--primary) 22%, transparent)',
        boxShadow: '0 0 16px -8px color-mix(in oklch, var(--primary) 30%, transparent)',
      }}
    >
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.lane && (
            <Badge
              className="border-0 text-[10px] font-medium capitalize px-2"
              style={{
                backgroundColor: `${laneClr}1f`,
                color: laneClr,
              }}
            >
              {task.lane}
            </Badge>
          )}
          {task.type && (
            <Badge
              variant="outline"
              className="text-[10px] font-medium capitalize px-2 text-muted-foreground border-border/70"
            >
              {task.type}
            </Badge>
          )}
        </div>
      </div>

      <h3 className="text-sm font-medium leading-snug mb-3 line-clamp-2 text-foreground group-hover:text-foreground">
        {task.title}
      </h3>

      {progress && (
        <div className="mb-3 space-y-1.5">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                done ? 'bg-emerald-500' : 'bg-primary',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>{progress.label}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* Meta row — phase counts + next phase */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-muted-foreground/80">
        {progress && (
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            {progress.total} {progress.total === 1 ? 'phase' : 'phases'}
          </span>
        )}
        {progress && !done && remaining > 0 && (
          <span className="flex items-center gap-1">
            <ListTodo className="size-3" />
            {remaining} left
          </span>
        )}
        {task.next_phase && !done && (
          <span className="flex items-center gap-1 min-w-0">
            <ArrowRight className="size-3 shrink-0" />
            <span className="font-mono truncate">{task.next_phase}</span>
          </span>
        )}
      </div>

      {/* Footer — status label (left) + date */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/40">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${stageClr}1f`, color: stageClr }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: stageClr }} />
          {statusLabel(task.status)}
        </span>
        {date && (
          <div className="flex items-center gap-1 text-muted-foreground/70 shrink-0">
            <Calendar className="size-3" />
            <span className="text-[10px]">{date}</span>
          </div>
        )}
      </div>
    </button>
  );
}
