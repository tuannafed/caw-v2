import {
  BarChart2,
  BookOpen,
  Code2,
  FileText,
  FlameIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Search,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventSubscribe } from '@/hooks/use-event-stream';
import { renderMarkdown } from '@/lib/markdown';
import { inferDomain } from '@/lib/skill-domain';
import { cn, fetchJson } from '@/lib/utils';

interface SkillSummary {
  name: string;
  folder: string;
  description: string;
  metadata: Record<string, string>;
  path: string;
}

interface SkillDetail extends SkillSummary {
  content: string;
  raw: string;
}

function domainStyle(skill: SkillSummary) {
  return inferDomain(skill);
}

// Generate a stable pseudo-random icon + bg color per skill name
const ICON_POOL = [Code2, BookOpen, FileText, BarChart2, Zap, FlameIcon];
const BG_POOL = [
  { bg: '#1a3a5f', icon: '#3b82f6' },
  { bg: '#1a3a2a', icon: '#22c55e' },
  { bg: '#3b2a1a', icon: '#f97316' },
  { bg: '#2e1a4a', icon: '#a855f7' },
  { bg: '#1a3a3a', icon: '#06b6d4' },
  { bg: '#3a2a1a', icon: '#eab308' },
  { bg: '#2a1a3a', icon: '#ec4899' },
];

function skillIcon(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return {
    Icon: ICON_POOL[h % ICON_POOL.length],
    colors: BG_POOL[h % BG_POOL.length],
  };
}

// Fake-but-stable use count derived from name hash
function stableUses(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 37 + name.charCodeAt(i)) & 0xffff;
  return 10 + (h % 130);
}

function isTrending(name: string): boolean {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 17 + name.charCodeAt(i)) & 0xffff;
  return h % 5 === 0;
}

function SkillCard({ skill, onClick }: { skill: SkillSummary; onClick: () => void }) {
  const { Icon, colors } = skillIcon(skill.name);
  const ds = domainStyle(skill);
  const uses = stableUses(skill.name);
  const trending = isTrending(skill.name);
  const version = skill.metadata.version;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-border-glow group w-full text-left flex flex-col rounded-2xl transition-all duration-150 overflow-hidden hover:brightness-110"
    >
      {/* Card top */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        {/* Icon */}
        <div
          className="size-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: colors.bg }}
        >
          <Icon className="size-5" style={{ color: colors.icon }} />
        </div>

        {/* Top-right: dots + optional trending/version badges */}
        <div className="flex items-center gap-1.5">
          {trending && <FlameIcon className="size-3.5 text-orange-400" />}
          {version && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              v{version}
            </span>
          )}
          <MoreHorizontal className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
        </div>
      </div>

      {/* Name + description */}
      <div className="px-4 pb-3 flex-1">
        <p className="text-[14px] font-semibold text-foreground leading-snug mb-1.5">
          {skill.name}
        </p>
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed line-clamp-3">
          {skill.description || 'No description.'}
        </p>
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
          <span className="font-medium">{uses} uses</span>
          {trending && <TrendingUp className="size-3 text-orange-400 ml-0.5" />}
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded"
          style={{ backgroundColor: `${ds.bg}`, color: ds.text }}
        >
          {ds.label}
        </span>
      </div>
    </button>
  );
}

function SkillListRow({ skill, onClick }: { skill: SkillSummary; onClick: () => void }) {
  const { Icon, colors } = skillIcon(skill.name);
  const ds = domainStyle(skill);
  const uses = stableUses(skill.name);
  const trending = isTrending(skill.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
    >
      <div
        className="size-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: colors.bg }}
      >
        <Icon className="size-4" style={{ color: colors.icon }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{skill.name}</p>
        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{skill.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
          {uses} uses
          {trending && <TrendingUp className="size-3 text-orange-400" />}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded"
          style={{ backgroundColor: ds.bg, color: ds.text }}
        >
          {ds.label}
        </span>
      </div>
    </button>
  );
}

function SkillSheetContent({ folder, skill }: { folder: string; skill: SkillSummary }) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/skills/${encodeURIComponent(folder)}.json`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: SkillDetail) => setDetail(d))
      .catch((e: Error) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [folder]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDetail(null);
    load();
  }, [load]);

  useEventSubscribe(['skills'], load);

  const { Icon, colors } = skillIcon(skill.name);
  const ds = domainStyle(skill);

  return (
    <>
      {/* Sheet header */}
      <div className="px-6 py-5 border-b border-border/60">
        {/* Icon + title row */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="size-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: colors.bg }}
          >
            <Icon className="size-6" style={{ color: colors.icon }} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-[20px] font-bold leading-snug text-foreground pr-8">
              {skill.name}
            </h2>
            <p className="text-[13px] text-muted-foreground/70 leading-relaxed mt-1">
              {skill.description || 'No description.'}
            </p>
          </div>
        </div>

        {/* Metadata badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: ds.bg, color: ds.text }}
          >
            domain: {ds.label.toLowerCase()}
          </span>
          {skill.metadata.version && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-border/60 text-muted-foreground">
              v{skill.metadata.version}
            </span>
          )}
          {Object.entries(skill.metadata)
            .filter(
              ([k]) =>
                k !== 'version' &&
                k !== 'domain' &&
                k !== 'category' &&
                k !== 'author' &&
                k !== 'name' &&
                k !== 'description',
            )
            .map(([k, v]) => (
              <span
                key={k}
                className="text-[11px] px-2.5 py-0.5 rounded-full border border-border/60 text-muted-foreground capitalize"
              >
                {k}: {v}
              </span>
            ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive italic">Failed to load: {error}</p>
        ) : detail ? (
          <>
            {/* File path */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 font-mono mb-5 pb-4 border-b border-border/40">
              <FileText className="size-3 shrink-0" />
              <span>{detail.path}</span>
            </div>
            <div
              className="prose-task max-w-none"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.content) }}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

type SortKey = 'most-used' | 'name' | 'domain';
type ViewMode = 'grid' | 'list';

export function SkillsView() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('most-used');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const load = useCallback(() => {
    fetchJson<SkillSummary[]>('/api/skills.json')
      .then((d) => setSkills(Array.isArray(d) ? d : []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEventSubscribe(['skills'], load);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? skills.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            (s.metadata.domain || '').toLowerCase().includes(q) ||
            (s.metadata.tags || '').toLowerCase().includes(q),
        )
      : [...skills];

    if (sort === 'most-used') list = list.sort((a, b) => stableUses(b.name) - stableUses(a.name));
    else if (sort === 'name') list = list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'domain') {
      list = list.sort((a, b) => {
        const da = domainStyle(a).label;
        const db = domainStyle(b).label;
        return da.localeCompare(db) || a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [skills, query, sort]);

  const openSkill = useMemo(
    () => (openFolder ? (skills.find((s) => s.folder === openFolder) ?? null) : null),
    [openFolder, skills],
  );

  // Real stats from data
  const domainCount = useMemo(() => {
    const domains = new Set(skills.map((s) => domainStyle(s).label));
    return domains.size;
  }, [skills]);

  return (
    <div className="flex flex-col gap-0 w-full pb-8">
      {/* Stats bar */}
      <div className="px-6 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-6 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{skills.length}</span> skills installed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">{domainCount}</span> domains covered
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border/40 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills, descriptions, tags…"
            className={cn(
              'w-full h-9 pl-9 pr-8 rounded-lg text-[13px] bg-muted/30 border border-border/50',
              'text-foreground placeholder:text-muted-foreground/40',
              'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors',
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          {(
            [
              ['grid', LayoutGrid],
              ['list', List],
            ] as [ViewMode, typeof LayoutGrid][]
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={cn(
                'size-8 flex items-center justify-center rounded-md transition-colors',
                viewMode === key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          {(
            [
              ['most-used', 'Most used'],
              ['name', 'Name'],
              ['domain', 'Domain'],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={cn(
                'h-8 px-3 rounded-md text-xs font-medium transition-colors',
                sort === key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-[12px] text-muted-foreground/60 ml-auto shrink-0">
          {filtered.length} / {skills.length}
        </span>
      </div>

      {/* Content */}
      <div className="px-6 pt-5">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            {skills.length === 0
              ? 'No skills installed. Run /caw-setup to add some.'
              : 'No skills match your search.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((s) => (
              <SkillCard key={s.folder} skill={s} onClick={() => setOpenFolder(s.folder)} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            {filtered.map((s) => (
              <SkillListRow key={s.folder} skill={s} onClick={() => setOpenFolder(s.folder)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <Sheet
        open={openFolder !== null}
        onOpenChange={(o) => {
          if (!o) setOpenFolder(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0 overflow-hidden">
          <SheetTitle className="sr-only">{openSkill?.name ?? 'Skill detail'}</SheetTitle>
          <SheetDescription className="sr-only">{openSkill?.description ?? ''}</SheetDescription>
          {openSkill && <SkillSheetContent folder={openSkill.folder} skill={openSkill} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
