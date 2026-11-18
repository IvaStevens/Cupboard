/**
 * Empty placeholder view shown for the Settings or Notes sidebar entry.
 * CUPBOARD-5 gave Places a real feature (`src/views/PlacesView.tsx`,
 * rendered directly by App.tsx instead of this component), so this file
 * now only covers the two entries that are still placeholders; it
 * renders only the entry's name and a way back to the map.
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
 * CUPBOARD-4: when `onShowLicences` is supplied (App.tsx only passes it
 * for the Settings entry - a licences surface belongs under Settings,
 * not Places or Notes), a second `Button` is rendered alongside "Back to
 * map", navigating to the non-sidebar `licences` view (AC21's reachable
 * in-app surface). Neither button changes this component's own props -
 * App.tsx owns all navigation.
 *
 * This file renders no RN primitives of its own (no `View`, no
 * absolute-fill positioning) - the caller (App.tsx) owns where this
 * sits inside `ViewPane`, so this component stays purely Bobuttons.
 *
 * @format
 */

import * as React from 'react';
import {Fragment} from 'react';
import {Button, ViewToolbar} from 'bobuttons';
import {SIDEBAR_ENTRY_LABELS, type SidebarEntryId} from '../shell/navEntries';

export interface PlaceholderViewProps {
  entryId: SidebarEntryId;
  onReturn: () => void;
  /** Settings-only: navigates to the licences view (AC21). Omitted for Places/Notes. */
  onShowLicences?: () => void;
}

function PlaceholderView(props: PlaceholderViewProps): React.ReactElement {
  const {entryId, onReturn, onShowLicences} = props;
  return (
    <ViewToolbar
      title={SIDEBAR_ENTRY_LABELS[entryId]}
      actions={
        <Fragment>
          {onShowLicences && (
            <Button
              label="Licences"
              variant="secondary"
              onPress={onShowLicences}
            />
          )}
          <Button label="Back to map" variant="secondary" onPress={onReturn} />
        </Fragment>
      }
    />
  );
}

export default PlaceholderView;
