import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { PRESETS } from '../data/presets';
import { WORLD_BY_ID } from '../data/worlds';
import { BREAK_TYPES, WORK_TYPES } from '../domain/world';
import { NavGrid } from '../engine/nav';
import { WorldSession } from '../engine/session';
import type { AgentLook } from '../engine/worldSim';

const look = (i: number): AgentLook => ({
  name: `Agent ${i}`,
  role: 'Tester',
  profile: PRESETS[i % PRESETS.length].profile,
  outfitId: 'universal.tee',
  signature: '#e2553b',
});

function session(n: number, worldId = 'office') {
  const bus = new EventBus();
  const looks = new Map(Array.from({ length: n }, (_, i) => [`a${i}`, look(i)]));
  const s = new WorldSession(WORLD_BY_ID[worldId], bus, looks, 42);
  return { s, bus };
}

const run = (s: WorldSession, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) s.update(0.1);
};

describe('pathfinding', () => {
  it('routes around obstacles and returns null when walled in', () => {
    const g = new NavGrid(5, 5);
    for (let y = 0; y < 4; y++) g.block(2, y);
    const p = g.findPath(0, 0, 4, 0)!;
    expect(p).not.toBeNull();
    expect(p.at(-1)).toEqual({ x: 4, y: 0 });
    expect(p.every((t) => g.walkable(t.x, t.y))).toBe(true);
    expect(p.some((t) => t.y === 4)).toBe(true); // had to go around the wall
    g.block(2, 4);
    expect(g.findPath(0, 0, 4, 0)).toBeNull();
  });

  it('can end on a blocked goal (seat) but never passes through one', () => {
    const g = new NavGrid(3, 1);
    g.block(1, 0);
    expect(g.findPath(0, 0, 1, 0)).toEqual([{ x: 1, y: 0 }]);
    expect(g.findPath(0, 0, 2, 0)).toBeNull();
  });
});

describe('simulation state transitions', () => {
  it('spawns agents idle, then START WORK walks them to distinct workstations', () => {
    const { s } = session(4);
    run(s, 4);
    expect(s.sim.agents.every((a) => a.state !== 'working')).toBe(true);
    s.dispatch({ type: 'startWork' });
    expect(s.sim.agents.some((a) => a.state === 'walking')).toBe(true);
    run(s, 12);
    const states = s.sim.agents.map((a) => a.state);
    expect(states.every((st) => st === 'working' || st === 'waiting')).toBe(true);
    const stations = s.sim.agents.map((a) => a.stationId);
    expect(new Set(stations).size).toBe(stations.length);
    for (const a of s.sim.agents) {
      const p = s.sim.point(a.stationId)!;
      expect(WORK_TYPES).toContain(p.type);
      expect(Math.hypot(a.x - p.x, a.y - p.y)).toBeLessThan(0.6);
    }
  });

  it('BREAK sends everyone to break points, RESUME brings them back', () => {
    const { s } = session(3);
    run(s, 3);
    s.dispatch({ type: 'startWork' });
    run(s, 12);
    const desks = new Map(s.sim.agents.map((a) => [a.id, a.stationId]));
    s.dispatch({ type: 'break' });
    run(s, 14);
    for (const a of s.sim.agents) {
      expect(['on_break', 'interacting']).toContain(a.state);
      expect(s.runtime.status(a.id)).toBe('break');
    }
    const atBreak = s.sim.agents.filter((a) => a.at && BREAK_TYPES.includes(s.sim.point(a.at)!.type));
    expect(atBreak.length).toBeGreaterThan(0);
    s.dispatch({ type: 'resume' });
    run(s, 14);
    for (const a of s.sim.agents) {
      expect(['working', 'waiting']).toContain(a.state);
      expect(a.stationId).toBe(desks.get(a.id)); // keeps the reserved desk
    }
  });

  it('PAUSE freezes agents in place and halts task progress; RESET returns to idle', () => {
    const { s } = session(2);
    run(s, 3);
    s.dispatch({ type: 'startWork' });
    run(s, 12);
    s.dispatch({ type: 'pause' });
    const before = s.sim.agents.map((a) => ({ x: a.x, y: a.y, p: s.runtime.task(a.id)?.progress ?? 0 }));
    run(s, 5);
    s.sim.agents.forEach((a, i) => {
      expect(a.state).toBe('paused');
      expect(a.x).toBeCloseTo(before[i].x, 5);
      expect(s.runtime.task(a.id)?.progress ?? 0).toBeCloseTo(before[i].p, 5);
    });
    s.dispatch({ type: 'reset' });
    expect(s.sim.agents.every((a) => a.runtime === 'idle' && a.state === 'idle')).toBe(true);
    expect(s.sim.agents.every((a) => s.runtime.status(a.id) === 'idle')).toBe(true);
  });

  it('agents beyond the station count WAIT instead of stacking', () => {
    const { s } = session(11); // office has 8 workstations
    run(s, 8);
    s.dispatch({ type: 'startWork' });
    run(s, 15);
    const waiting = s.sim.agents.filter((a) => a.state === 'waiting' && a.waitingFor === 'station');
    expect(waiting.length).toBeGreaterThanOrEqual(3);
    const reserved = s.sim.agents.map((a) => a.stationId).filter(Boolean);
    expect(new Set(reserved).size).toBe(reserved.length);
  });

  it('publishes runtime and world events on the bus', () => {
    const { s, bus } = session(1);
    run(s, 3);
    s.dispatch({ type: 'startWork' });
    run(s, 10);
    const types = new Set(bus.log.map((e) => e.type));
    for (const t of ['command.issued', 'simulation.started', 'agent.work.started', 'agent.walk.started', 'agent.walk.completed', 'agent.state.changed', 'interaction.started'])
      expect(types, t).toContain(t);
  });

  it('forceState error and delegation work through the runtime', () => {
    const { s } = session(2);
    run(s, 3);
    s.dispatch({ type: 'forceState', state: 'error', targets: ['a0'] });
    expect(s.sim.get('a0')!.state).toBe('error');
    s.dispatch({ type: 'delegate', targets: ['a0'], to: 'a1', task: 'Write the brief' });
    run(s, 12);
    expect(s.runtime.task('a1')?.title).toBe('Write the brief');
    expect(s.runtime.task('a1')?.from).toBe('a0');
  });

  it('is deterministic for a given seed', () => {
    const a = session(3).s;
    const b = session(3).s;
    for (const s of [a, b]) {
      run(s, 3);
      s.dispatch({ type: 'randomize' });
      run(s, 6);
    }
    expect(a.sim.agents.map((x) => [x.state, x.x.toFixed(3), x.y.toFixed(3)])).toEqual(b.sim.agents.map((x) => [x.state, x.x.toFixed(3), x.y.toFixed(3)]));
  });
});
