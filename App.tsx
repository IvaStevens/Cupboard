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
 * `sidebar` prop is a Fragment of bobuttons' `TabBar` (the three entries
 * Settings, Places, Notes, each with a Feather icon - see
 * `src/shell/navEntries`) followed by `LayerPicker` (CUPBOARD-4's bobuttons
 * `Tabs` sub-selector listing the map layers - see
 * `src/shell/LayerPicker`). `TabBar` is the app's one MAIN selector (it
 * alone decides which view `ViewPane` shows); `LayerPicker` never does -
 * activating one of its items only flips that layer's membership in
 * `enabledLayerIds`/`failedLayerIds` below. The single child of
 * `AppShell` is one `ViewPane` (never `ViewBody`, which wraps children in
 * a scrollable `Scroll` primitive that would fight the map's pan/zoom),
 * holding the map (the default view), the Places tab (CUPBOARD-5's
 * `PlacesView` - the only sidebar entry with a real feature behind it),
 * the Settings/Notes placeholder, or the licences view. `ViewPane` does
 * add non-zero padding around its content, but it does not itself
 * scroll or otherwise intercept gestures, so the map's own pan/zoom is
 * unaffected.
 *
 * NAVIGATION MODEL: the map is the default view (`activeView ===
 * MAP_VIEW_ID`). Selecting a sidebar entry replaces the map with that
 * entry's placeholder - the map unmounts and, on return, remounts and
 * reloads centred back on Chicago via the pinned constants (this is a
 * plain conditional render, not a hide-in-place). `enabledLayerIds` and
 * `failedLayerIds` are owned HERE, above `ViewPane`, specifically so a
 * map unmount/remount (switching to a placeholder and back) does not
 * lose which layers were toggled on (AC11) - `MapScreen` itself re-syncs
 * to whatever this state says on every (re)mount (see its header
 * comment and AC12). Settings' placeholder can additionally navigate to
 * the non-sidebar `licences` view (AC21's reachable in-app surface);
 * returning from it goes back to Settings, not to the map. Returning to
 * the map happens two ways: the visible "Back to map" button rendered
 * inside the placeholder (see `src/views/PlaceholderView`), or the
 * Android hardware back button, which this component wires up directly:
 * back from a placeholder OR the licences view returns to the map, back
 * from the map falls through to the platform's default behaviour
 * (exits). (Back from `licences` not returning to `settings` first is a
 * deliberate simplification - this ticket does not build a view back-
 * stack - rather than a regression; use the in-view "Back to Settings"
 * button for that finer-grained return.)
 *
 * Icons come from `react-native-feather` (Feather, MIT); bobuttons ships
 * none, so the icon components are supplied here as `TabBar`'s `icon`.
 *
 * @format
 */

import * as React from 'react';
import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, StatusBar} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {AppHeader, AppShell, BobuttonsProvider, TabBar, ViewPane} from 'bobuttons';
import MapScreen from './src/map/MapScreen';
import PlaceholderView from './src/views/PlaceholderView';
import PlacesView from './src/views/PlacesView';
import LicencesView from './src/views/LicencesView';
import LayerPicker from './src/shell/LayerPicker';
import {
  isSidebarEntryId,
  LICENCES_VIEW_ID,
  MAP_VIEW_ID,
  SIDEBAR_ENTRIES,
  type ViewId,
} from './src/shell/navEntries';
import type {LayerId} from './src/map/mapLayers';

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

  // CUPBOARD-4: the map layers, owned here (above ViewPane) rather
  // than inside MapScreen, so toggle state survives the map's own
  // unmount/remount when the user switches to a placeholder and back
  // (AC11). Both start empty - all layers default OFF on first
  // launch (AC11), matching CUPBOARD-1's launch state exactly.
  const [enabledLayerIds, setEnabledLayerIds] = useState<ReadonlySet<LayerId>>(
    () => new Set<LayerId>(),
  );
  const [failedLayerIds, setFailedLayerIds] = useState<ReadonlySet<LayerId>>(
    () => new Set<LayerId>(),
  );

  const handleToggleLayer = useCallback((id: LayerId) => {
    // A layer the picker is currently showing as "(unavailable)" is, by
    // construction, not in `enabledLayerIds` (see handleLayerError
    // below) - so toggling it here always RETRIES it (adds it back to
    // enabledLayerIds) rather than needing separate retry affordance.
    setFailedLayerIds(previous => {
      if (!previous.has(id)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setEnabledLayerIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLayerError = useCallback((id: LayerId) => {
    setEnabledLayerIds(previous => {
      if (!previous.has(id)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setFailedLayerIds(previous => {
      if (previous.has(id)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

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

  const showLicences = useCallback(() => {
    activeViewRef.current = LICENCES_VIEW_ID;
    setActiveView(LICENCES_VIEW_ID);
  }, []);

  const returnToSettings = useCallback(() => {
    activeViewRef.current = 'settings';
    setActiveView('settings');
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
        <Fragment>
          <TabBar
            tabs={SIDEBAR_ENTRIES}
            current={activeView}
            onChange={setActiveView}
            aria-label="Cupboard sections"
          />
          <LayerPicker
            enabledLayerIds={enabledLayerIds}
            failedLayerIds={failedLayerIds}
            onToggle={handleToggleLayer}
          />
        </Fragment>
      }
      insets={insets}>
      <ViewPane>
        {activeView === 'places' ? (
          <PlacesView onReturn={returnToMap} />
        ) : isSidebarEntryId(activeView) ? (
          <PlaceholderView
            entryId={activeView}
            onReturn={returnToMap}
            onShowLicences={activeView === 'settings' ? showLicences : undefined}
          />
        ) : activeView === LICENCES_VIEW_ID ? (
          <LicencesView onReturn={returnToSettings} />
        ) : (
          <MapScreen
            enabledLayerIds={enabledLayerIds}
            onLayerError={handleLayerError}
          />
        )}
      </ViewPane>
    </AppShell>
  );
}

export default App;
