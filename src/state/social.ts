import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabase';
import type { Look } from '../engine/types';

export type BoardMode = 'career' | 'manager';
export type BoardMetric = 'peak_ovr' | 'goals' | 'ballon_dors' | 'trophies' | 'league_titles';

export interface BoardRow {
  user_id: string;
  slot_id: string;
  mode: BoardMode;
  name: string;
  club: string | null;
  look: Look | null;
  peak_ovr: number | null;
  apps: number;
  goals: number;
  assists: number;
  seasons: number;
  ballon_dors: number;
  trophies: number;
  league_titles: number;
  retired: boolean;
  profiles: { username: string } | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  look: Look | null;
  created_at: string;
}

export const METRICS: Record<BoardMode, { key: BoardMetric; label: string }[]> = {
  career: [
    { key: 'peak_ovr', label: 'Peak rating' },
    { key: 'goals', label: 'Goals' },
    { key: 'ballon_dors', label: "Ballon d'Or" },
    { key: 'trophies', label: 'Trophies' },
  ],
  manager: [
    { key: 'trophies', label: 'Trophies' },
    { key: 'league_titles', label: 'League titles' },
  ],
};

const COLUMNS = 'user_id, slot_id, mode, name, club, look, peak_ovr, apps, goals, assists, seasons, ballon_dors, trophies, league_titles, retired, profiles!inner(username)';

export async function fetchBoard(mode: BoardMode, metric: BoardMetric, limit = 50): Promise<{ rows: BoardRow[]; error: string | null }> {
  if (!supabase) return { rows: [], error: 'Leaderboards are not available on this version of the game.' };
  const { data, error } = await supabase
    .from('leaderboard')
    .select(COLUMNS)
    .eq('mode', mode)
    .gt(metric, 0)
    .order(metric, { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(limit);
  return { rows: (data as unknown as BoardRow[]) ?? [], error: error ? 'Could not load the leaderboard. Check your connection.' : null };
}

export async function fetchMyRows(userId: string, mode: BoardMode): Promise<BoardRow[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('leaderboard').select(COLUMNS).eq('user_id', userId).eq('mode', mode);
  return (data as unknown as BoardRow[]) ?? [];
}

export async function fetchProfile(username: string): Promise<{ profile: PublicProfile | null; rows: BoardRow[]; error: string | null }> {
  if (!supabase) return { profile: null, rows: [], error: 'Profiles are not available on this version of the game.' };
  const { data, error } = await supabase.from('profiles').select('id, username, look, created_at').eq('username', username.toLowerCase()).maybeSingle();
  if (error) return { profile: null, rows: [], error: 'Could not load this profile. Check your connection.' };
  if (!data) return { profile: null, rows: [], error: null };
  const { data: rows } = await supabase.from('leaderboard').select(COLUMNS).eq('user_id', data.id).order('updated_at', { ascending: false });
  return { profile: data as PublicProfile, rows: (rows as unknown as BoardRow[]) ?? [], error: null };
}

// The web address of a profile, for sharing from web and from the apps.
export function profileUrl(username: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://footmax.vercel.app';
  return `${origin}/u/${username}`;
}

export async function shareProfile(username: string): Promise<string> {
  const url = profileUrl(username);
  if (Platform.OS !== 'web') {
    await Share.share({ message: `My FootMax careers: ${url}` });
    return '';
  }
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { url: string; title: string }) => Promise<void> }) : null;
  if (nav?.share) {
    await nav.share({ url, title: 'My FootMax careers' }).catch(() => {});
    return '';
  }
  await Clipboard.setStringAsync(url);
  return 'Profile link copied.';
}
