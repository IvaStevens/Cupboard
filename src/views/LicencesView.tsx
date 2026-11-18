/**
 * The in-app licences surface (AC21), reached from the Settings
 * placeholder's "Licences" button (see src/views/PlaceholderView.tsx)
 * via the non-sidebar `licences` view id (src/shell/navEntries.ts).
 *
 * Built only from bobuttons components: `ViewToolbar` for the heading
 * and the "Back to Settings" action; `SettingsLayout` + `SettingsSection`
 * + `SettingsHint` for the scrolling body, so `ViewBody` (which this
 * repo avoids - see App.tsx's header comment) is never used and the
 * scrolling itself comes from `SettingsLayout`'s own `Scroll`, not a
 * bespoke RN primitive here.
 *
 * All three licence/credit texts are imported from
 * src/licences/licenceText.ts, the single source shared with README.md
 * (see __tests__/licences.test.tsx's drift guard) - nothing here is a
 * copy that could drift from that file.
 *
 * @format
 */

import * as React from 'react';
import {Button, SettingsHint, SettingsLayout, SettingsSection, ViewToolbar} from 'bobuttons';
import {
  CHICAGO_DERIVATIVE_USE_DISCLAIMER,
  CHICAGO_NEIGHBOURHOODS_LICENCE_RECORD,
  CTA_CREDIT_NOTE,
} from '../licences/licenceText';

export interface LicencesViewProps {
  onReturn: () => void;
}

function LicencesView(props: LicencesViewProps): React.ReactElement {
  const {onReturn} = props;
  return (
    <>
      <ViewToolbar
        title="Licences"
        actions={
          <Button
            label="Back to Settings"
            variant="secondary"
            onPress={onReturn}
          />
        }
      />
      <SettingsLayout>
        <SettingsSection title="CTA data">
          <SettingsHint>{CTA_CREDIT_NOTE}</SettingsHint>
        </SettingsSection>
        <SettingsSection title="City of Chicago data">
          <SettingsHint>{CHICAGO_NEIGHBOURHOODS_LICENCE_RECORD}</SettingsHint>
          <SettingsHint>{CHICAGO_DERIVATIVE_USE_DISCLAIMER}</SettingsHint>
        </SettingsSection>
      </SettingsLayout>
    </>
  );
}

export default LicencesView;
