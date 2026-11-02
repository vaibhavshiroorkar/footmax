import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Look } from '../engine/types';

// Finishes a Google sign-in popup on web; does nothing elsewhere.
WebBrowser.maybeCompleteAuthSession();

export interface Profile {
  id: string;
  username: string;
  look: Look | null;
  is_public: boolean;
}

type Status = 'off' | 'loading' | 'guest' | 'signed-in';

// Actions return an error to show, or null when it worked. Some also return
// a notice, such as "check your email".
type Result = { error: string | null; notice?: string };

interface AuthStore {
  // 'off' when this build has no backend configured.
  status: Status;
  session: Session | null;
  profile: Profile | null;
  // True after opening a password-reset link, until a new password is set.
  recovering: boolean;
  init: () => void;
  signUp: (email: string, password: string) => Promise<Result>;
  signIn: (email: string, password: string) => Promise<Result>;
  signInWithGoogle: () => Promise<Result>;
  sendReset: (email: string) => Promise<Result>;
  setPassword: (password: string) => Promise<Result>;
  updateProfile: (patch: Partial<Pick<Profile, 'username' | 'look' | 'is_public'>>) => Promise<Result>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<Result>;
}

const WEB = Platform.OS === 'web';
export const MIN_PASSWORD = 8;

// Where email links and Google send the player back to.
function redirect(path: string): string {
  if (WEB && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return Linking.createURL(path);
}

// Supabase error text is written for developers; this is for players.
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return 'Something went wrong. Try again.';
  const m = (e.message ?? '').toLowerCase();
  if (e.code === '23505' || m.includes('duplicate key')) return 'That username is taken.';
  if (e.code === '23514' || m.includes('violates check constraint')) return 'Usernames are 3 to 20 characters: lowercase letters, numbers and _.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. The link is in your inbox.';
  if (m.includes('already registered')) return 'An account with this email already exists. Sign in instead.';
  if (m.includes('password should be')) return `Passwords need at least ${MIN_PASSWORD} characters.`;
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your internet and try again.';
  return e.message ?? 'Something went wrong. Try again.';
}

const off: Result = { error: 'Accounts are not set up on this version of the game.' };

export const useAuth = create<AuthStore>((set, get) => {
  async function loadProfile(userId: string) {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('id, username, look, is_public').eq('id', userId).maybeSingle();
    if (get().session?.user.id === userId) set({ profile: (data as Profile | null) ?? null });
  }

  return {
    status: supabase ? 'loading' : 'off',
    session: null,
    profile: null,
    recovering: false,
    init: () => {
      if (!supabase || get().status !== 'loading') return;
      supabase.auth.getSession().then(({ data }) => {
        set({ session: data.session, status: data.session ? 'signed-in' : 'guest' });
        if (data.session) loadProfile(data.session.user.id);
      });
      supabase.auth.onAuthStateChange((event, session) => {
        set({ session, status: session ? 'signed-in' : 'guest', ...(session ? {} : { profile: null }) });
        if (event === 'PASSWORD_RECOVERY') set({ recovering: true });
        // Defer: calling Supabase inside this callback can deadlock it.
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) setTimeout(() => loadProfile(session.user.id), 0);
      });
    },
    signUp: async (email, password) => {
      if (!supabase) return off;
      if (password.length < MIN_PASSWORD) return { error: `Passwords need at least ${MIN_PASSWORD} characters.` };
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect('/account') } });
      if (error) return { error: friendlyError(error) };
      // With email confirmation on, there is no session until the link is opened.
      if (!data.session) return { error: null, notice: `We sent a confirmation link to ${email.trim()}. Open it to finish signing up.` };
      return { error: null };
    },
    signIn: async (email, password) => {
      if (!supabase) return off;
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error ? friendlyError(error) : null };
    },
    signInWithGoogle: async () => {
      if (!supabase) return off;
      if (WEB) {
        // The page leaves for Google and comes back signed in.
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect('/account') } });
        return { error: error ? friendlyError(error) : null };
      }
      const redirectTo = makeRedirectUri({ path: 'account' });
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error || !data.url) return { error: friendlyError(error) };
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== 'success') return { error: null, notice: 'Google sign-in was cancelled.' };
      const code = /[?&]code=([^&#]+)/.exec(res.url)?.[1];
      if (!code) return { error: 'Google did not send a sign-in code back. Try again.' };
      const { error: exchange } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
      return { error: exchange ? friendlyError(exchange) : null };
    },
    sendReset: async (email) => {
      if (!supabase) return off;
      if (!email.trim()) return { error: 'Enter your email first.' };
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect('/account/reset') });
      if (error) return { error: friendlyError(error) };
      return { error: null, notice: `If ${email.trim()} has an account, a reset link is on its way.` };
    },
    setPassword: async (password) => {
      if (!supabase) return off;
      if (password.length < MIN_PASSWORD) return { error: `Passwords need at least ${MIN_PASSWORD} characters.` };
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: friendlyError(error) };
      set({ recovering: false });
      return { error: null, notice: 'Password updated.' };
    },
    updateProfile: async (patch) => {
      const { session, profile } = get();
      if (!supabase) return off;
      if (!session || !profile) return { error: 'Sign in first.' };
      const clean = { ...patch, ...(patch.username !== undefined ? { username: patch.username.trim().toLowerCase() } : {}), updated_at: new Date().toISOString() };
      const { error } = await supabase.from('profiles').update(clean).eq('id', session.user.id);
      if (error) return { error: friendlyError(error) };
      set({ profile: { ...profile, ...clean } });
      return { error: null };
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
      set({ session: null, profile: null, status: 'guest', recovering: false });
    },
    deleteAccount: async () => {
      const { session } = get();
      if (!supabase) return off;
      if (!session) return { error: 'Sign in first.' };
      // Save files go through the Storage API; SQL cannot delete them.
      const folder = session.user.id;
      const { data: files } = await supabase.storage.from('saves').list(folder, { limit: 100 });
      if (files?.length) {
        const { error } = await supabase.storage.from('saves').remove(files.map((f) => `${folder}/${f.name}`));
        if (error) return { error: friendlyError(error) };
      }
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return { error: friendlyError(error) };
      await supabase.auth.signOut().catch(() => {});
      set({ session: null, profile: null, status: 'guest' });
      return { error: null, notice: 'Your account and cloud saves are deleted.' };
    },
  };
});
