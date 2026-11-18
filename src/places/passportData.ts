/**
 * Hand-written typed access layer over the committed, generated-once
 * data file `./passportData.json` (converted from the gitignored
 * `docs/passport.tex` - see README.md's "Places data" section). That
 * JSON file is the source of truth from here on: CUPBOARD-5 generated it
 * once with a throwaway script and the author may hand-edit it directly
 * afterwards - there is no committed converter (see README.md), so
 * nothing in this app regenerates or re-validates it at build/run time.
 *
 * FIELD NAMES ARE FIXED HERE for CUPBOARD-6 (the on-device database
 * ticket): `signatureDrink`, `website`, `overallRating` and
 * `neighbourhoodRating` all use `null` (never `''`) as their one shared
 * "blank in the source" representation, so CUPBOARD-6 can write a real
 * value into any of them with no schema change. CUPBOARD-6 must not
 * rename any field here, and may add new optional ones (e.g. a place's
 * lat/lon) without renaming existing ones.
 *
 * STABLE IDS: every `PassportNeighbourhood.id` and `PassportPlace.id` is
 * a deterministic, name-derived slug (never document order or array
 * index) - these are the CUPBOARD-6 database's future primary keys.
 * `PassportPlace.neighbourhoodId` and `PassportNeighbourhoodParent.id`
 * reference other records by id; nothing downstream may key a record by
 * display string or position. Because ids are a pure function of names,
 * a rename in `passportData.json` shows up as an id change in
 * `git diff` - CUPBOARD-6 must treat that as a data migration, not a
 * no-op.
 *
 * USER-EDITABLE STATE DOES NOT LIVE HERE: this file is reference/seed
 * data only. The `null` rating fields are the passport's own blank
 * answer sheet, not a place for user ratings/notes/visited-state, which
 * CUPBOARD-6's database will own.
 *
 * ONE DOCUMENTED CAST: TypeScript's `resolveJsonModule` infers this
 * file's RGB tuples as `number[]` (not the 3-tuple `RgbTriplet` below)
 * and infers the all-null `website`/`overallRating`/
 * `neighbourhoodRating` columns as type `null` (not `string | null` /
 * `number | null`), because every value in the committed JSON happens to
 * be null today. The single cast below re-widens those inferred types to
 * their real shape; nothing else in this file or any importer casts the
 * data.
 *
 * @format
 */

import passportDataJson from './passportData.json';

export type RgbTriplet = readonly [number, number, number];

export interface PassportNeighbourhoodColours {
  /** The passport's colour-name stem (e.g. "loopBlue") this pair was resolved from. Not used for matching/grouping - informational only. */
  stem: string;
  backgroundRgb: RgbTriplet;
  backgroundHex: string;
  frameRgb: RgbTriplet;
  frameHex: string;
}

/**
 * A neighbourhood may have a parent neighbourhood (South Loop -> The
 * Loop) or a parent layer area (Pilsen -> the "Lower West Side"
 * `pri_neigh` polygon, which has no passport neighbourhood of its own).
 * Expressed generally so more sub-neighbourhoods can be added later
 * without a model change.
 */
export type PassportNeighbourhoodParent =
  | null
  | {kind: 'neighbourhood'; id: string}
  | {kind: 'layerArea'; priNeigh: string};

export interface PassportNeighbourhood {
  id: string;
  /** The canonical passport neighbourhood name - the match key and grouping key everywhere (list headers, map matching). */
  name: string;
  /**
   * Only set where the passport section heading carries more than the
   * canonical name (passport.tex:874, "West Loop / Fulton Market").
   * Presentation-only - never a match or grouping key.
   */
  displayTitle: string | null;
  colours: PassportNeighbourhoodColours;
  /** The neighbourhoods-layer `pri_neigh` area(s) this passport neighbourhood colours. Always non-empty. */
  connectedAreas: readonly string[];
  parent: PassportNeighbourhoodParent;
  /** The passport's blank "Neighborhood Rating:" field - captured now so CUPBOARD-6 needs no schema change. Never displayed or editable in this ticket. */
  neighbourhoodRating: number | null;
}

export interface PassportPlace {
  id: string;
  name: string;
  /** References PassportNeighbourhood.id - never a display string or index. */
  neighbourhoodId: string;
  address: string;
  website: string | null;
  whyGreatForRemoteWork: string;
  signatureDrink: string;
  coffeeHighlights: readonly string[];
  overallRating: number | null;
}

const rawData = passportDataJson as unknown as {
  neighbourhoods: PassportNeighbourhood[];
  places: PassportPlace[];
};

/**
 * The 17 passport neighbourhoods, in passport document order. Carries no
 * shop prose - the only export `src/map/neighbourhoodColours.ts` needs,
 * via `import type`.
 */
export const PASSPORT_NEIGHBOURHOODS: ReadonlyArray<PassportNeighbourhood> =
  rawData.neighbourhoods;

/** The 50 passport places, in passport document order. */
export const PASSPORT_PLACES: ReadonlyArray<PassportPlace> = rawData.places;

/**
 * PASSPORT_PLACES grouped by neighbourhoodId, preserving each group's
 * document order. Built once at module load, not per render - PlacesView
 * reads this instead of filtering PASSPORT_PLACES itself.
 */
export const PLACES_BY_NEIGHBOURHOOD_ID: ReadonlyMap<
  string,
  ReadonlyArray<PassportPlace>
> = (() => {
  const map = new Map<string, PassportPlace[]>();
  for (const place of PASSPORT_PLACES) {
    const existing = map.get(place.neighbourhoodId);
    if (existing) {
      existing.push(place);
    } else {
      map.set(place.neighbourhoodId, [place]);
    }
  }
  return map;
})();
