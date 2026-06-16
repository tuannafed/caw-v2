import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { getStageKey, laneColor, statusLabel } from '@/lib/status';
import type { Task } from '@/lib/task-parser';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
  tasks: Task[];
}

interface ActivityEvent {
  time: string;
  taskId: string;
  description: string;
  stage: string;
  lane?: string;
}

function stageBadgeStyle(stage: string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    done: { bg: '#276749', text: '#9ae6b4', label: 'Done' },
    coding: { bg: '#7b341e', text: '#fbd38d', label: 'In progress' },
    blocked: { bg: '#742a2a', text: '#fc8181', label: 'Risky' },
    testing: { bg: '#2a4365', text: '#90cdf4', label: 'Testing' },
    review: { bg: '#44337a', text: '#d6bcfa', label: 'Review' },
    planning: { bg: '#44337a', text: '#d6bcfa', label: 'Planning' },
    pending: { bg: '#2d3748', text: '#a0aec0', label: 'Planned' },
  };
  return map[stage] ?? map.pending;
}

function dotColor(stage: string): string {
  const map: Record<string, string> = {
    done: '#68d391',
    coding: 'var(--primary)',
    blocked: '#fc8181',
    testing: '#90cdf4',
    review: '#d6bcfa',
    planning: '#d6bcfa',
    pending: '#718096',
  };
  return map[stage] ?? '#718096';
}

function formatEventTime(dateStr: string): string {
  if (!dateStr) return '--:--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0] ?? '--:--:--';
  return d.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function makeDescription(task: Task): string {
  const stage = getStageKey(task);
  const label = statusLabel(task.status);
  if (stage === 'done') return 'completed';
  if (stage === 'testing') return 'tests completed';
  if (stage === 'review') return 'code review approved';
  if (stage === 'coding') return 'implementation started';
  if (stage === 'planning') return 'plan created';
  if (stage === 'blocked') return 'marked as blocked';
  return `updated to ${label.toLowerCase()}`;
}

export function ActivityFeed({ tasks }: ActivityFeedProps) {
  const events = useMemo<ActivityEvent[]>(() => {
    return tasks
      .slice()
      .sort((a, b) => {
        const da = a.updated || a.created || '';
        const db = b.updated || b.created || '';
        return db.localeCompare(da);
      })
      .slice(0, 5)
      .map((t) => ({
        time: formatEventTime(t.updated || t.created || ''),
        taskId: t.id,
        description: makeDescription(t),
        stage: getStageKey(t),
        lane: t.lane,
      }));
  }, [tasks]);

  return (
    <div className="card-border-glow rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-primary text-base">⚡</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Activity Feed
          </span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
        >
          See all
          <ArrowRight className="size-3" />
        </button>
      </div>

      {/* Events */}
      <div className="flex flex-col divide-y divide-border/50 flex-1">
        {events.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground">No activity yet.</div>
        ) : (
          events.map((ev, i) => {
            const badge = stageBadgeStyle(ev.stage);
            const dot = dotColor(ev.stage);
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
              >
                {/* Dot */}
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                {/* Time */}
                <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-[52px]">
                  {ev.time}
                </span>
                {/* Description */}
                <span className="text-[12px] text-foreground/80 flex-1 min-w-0 truncate">
                  <span className="font-semibold text-foreground">{ev.taskId}</span>{' '}
                  {ev.description}
                </span>
                {/* Badge — colored by lane when available, else by stage */}
                {ev.lane ? (
                  <span
                    className="text-[10px] font-semibold rounded px-2 py-0.5 shrink-0"
                    style={{
                      backgroundColor: ev.lane === 'risky' ? '#fc818122' : ev.lane === 'standard' ? '#63b3ed22' : '#68d39122',
                      color: ev.lane === 'risky' ? '#fc8181' : ev.lane === 'standard' ? '#63b3ed' : '#68d391',
                    }}
                  >
                    {ev.lane.charAt(0).toUpperCase() + ev.lane.slice(1)}
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-semibold rounded px-2 py-0.5 shrink-0"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
