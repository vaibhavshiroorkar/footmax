import React from 'react';
import { Redirect } from 'expo-router';
import { useGame } from '../../state/store';
import { Screen } from '../../ui/kit';
import { TacticsEditor } from '../../ui/teamEditors';
import { managerClub } from '../../engine/manager';

export default function Tactics() {
  const game = useGame();
  const club = game ? managerClub(game) : null;
  if (!club) return <Redirect href="/manager" />;
  return (
    <Screen title="Tactics">
      <TacticsEditor team={club} />
    </Screen>
  );
}
