/**
 * The Places tab (CUPBOARD-5): the 50 passport coffee shops, grouped by
 * their 17 passport neighbourhoods, built only from bobuttons
 * components. No editing anywhere - ratings, notes and visited state are
 * out of scope for this ticket (AC "PLACES UI - read-only").
 *
 * LIST: `ViewToolbar` ("Places" heading, "Back to map" action) over
 * `SettingsLayout`, mirroring LicencesView.tsx (never `ViewBody`). One
 * `SettingsSection` per neighbourhood, in `PASSPORT_NEIGHBOURHOODS`'
 * document order (The Loop first ... South Loop, Pilsen last - South
 * Loop and Pilsen are their own top-level sections, same as every other
 * neighbourhood; the "Lower West Side" layer area they are matched
 * against for map colouring has no passport name of its own and is
 * never rendered as a section here). Each section's title is the
 * neighbourhood's canonical passport name; its `titleAction` is the
 * neighbourhood's colour pair, rendered as a read-only 1x2 `SquareGrid`
 * (cell 0 filled with the background colour, cell 1 outlined with the
 * frame colour - no `onSquarePress`, so the swatch is purely
 * presentational). Shops are `ListRow`s, in `PASSPORT_PLACES`'
 * document order within each group (via `PLACES_BY_NEIGHBOURHOOD_ID`),
 * identified by `place.id` - never by display string or array index.
 * `onSelect` gives each row a radio dot, kept deliberately for the
 * larger touch target even though the shop is navigated to rather than
 * "selected" in the usual sense.
 *
 * DETAIL: selecting a shop swaps the list for `PlaceDetailView`, intra-
 * view state (`selectedPlaceId`) rather than a new `ViewId` - App.tsx's
 * `activeView` stays `'places'` the whole time.
 *
 * HARDWARE BACK: App.tsx's own `BackHandler` (registered once, for the
 * app's lifetime) already returns from any sidebar entry straight to the
 * map - see its header comment. This component registers its OWN
 * `hardwareBackPress` subscription, once on mount, so a back press while
 * a shop's detail is open returns to the list first instead of skipping
 * it. Android dispatches subscriptions newest-first and stops at the
 * first one returning `true` (see BackHandler.android.js), so this
 * inner handler intercepts the press while mounted; it returns `false`
 * (letting App.tsx's handler run) whenever no shop is open, and is
 * removed on unmount to avoid the stale-registration hazard App.tsx's
 * own comment warns about. The selection is read through a ref, updated
 * synchronously by `selectPlace`/`clearSelection` as well as by the
 * effect below, for the same reason App.tsx's `activeViewRef` is: a
 * second back press dispatched before React commits the first must see
 * the new value, not a stale one.
 *
 * @format
 */

import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler} from 'react-native';
import {Button, ListRow, SettingsLayout, SettingsSection, SquareGrid, ViewToolbar} from 'bobuttons';
import {
  PASSPORT_NEIGHBOURHOODS,
  PASSPORT_PLACES,
  PLACES_BY_NEIGHBOURHOOD_ID,
  type PassportNeighbourhood,
} from '../places/passportData';
import PlaceDetailView from './PlaceDetailView';

export interface PlacesViewProps {
  onReturn: () => void;
}

/** The neighbourhood's background/frame colour pair, read-only, as a 1x2 SquareGrid. */
function NeighbourhoodColourSwatch(props: {
  neighbourhood: PassportNeighbourhood;
}): React.ReactElement {
  const {neighbourhood} = props;
  return (
    <SquareGrid
      columns={2}
      rows={1}
      squareSize={20}
      cells={[
        {color: neighbourhood.colours.backgroundHex, label: 'Background colour'},
        {
          color: neighbourhood.colours.frameHex,
          variant: 'outlined',
          label: 'Frame colour',
        },
      ]}
      aria-label={`${neighbourhood.name} colours`}
    />
  );
}

function PlacesView(props: PlacesViewProps): React.ReactElement {
  const {onReturn} = props;
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const selectedPlaceIdRef = useRef(selectedPlaceId);
  useEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId;
  }, [selectedPlaceId]);

  const selectPlace = useCallback((id: string) => {
    selectedPlaceIdRef.current = id;
    setSelectedPlaceId(id);
  }, []);

  const clearSelection = useCallback(() => {
    selectedPlaceIdRef.current = null;
    setSelectedPlaceId(null);
  }, []);

  useEffect(() => {
    // Registered once for this component's lifetime - see this file's
    // header comment for why (mirrors App.tsx's own BackHandler).
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedPlaceIdRef.current !== null) {
        clearSelection();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [clearSelection]);

  if (selectedPlaceId !== null) {
    const place = PASSPORT_PLACES.find(candidate => candidate.id === selectedPlaceId);
    if (place) {
      const neighbourhood = PASSPORT_NEIGHBOURHOODS.find(
        candidate => candidate.id === place.neighbourhoodId,
      );
      return (
        <PlaceDetailView
          place={place}
          neighbourhood={neighbourhood}
          onBack={clearSelection}
        />
      );
    }
    // Inconsistent data (an id that no longer resolves) - fall back to the list.
  }

  return (
    <>
      <ViewToolbar
        title="Places"
        actions={<Button label="Back to map" variant="secondary" onPress={onReturn} />}
      />
      <SettingsLayout>
        {PASSPORT_NEIGHBOURHOODS.map(neighbourhood => (
          <SettingsSection
            key={neighbourhood.id}
            title={neighbourhood.name}
            titleAction={<NeighbourhoodColourSwatch neighbourhood={neighbourhood} />}>
            {(PLACES_BY_NEIGHBOURHOOD_ID.get(neighbourhood.id) ?? []).map(place => (
              <ListRow
                key={place.id}
                title={place.name}
                selected={place.id === selectedPlaceId}
                onSelect={() => selectPlace(place.id)}
              />
            ))}
          </SettingsSection>
        ))}
      </SettingsLayout>
    </>
  );
}

export default PlacesView;
