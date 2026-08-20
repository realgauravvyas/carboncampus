/**
 * App state.
 *
 * One context holds the profile, the logs and the challenges; everything else
 * (totals, recommendations, badges, league position) is derived on the fly from
 * the shared engine, so there is never a stale copy of a number to reconcile.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode
} from 'react';
import {
  badges as computeBadges, campusCounters, cohort, computeRange, peerAverage, percentile,
  recommend, streakFrom, todayISO, type Badge, type Challenge, type DayLog, type Profile,
  type RangeResult, type Suggestion, demoHistory, type Persona
} from '@carboncampus/shared';
import * as db from './db';
import * as api from './api';

interface Store {
  ready: boolean;
  profile: Profile | null;
  logs: DayLog[];
  challenges: Challenge[];
  online: boolean;
  mode: api.Mode;
  serverUp: boolean;

  // derived
  range: RangeResult;
  last30: RangeResult;
  streak: number;
  greenPoints: number;
  suggestions: Suggestion[];
  badges: Badge[];
  campusAvg: number;
  peerAvg: number;
  rank: number;
  counters: ReturnType<typeof campusCounters>;
  isDemoData: boolean;

  // actions
  saveProfile: (p: Profile) => Promise<void>;
  saveDay: (log: DayLog) => Promise<void>;
  removeDay: (date: string) => Promise<void>;
  acceptChallenge: (s: Suggestion) => Promise<void>;
  completeChallenge: (id: string) => Promise<void>;
  loadDemo: (persona: Persona, days?: number) => Promise<void>;
  clearDemo: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [serverUp, setServerUp] = useState(false);
  const [isDemoData, setIsDemoData] = useState(false);

  /* ---------------------------- boot ---------------------------- */

  useEffect(() => {
    (async () => {
      const [p, l, c, demoFlag] = await Promise.all([
        db.getProfile(), db.allLogs(), db.allChallenges(), db.getMeta<boolean>('demoData')
      ]);
      setProfile(p ?? null);
      setLogs(l);
      setChallenges(c);
      setIsDemoData(Boolean(demoFlag));
      setReady(true);
      if (api.apiConfigured()) {
        const up = await api.ping();
        setServerUp(up);
        if (up) await api.flushOutbox();
      }
    })();
  }, []);

  useEffect(() => {
    const on = () => { setOnline(true); void api.flushOutbox().then(() => api.ping().then(setServerUp)); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  /* --------------------------- actions -------------------------- */

  const saveProfile = useCallback(async (p: Profile) => {
    await db.setProfile(p);
    setProfile(p);
    void api.syncProfile(p);
  }, []);

  const saveDay = useCallback(async (log: DayLog) => {
    await db.putLog(log);
    setLogs(prev => {
      const next = prev.filter(l => l.date !== log.date).concat(log);
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
    void api.syncLog(log);
  }, []);

  const removeDay = useCallback(async (date: string) => {
    await db.deleteLog(date);
    setLogs(prev => prev.filter(l => l.date !== date));
  }, []);

  const acceptChallenge = useCallback(async (s: Suggestion) => {
    const now = new Date();
    const ends = new Date(now);
    ends.setDate(ends.getDate() + 7);
    const c: Challenge = {
      id: `${s.id}-${now.getTime()}`,
      suggestionId: s.id,
      title: s.title,
      icon: s.icon,
      saving: s.saving,
      points: s.points,
      startedAt: now.toISOString(),
      endsAt: ends.toISOString(),
      done: false
    };
    await db.putChallenge(c);
    setChallenges(prev => [...prev, c]);
    void api.syncChallenge(c);
  }, []);

  const completeChallenge = useCallback(async (id: string) => {
    const found = challenges.find(c => c.id === id);
    if (!found) return;
    const updated: Challenge = { ...found, done: true, completedAt: new Date().toISOString() };
    await db.putChallenge(updated);
    setChallenges(prev => prev.map(c => (c.id === id ? updated : c)));
    void api.syncChallenge(updated);
  }, [challenges]);

  const loadDemo = useCallback(async (persona: Persona, days = 30) => {
    const history = demoHistory(days, persona);
    await db.putLogs(history);
    await db.setMeta('demoData', true);
    setLogs(await db.allLogs());
    setIsDemoData(true);
  }, []);

  const clearDemo = useCallback(async () => {
    await db.clearLogs();
    await db.setMeta('demoData', false);
    setLogs([]);
    setIsDemoData(false);
  }, []);

  const resetAll = useCallback(async () => {
    await db.wipe();
    setProfile(null);
    setLogs([]);
    setChallenges([]);
    setIsDemoData(false);
  }, []);

  /* -------------------------- derived --------------------------- */

  const range = useMemo(() => computeRange(logs), [logs]);

  const last30 = useMemo(() => {
    const cutoff = todayISO(-30);
    return computeRange(logs.filter(l => l.date >= cutoff));
  }, [logs]);

  const streak = useMemo(() => streakFrom(logs.map(l => l.date)), [logs]);

  const greenPoints = useMemo(
    () => challenges.filter(c => c.done).reduce((a, c) => a + c.points, 0) + logs.length * 5,
    [challenges, logs.length]
  );

  const suggestions = useMemo(() => {
    const active = challenges.filter(c => !c.done).map(c => c.suggestionId);
    const recent = logs.slice(-21);
    return recommend(recent, { limit: 3, exclude: active });
  }, [logs, challenges]);

  const campusAvg = useMemo(() => cohort().campusAvgDay, []);

  const peerAvg = useMemo(
    () => (profile ? peerAverage(profile.hostel, profile.year) : campusAvg),
    [profile, campusAvg]
  );

  const rank = useMemo(
    () => (last30.perDay > 0 ? percentile(last30.perDay) : 0),
    [last30.perDay]
  );

  const badges = useMemo(() => computeBadges({
    logCount: logs.length,
    streak,
    challengesDone: challenges.filter(c => c.done).length,
    perDay: last30.perDay,
    campusAvg,
    greenPoints
  }), [logs.length, streak, challenges, last30.perDay, campusAvg, greenPoints]);

  const counters = useMemo(() => campusCounters(), []);

  const value: Store = {
    ready, profile, logs, challenges, online, mode: api.configuredMode, serverUp,
    range, last30, streak, greenPoints, suggestions, badges,
    campusAvg, peerAvg, rank, counters, isDemoData,
    saveProfile, saveDay, removeDay, acceptChallenge, completeChallenge,
    loadDemo, clearDemo, resetAll
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
