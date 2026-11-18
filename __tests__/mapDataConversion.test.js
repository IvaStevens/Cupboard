/**
 * Unit tests for tools/mapDataConversion.js's pure GeoJSON normaliser:
 * whitelist filtering (Socrata ':'-prefixed fields dropped by
 * omission), 6-decimal-place coordinate rounding, MultiLineString part
 * counting, and the no-pretty-print wrapped output format.
 *
 * @format
 */

const {
  LAYER_WHITELISTS,
  convertFeature,
  convertFeatureCollection,
  countMultiLineStringParts,
  roundCoordinateValue,
  roundCoordinates,
  wrapAsRegisterLayerScript,
} = require('../tools/mapDataConversion');

describe('roundCoordinateValue / roundCoordinates', () => {
  it('rounds to at most 6 decimal places', () => {
    expect(roundCoordinateValue(-87.62759609703375)).toBe(-87.627596);
    expect(roundCoordinateValue(41.8781234567)).toBe(41.878123);
  });

  it('recurses through Point, MultiLineString and MultiPolygon nesting depths', () => {
    expect(roundCoordinates([-87.123456789, 41.123456789])).toEqual([
      -87.123457, 41.123457,
    ]);
    expect(
      roundCoordinates([[[-87.123456789, 41.1], [-87.2, 41.123456789]]]),
    ).toEqual([[[-87.123457, 41.1], [-87.2, 41.123457]]]);
  });
});

describe('convertFeature', () => {
  it('keeps only whitelisted properties', () => {
    const feature = {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [-87.1, 41.1]},
      properties: {
        ':id': 'row-abc',
        ':version': 'rv-abc',
        point_x: '1144440.97667316',
        point_y: '1896352.78926296',
        station_id: '970',
        longname: 'Cicero-Congress',
        lines: "Blue Line (Congress)",
        ada: false,
        legend: 'Blue Line',
      },
    };
    const converted = convertFeature(feature, LAYER_WHITELISTS['cta-rail-stations']);
    expect(converted.properties).toEqual({
      station_id: '970',
      longname: 'Cicero-Congress',
      lines: 'Blue Line (Congress)',
      ada: false,
      legend: 'Blue Line',
    });
    expect(converted.properties[':id']).toBeUndefined();
    expect(converted.properties.point_x).toBeUndefined();
    expect(converted.properties.point_y).toBeUndefined();
  });

  it('rounds the feature geometry coordinates', () => {
    const feature = {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [-87.123456789, 41.987654321]},
      properties: {},
    };
    const converted = convertFeature(feature, []);
    expect(converted.geometry.coordinates).toEqual([-87.123457, 41.987654]);
  });

  it('drops a property not present on the source feature without throwing', () => {
    const feature = {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [0, 0]},
      properties: {lines: 'Red Line'},
    };
    const converted = convertFeature(feature, ['lines', 'legend']);
    expect(converted.properties).toEqual({lines: 'Red Line'});
  });
});

describe('convertFeatureCollection', () => {
  it('converts every feature and preserves feature count', () => {
    const source = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [0, 0]},
          properties: {':id': 'x', pri_neigh: 'Loop', sec_neigh: 'LOOP'},
        },
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [1, 1]},
          properties: {':id': 'y', pri_neigh: 'Printers Row', sec_neigh: null},
        },
      ],
    };
    const converted = convertFeatureCollection(
      source,
      LAYER_WHITELISTS['chicago-neighbourhoods'],
    );
    expect(converted.type).toBe('FeatureCollection');
    expect(converted.features).toHaveLength(2);
    expect(converted.features[0].properties).toEqual({
      pri_neigh: 'Loop',
      sec_neigh: 'LOOP',
    });
  });

  it('throws on a non-FeatureCollection input', () => {
    expect(() => convertFeatureCollection({type: 'Feature'}, [])).toThrow();
    expect(() => convertFeatureCollection(null, [])).toThrow();
  });
});

describe('countMultiLineStringParts', () => {
  it('counts MultiLineString parts, ignoring other geometry types', () => {
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [[0, 0], [1, 1]],
              [[2, 2], [3, 3]],
            ],
          },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [0, 0]},
          properties: {},
        },
      ],
    };
    expect(countMultiLineStringParts(featureCollection)).toBe(2);
  });
});

describe('wrapAsRegisterLayerScript', () => {
  it('wraps the GeoJSON in one cupboardRegisterLayer call with no pretty-print whitespace', () => {
    const featureCollection = {type: 'FeatureCollection', features: []};
    const script = wrapAsRegisterLayerScript('cta-rail-lines', featureCollection);
    expect(script).toBe(
      'cupboardRegisterLayer("cta-rail-lines", {"type":"FeatureCollection","features":[]});\n',
    );
    expect(script).not.toMatch(/\n {2}/);
  });
});

describe('LAYER_WHITELISTS', () => {
  it('defines a whitelist for all five layers', () => {
    expect(Object.keys(LAYER_WHITELISTS).sort()).toEqual(
      [
        'cta-rail-lines',
        'cta-rail-stations',
        'cta-bus-routes',
        'cta-bus-stops',
        'chicago-neighbourhoods',
      ].sort(),
    );
  });

  it('never whitelists a Socrata \':\'-prefixed field or point_x/point_y', () => {
    for (const whitelist of Object.values(LAYER_WHITELISTS)) {
      for (const key of whitelist) {
        expect(key.startsWith(':')).toBe(false);
        expect(key).not.toBe('point_x');
        expect(key).not.toBe('point_y');
      }
    }
  });
});
