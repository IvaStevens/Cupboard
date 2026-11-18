/**
 * Read-only detail for one passport coffee shop (CUPBOARD-5), reached by
 * selecting a shop in PlacesView's grouped list. No editing affordance
 * anywhere - no rating control, no notes field, no visited toggle (AC
 * "PLACES UI - read-only").
 *
 * Built only from bobuttons components, mirroring LicencesView.tsx:
 * `ViewToolbar` for the heading (the shop's name) and the "Back to
 * places" action; `SettingsLayout` + `SettingsSection` for the scrolling
 * body (never `ViewBody`). Each scalar field (neighbourhood, address,
 * website, overall rating) is one `ListRow` with the label and value
 * combined into `title` - `detail` is used only for the website URL,
 * its documented monospace purpose (bobuttons' `ListRowProps.detail`:
 * "Secondary line in monospace, e.g. a URL or flags"), never for the
 * street address. The two prose fields (why it's great for remote work,
 * signature drink) are `SettingsHint`s under their own section headings.
 * Coffee highlights are one `ListRow` per bullet.
 *
 * A field whose source value is `null` (website, overall rating) shows
 * its label with no value text - no invented placeholder, no control.
 *
 * @format
 */

import * as React from 'react';
import {
  Button,
  ListRow,
  SettingsHint,
  SettingsLayout,
  SettingsSection,
  ViewToolbar,
} from 'bobuttons';
import type {PassportNeighbourhood, PassportPlace} from '../places/passportData';

export interface PlaceDetailViewProps {
  place: PassportPlace;
  /** The place's neighbourhood record, for its canonical display name. Undefined only if the data is inconsistent - falls back to the raw id. */
  neighbourhood: PassportNeighbourhood | undefined;
  onBack: () => void;
}

function PlaceDetailView(props: PlaceDetailViewProps): React.ReactElement {
  const {place, neighbourhood, onBack} = props;
  const neighbourhoodName = neighbourhood ? neighbourhood.name : place.neighbourhoodId;

  return (
    <>
      <ViewToolbar
        title={place.name}
        actions={
          <Button label="Back to places" variant="secondary" onPress={onBack} />
        }
      />
      <SettingsLayout>
        <SettingsSection title="Details">
          <ListRow title={`Neighbourhood: ${neighbourhoodName}`} />
          <ListRow title={`Address: ${place.address}`} />
          <ListRow title="Website" detail={place.website ?? undefined} />
          <ListRow
            title={
              place.overallRating != null
                ? `Overall rating: ${place.overallRating} / 10`
                : 'Overall rating'
            }
          />
        </SettingsSection>
        <SettingsSection title="Why it's great for remote work">
          <SettingsHint>{place.whyGreatForRemoteWork}</SettingsHint>
        </SettingsSection>
        <SettingsSection title="Signature drink">
          <SettingsHint>{place.signatureDrink}</SettingsHint>
        </SettingsSection>
        <SettingsSection title="Coffee highlights">
          {place.coffeeHighlights.length > 0 ? (
            place.coffeeHighlights.map((highlight, index) => (
              <ListRow key={index} title={highlight} />
            ))
          ) : (
            <SettingsHint>No highlights listed.</SettingsHint>
          )}
        </SettingsSection>
      </SettingsLayout>
    </>
  );
}

export default PlaceDetailView;
