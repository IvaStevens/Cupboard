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
 * CUPBOARD-4 KEPT THOSE FLAGS UNSET ON PURPOSE. The five map-data assets
 * (android/app/src/main/assets/mapdata/*.geojson.js) are NOT fetched
 * with `fetch`/`XHR` from the page - that IS blocked from a file://
 * document without `allowFileAccessFromFileURLs`/
 * `allowUniversalAccessFromFileURLs`, and loosening either would let the
 * page's own JS read arbitrary files under file:///android_asset (and,
 * with the universal-access flag, arbitrary file:// paths on the
 * device) by URL - a real widening of this WebView's attack surface for
 * a page that also renders unsanitised... well, sanitised but
 * still-external... data. Instead, map.html loads each layer as a
 * same-origin <script src="../mapdata/*.geojson.js"> SUBRESOURCE, the
 * same mechanism it already uses for leaflet.js/leaflet.css - a
 * <script src> load is governed by `mixedContentMode`/CSP, not by the
 * three file-access flags above, so no WebView security setting needed
 * to change at all. See mapConstants.ts's MAP_DATA_DIR_RELATIVE and
 * map.html's `cupboardRegisterLayer`/`cupboardSetLayers`.
 *
 * @format
 */

import * as React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import WebView from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewMessageEvent,
  WebViewRenderProcessGoneEvent,
} from 'react-native-webview/lib/WebViewTypes';
import {LAYER_ERROR_LOG_PREFIX, MAP_HTML_ASSET_URI, MAP_LOG_TAG} from './mapConstants';
import {buildMapInitScript, buildSetLayersScript} from './mapInitScript';
import {isLayerId, orderedEnabledLayerIds, type LayerId} from './mapLayers';

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

// Prefix for map.html's `layer-error: <id>` diagnostics (a <script>
// asset that failed to load, or an internal guard like
// 'unknown-layer:'/'unbuildable-layer:' that should never fire). Unlike
// the two log lines above, this one IS actionable here, not just
// diagnostic - see handleMessage below, which also flips the reported
// layer to "unavailable" in the picker via onLayerError.
const MAP_LAYER_ERROR_LOG_PREFIX = `${MAP_LOG_TAG} ${LAYER_ERROR_LOG_PREFIX} `;

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

export interface MapScreenProps {
  /** Which of the five CUPBOARD-4 layers the picker currently shows as "on" - see App.tsx. Defaults to none, matching AC11's launch state. */
  enabledLayerIds?: ReadonlySet<LayerId>;
  /** Called when map.html reports a layer's data failed to load, so the picker can show "(unavailable)" and offer a retry. Defaults to a no-op. */
  onLayerError?: (id: LayerId) => void;
}

// Both module-level constants (not created per-render) so a caller that
// omits the props - e.g. map.test.tsx's `<MapScreen />`, predating
// CUPBOARD-4 - gets a referentially stable empty set/no-op rather than a
// new object every render.
const NO_ENABLED_LAYER_IDS: ReadonlySet<LayerId> = new Set();
function noopOnLayerError(): void {}

/**
 * Guarded `injectJavaScript` call. `webViewRef.current` can be a few
 * things that are NOT a real WebView instance exposing this method: the
 * ref hasn't attached yet, OR - as seen under React 19 with the test
 * suite's function-component `react-native-webview` mock (see
 * map.test.tsx/shell.test.tsx/App.test.tsx) - a function component now
 * receives `ref` as an ordinary prop, so the mock's `{...props}` spread
 * forwards it straight to the underlying RN `View`, making
 * `webViewRef.current` that `View` instance rather than null. A bare
 * `?.` only guards null/undefined, not "exists but lacks this method",
 * so this checks the method's presence explicitly rather than throwing
 * from those tests (or from a real device's native bridge not being
 * ready yet).
 *
 * `webViewRef` is typed `any` rather than `WebView` (react-native-
 * webview's own class) deliberately, not sloppily: its .d.ts declares
 * `class WebView<P = undefined> extends Component<WebViewProps & P>`,
 * and `WebViewProps & undefined` collapses to TypeScript's `never` - any
 * JSX usage of `<WebView ref={...} .../>` where the ref's declared type
 * forces that default generic to resolve hits a `(props: never)`
 * constructor overload that no props object (ref included) can ever
 * satisfy (verified directly against this toolchain's @types/react
 * 19.3.0; `ref={null}` and `ref={createRef<any>()}` both typecheck,
 * every more specific ref type does not). The runtime check below is
 * what actually keeps this safe, not the ref's declared type.
 */
function safeInjectJavaScript(
  webViewRef: React.RefObject<{injectJavaScript?: (script: string) => void} | null>,
  script: string,
): void {
  const instance = webViewRef.current;
  if (instance && typeof instance.injectJavaScript === 'function') {
    instance.injectJavaScript(script);
  }
}

function MapScreen(props: MapScreenProps): React.ReactElement {
  const {
    enabledLayerIds = NO_ENABLED_LAYER_IDS,
    onLayerError = noopOnLayerError,
  } = props;
  const [remountKey, setRemountKey] = useState(0);
  // See safeInjectJavaScript's header comment for why this is `any`.
  const webViewRef = useRef<any>(null);

  // A stable, comma-joined string in mapLayers.ts's fixed MAP_LAYERS
  // order (never raw `Set` iteration order, which is insertion order and
  // would make the injected script's id order depend on toggle history).
  const enabledLayerIdsKey = useMemo(
    () => orderedEnabledLayerIds(enabledLayerIds).join(','),
    [enabledLayerIds],
  );

  // Read through refs inside the two callbacks below (handleMessage,
  // which is a stable useCallback so react-native-webview never
  // re-subscribes onMessage, and the inject-on-change effect's identity
  // doesn't matter but the init-ok path's does) rather than closing over
  // the render-time value directly - same "ref kept in sync by an
  // effect" pattern App.tsx's activeViewRef already uses.
  const enabledLayerIdsKeyRef = useRef(enabledLayerIdsKey);
  useEffect(() => {
    enabledLayerIdsKeyRef.current = enabledLayerIdsKey;
  }, [enabledLayerIdsKey]);

  const onLayerErrorRef = useRef(onLayerError);
  useEffect(() => {
    onLayerErrorRef.current = onLayerError;
  }, [onLayerError]);

  // AC14: activating a picker item toggles that layer immediately - no
  // WebView remount, no view switch. Imperative `injectJavaScript`
  // (not a second `injectedJavaScript` prop/remount) is the only way to
  // reach an already-loaded page.
  useEffect(() => {
    const ids = enabledLayerIdsKey
      ? (enabledLayerIdsKey.split(',') as LayerId[])
      : [];
    safeInjectJavaScript(webViewRef, buildSetLayersScript(ids));
  }, [enabledLayerIdsKey]);

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
    if (data === MAP_INIT_OK_LOG_LINE) {
      // AC11/AC12: the page just (re)initialised and has no memory of
      // which layers were on before - re-send the FULL enabled set so
      // the picker and the map can never diverge after a remount
      // (onRenderProcessGone) or a view-switch-and-back round trip.
      console.log(data);
      const ids = enabledLayerIdsKeyRef.current
        ? (enabledLayerIdsKeyRef.current.split(',') as LayerId[])
        : [];
      safeInjectJavaScript(webViewRef, buildSetLayersScript(ids));
    } else if (data.startsWith(MAP_TILE_ERROR_LOG_PREFIX)) {
      console.log(data);
    } else {
      if (data.startsWith(MAP_LAYER_ERROR_LOG_PREFIX)) {
        const candidateId = data.slice(MAP_LAYER_ERROR_LOG_PREFIX.length).trim();
        if (isLayerId(candidateId)) {
          onLayerErrorRef.current(candidateId);
        }
      }
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
        ref={webViewRef}
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
