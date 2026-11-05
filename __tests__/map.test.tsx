/**
 * Map test for CUPBOARD-1: the Chicago view constants reach the page, and
 * the WebView loads the bundled Leaflet asset. Panning, zooming and tile
 * loading are checked on a device / in the e2e tests, not here.
 *
 * @format
 */

import * as React from 'react';
import renderer, {act} from 'react-test-renderer';

import MapScreen from '../src/map/MapScreen';
import {
  CHICAGO_LATITUDE,
  CHICAGO_LONGITUDE,
  INITIAL_ZOOM,
  MAP_HTML_ASSET_URI,
  MAP_MAX_ZOOM,
  OSM_ATTRIBUTION_HTML,
  OSM_TILE_URL_TEMPLATE,
} from '../src/map/mapConstants';
import {buildMapInitScript} from '../src/map/mapInitScript';

jest.mock('react-native-webview', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const MockWebView = (props: Record<string, unknown>) =>
    ReactActual.createElement(View, {testID: 'mock-webview', ...props});
  return {
    __esModule: true,
    default: MockWebView,
    WebView: MockWebView,
  };
});

describe('Chicago map', () => {
  it('passes the Chicago view constants into the page as one init call', () => {
    const script = buildMapInitScript();

    const callMatch = script.match(/window\.initLeafletMap\((\{.*\})\);/);
    expect(callMatch).not.toBeNull();
    const config = JSON.parse((callMatch as RegExpMatchArray)[1]);

    // Against the literal values the ticket names...
    expect(config.latitude).toBe(41.8781);
    expect(config.longitude).toBe(-87.6298);
    expect(config.zoom).toBe(12);

    // ...and against the imported constants.
    expect(config.latitude).toBe(CHICAGO_LATITUDE);
    expect(config.longitude).toBe(CHICAGO_LONGITUDE);
    expect(config.zoom).toBe(INITIAL_ZOOM);
    expect(config.maxZoom).toBe(MAP_MAX_ZOOM);
    expect(config.tileUrlTemplate).toBe(OSM_TILE_URL_TEMPLATE);
    expect(config.attributionHtml).toBe(OSM_ATTRIBUTION_HTML);
  });

  it('loads the bundled asset with the constant-derived injected script', () => {
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(<MapScreen />);
    });
    const {WebView} = jest.requireMock('react-native-webview') as {
      WebView: React.ComponentType;
    };
    const webview = instance.root.findByType(WebView);

    expect(webview.props.source).toEqual({uri: MAP_HTML_ASSET_URI});
    expect(webview.props.injectedJavaScript).toBe(buildMapInitScript());
  });
});
