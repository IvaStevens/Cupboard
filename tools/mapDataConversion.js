'use strict';

/**
 * Pure GeoJSON normaliser for the map layers. All source files are GeoJSON
 * from the Chicago Data Portal. This module touches no filesystem; see
 * tools/convertMapData.js for the developer-run CLI that reads the real
 * source files and writes the committed assets.
 *
 * Normalisation applied to every feature:
 *  - coordinates rounded to COORDINATE_PRECISION decimal places (the
 *    source carries up to 15; AC9 caps the committed data at 6);
 *  - properties reduced to a per-layer WHITELIST (LAYER_WHITELISTS below)
 *    - every Socrata ':'-prefixed field (:id, :version, :created_at,
 *      :updated_at, :@computed_region_*) is dropped because it is not in
 *      any whitelist, as are rail stations' point_x/point_y (State Plane
 *      feet, misleading next to lon/lat geometry), address/pknrd, and
 *      shape_len/shape_area;
 *  - output is a plain object tree, serialised with no pretty-print
 *    whitespace by the caller (see wrapAsRegisterLayerScript / toCompactJson).
 *
 * @format
 */

/** AC9: coordinates rounded to at most this many decimal places. */
const COORDINATE_PRECISION = 6;

/**
 * Per-layer property whitelist, keyed by the same layer id used in
 * src/map/mapLayers.ts. Every key not listed here is dropped, including
 * every Socrata ':'-prefixed field (those never appear in any list, so
 * they are dropped by omission, not by name-matching ':' - simpler and
 * safe against a column Socrata adds later).
 */
const LAYER_WHITELISTS = Object.freeze({
  'cta-rail-lines': Object.freeze(['lines', 'description', 'type', 'legend']),
  'cta-rail-stations': Object.freeze([
    'station_id',
    'longname',
    'lines',
    'ada',
    'legend',
  ]),
  'cta-bus-routes': Object.freeze(['route', 'name', 'wkday', 'sat', 'sun']),
  'cta-bus-stops': Object.freeze([
    'systemstop',
    'public_nam',
    'routesstpg',
    'dir',
  ]),
  'chicago-neighbourhoods': Object.freeze(['pri_neigh', 'sec_neigh']),
  'chicago-bike-routes': Object.freeze([
    'street',
    'st_name',
    'displayrou',
    'oneway_dir',
    'f_street',
    't_street',
  ]),
});

function roundCoordinateValue(value) {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

/**
 * Recurses through a GeoJSON `coordinates` array of any nesting depth
 * (Point: [x,y]; MultiLineString: [[[x,y],...],...]; MultiPolygon one
 * level deeper still) and rounds every numeric leaf.
 */
function roundCoordinates(coordinates) {
  if (typeof coordinates[0] === 'number') {
    return coordinates.map(roundCoordinateValue);
  }
  return coordinates.map(roundCoordinates);
}

function pickWhitelistedProperties(properties, whitelist) {
  const out = {};
  for (const key of whitelist) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) {
      out[key] = properties[key];
    }
  }
  return out;
}

function convertFeature(feature, whitelist) {
  return {
    type: 'Feature',
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoordinates(feature.geometry.coordinates),
    },
    properties: pickWhitelistedProperties(feature.properties || {}, whitelist),
  };
}

/**
 * Converts one source FeatureCollection, applying `whitelist` to every
 * feature's properties. Does not look at `layerId` - callers pick the
 * right whitelist via LAYER_WHITELISTS so this function stays a pure,
 * single-layer transform (easy to unit test without a layer registry).
 */
function convertFeatureCollection(source, whitelist) {
  if (
    !source ||
    source.type !== 'FeatureCollection' ||
    !Array.isArray(source.features)
  ) {
    throw new Error(
      'convertFeatureCollection: expected a GeoJSON FeatureCollection',
    );
  }
  return {
    type: 'FeatureCollection',
    features: source.features.map(feature => convertFeature(feature, whitelist)),
  };
}

/** MultiLineString feature count differs from LINE PART count; both are useful for the data note. */
function countMultiLineStringParts(featureCollection) {
  let parts = 0;
  for (const feature of featureCollection.features) {
    if (feature.geometry.type === 'MultiLineString') {
      parts += feature.geometry.coordinates.length;
    }
  }
  return parts;
}

function toCompactJson(value) {
  return JSON.stringify(value);
}

/**
 * The committed asset format (AC10/AC8): the whole file is one call to
 * the page-global `cupboardRegisterLayer`, so loading it is a <script>
 * subresource load (see map.html) rather than a fetch/XHR that the
 * WebView's unset file-access flags would block.
 */
function wrapAsRegisterLayerScript(layerId, featureCollection) {
  return `cupboardRegisterLayer(${JSON.stringify(layerId)}, ${toCompactJson(
    featureCollection,
  )});\n`;
}

module.exports = {
  COORDINATE_PRECISION,
  LAYER_WHITELISTS,
  roundCoordinateValue,
  roundCoordinates,
  pickWhitelistedProperties,
  convertFeature,
  convertFeatureCollection,
  countMultiLineStringParts,
  toCompactJson,
  wrapAsRegisterLayerScript,
};
