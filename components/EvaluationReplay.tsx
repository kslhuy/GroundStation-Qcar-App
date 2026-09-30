import React, { useEffect, useMemo, useState } from 'react';
import './EvaluationReplay.css';

type State = [number, number, number, number];
type Trace = { name: string; label: string; role: 'truth' | 'estimate'; states: State[] };
type Metric = { estimator: string; [key: string]: string | number };
type Run = { seed: number; scenario: string; sample_count: number; time_s: number[]; attack: boolean[]; traces: Trace[]; metrics: Metric[] };
type Replay = { format: string; mode: 'open_loop' | 'closed_loop'; source_name: string;
  metadata: { protocol: string; dt: number; checkpoint_sha256?: string; partition?: string }; runs: Run[] };

const colors: Record<string, string> = { truth: '#e2e8f0', ekf: '#fb923c', robust: '#34d399',
  legacy: '#c084fc', analytic_ablation: '#60a5fa', ekf_truth: '#fdba74', robust_truth: '#a7f3d0' };
const color = (name: string) => colors[name] || '#94a3b8';
const label = (name: string) => ({ robust: 'RobustKLNet', ekf: 'EKF', legacy: 'Legacy GRU',
  analytic_ablation: 'Analytical ablation' }[name] || name);

function readReplay(value: unknown): Replay {
  const data = value as Replay;
  if (!data || data.format !== 'qcar_evaluation_replay_v1' || !Array.isArray(data.runs) || !data.runs.length ||
      !['open_loop', 'closed_loop'].includes(data.mode) || !data.metadata || !(data.metadata.dt > 0)) {
    throw new Error('Expected a qcar_evaluation_replay_v1 JSON exported by the workflow.');
  }
  for (const run of data.runs) {
    if (!Array.isArray(run.time_s) || run.time_s.length < 2 || !Array.isArray(run.attack) ||
        run.attack.length !== run.time_s.length || !Array.isArray(run.traces) || !run.traces.length ||
        !Array.isArray(run.metrics) || run.time_s.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= run.time_s[i - 1]))) {
      throw new Error('Invalid replay timeline.');
    }
    for (const trace of run.traces) {
      if (!Array.isArray(trace.states) || trace.states.length !== run.time_s.length ||
          trace.states.some(s => !Array.isArray(s) || s.length !== 4 || !s.every(Number.isFinite))) {
        throw new Error('Invalid replay state array.');
      }
    }
  }
  return data;
}

function findFrame(times: number[], t: number) {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (times[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export default function EvaluationReplay() {
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [runIndex, setRunIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hidden, setHidden] = useState<string[]>(['legacy', 'analytic_ablation']);
  const run = data?.runs[runIndex];
  const end = run?.time_s[run.time_s.length - 1] || 0;
  const frame = run ? findFrame(run.time_s, position) : 0;

  const accept = (value: unknown) => {
    setData(readReplay(value)); setRunIndex(0); setPosition(0); setPlaying(false); setError('');
  };
  useEffect(() => {
    const abort = new AbortController();
    fetch('/evaluation/latest.json', { cache: 'no-store', signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error('No replay has been exported yet.');
        return response.json();
      })
      .then(accept)
      .catch(e => { if (e.name !== 'AbortError') setError('Run robust_workflow.cmd replay, or open an exported replay JSON below.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!playing || !run) return;
    let id = 0, previous = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - previous) / 1000;
      previous = now;
      setPosition(t => Math.min(end, t + elapsed * speed));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, run, end]);
  useEffect(() => { if (position >= end) setPlaying(false); }, [position, end]);

  const visible = useMemo(() => run?.traces.filter(t => !hidden.includes(t.name)) || [], [run, hidden]);
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    visible.forEach(trace => trace.states.forEach(s => {
      minX = Math.min(minX, s[0]); maxX = Math.max(maxX, s[0]);
      minY = Math.min(minY, s[1]); maxY = Math.max(maxY, s[1]);
    }));
    if (!visible.length) return { x: 0, y: 0, scale: 1 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2,
      scale: Math.min(650 / Math.max(1, maxX - minX), 410 / Math.max(1, maxY - minY)) };
  }, [visible]);
  const mapX = (x: number) => 380 + (x - bounds.x) * bounds.scale;
  const mapY = (y: number) => 250 - (y - bounds.y) * bounds.scale;
  const paths = useMemo(() => visible.map(trace => ({ trace,
    points: trace.states.map(s => `${380 + (s[0] - bounds.x) * bounds.scale},${250 - (s[1] - bounds.y) * bounds.scale}`) })), [visible, bounds]);
  const episodes = useMemo(() => {
    if (!run) return [];
    const ranges: { start: number; end: number }[] = [];
    let start: number | null = null;
    run.attack.forEach((active, i) => {
      if (active && start === null) start = run.time_s[i];
      if (!active && start !== null) { ranges.push({ start, end: run.time_s[i] }); start = null; }
    });
    if (start !== null) ranges.push({ start, end });
    return ranges;
  }, [run, end]);
  const chooseRun = (index: number) => { setRunIndex(index); setPosition(0); setPlaying(false); };
  const metricValue = (row: Metric, key: string) => typeof row[key] === 'number' ? (row[key] as number).toFixed(4) : '—';

  return <div className="evaluation-page">
    <header className="evaluation-header">
      <div><p className="evaluation-eyebrow">QCAR GROUND STATION / EVALUATION</p>
        <h1>RobustKLNet · Simulation replay</h1>
        <p>Play back saved benchmark results. Metrics use every original simulation sample.</p></div>
      <a href="/">Live Ground Station ↗</a>
    </header>
    <main>
      <section className="evaluation-toolbar">
        <label>Scenario<select aria-label="Scenario" disabled={!run} value={run?.scenario || ''} onChange={e => {
          const index = data!.runs.findIndex(r => r.scenario === e.target.value && r.seed === run!.seed);
          chooseRun(index < 0 ? data!.runs.findIndex(r => r.scenario === e.target.value) : index);
        }}>{Array.from(new Set(data?.runs.map(r => r.scenario))).map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Seed<select aria-label="Seed" disabled={!run} value={run?.seed || ''} onChange={e => chooseRun(data!.runs.findIndex(r => r.scenario === run!.scenario && r.seed === Number(e.target.value)))}>
          {data?.runs.filter(r => r.scenario === run?.scenario).map(r => <option key={r.seed} value={r.seed}>{r.seed}</option>)}
        </select></label>
        <label className="evaluation-file">Open replay JSON<input aria-label="Open replay JSON" type="file" accept=".json,application/json" onChange={async e => {
          const file = e.target.files?.[0];
          if (file) try { accept(JSON.parse(await file.text())); } catch (err) { setError(String(err)); }
          e.target.value = '';
        }} /></label>
        <span className="evaluation-mode">{data?.mode === 'closed_loop' ? 'CLOSED LOOP · STANLEY + PID' : 'SENSOR REPLAY · SAME INPUTS'}</span>
      </section>
      {loading && <p role="status">Loading replay…</p>}
      {error && <p role="alert" className="evaluation-error">{error}</p>}
      {run && data && <>
        <div className="evaluation-info">
          <span>{data.mode === 'closed_loop' ? 'Each estimator drives its own simulated car. Dashed lines show each car’s true trajectory.' : 'All estimators receive the same attacked sensor stream. White shows the true trajectory.'}</span>
          <span>Source: {data.source_name} · checkpoint {data.metadata.checkpoint_sha256?.slice(0, 12) || 'unspecified'} · {data.metadata.partition || data.metadata.protocol}</span>
        </div>
        <div className="evaluation-grid">
          <section className="evaluation-card">
            <div className="evaluation-card-title"><h2>Vehicle trajectory</h2><span className={run.attack[frame] ? 'evaluation-attack' : 'evaluation-clean'}>{run.attack[frame] ? 'ATTACK ACTIVE' : 'CLEAN / RECOVERY'}</span></div>
            <svg viewBox="0 0 760 500" role="img" aria-label="Animated vehicle trajectories in metres" className="evaluation-map">
              <defs><pattern id="evaluation-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="#1e293b" strokeWidth="1" /></pattern></defs>
              <rect width="760" height="500" fill="#0b1220" /><rect width="760" height="500" fill="url(#evaluation-grid)" />
              {data.mode === 'closed_loop' && <circle cx={mapX(0)} cy={mapY(0)} r={2 * bounds.scale} fill="none" stroke="#64748b" strokeDasharray="3 5" />}
              {paths.map(({ trace, points }) => <g key={trace.name}>
                <polyline points={points.join(' ')} fill="none" stroke={color(trace.name)} strokeWidth="1" opacity="0.18" />
                <polyline points={points.slice(0, frame + 1).join(' ')} fill="none" stroke={color(trace.name)} strokeWidth={trace.role === 'truth' ? 2 : 2.5} strokeDasharray={trace.role === 'truth' ? '6 4' : undefined} />
                <g transform={`translate(${mapX(trace.states[frame][0])} ${mapY(trace.states[frame][1])}) rotate(${-trace.states[frame][2] * 180 / Math.PI})`}>
                  <path d="M 12 0 L -7 -6 L -4 0 L -7 6 Z" fill={color(trace.name)} stroke="#0b1220" strokeWidth="1" />
                </g>
              </g>)}
              <text x="18" y="26" fill="#94a3b8" fontSize="13">x → · y ↑ · equal scale</text>
              <path d={`M 22 467 h ${bounds.scale}`} stroke="#cbd5e1" strokeWidth="2" />
              <text x="22" y="488" fill="#cbd5e1" fontSize="12">1 m</text>
            </svg>
            <div className="evaluation-legend">{run.traces.map(trace => <label key={trace.name} style={{ color: color(trace.name) }}>
              <input type="checkbox" checked={!hidden.includes(trace.name)} onChange={() => setHidden(old => old.includes(trace.name) ? old.filter(n => n !== trace.name) : [...old, trace.name])} />{trace.label}
            </label>)}</div>
          </section>
          <section className="evaluation-card evaluation-scores">
            <h2>Metrics · entire run</h2><p>{run.sample_count.toLocaleString()} original samples · dt = {data.metadata.dt} s</p>
            <div className="evaluation-table-wrap"><table><thead><tr><th>Estimator</th><th>Position<br />(m RMSE)</th><th>Heading<br />(rad RMSE)</th><th>Speed<br />(m/s RMSE)</th></tr></thead>
              <tbody>{run.metrics.map(row => <tr key={row.estimator}><th style={{ color: color(row.estimator) }}>{label(row.estimator)}</th>
                <td>{metricValue(row, 'position_rmse_m')}</td><td>{metricValue(row, 'heading_rmse_rad')}</td><td>{metricValue(row, 'speed_rmse_mps')}</td></tr>)}</tbody></table></div>
            <h3>{data.mode === 'closed_loop' ? 'Controller performance' : 'Attack window & compute time'}</h3>
            <div className="evaluation-table-wrap"><table><thead><tr><th>Estimator</th><th>{data.mode === 'closed_loop' ? 'Path RMSE (m)' : 'Attack pos. RMSE (m)'}</th><th>{data.mode === 'closed_loop' ? 'Speed tracking RMSE (m/s)' : 'Update p95 (ms)'}</th></tr></thead>
              <tbody>{run.metrics.map(row => <tr key={row.estimator}><th style={{ color: color(row.estimator) }}>{label(row.estimator)}</th>
                <td>{metricValue(row, data.mode === 'closed_loop' ? 'tracking_rmse_m' : 'attack_position_rmse_m')}</td>
                <td>{metricValue(row, data.mode === 'closed_loop' ? 'speed_tracking_rmse_mps' : 'runtime_p95_ms')}</td></tr>)}</tbody></table></div>
            <h3>At cursor · t = {run.time_s[frame].toFixed(2)} s</h3>
            <div className="evaluation-live-values">{visible.map(trace => <div key={trace.name}><span style={{ color: color(trace.name) }}>{trace.label}</span><strong>{trace.states[frame][3].toFixed(3)} m/s</strong></div>)}</div>
            <p className="evaluation-note">Animation may skip frames for smooth playback. The saved RMSE and timing values remain unchanged.</p>
          </section>
        </div>
        <section className="evaluation-player">
          <div className="evaluation-player-controls">
            <button onClick={() => { if (position >= end) setPosition(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button>
            <button className="evaluation-secondary" onClick={() => { setPosition(0); setPlaying(false); }}>Reset</button>
            <label>Speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.25, 0.5, 1, 2, 4, 8].map(s => <option key={s} value={s}>{s}×</option>)}</select></label>
            <output>{position.toFixed(2)} / {end.toFixed(2)} s</output>
          </div>
          <div className="evaluation-timeline"><div className="evaluation-attack-bands">{episodes.map((episode, i) => <span key={i} style={{ left: `${100 * episode.start / end}%`, width: `${100 * (episode.end - episode.start) / end}%` }} />)}</div>
            <input aria-label="Simulation time" type="range" min="0" max={end} step="0.001" value={position} onChange={e => { setPlaying(false); setPosition(Number(e.target.value)); }} />
          </div><p>Red bands mark attack intervals. Drag the slider to inspect onset and recovery.</p>
        </section>
      </>}
    </main>
  </div>;
}
