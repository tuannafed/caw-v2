import { useEffect, useRef, useState } from 'react';

export type EventTopic = 'tasks' | 'project-files' | 'skills';

interface SubscriberMap {
  [topic: string]: Set<() => void>;
}

// Module-level singleton — every component that subscribes shares one
// EventSource so we don't open multiple SSE connections.
let source: EventSource | null = null;
const subscribers: SubscriberMap = {};
const flashListeners = new Set<(topic: EventTopic) => void>();

function ensureSource() {
  if (typeof window === 'undefined') return null;
  // Static builds (Vercel) have no live SSE endpoint — task data is frozen at
  // build time. Skip opening the connection so we don't spam the console with
  // reconnect failures.
  if (import.meta.env.PUBLIC_DEPLOY_TARGET === 'vercel') return null;
  if (source) return source;

  source = new EventSource('/api/events');

  source.addEventListener('hello', () => {
    // No-op; presence of the event is enough to confirm the channel.
  });

  const wire = (topic: EventTopic) => {
    source?.addEventListener(topic, () => {
      const set = subscribers[topic];
      if (set) for (const fn of set) fn();
      for (const l of flashListeners) l(topic);
    });
  };
  wire('tasks');
  wire('project-files');
  wire('skills');

  source.onerror = () => {
    // EventSource auto-reconnects; nothing to do. If browser permanently
    // closes (CLOSED state), next subscriber call will re-create.
    if (source?.readyState === EventSource.CLOSED) {
      source.close();
      source = null;
    }
  };

  return source;
}

/**
 * Subscribe to one or more topics. The callback fires whenever the server
 * pushes a change event for any of the listed topics — caller refetches.
 */
export function useEventSubscribe(topics: EventTopic[], onChange: () => void): void {
  // Stable reference to the latest callback to avoid re-subscribing on each render.
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    ensureSource();
    const wrapper = () => cbRef.current();
    for (const t of topics) {
      if (!subscribers[t]) subscribers[t] = new Set();
      subscribers[t].add(wrapper);
    }
    return () => {
      for (const t of topics) {
        subscribers[t]?.delete(wrapper);
        if (subscribers[t]?.size === 0) delete subscribers[t];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.join('|')]);
}

/**
 * Global flash indicator — pulses any time the server pushes a change on any
 * topic. Used by the header "Live" dot.
 */
export function useGlobalFlash(durationMs = 500): boolean {
  const [flash, setFlash] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    ensureSource();
    const listener = () => {
      setFlash(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setFlash(false), durationMs);
    };
    flashListeners.add(listener);
    return () => {
      flashListeners.delete(listener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [durationMs]);

  return flash;
}
