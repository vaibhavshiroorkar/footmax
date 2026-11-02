import React, { ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import { Card, H2, Screen, T } from './kit';
import { colors, fonts } from './theme';

export const ISSUES_URL = 'https://github.com/vaibhavshiroorkar/footmax/issues';
export const UPDATED = '2 November 2026';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen title={title}>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>Last updated {UPDATED}</Text>
      {children}
      <Card>
        <H2>Questions</H2>
        <T muted>
          Open an issue at{' '}
          <Text style={{ color: colors.accent }} onPress={() => Linking.openURL(ISSUES_URL)}>
            github.com/vaibhavshiroorkar/footmax
          </Text>
          .
        </T>
      </Card>
    </Screen>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <H2>{title}</H2>
      <View style={{ gap: 8 }}>{children}</View>
    </Card>
  );
}

export function Para({ children }: { children: ReactNode }) {
  return <T muted>{children}</T>;
}
