/**
 * Cupboard: a React Native app built entirely on bobuttons components,
 * showing a Leaflet map of Chicago.
 *
 * The root wraps the tree in `BobuttonsProvider` (with no `config` prop -
 * the provider wires its bundled Tamagui config internally) and never adds
 * a second, separate Tamagui provider. See the template README for why: a
 * second provider/config is exactly how the "can't find Tamagui
 * configuration" crash happens even with a single Tamagui copy installed.
 *
 * `AppShell`'s `header` prop is omitted entirely - nothing goes in the
 * header for now (author's instruction). bobuttons' `AppHeader` declares
 * `title: string` as required and also renders a date, so even
 * `title=""` would leave visible header content; modifying bobuttons is
 * out of scope, so the header is left out rather than passed empty.
 *
 * The map fills the content area directly under `AppShell` rather than
 * going through `ViewPane`/`ViewBody`: reading bobuttons' installed
 * source shows both `ViewPane` and `ViewBody` apply non-zero padding, and
 * `ViewBody` also wraps its children in a scrollable `Scroll` primitive -
 * either would fight the map's own pan/zoom. The map stays inside
 * `AppShell`, which is the author-approved requirement; it is not a bare
 * full-screen WebView replacing the shell.
 *
 * No icons are used: bobuttons ships none, so this screen sticks to the
 * components that need no icon source.
 *
 * @format
 */

import * as React from 'react';
import {StatusBar} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {AppShell, BobuttonsProvider} from 'bobuttons';
import MapScreen from './src/map/MapScreen';

function App() {
  return (
    <SafeAreaProvider>
      <BobuttonsProvider>
        <StatusBar barStyle="dark-content" />
        <AppContent />
      </BobuttonsProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();

  return (
    <AppShell insets={insets}>
      <MapScreen />
    </AppShell>
  );
}

export default App;
