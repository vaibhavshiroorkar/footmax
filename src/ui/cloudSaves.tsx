import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../state/auth';
import { useStore } from '../state/store';
import { dismissGuestSlots, pullAll, uploadGuestSlots, useSync } from '../state/sync';
import { SlotMeta, isDirty } from '../state/slots';
import { Button, Card, H2, Icon, IconName, Row, T } from './kit';
import { colors, fonts } from './theme';

export type CloudStatus = { icon: IconName; color: string; label: string };

// What the cloud icon on a save row says.
export function cloudStatus(m: SlotMeta, user: string | null, offline: boolean): CloudStatus | null {
  if (!m.owner || m.owner !== user) return null;
  if (m.conflict) return { icon: 'git-compare-outline', color: colors.gold, label: 'Changed on two devices' };
  if (m.cloudOnly) return { icon: 'cloud-download-outline', color: colors.blue, label: 'In the cloud' };
  if (m.remoteRev && m.remoteRev > (m.cloudRev ?? 0)) return { icon: 'cloud-download-outline', color: colors.blue, label: 'Newer copy in the cloud' };
  if (isDirty(m) || !m.cloudRev) return offline ? { icon: 'cloud-offline-outline', color: colors.muted, label: 'Waiting for connection' } : { icon: 'cloud-upload-outline', color: colors.muted, label: 'Syncing soon' };
  return { icon: 'cloud-done-outline', color: colors.accent, label: 'Synced' };
}

function ago(t: number | null): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}

// Offer to move this device's guest saves into the account.
export function GuestUploadCard() {
  const guestSlots = useSync((s) => s.guestSlots);
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  if (!guestSlots.length) return null;
  return (
    <Card glow={colors.accent}>
      <Row gap={10}>
        <Icon name="cloud-upload-outline" size={20} color={colors.accent} />
        <H2>Back up your saves?</H2>
      </Row>
      <T muted style={{ fontSize: 13 }}>
        {guestSlots.length === 1 ? 'One save on this device is not in your account yet.' : `${guestSlots.length} saves on this device are not in your account yet.`} Add them to sync them to your other devices.
      </T>
      <Row>
        <Button label="Not now" small variant="ghost" style={{ flex: 1 }} onPress={dismissGuestSlots} />
        <Button
          label={busy ? 'Uploading...' : 'Add to account'}
          small
          icon="cloud-upload"
          style={{ flex: 2 }}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            const err = await uploadGuestSlots(guestSlots);
            setBusy(false);
            showToast(err ?? 'Saves added to your account.');
          }}
        />
      </Row>
    </Card>
  );
}

export function CloudSavesCard() {
  const user = useAuth((s) => s.session?.user.id ?? null);
  const slots = useStore((s) => s.slots);
  const { busy, offline, error, lastSync } = useSync();
  const mine = slots.filter((s) => s.owner && s.owner === user);
  const waiting = mine.filter((m) => isDirty(m) || !m.cloudRev).length;
  const conflicts = mine.filter((m) => m.conflict).length;
  return (
    <>
      <GuestUploadCard />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            <Icon name={offline ? 'cloud-offline-outline' : 'cloud-done-outline'} size={20} color={offline ? colors.muted : colors.accent} />
            <H2>Cloud saves</H2>
          </Row>
          {busy && <ActivityIndicator color={colors.accent} size="small" />}
        </Row>
        <T muted style={{ fontSize: 13 }}>
          {mine.length} of 6 saves in your account. Saves sync a few seconds after you play and when you leave the app.
        </T>
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }}>Last synced: {ago(lastSync)}</Text>
          {offline && <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.gold }}>Offline. Changes upload when you reconnect.</Text>}
          {waiting > 0 && !offline && <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted }}>{waiting} waiting to upload.</Text>}
          {conflicts > 0 && <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.gold }}>{conflicts} changed on two devices. Choose which copy to keep on the title screen.</Text>}
          {error && <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.red }}>{error}</Text>}
        </View>
        <Button label="Sync now" icon="sync" small variant="secondary" disabled={busy} onPress={() => pullAll()} />
      </Card>
    </>
  );
}
