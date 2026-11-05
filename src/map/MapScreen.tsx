/**
 * The full-bleed Leaflet map screen, rendered as Leaflet inside a
 * react-native-webview loaded from a local Android asset
 * (file:///android_asset/leaflet/map.html).
 *
 * Deliberately absent, because the defaults are already correct and
 * loosening them is unnecessary: `allowFileAccess`,
 * `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs` and
 * `mixedContentMode` (file:///android_asset is exempt from
 * allowFileAccess, and HTTPS tiles fetched as <img> subresources from a
 * file:// document are not mixed content); `scrollEnabled` (not an
 * Android prop - iOS/macOS only, with no native Android setter);
 * `nestedScrollEnabled` (already defaults to false); and
 * `onNavigationStateChange` (no `onReceivedTitle` override exists, so a
 * post-load `document.title` change emits no event).
 *
 * @format
 */

import * as React from 'react';
import {useCallback, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import WebView from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewRenderProcessGoneEvent,
} from 'react-native-webview/lib/WebViewTypes';
import {MAP_HTML_ASSET_URI, MAP_LOG_TAG} from './mapConstants';
import {buildMapInitScript} from './mapInitScript';

const injectedJavaScript = buildMapInitScript();

// The tagged line map.html's post() helper produces for the success
// heartbeat (TAG + ' ' + 'init-ok'). Mirrors map.html's own literal
// rather than importing it, the same way map.html mirrors MAP_LOG_TAG as
// a literal - a log tag/message is not a map parameter, so it is not
// subject to the no-duplication rule those values carry.
const MAP_INIT_OK_LOG_LINE = `${MAP_LOG_TAG} init-ok`;

// Prefix for map.html's tile-error diagnostics (both the first,
// URL-carrying line and the later throttled/capped count summaries - see
// map.html's tileerror handler). Like MAP_INIT_OK_LOG_LINE above, this is
// an expected-condition log line, not a failure of this screen, so it is
// also routed to console.log rather than console.warn.
const MAP_TILE_ERROR_LOG_PREFIX = `${MAP_LOG_TAG} tile-error`;

/**
 * Gates top-level navigations only (subresources, such as OSM tiles, are
 * unaffected). The initial load and the post-remount load are never
 * gated at all - Android does not call this for a page-initiated load -
 * so this exists to block navigations a user could otherwise trigger,
 * such as tapping the OSM attribution link. A prefix match against the
 * bundled document itself (not the whole asset directory), since the
 * bundled document can carry a query/hash but this must admit only the
 * bundled asset URL - not a top-level navigation to a sibling asset such
 * as leaflet.js/leaflet.css.
 */
function shouldAllowNavigation(request: ShouldStartLoadRequest): boolean {
  const allowed = request.url.startsWith(MAP_HTML_ASSET_URI);
  if (!allowed) {
    console.warn(`${MAP_LOG_TAG} blocked navigation to ${request.url}`);
  }
  return allowed;
}

function MapScreen(): React.ReactElement {
  const [remountKey, setRemountKey] = useState(0);

  const handleError = useCallback((event: WebViewErrorEvent) => {
    console.warn(`${MAP_LOG_TAG} onError: ${JSON.stringify(event.nativeEvent)}`);
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    console.warn(
      `${MAP_LOG_TAG} onHttpError: ${JSON.stringify(event.nativeEvent)}`,
    );
  }, []);

  const handleLoadSubResourceError = useCallback(
    (event: WebViewErrorEvent) => {
      console.warn(
        `${MAP_LOG_TAG} onLoadSubResourceError: ${JSON.stringify(
          event.nativeEvent,
        )}`,
      );
    },
    [],
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    // map.html and mapInitScript.ts already prefix every message with
    // MAP_LOG_TAG; this is the channel every in-page signal exits
    // through (in-page console is swallowed in release builds). The
    // init-ok heartbeat is a SUCCESS signal, not a failure - logging it
    // at warn level put a LogBox banner over the map on every successful
    // launch (confirmed on-device), so it alone is logged at console.log.
    // A tile-fetch failure (offline, a blocked endpoint, OSM rate-
    // limiting) is explicitly accepted as degraded-but-silent for this
    // ticket - no error/retry UI - but still diagnosable, so its tagged
    // line is also routed to console.log rather than console.warn for
    // the same LogBox reason. Every other in-page message (the
    // layer-1/layer-2 guards, window.onerror, a throwing initLeafletMap)
    // still exits through console.warn.
    const data = event.nativeEvent.data;
    if (
      data === MAP_INIT_OK_LOG_LINE ||
      data.startsWith(MAP_TILE_ERROR_LOG_PREFIX)
    ) {
      console.log(data);
    } else {
      console.warn(data);
    }
  }, []);

  const handleRenderProcessGone = useCallback(
    (event: WebViewRenderProcessGoneEvent) => {
      console.warn(
        `${MAP_LOG_TAG} onRenderProcessGone: ${JSON.stringify(
          event.nativeEvent,
        )}`,
      );
      setRemountKey(key => key + 1);
    },
    [],
  );

  return (
    <View style={styles.container}>
      <WebView
        key={remountKey}
        source={{uri: MAP_HTML_ASSET_URI}}
        style={styles.webview}
        injectedJavaScript={injectedJavaScript}
        originWhitelist={['file://*']}
        onShouldStartLoadWithRequest={shouldAllowNavigation}
        setBuiltInZoomControls={false}
        onError={handleError}
        onHttpError={handleHttpError}
        onLoadSubResourceError={handleLoadSubResourceError}
        onMessage={handleMessage}
        onRenderProcessGone={handleRenderProcessGone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default MapScreen;
