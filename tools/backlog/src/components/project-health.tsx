import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEventSubscribe } from '@/hooks/use-event-stream';
import { ALL_DOMAINS, DOMAINS, inferDomain } from '@/lib/skill-domain';
import { fetchJson } from '@/lib/utils';

interface SkillSummary {
  name: string;
  folder: string;
  description: string;
  metadata: Record<string, string>;
}

function DonutChart({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 58;
  const cx = 72;
  const cy = 72;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={144} height={144} viewBox="0 0 144 144">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={12}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {pct}%
        </span>
        <span className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function DomainBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-muted-foreground w-[88px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[12px] font-semibold tabular-nums w-5 text-right" style={{ color }}>
        {count}
      </span>
    </div>
  );
}

export function ProjectHealth() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  const { groups, coveragePct, topDomain, totalSkills } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of skills) {
      const d = inferDomain(s).key;
      counts[d] = (counts[d] ?? 0) + 1;
    }

    const groups = ALL_DOMAINS.map((d) => ({
      key: d,
      label: DOMAINS[d].label,
      color: DOMAINS[d].color,
      count: counts[d] ?? 0,
    }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);

    const covered = groups.length;
    const coveragePct = Math.round((covered / ALL_DOMAINS.length) * 100);
    const topDomain = groups[0]?.label ?? '—';
    const totalSkills = skills.length;
    const maxCount = groups[0]?.count ?? 1;

    return { groups, coveragePct, topDomain, totalSkills, maxCount };
  }, [skills]);

  const maxCount = groups[0]?.count ?? 1;

  return (
    <div className="card-border-glow rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-primary text-base">✦</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Skill Coverage
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">{totalSkills} skills</span>
      </div>

      <div className="p-4 flex flex-col gap-4 flex-1">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            <div className="flex items-center gap-5 flex-1">
              <DonutChart
                pct={coveragePct}
                color="var(--primary)"
                label={`${groups.length}/${ALL_DOMAINS.length} domains`}
              />
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                {groups.map((g) => (
                  <DomainBar
                    key={g.key}
                    label={g.label}
                    count={g.count}
                    max={maxCount}
                    color={g.color}
                  />
                ))}
                {groups.length === 0 && (
                  <p className="text-[12px] text-muted-foreground italic">No skills installed.</p>
                )}
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 mt-auto flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Top domain: <span className="font-medium text-foreground">{topDomain}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {groups.length < ALL_DOMAINS.length ? (
                  <span className="text-primary font-medium">
                    {ALL_DOMAINS.length - groups.length} domain
                    {ALL_DOMAINS.length - groups.length > 1 ? 's' : ''} missing
                  </span>
                ) : (
                  <span className="text-emerald-500 font-medium">Full coverage</span>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
