import os from 'node:os';
import type { APIRoute } from 'astro';
import { IS_STATIC } from '@/lib/deploy-target';

export const prerender = IS_STATIC;

export const GET: APIRoute = async () => {
  const loadAvg = os.loadavg()[0]; // 1-min load average
  const cpuCount = os.cpus().length;
  const loadPct = Math.min(100, Math.round((loadAvg / cpuCount) * 100));

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const uptimeSec = Math.floor(os.uptime());

  const payload = {
    load: { pct: loadPct, raw: loadAvg, cpus: cpuCount },
    memory: {
      usedBytes: usedMem,
      totalBytes: totalMem,
      usedGB: Math.round((usedMem / 1e9) * 10) / 10,
      totalGB: Math.round((totalMem / 1e9) * 10) / 10,
      pct: Math.round((usedMem / totalMem) * 100),
    },
    uptimeSec,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
