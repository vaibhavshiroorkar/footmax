import { Redirect } from 'expo-router';

// More is gone: Life is on the bottom bar, the football screens are
// shortcuts on Play and Settings is on Me. Old links land on Play.
export default function More() {
  return <Redirect href="/career" />;
}
