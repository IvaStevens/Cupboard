/**
 * Data (not a component) describing the app's three sidebar entries and
 * the "map" sentinel used as `TabBar`'s `current` while the map is showing.
 *
 * Deliberately NOT a bespoke nav component (AC6 forbids one): `TabBar` is
 * rendered directly in App.tsx from `SIDEBAR_ENTRIES`, and this module
 * only supplies the typed data it needs.
 *
 * Icons are Feather icons (MIT, see THIRD-PARTY-NOTICE.md) from
 * `react-native-feather`. bobuttons ships no icon sources; its `IconSource`
 * is any component taking `size` and `color`, which these are.
 *
 * The explicit `ViewId` annotation on `SIDEBAR_ENTRIES` is load-bearing:
 * bobuttons' `TabBarProps<Id>` infers `Id` from both `tabs` and `current`
 * (see bobuttons' `TabBar.d.ts`), so an untyped three-element tabs array
 * combined with `current={MAP_VIEW_ID}` ('map', which matches none of
 * the three entries) gives tsc two conflicting inference candidates and
 * a confusing error about `'map'` not being assignable. Fixing that with
 * a cast would hide a real mismatch, so the array is annotated instead.
 *
 * @format
 */

import type {BobuttonsTab} from 'bobuttons';
import {Edit3, MapPin, Settings} from 'react-native-feather';

/** The three sidebar entries, in their fixed display order. */
export type SidebarEntryId = 'settings' | 'places' | 'notes';

/** Sentinel `current` value while the map (the default view) is showing. */
export const MAP_VIEW_ID = 'map';

export type ViewId = typeof MAP_VIEW_ID | SidebarEntryId;

const SIDEBAR_ENTRY_IDS: ReadonlyArray<SidebarEntryId> = [
  'settings',
  'places',
  'notes',
];

export function isSidebarEntryId(id: ViewId): id is SidebarEntryId {
  return (SIDEBAR_ENTRY_IDS as ReadonlyArray<ViewId>).includes(id);
}

export const SIDEBAR_ENTRY_LABELS: Record<SidebarEntryId, string> = {
  settings: 'Settings',
  places: 'Places',
  notes: 'Notes',
};

/**
 * Fed straight into bobuttons' `TabBar` as its `tabs` prop. Order matters:
 * Settings, Places, Notes (AC6).
 *
 * While the map is the active view, `current` is `MAP_VIEW_ID`, which
 * matches none of these three ids - `TabBar` therefore renders
 * `aria-selected: false` on every tab (verified in bobuttons' installed
 * native build). This is deliberate, not a bug: the map is not one of
 * the three sidebar entries, so none of them should read as selected
 * while it shows. Left as-is rather than "fixed" with a 4th entry or a
 * synthetic highlighted state - a later accessibility pass should read
 * this comment rather than treat the all-false state as a regression.
 *
 * On phones `TabBar` is icon-only, with each label exposed as the tab's
 * `aria-label` (see bobuttons' `TabItem`), so screen readers still get it.
 */
export const SIDEBAR_ENTRIES: ReadonlyArray<BobuttonsTab<ViewId>> = [
  {id: 'settings', label: SIDEBAR_ENTRY_LABELS.settings, icon: Settings},
  {id: 'places', label: SIDEBAR_ENTRY_LABELS.places, icon: MapPin},
  {id: 'notes', label: SIDEBAR_ENTRY_LABELS.notes, icon: Edit3},
];
