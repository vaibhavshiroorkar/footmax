import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BigShouldersDisplay_600SemiBold, BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from '@expo-google-fonts/rubik';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../state/store';
import { Toast } from '../ui/kit';
import { Celebration } from '../ui/celebration';
import { ScreenError } from '../ui/screenError';
import { useAuth } from '../state/auth';
import { startSync } from '../state/sync';
import { useSettings } from '../state/settings';
import { colors, fonts, gradients } from '../ui/theme';

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const toast = useStore((s) => s.toast);
  const showToast = useStore((s) => s.showToast);
  const celebration = useStore((s) => s.celebration);
  const celebrate = useStore((s) => s.celebrate);
  const [fontsLoaded] = useFonts({
    BigShouldersDisplay_600SemiBold,
    BigShouldersDisplay_700Bold,
    BigShouldersDisplay_800ExtraBold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  useEffect(() => {
    // Accounts and sync start after the local saves are loaded, so the first
    // cloud pull merges into the real slot list.
    useSettings.getState().load();
    init().then(() => {
      useAuth.getState().init();
      startSync();
    });
    // Web: paint the page behind the app so overscroll is not white.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = colors.bg;
      document.documentElement.style.backgroundColor = colors.bg;
    }
  }, [init]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => showToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast, showToast]);

  const loaded = ready && fontsLoaded;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {loaded ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right' }} unstable_screenErrorBoundary={ScreenError} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <LinearGradient colors={gradients.sky as unknown as [string, string]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Text style={{ color: colors.text, fontSize: 48, fontWeight: '800', letterSpacing: 2, fontFamily: fontsLoaded ? fonts.display : undefined }}>
              FOOT<Text style={{ color: colors.accent }}>MAX</Text>
            </Text>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        )}
        <Toast text={toast?.text ?? null} href={toast?.href} onClose={() => showToast(null)} />
        <Celebration data={celebration} onClose={() => celebrate(null)} />
      </View>
    </SafeAreaProvider>
  );
}
