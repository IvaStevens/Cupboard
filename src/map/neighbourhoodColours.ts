/**
 * CUPBOARD-5: the RULE for turning the 17 passport neighbourhoods'
 * colour pairs into a per-`pri_neigh`-area style dictionary for the
 * `chicago-neighbourhoods` layer, mirroring the role src/map/railRoutes.ts
 * plays for rail-line colours.
 *
 * `import type` only for the passport data types (src/places/passportData),
 * so importing this module - or its test - never loads the committed
 * passportSeed.json at runtime; callers pass the neighbourhood list in.
 *
 * PRECEDENCE (AC "MAP - precedence"): resolved by KIND, never array
 * position. A neighbourhood with no parent ("parentless") always wins
 * the `pri_neigh` area(s) it is connected to; a sub-neighbourhood (one
 * with a parent) only colours an area no parentless neighbourhood has
 * claimed. Concretely: the "Loop" polygon is connected to both The Loop
 * (parentless) and South Loop (a sub-neighbourhood of The Loop) - The
 * Loop's colour wins and South Loop never recolours it. The "Lower West
 * Side" polygon is connected only to Pilsen (a sub-neighbourhood of that
 * layer area, which has no passport neighbourhood of its own) - Pilsen's
 * colour is used. Bronzeville (parentless) colours both the "Douglas"
 * and "Grand Boulevard" polygons.
 *
 * Iterates `neighbourhoods` and each of their `connectedAreas` arrays in
 * document order - never `Set`/`Map` key iteration over non-deterministic
 * input - so the result (and therefore `buildMapInitConfig()`'s JSON) is
 * byte-stable across calls, which map.test.tsx's `toBe` comparison and
 * this file's own header-documented contract both depend on.
 *
 * Every per-area style spreads the caller-supplied `defaultStyle`
 * (CUPBOARD-4's `NEIGHBOURHOOD_STYLE` in production - see mapConstants.ts)
 * so `weight` is inherited rather than restated. `color` and `fillColor`
 * both come from the neighbourhood's frame colour (the passport's pastel
 * background colours are too faint to read as a map fill), and
 * `fillOpacity` is PASSPORT_NEIGHBOURHOOD_FILL_OPACITY, so the map
 * underneath still shows through.
 *
 * @format
 */

import {
  PASSPORT_NEIGHBOURHOOD_FILL_OPACITY,
  type PolygonLayerStyle,
} from './mapConstants';
import type { PassportNeighbourhood } from '../places/passportData';

function styleForNeighbourhood(
  neighbourhood: PassportNeighbourhood,
  defaultStyle: PolygonLayerStyle,
): PolygonLayerStyle {
  return {
    ...defaultStyle,
    color: neighbourhood.colours.frameHex,
    fillColor: neighbourhood.colours.frameHex,
    fillOpacity: PASSPORT_NEIGHBOURHOOD_FILL_OPACITY,
  };
}

/**
 * `otherAreaColours` (area -> hex, see otherAreaColours.ts) colours the
 * areas that have no passport neighbourhood; a passport colour always
 * replaces an entry for the same area.
 *
 * Builds the `{pri_neigh-area: style}` dictionary map.html's
 * `chicago-neighbourhoods` style callback looks `feature.properties.pri_neigh`
 * up in (falling back to `defaultStyle` for every area with no entry -
 * see map.html's header comment for that branch). Throws if two
 * parentless neighbourhoods both claim the same area - a real data
 * conflict, not something to silently let array order decide.
 */
export function buildNeighbourhoodStyleByArea(
  neighbourhoods: ReadonlyArray<PassportNeighbourhood>,
  defaultStyle: PolygonLayerStyle,
  otherAreaColours: Readonly<Record<string, string>> = {},
): Record<string, PolygonLayerStyle> {
  const styleByArea: Record<string, PolygonLayerStyle> = {};
  // Made-up colours for areas with no passport neighbourhood go in first,
  // so every passport colour below overwrites them.
  for (const area of Object.keys(otherAreaColours)) {
    styleByArea[area] = {
      ...defaultStyle,
      color: otherAreaColours[area],
      fillColor: otherAreaColours[area],
      fillOpacity: PASSPORT_NEIGHBOURHOOD_FILL_OPACITY,
    };
  }
  const claimedByParentlessId = new Map<string, string>();
  const claimedBySubId = new Set<string>();

  // Pass 1: parentless neighbourhoods always win their connected areas.
  for (const neighbourhood of neighbourhoods) {
    if (neighbourhood.parent !== null) {
      continue;
    }
    for (const area of neighbourhood.connectedAreas) {
      const existingOwnerId = claimedByParentlessId.get(area);
      if (
        existingOwnerId !== undefined &&
        existingOwnerId !== neighbourhood.id
      ) {
        throw new Error(
          `buildNeighbourhoodStyleByArea: both ${JSON.stringify(
            existingOwnerId,
          )} and ${JSON.stringify(
            neighbourhood.id,
          )} are parentless neighbourhoods connected to area ${JSON.stringify(
            area,
          )}`,
        );
      }
      claimedByParentlessId.set(area, neighbourhood.id);
      styleByArea[area] = styleForNeighbourhood(neighbourhood, defaultStyle);
    }
  }

  // Pass 2: sub-neighbourhoods colour only areas no parentless neighbourhood claimed.
  for (const neighbourhood of neighbourhoods) {
    if (neighbourhood.parent === null) {
      continue;
    }
    for (const area of neighbourhood.connectedAreas) {
      if (claimedByParentlessId.has(area)) {
        continue;
      }
      if (!claimedBySubId.has(area)) {
        claimedBySubId.add(area);
        styleByArea[area] = styleForNeighbourhood(neighbourhood, defaultStyle);
      }
    }
  }

  return styleByArea;
}
