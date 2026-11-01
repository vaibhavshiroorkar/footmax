import React from 'react';
import { Redirect } from 'expo-router';
import { useGame } from '../../state/store';
import { Screen } from '../../ui/kit';
import { LineupEditor } from '../../ui/teamEditors';
import { managerClub } from '../../engine/manager';

export default function Squad() {
  const game = useGame();
  const club = game ? managerClub(game) : null;
  if (!club) return <Redirect href="/manager" />;
  return (
    <Screen title="Squad" nav="manager">
      <LineupEditor team={club} />
    </Screen>
  );
}
