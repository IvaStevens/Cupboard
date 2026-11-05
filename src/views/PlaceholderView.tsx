/**
 * Empty placeholder view shown for whichever sidebar entry (Settings,
 * Places or Notes) is currently selected. No real feature sits behind
 * any of the three (AC7); this renders only the entry's name and a way
 * back to the map.
 *
 * Built only from bobuttons components, no icons:
 *  - `ViewToolbar` for the caption, not a plain `Text` - the bobuttons
 *    package root exports no plain `Text` component, so a caption has to
 *    come from a component that renders text internally, and
 *    `ViewToolbar`'s documented role is a view's own heading (`title`
 *    becomes `role="heading"`, `aria-level={2}`). `SettingsHint`,
 *    `Badge`, `ListRow`, `SettingsRow` and `AddRow` also paint text but
 *    are the wrong semantics for a view's own heading.
 *  - `Button` (`variant="secondary"`, label-only, no icon in its API) in
 *    `ViewToolbar`'s `actions` slot as the visible "return to map"
 *    affordance - the tap-already-active-tab return path has no
 *    on-screen affordance, so a visible control is used instead.
 *
 * This file renders no RN primitives of its own (no `View`, no
 * absolute-fill positioning) - the caller (App.tsx) owns where this
 * sits inside `ViewPane`, so this component stays purely Bobuttons.
 *
 * @format
 */

import * as React from 'react';
import {Button, ViewToolbar} from 'bobuttons';
import {SIDEBAR_ENTRY_LABELS, type SidebarEntryId} from '../shell/navEntries';

export interface PlaceholderViewProps {
  entryId: SidebarEntryId;
  onReturn: () => void;
}

function PlaceholderView(props: PlaceholderViewProps): React.ReactElement {
  const {entryId, onReturn} = props;
  return (
    <ViewToolbar
      title={SIDEBAR_ENTRY_LABELS[entryId]}
      actions={
        <Button label="Back to map" variant="secondary" onPress={onReturn} />
      }
    />
  );
}

export default PlaceholderView;
