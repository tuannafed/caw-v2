import { AlertCircle, Boxes, Code2, Database, Globe, Layers, Server } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as simpleIcons from 'simple-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventSubscribe } from '@/hooks/use-event-stream';
import { renderMarkdown } from '@/lib/markdown';
import { fetchJson } from '@/lib/utils';
import type { ProjectOverview, StackItem } from '@/pages/api/project-overview.json';

interface OverviewData {
  overview: ProjectOverview;
  conventionsContent: string;
}

// One simple-icon record: title, brand hex (no '#'), and the SVG path.
type IconRecord = { title: string; hex: string; path: string };

// Index every simple-icon by a normalized title for fuzzy lookup by tech name.
const ICON_BY_TITLE: Record<string, IconRecord> = (() => {
  const map: Record<string, IconRecord> = {};
  for (const value of Object.values(simpleIcons)) {
    const icon = value as Partial<IconRecord>;
    if (icon && typeof icon === 'object' && icon.title && icon.path && icon.hex) {
      map[normalize(icon.title)] = icon as IconRecord;
    }
  }
  return map;
})();

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Tech names in conventions.md don't always match simple-icons titles 1:1.
// Map a stack item's name → the simple-icons title to look up.
const NAME_ALIASES: Record<string, string> = {
  nextjs: 'nextdotjs',
  next: 'nextdotjs',
  socketio: 'socketdotio',
  'socket.io': 'socketdotio',
  postgres: 'postgresql',
  reactquery: 'reactquery',
  tanstackquery: 'reactquery',
  s3: 'amazons3',
  aws: 'amazonwebservices',
  rn: 'react',
  reactnative: 'react',
  nestjs: 'nestjs',
  tailwind: 'tailwindcss',
  tailwindcss: 'tailwindcss',
  radix: 'radixui',
  radixui: 'radixui',
};

function resolveSimpleIcon(name: string): IconRecord | null {
  const key = normalize(name);
  // Try alias first, then the raw normalized name.
  const aliased = NAME_ALIASES[key];
  if (aliased && ICON_BY_TITLE[aliased]) return ICON_BY_TITLE[aliased];
  if (ICON_BY_TITLE[key]) return ICON_BY_TITLE[key];
  // Loose contains-match as a last resort (e.g. "expo router" → "expo").
  for (const [title, icon] of Object.entries(ICON_BY_TITLE)) {
    if (key.length >= 3 && (key.includes(title) || title.includes(key))) return icon;
  }
  return null;
}

// Brand logo for a stack tech. Falls back to a neutral lucide glyph chosen by
// the item's role when no brand icon is found.
function StackIcon({ name, role }: { name: string; role: string }) {
  const icon = resolveSimpleIcon(name);

  if (icon) {
    // simple-icons hex omits the leading '#'; near-black logos need a tinted bg.
    const isDark = ['000000', '010101', '161618', '1c2024', '2d3748'].includes(
      icon.hex.toLowerCase(),
    );
    return (
      <div
        className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
        style={{ backgroundColor: isDark ? '#2a2a2e' : `#${icon.hex}1a` }}
      >
        <svg
          role="img"
          aria-label={icon.title}
          viewBox="0 0 24 24"
          className="w-[18px] h-[18px]"
          fill={isDark ? '#ffffff' : `#${icon.hex}`}
        >
          <path d={icon.path} />
        </svg>
      </div>
    );
  }

  const Fallback = roleFallbackIcon(role);
  return (
    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-muted/60">
      <Fallback className="size-4 text-muted-foreground" />
    </div>
  );
}

function roleFallbackIcon(role: string): typeof Code2 {
  const r = role.toLowerCase();
  if (r.includes('database') || r.includes('cache') || r.includes('orm')) return Database;
  if (r.includes('monorepo') || r.includes('build')) return Boxes;
  if (r.includes('backend') || r.includes('api') || r.includes('real-time')) return Server;
  if (r.includes('web') || r.includes('admin') || r.includes('frontend')) return Globe;
  if (r.includes('mobile') || r.includes('extension') || r.includes('ui')) return Layers;
  return Code2;
}

function StackCard({ item }: { item: StackItem }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-border/70 transition-colors min-w-0">
      <StackIcon name={item.name} role={item.role} />
      <div className="text-center min-w-0 w-full">
        <p className="text-[12px] font-semibold text-foreground truncate">
          {item.name}
          {item.version ? ` ${item.version}` : ''}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{item.role}</p>
      </div>
    </div>
  );
}

// Map archetype → project logo icon
function getProjectLogo(archetype: string): typeof Code2 {
  const a = archetype.toLowerCase();
  if (
    a.includes('nestjs') ||
    a.includes('nest') ||
    a.includes('api') ||
    a.includes('backend') ||
    a.includes('rest')
  )
    return Server;
  if (a.includes('nextjs') || a.includes('next') || a.includes('frontend') || a.includes('web'))
    return Globe;
  if (a.includes('mobile') || a.includes('react-native') || a.includes('expo')) return Layers;
  if (a.includes('database') || a.includes('data')) return Database;
  return Code2;
}

// Tag color cycling
const TAG_COLORS = [
  'border-orange-500/40 text-orange-400',
  'border-blue-500/40 text-blue-400',
  'border-emerald-500/40 text-emerald-400',
  'border-purple-500/40 text-purple-400',
  'border-yellow-500/40 text-yellow-400',
  'border-pink-500/40 text-pink-400',
];

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    Promise.all([
      fetchJson<ProjectOverview>('/api/project-overview.json'),
      fetchJson<{ conventions?: { content?: string } }>('/api/project-files.json'),
    ])
      .then(([overview, files]) => {
        setData({
          overview,
          conventionsContent: files?.conventions?.content ?? '',
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEventSubscribe(['project-files'], load);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm italic py-12 justify-center">
        <AlertCircle className="size-4" />
        <span>Could not load project overview.</span>
      </div>
    );
  }

  const { overview, conventionsContent } = data;

  const ProjectLogo = getProjectLogo(overview.archetype);

  return (
    <div className="space-y-5">
      {/* Hero row */}
      <div className="flex gap-4 items-start">
        <div className="shrink-0 w-20 h-20 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <ProjectLogo className="size-9 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-foreground leading-tight">
            {overview.name}
          </h3>
          {overview.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {overview.description}
            </p>
          )}
          {overview.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {overview.tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border bg-transparent ${TAG_COLORS[i % TAG_COLORS.length]}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Team', value: overview.team },
          { label: 'Archetype', value: overview.archetype || '—' },
          { label: 'Generated', value: overview.generatedAt || '—' },
          { label: 'Last Updated', value: overview.lastUpdated || '—' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl bg-muted/20 border border-border/60 border-l-2 border-l-primary/60 px-4 py-3 space-y-1.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {label}
            </p>
            <p className="text-[14px] font-semibold text-foreground leading-snug wrap-break-word">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Stack */}
      {overview.stack.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Stack Summary
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {overview.stack.map((item) => (
              <StackCard key={item.name} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Conventions full content — strip the auto-generated header block */}
      {conventionsContent.trim() &&
        (() => {
          // Drop everything before the first ## heading (the generated preamble)
          const firstSection = conventionsContent.indexOf('\n## ');
          const body =
            firstSection !== -1 ? conventionsContent.slice(firstSection + 1) : conventionsContent;
          return (
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pt-2">
                Conventions
              </p>
              <div
                className="prose-task max-w-none"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
              />
            </div>
          );
        })()}
    </div>
  );
}
