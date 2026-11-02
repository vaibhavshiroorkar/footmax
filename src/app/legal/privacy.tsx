import React from 'react';
import { LegalPage, Para, Section } from '../../ui/legal';

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <Section title="The short version">
        <Para>You can play FootMax without an account. Then everything stays on your device and nothing is sent to us.</Para>
        <Para>If you create an account, we store what is needed to sync your saves and show leaderboards. We do not sell data, show ads or use tracking cookies.</Para>
      </Section>
      <Section title="What we store with an account">
        <Para>Your email address and a password hash, or your Google account id if you sign in with Google. We use these only to sign you in and to send account emails such as password resets.</Para>
        <Para>Your username, avatar and whether your profile is public.</Para>
        <Para>Your saved games, and the numbers from them shown on leaderboards and your profile (ratings, goals, trophies).</Para>
      </Section>
      <Section title="Who can see it">
        <Para>Saves are private to you. Your username, avatar and leaderboard numbers are public unless you turn off your public profile in Account settings. Your email is never shown.</Para>
      </Section>
      <Section title="Where it lives">
        <Para>Accounts and saves are stored with Supabase. The website is served by Vercel. Both act as our processors and keep standard server logs, such as IP addresses, for security.</Para>
      </Section>
      <Section title="Your choices">
        <Para>You can export any save as a file, make your profile private, or delete your account in Account settings. Deleting your account removes your profile, saves and leaderboard entries straight away.</Para>
      </Section>
      <Section title="On this device">
        <Para>The game keeps saves and settings in your browser or app storage. Clearing site data removes them, so export or sync saves you want to keep.</Para>
      </Section>
    </LegalPage>
  );
}
