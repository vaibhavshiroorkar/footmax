import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Both values are public by design: the publishable key only allows what the
// row level security rules in supabase/migrations permit.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const WEB = Platform.OS === 'web';

// Without the two env vars the game runs guest-only, so forks and local
// builds work with no backend.
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
