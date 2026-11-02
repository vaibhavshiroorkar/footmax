import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Both values are public by design: the publishable key only allows what the
// row level security rules in supabase/migrations permit. The official
// project is the default, so a build works without any env setup. Set the
// env vars to point a fork at its own project, or to "off" for guest-only.
const OFFICIAL_URL = 'https://shollcauscnytgrktvwi.supabase.co';
const OFFICIAL_KEY = 'sb_publishable_L5nQ25KoETH0mT1CEaO_Bg_wl8CrkVI';
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const off = envUrl === 'off';
const url = off ? undefined : envUrl || OFFICIAL_URL;
const key = off ? undefined : envKey || OFFICIAL_KEY;

const WEB = Platform.OS === 'web';

// With the env var set to "off" the game runs guest-only, with no backend.
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // The browser keeps the session in localStorage by default.
          storage: WEB ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // On web, Google sign-in and email links come back to the page
          // with a code in the URL that the client exchanges for a session.
          detectSessionInUrl: WEB,
          flowType: 'pkce',
        },
      })
    : null;

export const accountsEnabled = !!supabase;

// Native apps refresh the session only while in the foreground.
if (supabase && !WEB) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
