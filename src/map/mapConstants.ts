/**
 * Single source of truth for every parameter the Leaflet map needs.
 *
 * Nothing here is ever duplicated into map.html: these values are passed
 * into the page as one JSON-stringified config via
 * `buildMapInitScript()` (see mapInitScript.ts), which calls
 * `window.initLeafletMap(<config>)`. map.html itself carries no
 * coordinate, zoom, tile URL or attribution string.
 *
 * @format
 */

/** Chicago latitude, the pinned initial map centre. */
export const CHICAGO_LATITUDE = 41.8781;

/** Chicago longitude, the pinned initial map centre. */
export const CHICAGO_LONGITUDE = -87.6298;

/** Initial Leaflet zoom level. */
export const INITIAL_ZOOM = 12;

/** Maximum zoom level the tile layer will request. */
export const MAP_MAX_ZOOM = 19;

/** Standard OpenStreetMap HTTPS tile endpoint, with no prefetching. */
export const OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Attribution HTML shown on the map; deliberately not followable. */
export const OSM_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Directory the bundled Leaflet assets live under, as a file:// URI. */
export const MAP_ASSET_DIR_URI = 'file:///android_asset/leaflet/';

/** The map.html document, as a file:// URI, loaded by the WebView. */
export const MAP_HTML_ASSET_URI = `${MAP_ASSET_DIR_URI}map.html`;

/** One grep-able tag shared by every diagnostic line this feature logs. */
export const MAP_LOG_TAG = '[CupboardMap]';
