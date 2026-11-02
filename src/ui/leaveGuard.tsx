import React, { ReactNode, useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { Button, Card, H2, Row, T } from './kit';
import { colors } from './theme';

// Asks before back, a swipe or browser back throws away unsaved work. The
// screen renders `card` near the top and calls `allow()` before navigating
// away on purpose (after saving).
export function useLeaveGuard(dirty: boolean, text = 'Your changes are not saved yet.'): { card: ReactNode; allow: () => void } {
  const [pending, setPending] = useState<{ repeat: () => void } | null>(null);
  const allow = usePreventRemove(dirty, ({ repeat }) => setPending({ repeat }));
  const card = pending ? (
    <Card glow={colors.gold}>
      <H2>Discard changes?</H2>
      <T muted>{text}</T>
      <Row>
        <Button label="Keep editing" variant="secondary" style={{ flex: 1 }} onPress={() => setPending(null)} />
        <Button
          label="Discard"
          variant="danger"
          style={{ flex: 1 }}
          onPress={() => {
            const go = pending.repeat;
            setPending(null);
            allow();
            go();
          }}
        />
      </Row>
    </Card>
  ) : null;
  return { card, allow };
}
