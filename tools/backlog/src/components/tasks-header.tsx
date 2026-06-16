import { useEffect, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

interface TasksHeaderProps {
  flashing: boolean;
  view: 'dashboard' | 'board' | 'skills';
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  const date = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <div className="hidden md:flex flex-col items-end leading-none gap-1">
      <span className="text-[18px] font-semibold font-mono tabular-nums tracking-tight">
        {time}
      </span>
      <span className="text-[10px] text-muted-foreground">{date}</span>
    </div>
  );
}

export function TasksHeader({ flashing, view }: TasksHeaderProps) {
  const title = view === 'board' ? 'Board' : view === 'skills' ? 'Skills' : 'Dashboard';

  return (
    <header className="border-b border-border">
      <div className="flex items-center justify-between h-[60px] px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarTrigger />
          <h1 className="font-display text-lg md:text-xl font-semibold text-gradient-pop shrink-0">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div
            className={cn(
              'hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
              flashing && 'bg-sky-500/15 text-sky-500 dark:text-sky-400',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full bg-emerald-500',
                flashing && 'bg-sky-400 animate-pulse',
              )}
            />
            <span>{flashing ? 'Syncing' : 'All systems operational'}</span>
          </div>
          <LiveClock />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
