import { type FSWatcher, watch } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';
import { getProjectRoot } from '@/lib/project-root';

// In static (Vercel) builds, SSE is meaningless — task data is frozen at build
// time. We still prerender this route so the build doesn't produce a serverless
// function for it; the client's EventSource short-circuits before fetching.
export const prerender = IS_STATIC;

// Topics surface as event names on the client. Each watched path falls under
// exactly one topic; the client decides what to refetch when each fires.
type Topic = 'tasks' | 'project-files' | 'skills';

interface WatchSpec {
  path: string; // relative to projectRoot
  topic: Topic;
  recursive?: boolean;
}

const WATCH_SPECS: WatchSpec[] = [
  // Story lifecycle: docs/caw/stories/<story-id>/{overview.yaml, plan.md, code.md, tests.md, review.md}
  { path: 'docs/caw/stories', topic: 'tasks', recursive: true },
  // Project knowledge files served via /api/project-files.json
  { path: 'docs/caw/conventions.md', topic: 'project-files' },
  { path: 'docs/caw/knowledge.md', topic: 'project-files' },
  { path: 'CLAUDE.md', topic: 'project-files' },
  { path: '.claude/rules', topic: 'project-files', recursive: true },
  // Skills installed via /caw-setup
  { path: '.claude/skills', topic: 'skills', recursive: true },
];

const DEBOUNCE_MS = 250;
const HEARTBEAT_MS = 25_000;

export const GET: APIRoute = async () => {
  if (IS_STATIC) {
    // Snapshot build — return a stub so prerender produces an inert file
    // instead of opening file watchers.
    return new Response('event: hello\ndata: {"static":true}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
  const root = getProjectRoot();
  const encoder = new TextEncoder();

  // Per-topic debounce timers + watchers — collected so we can clean up on close.
  const watchers: FSWatcher[] = [];
  const debounceTimers = new Map<Topic, ReturnType<typeof setTimeout>>();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller closed — caller already canceled.
        }
      };

      const fire = (topic: Topic) => {
        const existing = debounceTimers.get(topic);
        if (existing) clearTimeout(existing);
        debounceTimers.set(
          topic,
          setTimeout(() => {
            send(topic, { topic, ts: Date.now() });
            debounceTimers.delete(topic);
          }, DEBOUNCE_MS),
        );
      };

      // Initial hello — lets the client confirm the channel is alive.
      send('hello', { root, ts: Date.now() });

      for (const spec of WATCH_SPECS) {
        const abs = join(root, spec.path);
        try {
          const w = watch(abs, { recursive: !!spec.recursive, persistent: false }, () =>
            fire(spec.topic),
          );
          w.on('error', () => {
            // Path may not exist yet (e.g. tasks/ before first /caw-plan).
            // Silently ignore — we still serve the channel.
          });
          watchers.push(w);
        } catch {
          // Same as above — missing path is non-fatal.
        }
      }

      // Heartbeat keeps proxies / reverse-proxies from closing idle connection.
      heartbeatTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          // ignored
        }
      }, HEARTBEAT_MS);
    },

    cancel() {
      closed = true;
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          // ignored
        }
      }
      watchers.length = 0;
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
