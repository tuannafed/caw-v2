import { Kanban, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

// Claude logo — multi-ray asterisk with beveled tips, matching official mark
function ClaudeLogo({ className }: { className?: string }) {
  // Each ray: [angleDeg, outerRadius, halfWidth] — center at 50,50, viewBox 100×100
  // Rays alternate long/short with slight angle offsets, tips are flat-beveled
  const cx = 50,
    cy = 50;
  const rays: [number, number, number][] = [
    [0, 46, 5.5],
    [27, 40, 4.2],
    [52, 45, 5.0],
    [79, 38, 3.8],
    [104, 44, 5.2],
    [130, 37, 4.0],
    [155, 46, 5.5],
    [180, 40, 4.2],
    [207, 44, 5.0],
    [232, 37, 3.8],
    [258, 45, 5.2],
    [283, 38, 4.0],
    [308, 43, 4.8],
  ];

  function rayPath(angleDeg: number, r: number, hw: number): string {
    const a = (angleDeg * Math.PI) / 180;
    const perp = a + Math.PI / 2;
    // Base points (at center)
    const bx1 = cx + Math.cos(perp) * hw;
    const by1 = cy + Math.sin(perp) * hw;
    const bx2 = cx - Math.cos(perp) * hw;
    const by2 = cy - Math.sin(perp) * hw;
    // Tip points — beveled (narrow the width by ~40% at the tip)
    const tipHw = hw * 0.55;
    const tx = cx + Math.cos(a) * r;
    const ty = cy + Math.sin(a) * r;
    const tx1 = tx + Math.cos(perp) * tipHw;
    const ty1 = ty + Math.sin(perp) * tipHw;
    const tx2 = tx - Math.cos(perp) * tipHw;
    const ty2 = ty - Math.sin(perp) * tipHw;
    return `M${bx1.toFixed(2)},${by1.toFixed(2)} L${tx1.toFixed(2)},${ty1.toFixed(2)} L${tx2.toFixed(2)},${ty2.toFixed(2)} L${bx2.toFixed(2)},${by2.toFixed(2)} Z`;
  }

  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden="true">
      {rays.map(([angle, r, hw], i) => (
        <path key={i} d={rayPath(angle, r, hw)} />
      ))}
    </svg>
  );
}

type View = 'dashboard' | 'board';

const APP_VERSION = 'v2.0.0';

interface TasksSidebarProps {
  projectName: string;
  view: View;
  onViewChange: (view: View) => void;
  taskCount?: number;
}

const menuItems: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'board', label: 'Board', icon: Kanban },
];

interface WorkspaceStats {
  tasks: number;
  decisions: number;
  rules: number;
}

function useWorkspaceStats() {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  useEffect(() => {
    fetch('/api/workspace.json')
      .then((r) => r.json())
      .then((d: WorkspaceStats) => setStats(d))
      .catch(() => undefined);
  }, []);
  return stats;
}

export function TasksSidebar({
  projectName,
  view,
  onViewChange,
  taskCount = 0,
}: TasksSidebarProps) {
  const ws = useWorkspaceStats();

  const metrics = [
    { label: 'Tasks', value: ws?.tasks ?? taskCount, color: 'var(--primary)' },
    { label: 'Decisions', value: ws?.decisions ?? '—', color: '#a78bfa' },
    { label: 'Rules', value: ws?.rules ?? '—', color: '#68d391' },
  ];

  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* ── Brand ─────────────────────────────── */}
      <SidebarHeader className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3.5">
          {/* Logo: dark bg + orange asterisk glow */}
          <div
            className="size-12 rounded-xl bg-[oklch(0.18_0.01_48)] border border-primary/30 flex items-center justify-center shrink-0"
            style={{
              boxShadow: '0 0 18px -4px color-mix(in oklch, var(--primary) 55%, transparent)',
            }}
          >
            <ClaudeLogo className="size-7 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold leading-none tracking-tight">Claude</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Agent Workflow
              </span>
              <span className="text-[9px] font-semibold rounded border border-primary/40 px-1.5 py-px text-primary">
                {APP_VERSION}
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 flex flex-col">
        {/* ── Navigation ───────────────────────── */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = item.id === view;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onViewChange(item.id)}
                      className={cn(
                        'h-11 px-4 rounded-lg transition-all text-base',
                        isActive
                          ? 'bg-card text-foreground border border-primary/60 shadow-[0_0_12px_-4px_color-mix(in_oklch,var(--primary)_40%,transparent)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 border border-transparent',
                      )}
                    >
                      <item.icon
                        className={cn('size-5 shrink-0', isActive ? 'text-primary' : '')}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* spacer pushes System Status toward bottom */}
        <div className="flex-1" />

        {/* ── System Status ────────────────────── */}
        <SidebarGroup className="p-0 mb-3">
          <SidebarGroupLabel className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            System Status
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="rounded-xl border border-sidebar-border bg-sidebar/60 overflow-hidden">
              {metrics.map((m, i) => (
                <div
                  key={m.label}
                  className={cn(
                    'flex items-center px-3 py-[9px]',
                    i < metrics.length - 1 && 'border-b border-sidebar-border/40',
                  )}
                >
                  <span className="text-[12px] text-muted-foreground flex-1">{m.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: m.color }}
                    >
                      {m.value}
                    </span>
                    <span
                      className="size-2 rounded-full animate-pulse"
                      style={{ backgroundColor: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── User profile ─────────────────────── */}
      <SidebarFooter className="p-3 pt-0">
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar/60 px-3 py-2.5">
          {/* Hacker avatar — larger, dark bg, orange border ring */}
          <div
            className="size-12 rounded-full shrink-0 overflow-hidden"
            style={{
              boxShadow:
                '0 0 0 1.5px color-mix(in oklch, var(--primary) 60%, transparent), 0 0 10px -2px color-mix(in oklch, var(--primary) 35%, transparent)',
            }}
          >
            <svg viewBox="0 0 100 100" fill="none" className="size-12" aria-hidden="true">
              {/* Background — very dark */}
              <circle cx="50" cy="50" r="50" fill="#0f0e0d" />

              {/* Cloak / body — wide dark shape filling lower half */}
              <path
                d="M0 100 Q5 68 25 58 Q38 52 50 50 Q62 52 75 58 Q95 68 100 100Z"
                fill="#1a1714"
              />

              {/* Hood outer — large dark arch */}
              <path d="M14 46 Q15 10 50 8 Q85 10 86 46 Q80 34 50 32 Q20 34 14 46Z" fill="#1c1a17" />

              {/* Hood inner shadow — slightly lighter arch */}
              <path
                d="M20 48 Q22 20 50 18 Q78 20 80 48 Q74 36 50 35 Q26 36 20 48Z"
                fill="#252118"
              />

              {/* Face area — very dark oval, slightly lighter than bg */}
              <ellipse cx="50" cy="46" rx="16" ry="18" fill="#141210" />

              {/* Subtle face gradient via a slightly lighter center */}
              <ellipse cx="50" cy="44" rx="11" ry="13" fill="#181512" />

              {/* Eyes — amber/orange glow, small */}
              <ellipse cx="43" cy="43" rx="2.8" ry="2.2" fill="#c8611a" opacity="0.75" />
              <ellipse cx="57" cy="43" rx="2.8" ry="2.2" fill="#c8611a" opacity="0.75" />
              {/* Eye inner highlight */}
              <ellipse cx="43" cy="43" rx="1.4" ry="1.1" fill="#e8844a" opacity="0.6" />
              <ellipse cx="57" cy="43" rx="1.4" ry="1.1" fill="#e8844a" opacity="0.6" />

              {/* Hood lip / brim shadow at bottom of hood */}
              <path
                d="M22 50 Q36 55 50 54 Q64 55 78 50 Q74 58 50 58 Q26 58 22 50Z"
                fill="#111"
                opacity="0.7"
              />

              {/* Shoulder / cloak drape */}
              <path d="M0 100 L0 78 Q18 62 50 60 Q82 62 100 78 L100 100Z" fill="#131110" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold leading-tight">Operator</div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {projectName || 'Project'}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] text-emerald-500 font-medium">Online</span>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
