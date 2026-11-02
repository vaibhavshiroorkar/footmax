import React from 'react';
import { LegalPage, Para, Section } from '../../ui/legal';

export default function Terms() {
  return (
    <LegalPage title="Terms">
      <Section title="An unofficial fan game">
        <Para>{`FootMax is a free, unofficial fan game. It is not affiliated with, endorsed by or connected to any league, club, federation, player or players' union.`}</Para>
        <Para>{`Real names of players, clubs and nations are used only to describe the football world the game simulates. Ratings are our own estimates and do not reflect anyone's real ability. You can rename or edit anything in the editor.`}</Para>
        <Para>If you represent a rights holder and want something changed or removed, open an issue on GitHub and we will act on it.</Para>
      </Section>
      <Section title="Your account">
        <Para>Keep your password safe. Pick a username that is not offensive and does not pretend to be someone else; we may rename or remove accounts that break this.</Para>
        <Para>Leaderboard numbers come from your own device. Do not tamper with saves to climb the tables; we may remove entries that do.</Para>
      </Section>
      <Section title="No warranty">
        <Para>The game is provided as is, without any warranty. We try hard to keep saves safe, but cannot promise they will never be lost. Export saves you care about.</Para>
      </Section>
      <Section title="Changes">
        <Para>We may update these terms. The date at the top shows the latest version.</Para>
      </Section>
    </LegalPage>
  );
}
