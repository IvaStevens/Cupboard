/**
 * The route-name -> colour RULE for CTA rail-line segments (AC2/AC3).
 *
 * The colour values themselves live in mapConstants.ts
 * (RAIL_ROUTE_COLOURS, one per colour KEY); this module only computes
 * which colour KEY a segment's `lines` property resolves to, and lists
 * the 16 distinct `lines` values verified against the source data
 * (CTARailLines.kml / the portal's rail-lines GeoJSON - both carry the
 * same 16 names).
 *
 * THE RULE (AC3): a segment is coloured by the FIRST route named in its
 * `lines` property - e.g. "Brown, Purple (Express), Red" -> Brown. Both
 * Blue Line branch labels ("Blue Line (O'Hare)", "Blue Line (Forest
 * Park)") -> Blue. This is a deliberate simplification: shared trackage
 * (the Loop, the Brown/Purple and Red/Purple trunks) takes ONE colour
 * rather than a parallel/offset rendering, which is out of scope for
 * this ticket. The full route list survives unmodified on the feature
 * as `properties.lines` so a later ticket can render shared trackage
 * differently without reconverting the data.
 *
 * @format
 */

import {RAIL_ROUTE_COLOURS, type RailColourKey} from './mapConstants';

/**
 * All 16 distinct `lines` values present in the portal rail-lines
 * GeoJSON.
 */
export const RAIL_LINE_NAMES = [
  'Red Line',
  "Blue Line (O'Hare)",
  'Blue Line (Forest Park)',
  'Brown Line',
  'Green Line',
  'Orange Line',
  'Pink Line',
  'Purple Line',
  'Yellow Line',
  'Red, Purple Line',
  'Brown, Purple (Express), Red',
  'Brown, Green, Orange, Pink, Purple (Exp)',
  'Green, Pink',
  'Green, Orange',
  'Brown, Purple',
  'Brown, Orange, Pink, Purple (Express)',
] as const;

export type RailLineName = (typeof RAIL_LINE_NAMES)[number];

/** The route list's first entry, trimmed - "Brown, Purple" -> "Brown"; "Red Line" -> "Red Line" (no comma). */
function firstRouteToken(lines: string): string {
  return lines.split(',')[0].trim();
}

/**
 * Resolves a rail segment's `lines` property to one of the 8 colour
 * keys, via the first-named-route rule above. Throws rather than
 * falling back to a default colour for an unrecognised route name - a
 * 17th source name is a data change this rule has not been checked
 * against, not something to silently mis-colour.
 */
export function railRouteKeyFromName(lines: string): RailColourKey {
  const first = firstRouteToken(lines);
  if (first.startsWith('Red')) {
    return 'red';
  }
  if (first.startsWith('Blue')) {
    return 'blue';
  }
  if (first.startsWith('Brown')) {
    return 'brown';
  }
  if (first.startsWith('Green')) {
    return 'green';
  }
  if (first.startsWith('Orange')) {
    return 'orange';
  }
  if (first.startsWith('Pink')) {
    return 'pink';
  }
  if (first.startsWith('Purple')) {
    return 'purple';
  }
  if (first.startsWith('Yellow')) {
    return 'yellow';
  }
  throw new Error(
    `railRouteKeyFromName: no colour mapping for route name ${JSON.stringify(lines)}`,
  );
}

/**
 * Builds the plain `{lines-value: colour}` dictionary carried into the
 * page as config (see mapInitScript.ts's `railColourByName`). map.html
 * does one object-property lookup against this dictionary; it computes
 * no colour of its own.
 */
export function buildRailColourByName(
  names: ReadonlyArray<string> = RAIL_LINE_NAMES,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = RAIL_ROUTE_COLOURS[railRouteKeyFromName(name)];
  }
  return result;
}
