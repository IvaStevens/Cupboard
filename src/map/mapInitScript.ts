/**
 * Builds the `injectedJavaScript` string passed to the WebView.
 *
 * This module is component-free: it imports no react-native-webview and
 * depends on nothing but mapConstants, so it is assertable in a plain
 * Jest test without the react-native-webview mock.
 *
 * Every map parameter is read from mapConstants and passed into the page
 * as a single JSON-stringified config via one
 * `window.initLeafletMap(<config>)` call - never duplicated as a literal
 * into map.html.
 *
 * @format
 */

import {
  CHICAGO_LATITUDE,
  CHICAGO_LONGITUDE,
  INITIAL_ZOOM,
  MAP_MAX_ZOOM,
  MAP_LOG_TAG,
  OSM_ATTRIBUTION_HTML,
  OSM_TILE_URL_TEMPLATE,
} from './mapConstants';

export interface MapInitConfig {
  latitude: number;
  longitude: number;
  zoom: number;
  maxZoom: number;
  tileUrlTemplate: string;
  attributionHtml: string;
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
