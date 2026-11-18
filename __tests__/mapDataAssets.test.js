/**
 * Guards the COMMITTED assets under
 * android/app/src/main/assets/mapdata/ (AC1/AC5/AC6/AC9): exact feature
 * counts against the portal GeoJSON snapshot actually converted, none of the forbidden internal/third-party
 * markers, no Socrata ':'-prefixed property survives, coordinates
 * rounded to at most 6 decimal places, and no pretty-print whitespace.
 *
 * Reads these files with `fs`, not `require` - jest.config.js excludes
 * android/app/src/main/assets/mapdata/ from the Jest haste map via
 * `modulePathIgnorePatterns`, so `require` would not resolve them even
 * if it were attempted.
 *
 * @format
 */

const fs = require('fs');
const path = require('path');

const MAPDATA_DIR = path.resolve(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'mapdata',
);

const LICENCES_DIR = path.resolve(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'licences',
);

const LAYER_FILES = [
  {assetFile: 'cta-rail-lines.geojson.js', layerId: 'cta-rail-lines', expectedCount: 153},
  {
    assetFile: 'cta-rail-stations.geojson.js',
    layerId: 'cta-rail-stations',
    expectedCount: 145,
  },
  {assetFile: 'cta-bus-routes.geojson.js', layerId: 'cta-bus-routes', expectedCount: 127},
  {assetFile: 'cta-bus-stops.geojson.js', layerId: 'cta-bus-stops', expectedCount: 10760},
  {
    assetFile: 'chicago-neighbourhoods.geojson.js',
    layerId: 'chicago-neighbourhoods',
    expectedCount: 98,
  },
];

const FORBIDDEN_MARKERS = [
  'gisweb',
  'joneslanglasalle',
  'CTALogo',
  'PHOTOLINK',
  'JLLINK',
  '<table',
];

function readAndParseLayerAsset(assetFile) {
  const filePath = path.join(MAPDATA_DIR, assetFile);
  const content = fs.readFileSync(filePath, 'utf8');
  // The committed format: `cupboardRegisterLayer("<id>", <geojson>);\n`
  const match = content.match(/^cupboardRegisterLayer\("([^"]+)", ([\s\S]*)\);\n$/);
  expect(match).not.toBeNull();
  const [, id, geojsonText] = match;
  return {content, id, geojson: JSON.parse(geojsonText)};
}

function maxDecimalPlaces(coordinates, currentMax) {
  if (typeof coordinates[0] === 'number') {
    let max = currentMax;
    for (const value of coordinates) {
      const text = String(value);
      const dotIndex = text.indexOf('.');
      const places = dotIndex === -1 ? 0 : text.length - dotIndex - 1;
      if (places > max) {
        max = places;
      }
    }
    return max;
  }
  return coordinates.reduce((max, nested) => maxDecimalPlaces(nested, max), currentMax);
}

describe('committed map-data assets', () => {
  it.each(LAYER_FILES)(
    '$assetFile: registers layer id $layerId with exactly $expectedCount features',
    ({assetFile, layerId, expectedCount}) => {
      const {id, geojson} = readAndParseLayerAsset(assetFile);
      expect(id).toBe(layerId);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toHaveLength(expectedCount);
    },
  );

  it.each(LAYER_FILES)(
    '$assetFile: carries none of the forbidden internal/third-party markers',
    ({assetFile}) => {
      const {content} = readAndParseLayerAsset(assetFile);
      for (const marker of FORBIDDEN_MARKERS) {
        expect(content).not.toContain(marker);
      }
    },
  );

  it.each(LAYER_FILES)('$assetFile: drops every Socrata \':\'-prefixed property', ({assetFile}) => {
    const {geojson} = readAndParseLayerAsset(assetFile);
    for (const feature of geojson.features) {
      for (const key of Object.keys(feature.properties)) {
        expect(key.startsWith(':')).toBe(false);
      }
    }
  });

  it.each(LAYER_FILES)(
    '$assetFile: drops rail stations\' point_x/point_y State Plane fields',
    ({assetFile}) => {
      const {geojson} = readAndParseLayerAsset(assetFile);
      for (const feature of geojson.features) {
        expect(feature.properties.point_x).toBeUndefined();
        expect(feature.properties.point_y).toBeUndefined();
      }
    },
  );

  it.each(LAYER_FILES)(
    '$assetFile: coordinates are rounded to at most 6 decimal places',
    ({assetFile}) => {
      const {geojson} = readAndParseLayerAsset(assetFile);
      let max = 0;
      for (const feature of geojson.features) {
        max = maxDecimalPlaces(feature.geometry.coordinates, max);
      }
      expect(max).toBeLessThanOrEqual(6);
    },
  );

  it.each(LAYER_FILES)('$assetFile: is serialised with no pretty-print whitespace', ({assetFile}) => {
    const {content} = readAndParseLayerAsset(assetFile);
    // The whole GeoJSON payload is one line - JSON.stringify with no
    // indent argument never inserts a newline, so any newline inside the
    // payload (i.e. after the opening `cupboardRegisterLayer(` line)
    // would mean pretty-printing crept back in.
    expect(content.trim().split('\n')).toHaveLength(1);
  });

  it('every rail-line feature keeps the full route list and a human-readable name', () => {
    const {geojson} = readAndParseLayerAsset('cta-rail-lines.geojson.js');
    for (const feature of geojson.features) {
      expect(typeof feature.properties.lines).toBe('string');
      expect(feature.properties.lines.length).toBeGreaterThan(0);
    }
  });
});

describe('committed licence/terms assets', () => {
  it('ships the sanitised CTA agreement as UTF-8 with no injected ad-block style or CTA logo <img>', () => {
    const filePath = path.join(LICENCES_DIR, 'cta-developer-license-agreement.html');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('charset=utf-8');
    expect(content).not.toContain('charset=windows-1252');
    expect(content).not.toContain('google_ads_iframe');
    expect(content).not.toContain('<img');
    expect(content).not.toContain('developers_license_agreement_files');
    expect(content).toContain('Developer License Agreement');
  });

  it('ships the City of Chicago terms as plain text covering all four sections', () => {
    const filePath = path.join(LICENCES_DIR, 'chicago-terms-of-use.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    for (const heading of [
      'DISCLAIMER OF LIABILITY',
      'USE OF DATA',
      'RESERVATION OF RIGHTS',
      'INDEMNITY',
    ]) {
      expect(content).toContain(heading);
    }
    expect(content).toContain(
      'This site provides applications using data that has been modified for use from its original source',
    );
    expect(content).not.toContain('<p>');
    expect(content).not.toContain('<html');
  });

  it('ships the neighbourhoods dataset licence as a short text record, not the saved landing page', () => {
    const filePath = path.join(LICENCES_DIR, 'neighbourhoods-dataset-licence.txt');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('Neighborhoods_2012b');
    expect(content).toContain('City of Chicago');
    expect(content).toContain('SEE_TERMS_OF_USE');
    expect(content.length).toBeLessThan(10000);
  });
});
