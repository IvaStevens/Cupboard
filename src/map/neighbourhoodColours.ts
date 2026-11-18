/**
 * CUPBOARD-5: the RULE for turning the 17 passport neighbourhoods'
 * colour pairs into a per-`pri_neigh`-area style dictionary for the
 * `chicago-neighbourhoods` layer, mirroring the role src/map/railRoutes.ts
 * plays for rail-line colours.
 *
 * `import type` only for the passport data types (src/places/passportData),
 * so importing this module - or its test - never loads the committed
 * passportData.json at runtime; callers pass the neighbourhood list in.
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
 * so `weight`/`fillOpacity` are inherited rather than restated, and
 * overrides only `color` (from the neighbourhood's frame RGB) and
 * `fillColor` (from its background RGB) - the AC's "overridable default
 * rather than one hard-coded style".
 *
 * @format
 */

import type {PolygonLayerStyle} from './mapConstants';
import type {PassportNeighbourhood} from '../places/passportData';

function styleForNeighbourhood(
  neighbourhood: PassportNeighbourhood,
  defaultStyle: PolygonLayerStyle,
): PolygonLayerStyle {
  return {
    ...defaultStyle,
    color: neighbourhood.colours.frameHex,
    fillColor: neighbourhood.colours.backgroundHex,
  };
}

/**
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
): Record<string, PolygonLayerStyle> {
  const styleByArea: Record<string, PolygonLayerStyle> = {};
  const claimedByParentlessId = new Map<string, string>();

  // Pass 1: parentless neighbourhoods always win their connected areas.
  for (const neighbourhood of neighbourhoods) {
    if (neighbourhood.parent !== null) {
      continue;
    }
    for (const area of neighbourhood.connectedAreas) {
      const existingOwnerId = claimedByParentlessId.get(area);
      if (existingOwnerId !== undefined && existingOwnerId !== neighbourhood.id) {
        throw new Error(
          `buildNeighbourhoodStyleByArea: both ${JSON.stringify(existingOwnerId)} and ${JSON.stringify(neighbourhood.id)} are parentless neighbourhoods connected to area ${JSON.stringify(area)}`,
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
      if (!(area in styleByArea)) {
        styleByArea[area] = styleForNeighbourhood(neighbourhood, defaultStyle);
      }
    }
  }

  return styleByArea;
}
