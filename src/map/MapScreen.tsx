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
import {
  MAP_ASSET_DIR_URI,
  MAP_HTML_ASSET_URI,
  MAP_LOG_TAG,
} from './mapConstants';
import {buildMapInitScript} from './mapInitScript';

const injectedJavaScript = buildMapInitScript();

/**
 * Gates top-level navigations only (subresources, such as OSM tiles, are
 * unaffected). The initial load and the post-remount load are never
 * gated at all - Android does not call this for a page-initiated load -
 * so this exists to block navigations a user could otherwise trigger,
 * such as tapping the OSM attribution link. A prefix match, not exact
 * equality, since the bundled document can carry a query/hash.
 */
function shouldAllowNavigation(request: ShouldStartLoadRequest): boolean {
  const allowed = request.url.startsWith(MAP_ASSET_DIR_URI);
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
    // MAP_LOG_TAG; this is the one JS console.warn every in-page signal
    // exits through (in-page console is swallowed in release builds).
    console.warn(event.nativeEvent.data);
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
