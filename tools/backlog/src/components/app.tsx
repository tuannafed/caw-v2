import { useCallback, useEffect, useMemo, useState } from 'react';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useEventSubscribe, useGlobalFlash } from '@/hooks/use-event-stream';
import { isAuthenticated } from '@/lib/auth';
import type { Task } from '@/lib/task-parser';
import { fetchJson } from '@/lib/utils';
import { BoardView } from './board-view';
import { Dashboard } from './dashboard';
import { TaskDialog } from './task-dialog';
import { TasksHeader } from './tasks-header';
import { TasksSidebar } from './tasks-sidebar';

type View = 'dashboard' | 'board';

function readHashView(): View {
  if (typeof window === 'undefined') return 'dashboard';
  const h = window.location.hash;
  if (h === '#/board') return 'board';
  return 'dashboard';
}

function viewToHash(view: View): string {
  if (view === 'board') return '#/board';
  return '#/';
}

export function App() {
  // Auth gate — redirect to /login if no localStorage credential.
  // Runs in useEffect (post-mount) so SSR/prerender doesn't redirect.
  useEffect(() => {
    if (!isAuthenticated()) {
      const next = window.location.pathname + window.location.search + window.location.hash;
      const loginUrl = '/login' + (next && next !== '/' ? '?next=' + encodeURIComponent(next) : '');
      window.location.replace(loginUrl);
    }
  }, []);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectName, setProjectName] = useState('');
  // Always start with 'dashboard' to match SSR — sync from browser after mount.
  const [view, setView] = useState<View>('dashboard');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const flashing = useGlobalFlash();

  // Sync view ↔ hash after hydration to avoid SSR mismatch.
  useEffect(() => {
    setView(readHashView());
    const onHash = () => setView(readHashView());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleViewChange = useCallback((next: View) => {
    setView(next);
    window.location.hash = viewToHash(next);
  }, []);

  // Initial fetch of project metadata. Static — only changes if the dev server
  // restarts with a different CAW_PROJECT_ROOT, so we don't subscribe to it.
  useEffect(() => {
    fetchJson<{ name?: string }>('/api/project.json')
      .then((d) => setProjectName(d.name || ''))
      .catch(() => undefined);
  }, []);

  const fetchTasks = useCallback(() => {
    fetch('/api/tasks.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh: Task[] | null) => {
        if (Array.isArray(fresh)) setTasks(fresh);
      })
      .catch(() => undefined);
  }, []);

  // Initial load + re-fetch on every `tasks` SSE event.
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);
  useEventSubscribe(['tasks'], fetchTasks);

  const onOpen = useCallback((id: string) => setOpenTaskId(id), []);
  const onCloseDialog = useCallback((open: boolean) => {
    if (!open) setOpenTaskId(null);
  }, []);

  const openTask = useMemo(
    () => (openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null),
    [openTaskId, tasks],
  );

  return (
    <SidebarProvider>
      <TasksSidebar
        projectName={projectName}
        view={view}
        onViewChange={handleViewChange}
        taskCount={tasks.length}
      />
      <SidebarInset className="min-w-0 overflow-hidden bg-transparent">
        <TasksHeader flashing={flashing} view={view} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          {view === 'board' ? (
            <BoardView tasks={tasks} onOpen={onOpen} />
          ) : (
            <Dashboard tasks={tasks} />
          )}
        </main>
      </SidebarInset>
      <TaskDialog task={openTask} open={openTask !== null} onOpenChange={onCloseDialog} />
    </SidebarProvider>
  );
}
