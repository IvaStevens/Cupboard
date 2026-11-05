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
 * REVISED LAYOUT (supersedes the app's original header/body decisions):
 * `AppShell`'s `header` prop is now `AppHeader`, with `title="Cupboard"`
 * and `locale`/`timeZone` passed explicitly so the rendered (desktop-only)
 * date is Chicago-local rather than defaulting to UTC. `AppShell`'s
 * `sidebar` prop is bobuttons' `Tabs` primitive carrying exactly the three
 * label-only entries Settings, Places, Notes (see `src/shell/navEntries`);
 * `TabBar` is not used because it requires a per-tab icon and icons are
 * out of scope for this ticket (CUPBOARD-2). The single child of
 * `AppShell` is one `ViewPane` (never `ViewBody`, which wraps children in
 * a scrollable `Scroll` primitive that would fight the map's pan/zoom),
 * holding either the map (the default view) or the active entry's
 * placeholder. `ViewPane` does add non-zero padding around its content,
 * but it does not itself scroll or otherwise intercept gestures, so the map's own
 * pan/zoom is unaffected.
 *
 * NAVIGATION MODEL: the map is the default view (`activeView ===
 * MAP_VIEW_ID`). Selecting a sidebar entry replaces the map with that
 * entry's placeholder - the map unmounts and, on return, remounts and
 * reloads centred back on Chicago via the pinned constants (this is a
 * plain conditional render, not a hide-in-place). Returning to the map
 * happens two ways: the visible "Back to map" button rendered inside the
 * placeholder (see `src/views/PlaceholderView`), or the Android hardware
 * back button, which this component wires up directly: back from a
 * placeholder returns to the map, back from the map falls through to the
 * platform's default behaviour (exits).
 *
 * No icons are used anywhere: bobuttons ships none, so this screen sticks
 * to the components that need no icon source.
 *
 * @format
 */

import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, StatusBar} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {AppHeader, AppShell, BobuttonsProvider, Tabs, ViewPane} from 'bobuttons';
import MapScreen from './src/map/MapScreen';
import PlaceholderView from './src/views/PlaceholderView';
import {
  isSidebarEntryId,
  MAP_VIEW_ID,
  SIDEBAR_ENTRIES,
  type ViewId,
} from './src/shell/navEntries';

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
  const [activeView, setActiveView] = useState<ViewId>(MAP_VIEW_ID);

  // Read through a ref inside the back-handler callback: the handler is
  // registered once for the component's lifetime (see the effect below),
  // not re-subscribed on every `activeView` change. The ref is kept in
  // sync in an effect rather than during render - writing to a ref in the
  // component body mutates state React considers a thrown-away render may
  // still have touched, and it is also too late for the handler below:
  // `setActiveView` is batched, so without updating the ref synchronously
  // inside the handler itself, two back presses dispatched before React
  // commits the first would both still read the placeholder id and both
  // return `true`, silently swallowing the second press instead of
  // falling through to exit. The effect keeps the ref correct for the
  // ordinary (non-back-press) case; the handler below updates it directly
  // for its own case.
  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const returnToMap = useCallback(() => {
    activeViewRef.current = MAP_VIEW_ID;
    setActiveView(MAP_VIEW_ID);
  }, []);

  useEffect(() => {
    // Registered exactly ONCE for this component's lifetime. Android
    // dispatches `hardwareBackPress` subscriptions newest-first and stops
    // at the first one that returns true (see BackHandler.android.js); a
    // handler that got re-subscribed on every `activeView` change would
    // leak one stale registration per change, and a leaked registration
    // that still returns true from a since-left placeholder would
    // consume the back press on the map and the app would stop exiting -
    // green in any test that only presses back once, wrong on device.
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (activeViewRef.current !== MAP_VIEW_ID) {
          // Update the ref synchronously (not just via `setActiveView`,
          // which is batched) so a second back press dispatched before
          // this render commits reads MAP_VIEW_ID and correctly falls
          // through to exit instead of being swallowed. See the comment
          // on `activeViewRef` above.
          activeViewRef.current = MAP_VIEW_ID;
          setActiveView(MAP_VIEW_ID);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <AppShell
      header={
        <AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago" />
      }
      sidebar={
        <Tabs
          tabs={SIDEBAR_ENTRIES}
          current={activeView}
          onChange={setActiveView}
          aria-label="Cupboard sections"
        />
      }
      insets={insets}>
      <ViewPane>
        {isSidebarEntryId(activeView) ? (
          <PlaceholderView entryId={activeView} onReturn={returnToMap} />
        ) : (
          <MapScreen />
        )}
      </ViewPane>
    </AppShell>
  );
}

export default App;
