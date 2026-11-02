import React from 'react';
import { Redirect } from 'expo-router';
import { useGame } from '../../state/store';
import { Screen } from '../../ui/kit';
import { NavGrid } from '../../ui/shared';
import { colors } from '../../ui/theme';

// Everything that is not part of the weekly loop of train and play.
export default function More() {
  const game = useGame();
  if (!game?.career) return <Redirect href="/" />;
  return (
    <Screen title="More" nav="career">
      <NavGrid
        items={[
          { label: 'Life', sub: 'Social, shop, sponsors', href: '/career/life', icon: 'bag-handle', color: colors.pink },
          { label: 'Clubs', sub: 'Relations, offer yourself', href: '/career/clubs', icon: 'briefcase', color: colors.teal },
          { label: 'League', sub: 'Tables and results', href: '/league', icon: 'podium', color: colors.blue },
          { label: 'Internationals', sub: 'Tournaments', href: '/tournaments', icon: 'earth', color: colors.orange },
          { label: 'Awards', sub: "Ballon d'Or race", href: '/awards', icon: 'medal', color: colors.gold },
          { label: 'Honours', sub: 'Trophy history', href: '/honours', icon: 'trophy', color: colors.purple },
          { label: 'Milestones', sub: 'Career landmarks', href: '/career/milestones', icon: 'ribbon', color: colors.gold },
          { label: 'Leaderboards', sub: 'Best careers online', href: '/leaderboards', icon: 'stats-chart', color: colors.accent },
          { label: 'Settings', sub: 'Speed, motion, account', href: '/settings', icon: 'settings-outline', color: colors.muted },
        ]}
      />
    </Screen>
  );
}
