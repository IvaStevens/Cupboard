#!/usr/bin/env node
'use strict';

/**
 * Developer-run CLI: reads the five portal GeoJSON files from the
 * gitignored 'Chicago Data Portal/' folder (present only in the main
 * checkout) and writes the five committed
 * android/app/src/main/assets/mapdata/*.geojson.js files. Never wired
 * into Gradle or Metro - re-run by hand (see package.json's
 * "convert:map-data" script) when
 * the source data is refreshed.
 *
 * Fails loudly, before writing anything, if a source file is missing or
 * its feature count does not match the count recorded here - a silent
 * count drift is exactly the kind of error that should not be
 * swallowed.
 *
 * Usage:
 *   node tools/convertMapData.js "<path to 'Chicago Data Portal'>"
 *
 * @format
 */

const fs = require('fs');
const path = require('path');
const {
  LAYER_WHITELISTS,
  convertFeatureCollection,
  countMultiLineStringParts,
  wrapAsRegisterLayerScript,
} = require('./mapDataConversion');

/**
 * Source file names, the asset file each becomes, and the feature count
 * verified against the portal snapshot. These are the four CTA portal
 * exports plus the neighbourhoods file.
 */
const SOURCE_SPECS = [
  {
    id: 'cta-rail-lines',
    sourceFile: "CTA_-_'L'_(Rail)_Lines_20261117.geojson",
    assetFile: 'cta-rail-lines.geojson.js',
    expectedFeatureCount: 153,
  },
  {
    id: 'cta-rail-stations',
    sourceFile: "CTA_-_'L'_(Rail)_Stations_20261117.geojson",
    assetFile: 'cta-rail-stations.geojson.js',
    expectedFeatureCount: 145,
  },
  {
    id: 'cta-bus-routes',
    sourceFile: 'CTA_-_Bus_Routes_20261117.geojson',
    assetFile: 'cta-bus-routes.geojson.js',
    expectedFeatureCount: 127,
  },
  {
    id: 'cta-bus-stops',
    sourceFile: 'CTA_BusStops_20261117.geojson',
    assetFile: 'cta-bus-stops.geojson.js',
    expectedFeatureCount: 10760,
  },
  {
    id: 'chicago-neighbourhoods',
    sourceFile: 'Neighborhoods_2012b_20261117.geojson',
    assetFile: 'chicago-neighbourhoods.geojson.js',
    expectedFeatureCount: 98,
  },
];

function main() {
  const sourceDirArg = process.argv[2];
  if (!sourceDirArg) {
    console.error(
      'Usage: node tools/convertMapData.js "<path to \'Chicago Data Portal\'>"',
    );
    process.exitCode = 1;
    return;
  }
  const sourceDir = path.resolve(sourceDirArg);
  const outputDir = path.resolve(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'assets',
    'mapdata',
  );

  // Validate every source first - fail loudly before writing anything,
  // rather than leaving a partially-converted asset directory.
  const loaded = [];
  for (const spec of SOURCE_SPECS) {
    const sourcePath = path.join(sourceDir, spec.sourceFile);
    if (!fs.existsSync(sourcePath)) {
      console.error(`convertMapData: missing source file ${sourcePath}`);
      process.exitCode = 1;
      return;
    }
    const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    if (
      !raw ||
      raw.type !== 'FeatureCollection' ||
      !Array.isArray(raw.features)
    ) {
      console.error(
        `convertMapData: ${spec.sourceFile} is not a GeoJSON FeatureCollection`,
      );
      process.exitCode = 1;
      return;
    }
    if (raw.features.length !== spec.expectedFeatureCount) {
      console.error(
        `convertMapData: ${spec.sourceFile} has ${raw.features.length} features, expected ${spec.expectedFeatureCount}. ` +
          'Update the expected count here if this is an intentional refresh.',
      );
      process.exitCode = 1;
      return;
    }
    loaded.push({spec, raw});
  }

  fs.mkdirSync(outputDir, {recursive: true});

  for (const {spec, raw} of loaded) {
    const whitelist = LAYER_WHITELISTS[spec.id];
    const converted = convertFeatureCollection(raw, whitelist);
    const script = wrapAsRegisterLayerScript(spec.id, converted);
    const outputPath = path.join(outputDir, spec.assetFile);
    fs.writeFileSync(outputPath, script, 'utf8');
    const parts = countMultiLineStringParts(converted);
    console.log(
      `convertMapData: wrote ${outputPath} ` +
        `(${converted.features.length} features` +
        (parts > 0 ? `, ${parts} MultiLineString parts` : '') +
        `, ${Buffer.byteLength(script, 'utf8')} bytes)`,
    );
  }
}

main();
