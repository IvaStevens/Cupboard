/**
 * Builds the two injectedJavaScript strings MapScreen.tsx uses:
 * `buildMapInitScript()` (the one-time `window.initLeafletMap(<config>)`
 * call, run once per WebView load/reload) and `buildSetLayersScript()`
 * (the repeatable `window.cupboardSetLayers(<ids>)` call that drives
 * CUPBOARD-4 toggleable layers).
 *
 * This module is component-free: it imports no react-native-webview and
 * depends on nothing but mapConstants/railRoutes/mapLayers, so it is
 * assertable in a plain Jest test without the react-native-webview mock.
 *
 * Every map parameter is read from mapConstants (plus the layer list
 * from mapLayers and the rail colour rule from railRoutes) and passed
 * into the page as a single JSON-stringified config - never duplicated
 * as a literal into map.html. Both builder functions must stay pure and
 * deterministic (map.test.tsx compares `buildMapInitScript()`'s output
 * with `toBe`): no `Set` iteration, no `Date`, no non-deterministic
 * object key order.
 *
 * @format
 */

import {
  BIKE_ROUTE_COLOUR,
  BIKE_ROUTE_WEIGHT,
  BUS_ROUTE_COLOUR,
  BUS_ROUTE_WEIGHT,
  BUS_STOP_STYLE,
  BUS_STOPS_MIN_ZOOM,
  CHICAGO_CREDIT_TEXT,
  CHICAGO_LATITUDE,
  CHICAGO_LONGITUDE,
  CTA_CREDIT_TEXT,
  INITIAL_ZOOM,
  MAP_DATA_DIR_RELATIVE,
  MAP_MAX_ZOOM,
  MAP_LOG_TAG,
  NEIGHBOURHOOD_PANE_NAME,
  NEIGHBOURHOOD_PANE_Z_INDEX,
  NEIGHBOURHOOD_STYLE,
  OSM_ATTRIBUTION_HTML,
  OSM_TILE_URL_TEMPLATE,
  RAIL_LINE_WEIGHT,
  RAIL_STATION_STYLE,
  type CircleLayerStyle,
  type PolygonLayerStyle,
} from './mapConstants';
import {buildRailColourByName} from './railRoutes';
import {MAP_LAYERS, type LayerId} from './mapLayers';

export interface MapInitConfigLayer {
  id: LayerId;
  assetFile: string;
  kind: string;
  creditGroup: string;
}

export interface MapInitConfig {
  latitude: number;
  longitude: number;
  zoom: number;
  maxZoom: number;
  tileUrlTemplate: string;
  attributionHtml: string;
  preferCanvas: boolean;
  mapDataDir: string;
  layers: MapInitConfigLayer[];
  railColourByName: Record<string, string>;
  railLineWeight: number;
  busRouteColour: string;
  busRouteWeight: number;
  bikeRouteColour: string;
  bikeRouteWeight: number;
  stationStyle: CircleLayerStyle;
  busStopStyle: CircleLayerStyle;
  neighbourhoodStyle: PolygonLayerStyle;
  busStopsMinZoom: number | null;
  neighbourhoodPane: {name: string; zIndex: number};
  creditTexts: {cta: string; chicago: string};
}

/** Pure, so a test can assert the config without parsing injected JS. */
export function buildMapInitConfig(): MapInitConfig {
  return {
    latitude: CHICAGO_LATITUDE,
    longitude: CHICAGO_LONGITUDE,
    zoom: INITIAL_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
    tileUrlTemplate: OSM_TILE_URL_TEMPLATE,
    attributionHtml: OSM_ATTRIBUTION_HTML,
    preferCanvas: true,
    mapDataDir: MAP_DATA_DIR_RELATIVE,
    layers: MAP_LAYERS.map(layer => ({
      id: layer.id,
      assetFile: layer.assetFile,
      kind: layer.kind,
      creditGroup: layer.creditGroup,
    })),
    railColourByName: buildRailColourByName(),
    railLineWeight: RAIL_LINE_WEIGHT,
    busRouteColour: BUS_ROUTE_COLOUR,
    busRouteWeight: BUS_ROUTE_WEIGHT,
    bikeRouteColour: BIKE_ROUTE_COLOUR,
    bikeRouteWeight: BIKE_ROUTE_WEIGHT,
    stationStyle: RAIL_STATION_STYLE,
    busStopStyle: BUS_STOP_STYLE,
    neighbourhoodStyle: NEIGHBOURHOOD_STYLE,
    busStopsMinZoom: BUS_STOPS_MIN_ZOOM,
    neighbourhoodPane: {
      name: NEIGHBOURHOOD_PANE_NAME,
      zIndex: NEIGHBOURHOOD_PANE_Z_INDEX,
    },
    creditTexts: {cta: CTA_CREDIT_TEXT, chicago: CHICAGO_CREDIT_TEXT},
  };
}

/**
 * Returns the injectedJavaScript string.
 *
 * Layer-2 of the diagnosable failure path: guards against a missing or
 * throwing `window.initLeafletMap` (map.html failed to define it, or
 * threw while defining it). Carries its own inline `post` helper - it
 * cannot borrow map.html's page-level helper, which may not exist if
 * map.html itself failed to load - guarded by a `typeof` check so
 * reporting can never throw.
 */
export function buildMapInitScript(): string {
  const config = buildMapInitConfig();
  const configJson = JSON.stringify(config);
  const tag = MAP_LOG_TAG;
  return `(function () {
  function post(message) {
    if (
      typeof window.ReactNativeWebView !== 'undefined' &&
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === 'function'
    ) {
      window.ReactNativeWebView.postMessage('${tag} ' + message);
    }
  }
  try {
    if (typeof window.initLeafletMap !== 'function') {
      post('injected: window.initLeafletMap is missing');
    } else {
      window.initLeafletMap(${configJson});
    }
  } catch (err) {
    post('injected: window.initLeafletMap threw: ' + (err && err.message ? err.message : String(err)));
  }
  true;
})();`;
}

/**
 * Returns an injectedJavaScript string that tells the page which layers
 * should be visible RIGHT NOW - called on every toggle (AC14, "no
 * restart, no view switch") and re-called with the full enabled set on
 * every `init-ok` heartbeat, i.e. after every WebView (re)mount (AC11,
 * AC12). Pure and deterministic like `buildMapInitScript()` above: `ids`
 * must already be in a stable order (see mapLayers.ts's
 * `orderedEnabledLayerIds()`), never raw `Set` iteration order.
 *
 * map.html's `cupboardSetLayers(ids)` (not this function) owns deciding
 * what to add/remove/load for each id - this just delivers the desired
 * set, the same guarded injected-script shape as buildMapInitScript().
 */
export function buildSetLayersScript(ids: ReadonlyArray<LayerId>): string {
  const idsJson = JSON.stringify(ids);
  const tag = MAP_LOG_TAG;
  return `(function () {
  function post(message) {
    if (
      typeof window.ReactNativeWebView !== 'undefined' &&
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === 'function'
    ) {
      window.ReactNativeWebView.postMessage('${tag} ' + message);
    }
  }
  try {
    if (typeof window.cupboardSetLayers !== 'function') {
      post('injected: window.cupboardSetLayers is missing');
    } else {
      window.cupboardSetLayers(${idsJson});
    }
  } catch (err) {
    post('injected: window.cupboardSetLayers threw: ' + (err && err.message ? err.message : String(err)));
  }
  true;
})();`;
}
