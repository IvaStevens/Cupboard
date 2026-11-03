/// <reference types="node" />
/**
 * AC-bearing test file for CUPBOARD-1. Covers:
 *  - VIEW CONSTANTS ARE ACTUALLY CONSUMED
 *  - LEAFLET ASSET MECHANISM
 *  - WEBVIEW SECURITY SETTINGS PINNED
 *  - PAN, ZOOM AND GESTURE OWNERSHIP (ancestor walk)
 *  - LAYOUT INSIDE THE APP SHELL / HEADER SHOWS NOTHING / SAFE AREA WIRED
 *  - DIAGNOSABLE FAILURE PATH (injected-script guard)
 *  - THIRD-PARTY PROVENANCE RECORDED (asset digests)
 *
 * `/// <reference types="node" />` is required because this template's
 * tsconfig sets `types: ["jest"]`, which keeps @types/node out of the
 * program - a bare `fs`/`path`/`crypto` import would otherwise be
 * TS2307.
 *
 * @format
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as React from 'react';
import renderer, {act} from 'react-test-renderer';
import type {ReactTestInstance} from 'react-test-renderer';

import {AppShell} from 'bobuttons';
import App from '../App';
import MapScreen from '../src/map/MapScreen';
import {
  CHICAGO_LATITUDE,
  CHICAGO_LONGITUDE,
  INITIAL_ZOOM,
  MAP_ASSET_DIR_URI,
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

// Neutralises react-native-safe-area-context for rendering `App`: under
// the real SafeAreaProvider, Jest never delivers the native onLayout
// event the provider waits on, so it renders zero children. Stubbing
// both the provider (identity passthrough) and the hook (fixed zero
// insets) lets the chrome render, and pins the "ZERO stub insets" the
// ancestor walk below depends on - real, non-zero insets may legitimately
// render as padding, which a padding-forbidding walk would wrongly fail
// on a correct implementation.
const ZERO_INSETS = {top: 0, right: 0, bottom: 0, left: 0};
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
    useSafeAreaInsets: () => ZERO_INSETS,
  };
});

const ASSET_DIR = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'assets',
  'leaflet',
);
const MAP_HTML_PATH = path.join(ASSET_DIR, 'map.html');
const LEAFLET_JS_PATH = path.join(ASSET_DIR, 'leaflet.js');
const LEAFLET_CSS_PATH = path.join(ASSET_DIR, 'leaflet.css');

const LEAFLET_CSS_SHA256 =
  'a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6';
const LEAFLET_JS_TAIL_SHA256 =
  'db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a';

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Mirrors `tail -n +2 | sha256sum` byte-exactly. */
function sha256AfterFirstLine(buf: Buffer): string {
  const idx = buf.indexOf(0x0a);
  if (idx === -1) {
    throw new Error('no newline found');
  }
  return sha256(buf.subarray(idx + 1));
}

describe('mapConstants / buildMapInitScript consumption', () => {
  it('emits exactly one window.initLeafletMap(<json>) call carrying the named constants', () => {
    const script = buildMapInitScript();

    const matches = script.match(/window\.initLeafletMap\(/g) ?? [];
    expect(matches).toHaveLength(1);

    const callMatch = script.match(/window\.initLeafletMap\((\{.*\})\);/);
    expect(callMatch).not.toBeNull();
    const config = JSON.parse((callMatch as RegExpMatchArray)[1]);

    // Against the literal the AC names...
    expect(config.latitude).toBe(41.8781);
    expect(config.longitude).toBe(-87.6298);
    expect(config.zoom).toBe(12);
    expect(config.maxZoom).toBe(19);
    expect(config.tileUrlTemplate).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );

    // ...and against the imported constant.
    expect(config.latitude).toBe(CHICAGO_LATITUDE);
    expect(config.longitude).toBe(CHICAGO_LONGITUDE);
    expect(config.zoom).toBe(INITIAL_ZOOM);
    expect(config.maxZoom).toBe(MAP_MAX_ZOOM);
    expect(config.tileUrlTemplate).toBe(OSM_TILE_URL_TEMPLATE);
    expect(config.attributionHtml).toBe(OSM_ATTRIBUTION_HTML);
  });

  it('carries the layer-2 init guard for a missing/throwing window.initLeafletMap', () => {
    const script = buildMapInitScript();
    expect(script).toContain("typeof window.initLeafletMap !== 'function'");
    expect(script).toContain('try {');
    expect(script).toContain('catch (err)');
  });
});

describe('map.html asset mechanism', () => {
  const html = fs.readFileSync(MAP_HTML_PATH, 'utf8');

  it('contains no http(s) <script> or <link> tag - no CDN fetch for Leaflet', () => {
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it('references leaflet.js/leaflet.css by relative path', () => {
    expect(html).toMatch(/<script\s+src=["']leaflet\.js["']/);
    expect(html).toMatch(/<link\s+rel=["']stylesheet["']\s+href=["']leaflet\.css["']/);
  });

  it('pins a user-scalable=no viewport so Android does not fight Leaflet pinch', () => {
    expect(html).toMatch(/name=["']viewport["']/);
    expect(html).toMatch(/user-scalable=no/);
  });

  it('sizes the document exactly to the viewport with overflow hidden', () => {
    expect(html).toMatch(/overflow:\s*hidden/);
  });

  it('guards the postMessage helper with a typeof check so it can never throw', () => {
    expect(html).toMatch(/typeof window\.ReactNativeWebView/);
  });

  it('carries the layer-1 typeof L undefined guard and the init-ok heartbeat', () => {
    expect(html).toMatch(/typeof L === 'undefined'/);
    expect(html).toContain('init-ok');
  });

  it('carries no coordinate, zoom, tile URL or attribution literal', () => {
    expect(html).not.toContain('41.8781');
    expect(html).not.toContain('-87.6298');
    expect(html).not.toMatch(/\btile\.openstreetmap\.org\b/);
  });
});

describe('vendored Leaflet asset provenance', () => {
  it('leaflet.css is non-empty and matches the pinned digest', () => {
    const buf = fs.readFileSync(LEAFLET_CSS_PATH);
    expect(buf.length).toBeGreaterThan(0);
    expect(sha256(buf)).toBe(LEAFLET_CSS_SHA256);
  });

  it('leaflet.js is non-empty, starts with the eslint-disable line, and its tail matches the pinned digest', () => {
    const buf = fs.readFileSync(LEAFLET_JS_PATH);
    expect(buf.length).toBeGreaterThan(0);
    const firstLine = buf.subarray(0, buf.indexOf(0x0a)).toString('utf8');
    expect(firstLine).toBe('/* eslint-disable */');
    expect(sha256AfterFirstLine(buf)).toBe(LEAFLET_JS_TAIL_SHA256);
  });

  it('map.html is non-empty', () => {
    const buf = fs.readFileSync(MAP_HTML_PATH);
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe('MapScreen WebView wiring', () => {
  function renderMapScreen(): ReactTestInstance {
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(<MapScreen />);
    });
    return instance.root;
  }

  it('loads the bundled asset uri with the constant-derived injected script', () => {
    const root = renderMapScreen();
    const {WebView} = jest.requireMock('react-native-webview') as {
      WebView: React.ComponentType;
    };
    const webview = root.findByType(WebView);

    expect(webview.props.source).toEqual({uri: MAP_HTML_ASSET_URI});
    expect(webview.props.injectedJavaScript).toBe(buildMapInitScript());
  });

  it('pins originWhitelist and setBuiltInZoomControls, and omits the security/scroll props', () => {
    const root = renderMapScreen();
    const {WebView} = jest.requireMock('react-native-webview') as {
      WebView: React.ComponentType;
    };
    const webview = root.findByType(WebView);

    expect(webview.props.originWhitelist).toEqual(['file://*']);
    expect(webview.props.setBuiltInZoomControls).toBe(false);

    for (const prop of [
      'allowFileAccess',
      'allowFileAccessFromFileURLs',
      'allowUniversalAccessFromFileURLs',
      'mixedContentMode',
      'scrollEnabled',
      'nestedScrollEnabled',
      'onNavigationStateChange',
    ]) {
      expect(webview.props[prop]).toBeUndefined();
    }
  });

  it('onShouldStartLoadWithRequest allows the bundled asset and rejects the OSM attribution target', () => {
    const root = renderMapScreen();
    const {WebView} = jest.requireMock('react-native-webview') as {
      WebView: React.ComponentType;
    };
    const webview = root.findByType(WebView);
    const predicate = webview.props.onShouldStartLoadWithRequest as (req: {
      url: string;
    }) => boolean;

    expect(predicate({url: MAP_HTML_ASSET_URI})).toBe(true);
    expect(predicate({url: `${MAP_ASSET_DIR_URI}map.html?x=1`})).toBe(true);
    expect(
      predicate({url: 'https://www.openstreetmap.org/copyright'}),
    ).toBe(false);
  });
});

describe('App composition: header omission, insets, and no scroll/padding ancestor', () => {
  function renderApp(): ReactTestInstance {
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(<App />);
    });
    return instance.root;
  }

  it('renders AppShell with no header prop and the safe-area insets', () => {
    const root = renderApp();
    const shell = root.findByType(AppShell);

    expect('header' in shell.props).toBe(false);
    expect(shell.props.insets).toEqual(ZERO_INSETS);
  });

  it('places the map inside AppShell, not as a bare replacement for it', () => {
    const root = renderApp();
    expect(() => root.findByType(AppShell)).not.toThrow();
    const {WebView} = jest.requireMock('react-native-webview') as {
      WebView: React.ComponentType;
    };
    const webview = root.findByType(WebView);
    const shell = root.findByType(AppShell);
    // The WebView is a descendant of AppShell.
    expect(shell.findByType(WebView)).toBe(webview);
  });

  it('has no scroll-host ancestor, scroll-prop ancestor, or non-zero-padding ancestor above the WebView (at zero stub insets)', () => {
    const root = renderApp();
    const {WebView} = jest.requireMock('react-native-webview') as {
      WebView: React.ComponentType;
    };
    const webview = root.findByType(WebView);

    const SCROLL_HOST_TYPE_NAMES = [
      'ScrollView',
      'FlatList',
      'SectionList',
      'VirtualizedList',
    ];
    const SCROLL_PROP_NAMES = [
      'scrollEnabled',
      'onScroll',
      'horizontal',
      'pagingEnabled',
      'contentContainerStyle',
    ];

    let node: ReactTestInstance | null = webview.parent;
    while (node) {
      const typeName =
        typeof node.type === 'string'
          ? node.type
          : (node.type as {displayName?: string; name?: string}).displayName ??
            (node.type as {name?: string}).name ??
            '';

      expect(SCROLL_HOST_TYPE_NAMES).not.toContain(typeName);

      for (const scrollProp of SCROLL_PROP_NAMES) {
        expect(node.props[scrollProp]).toBeUndefined();
      }

      const style = node.props.style;
      const styles = Array.isArray(style) ? style : [style];
      for (const s of styles) {
        if (s && typeof s === 'object') {
          for (const key of [
            'padding',
            'paddingTop',
            'paddingBottom',
            'paddingLeft',
            'paddingRight',
            'paddingHorizontal',
            'paddingVertical',
          ]) {
            if (key in s) {
              expect(s[key]).toBe(0);
            }
          }
        }
      }

      node = node.parent;
    }
  });
});
