/**
 * CUPBOARD-4: the route-name -> colour mapping for all 16 distinct rail
 * route names (including every multi-route label and both Blue Line
 * branches), the bus colour's distinctness, per-layer credit grouping,
 * and that layer ids never collide with view ids.
 *
 * @format
 */

import {RAIL_ROUTE_COLOURS} from '../src/map/mapConstants';
import {
  buildRailColourByName,
  RAIL_LINE_NAMES,
  railRouteKeyFromName,
} from '../src/map/railRoutes';
import {isLayerId, MAP_LAYER_IDS, MAP_LAYERS} from '../src/map/mapLayers';
import {LICENCES_VIEW_ID, MAP_VIEW_ID, SIDEBAR_ENTRIES} from '../src/shell/navEntries';
import {BUS_ROUTE_COLOUR} from '../src/map/mapConstants';

describe('rail route colours', () => {
  // The exact 16 names verified against the source data (ticket AC3 /
  // the architect's notes), each mapped to its expected colour KEY.
  const EXPECTED_KEY_BY_NAME: Record<string, string> = {
    'Red Line': 'red',
    "Blue Line (O'Hare)": 'blue',
    'Blue Line (Forest Park)': 'blue',
    'Brown Line': 'brown',
    'Green Line': 'green',
    'Orange Line': 'orange',
    'Pink Line': 'pink',
    'Purple Line': 'purple',
    'Yellow Line': 'yellow',
    'Red, Purple Line': 'red',
    'Brown, Purple (Express), Red': 'brown',
    'Brown, Green, Orange, Pink, Purple (Exp)': 'brown',
    'Green, Pink': 'green',
    'Green, Orange': 'green',
    'Brown, Purple': 'brown',
    'Brown, Orange, Pink, Purple (Express)': 'brown',
  };

  it('has exactly 16 distinct names, matching the verified source data', () => {
    expect(RAIL_LINE_NAMES).toHaveLength(16);
    expect(new Set(RAIL_LINE_NAMES).size).toBe(16);
    expect(new Set(RAIL_LINE_NAMES)).toEqual(
      new Set(Object.keys(EXPECTED_KEY_BY_NAME)),
    );
  });

  it.each(Object.entries(EXPECTED_KEY_BY_NAME))(
    'resolves %s to the %s colour key (first route named wins)',
    (name, expectedKey) => {
      expect(railRouteKeyFromName(name)).toBe(expectedKey);
    },
  );

  it('throws for a route name with no recognised first route', () => {
    expect(() => railRouteKeyFromName('Silver Line')).toThrow();
    expect(() => railRouteKeyFromName('')).toThrow();
  });

  it('gives every one of the 8 colour keys a distinct, defined colour', () => {
    const keys = Object.keys(RAIL_ROUTE_COLOURS);
    expect(keys.sort()).toEqual(
      ['blue', 'brown', 'green', 'orange', 'pink', 'purple', 'red', 'yellow'].sort(),
    );
    const colours = Object.values(RAIL_ROUTE_COLOURS);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('builds a {name: colour} dictionary covering all 16 names', () => {
    const dictionary = buildRailColourByName();
    expect(Object.keys(dictionary).sort()).toEqual([...RAIL_LINE_NAMES].sort());
    for (const name of RAIL_LINE_NAMES) {
      expect(dictionary[name]).toBe(RAIL_ROUTE_COLOURS[railRouteKeyFromName(name)]);
    }
  });
});

describe('bus route colour', () => {
  it('is distinct from every one of the 8 rail route colours', () => {
    const railColours = Object.values(RAIL_ROUTE_COLOURS);
    expect(railColours).not.toContain(BUS_ROUTE_COLOUR);
  });
});

describe('map layers', () => {
  it('defines exactly the five required layers, in picker order', () => {
    expect(MAP_LAYERS.map(layer => layer.id)).toEqual([
      'cta-rail-lines',
      'cta-rail-stations',
      'cta-bus-routes',
      'cta-bus-stops',
      'chicago-neighbourhoods',
    ]);
  });

  it('assigns each of the four CTA layers to the cta credit group and neighbourhoods to its own', () => {
    const ctaLayers = MAP_LAYERS.filter(layer => layer.creditGroup === 'cta');
    expect(ctaLayers.map(layer => layer.id)).toEqual([
      'cta-rail-lines',
      'cta-rail-stations',
      'cta-bus-routes',
      'cta-bus-stops',
    ]);
    const neighbourhoodLayers = MAP_LAYERS.filter(
      layer => layer.creditGroup === 'neighbourhoods',
    );
    expect(neighbourhoodLayers.map(layer => layer.id)).toEqual([
      'chicago-neighbourhoods',
    ]);
  });

  it('gives every layer a distinct asset file', () => {
    const assetFiles = MAP_LAYERS.map(layer => layer.assetFile);
    expect(new Set(assetFiles).size).toBe(assetFiles.length);
  });

  it('isLayerId recognises exactly the five real ids', () => {
    for (const id of MAP_LAYER_IDS) {
      expect(isLayerId(id)).toBe(true);
    }
    expect(isLayerId('not-a-layer')).toBe(false);
    expect(isLayerId('')).toBe(false);
  });

  it('has layer ids disjoint from every view id (map/settings/places/notes/licences)', () => {
    const viewIds = new Set<string>([
      MAP_VIEW_ID,
      LICENCES_VIEW_ID,
      ...SIDEBAR_ENTRIES.map(entry => entry.id),
    ]);
    for (const id of MAP_LAYER_IDS) {
      expect(viewIds.has(id)).toBe(false);
    }
  });
});
