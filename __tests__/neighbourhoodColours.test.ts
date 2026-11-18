/**
 * CUPBOARD-5: pure unit tests of src/map/neighbourhoodColours.ts over an
 * inline fixture neighbourhood list, alongside mapLayers.test.ts. Reads
 * no files and never imports src/places/passportData (the committed
 * dataset) - only the `PassportNeighbourhood` type, so this suite can
 * never silently start asserting against the real data instead of its
 * own fixtures.
 *
 * Covers: the neighbourhood-to-`pri_neigh`-area shape (via fixtures
 * using the three normalised pri_neigh strings - "Loop", "Lake View",
 * "North Center" - and Bronzeville's two-area case), the precedence
 * rules (The Loop beats South Loop, a Pilsen-only claim colours Lower
 * West Side, Bronzeville colours two areas, an unmatched area is simply
 * absent so the caller's own default applies), and the frameHex ->
 * `color` / backgroundHex -> `fillColor` mapping with `weight`/
 * `fillOpacity` preserved from the caller-supplied default style.
 *
 * @format
 */

import {buildNeighbourhoodStyleByArea} from '../src/map/neighbourhoodColours';
import type {PolygonLayerStyle} from '../src/map/mapConstants';
import type {PassportNeighbourhood} from '../src/places/passportData';

const DEFAULT_STYLE: PolygonLayerStyle = {
  color: '#8A8A8A',
  weight: 1,
  fillColor: '#CFCFCF',
  fillOpacity: 0.25,
};

function fixtureNeighbourhood(
  overrides: Partial<PassportNeighbourhood> & {id: string; name: string},
): PassportNeighbourhood {
  return {
    displayTitle: null,
    colours: {
      stem: `${overrides.id}Stem`,
      backgroundRgb: [1, 2, 3],
      backgroundHex: '#000000',
      frameRgb: [4, 5, 6],
      frameHex: '#111111',
    },
    connectedAreas: [],
    parent: null,
    neighbourhoodRating: null,
    ...overrides,
  };
}

const THE_LOOP = fixtureNeighbourhood({
  id: 'the-loop',
  name: 'The Loop',
  connectedAreas: ['Loop'],
  colours: {
    stem: 'loopBlue',
    backgroundRgb: [219, 229, 242],
    backgroundHex: '#DBE5F2',
    frameRgb: [62, 100, 150],
    frameHex: '#3E6496',
  },
});

const SOUTH_LOOP = fixtureNeighbourhood({
  id: 'south-loop',
  name: 'South Loop',
  connectedAreas: ['Loop'],
  parent: {kind: 'neighbourhood', id: 'the-loop'},
  colours: {
    stem: 'southSage',
    backgroundRgb: [218, 235, 218],
    backgroundHex: '#DAEBDA',
    frameRgb: [70, 120, 70],
    frameHex: '#467846',
  },
});

const PILSEN = fixtureNeighbourhood({
  id: 'pilsen',
  name: 'Pilsen',
  connectedAreas: ['Lower West Side'],
  parent: {kind: 'layerArea', priNeigh: 'Lower West Side'},
  colours: {
    stem: 'pilsenMagenta',
    backgroundRgb: [245, 218, 232],
    backgroundHex: '#F5DAE8',
    frameRgb: [155, 60, 105],
    frameHex: '#9B3C69',
  },
});

const BRONZEVILLE = fixtureNeighbourhood({
  id: 'bronzeville',
  name: 'Bronzeville',
  connectedAreas: ['Douglas', 'Grand Boulevard'],
  colours: {
    stem: 'bronzeAmber',
    backgroundRgb: [245, 228, 200],
    backgroundHex: '#F5E4C8',
    frameRgb: [165, 100, 20],
    frameHex: '#A56414',
  },
});

const LAKEVIEW = fixtureNeighbourhood({
  id: 'lakeview',
  name: 'Lakeview',
  connectedAreas: ['Lake View'],
});

const ROSCOE_VILLAGE = fixtureNeighbourhood({
  id: 'roscoe-village',
  name: 'Roscoe Village',
  connectedAreas: ['North Center'],
});

describe('buildNeighbourhoodStyleByArea', () => {
  it('colours a plain parentless neighbourhood using its own frame/background hex', () => {
    const result = buildNeighbourhoodStyleByArea([LAKEVIEW], DEFAULT_STYLE);
    expect(result).toEqual({
      'Lake View': {
        color: LAKEVIEW.colours.frameHex,
        weight: DEFAULT_STYLE.weight,
        fillColor: LAKEVIEW.colours.backgroundHex,
        fillOpacity: DEFAULT_STYLE.fillOpacity,
      },
    });
  });

  it('maps a normalised alias area (Roscoe Village -> North Center) by the area key alone', () => {
    const result = buildNeighbourhoodStyleByArea([ROSCOE_VILLAGE], DEFAULT_STYLE);
    expect(Object.keys(result)).toEqual(['North Center']);
    expect(result['North Center'].fillColor).toBe(ROSCOE_VILLAGE.colours.backgroundHex);
  });

  it('colours both of Bronzeville two connected areas with the same colour pair', () => {
    const result = buildNeighbourhoodStyleByArea([BRONZEVILLE], DEFAULT_STYLE);
    expect(Object.keys(result).sort()).toEqual(['Douglas', 'Grand Boulevard']);
    expect(result.Douglas).toEqual(result['Grand Boulevard']);
    expect(result.Douglas.color).toBe(BRONZEVILLE.colours.frameHex);
    expect(result.Douglas.fillColor).toBe(BRONZEVILLE.colours.backgroundHex);
  });

  it('precedence: The Loop beats South Loop on the shared "Loop" area', () => {
    const result = buildNeighbourhoodStyleByArea([THE_LOOP, SOUTH_LOOP], DEFAULT_STYLE);
    expect(result.Loop.color).toBe(THE_LOOP.colours.frameHex);
    expect(result.Loop.fillColor).toBe(THE_LOOP.colours.backgroundHex);

    // Order independence: the parentless neighbourhood wins regardless
    // of array position, never by position alone.
    const reversed = buildNeighbourhoodStyleByArea([SOUTH_LOOP, THE_LOOP], DEFAULT_STYLE);
    expect(reversed.Loop).toEqual(result.Loop);
  });

  it('precedence: a sub-neighbourhood colours an area no parentless neighbourhood claims (Pilsen -> Lower West Side)', () => {
    const result = buildNeighbourhoodStyleByArea([PILSEN], DEFAULT_STYLE);
    expect(result['Lower West Side'].color).toBe(PILSEN.colours.frameHex);
    expect(result['Lower West Side'].fillColor).toBe(PILSEN.colours.backgroundHex);
  });

  it('leaves an area with no connected neighbourhood absent, so the caller default applies', () => {
    const result = buildNeighbourhoodStyleByArea([LAKEVIEW], DEFAULT_STYLE);
    expect(result.Albany).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result, 'Not A Real Area')).toBe(false);
  });

  it('inherits weight and fillOpacity unchanged from the caller-supplied default style', () => {
    const customDefault: PolygonLayerStyle = {
      color: '#000000',
      weight: 7,
      fillColor: '#FFFFFF',
      fillOpacity: 0.9,
    };
    const result = buildNeighbourhoodStyleByArea([LAKEVIEW], customDefault);
    expect(result['Lake View'].weight).toBe(7);
    expect(result['Lake View'].fillOpacity).toBe(0.9);
    // color/fillColor are overridden, never inherited from the default.
    expect(result['Lake View'].color).not.toBe(customDefault.color);
    expect(result['Lake View'].fillColor).not.toBe(customDefault.fillColor);
  });

  it('throws if two parentless neighbourhoods both claim the same area', () => {
    const conflictingParentless = fixtureNeighbourhood({
      id: 'conflict',
      name: 'Conflict',
      connectedAreas: ['Loop'],
    });
    expect(() =>
      buildNeighbourhoodStyleByArea([THE_LOOP, conflictingParentless], DEFAULT_STYLE),
    ).toThrow();
  });

  it('builds the full 17-neighbourhood dictionary deterministically regardless of call order', () => {
    const all = [THE_LOOP, SOUTH_LOOP, PILSEN, BRONZEVILLE, LAKEVIEW, ROSCOE_VILLAGE];
    const first = buildNeighbourhoodStyleByArea(all, DEFAULT_STYLE);
    const second = buildNeighbourhoodStyleByArea(all, DEFAULT_STYLE);
    expect(first).toEqual(second);
    expect(Object.keys(first).sort()).toEqual(
      ['Loop', 'Lower West Side', 'Douglas', 'Grand Boulevard', 'Lake View', 'North Center'].sort(),
    );
  });
});
