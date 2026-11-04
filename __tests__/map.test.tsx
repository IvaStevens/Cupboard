/// <reference types="node" />
/**
 * AC-bearing test file for CUPBOARD-1. Covers:
 *  - VIEW CONSTANTS ARE ACTUALLY CONSUMED
 *  - LEAFLET ASSET MECHANISM
 *  - WEBVIEW SECURITY SETTINGS PINNED
 *  - PAN, ZOOM AND GESTURE OWNERSHIP (ancestor walk, now a measured
 *    allowlist rather than a blanket zero-padding rule, because
 *    `ViewPane` sits above the map by design)
 *  - LAYOUT INSIDE THE APP SHELL / HEADER IS AppHeader / SAFE AREA WIRED
 *  - DIAGNOSABLE FAILURE PATH (injected-script guard, size-conditional
 *    init-view apply, capped/throttled tile-error reporting)
 *  - ATTRIBUTION STAYS CLEAR OF ViewPane's ROUNDED CORNER
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

import {AppHeader, AppShell} from 'bobuttons';
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

  it('applies the initial view on a size condition, not an unconditional double-rAF', () => {
    // dba2a4c's two-frame defer stays as the first attempt...
    expect(html).toMatch(
      /requestAnimationFrame\(function\s*\(\)\s*{\s*requestAnimationFrame\(applyInitialView\);/,
    );
    // ...but the apply itself is gated on #map's measured size, bounded
    // by a named attempt cap, not a bare frame count.
    expect(html).toContain('clientWidth');
    expect(html).toContain('clientHeight');
    expect(html).toContain('INIT_VIEW_MAX_ATTEMPTS');
    expect(html).toMatch(/applied anyway|applying anyway/);
    expect(html).toMatch(/re-applying at first non-zero size/);
  });

  it('nudges the OSM attribution control clear of ViewPane\'s rounded corner', () => {
    expect(html).toMatch(
      /\.leaflet-container\s+\.leaflet-control-attribution\s*{[^}]*margin-bottom:\s*6px;[^}]*margin-right:\s*6px;/,
    );
  });

  it('carries a throttled, capped tileerror handler that posts the first failure with a URL', () => {
    expect(html).toContain('TILE_ERROR_POST_INTERVAL_MS');
    expect(html).toContain('TILE_ERROR_MAX_POSTS');
    expect(html).toMatch(/tileLayer\.on\(\s*'tileerror'/);
    expect(html).toMatch(/tile-error: first failure/);
    expect(html).toContain('e.tile.src');
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

describe('App composition: AppHeader, insets, and the ViewPane ancestor allowlist', () => {
  function renderApp(): ReactTestInstance {
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(<App />);
    });
    return instance.root;
  }

  it('renders AppShell with an AppHeader (title/locale/timeZone) and the safe-area insets', () => {
    const root = renderApp();
    const shell = root.findByType(AppShell);

    const header = shell.props.header as ReactTestInstance;
    expect(React.isValidElement(header)).toBe(true);
    expect((header as unknown as {type: unknown}).type).toBe(AppHeader);
    const headerProps = (header as unknown as {
      props: {title: string; locale: string; timeZone: string};
    }).props;
    expect(headerProps.title).toBe('Cupboard');
    expect(headerProps.locale).toBe('en-US');
    expect(headerProps.timeZone).toBe('America/Chicago');

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

  it('has no scroll-host ancestor or scroll-prop ancestor above the WebView, and every padded ancestor is a measured, allowlisted ViewPane layer (at zero stub insets)', () => {
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

    // Measured today: Gutter's paddingVertical/paddingRight is $1.5 (= 6)
    // and Card's paddingTop is $2.5 (= 10) - see
    // node_modules/bobuttons/dist/tokens/space.d.ts and ViewPane's
    // styled() definitions in node_modules/bobuttons/dist/index.native.js.
    // Tamagui bakes these as props (not necessarily resolved to a style
    // object), and the surfaced form can be either the resolved number or
    // the token string, so both are allowed. This is an ALLOWLIST, not a
    // blanket "no padding" rule: a future ancestor with a padding value
    // outside this list still fails, which is the point - only ViewPane's
    // own, already-measured padding is permitted.
    const ALLOWED_PADDING_VALUES = new Set<unknown>([0, 6, 10, '$1.5', '$2.5']);

    let node: ReactTestInstance | null = webview.parent;
    let sawAllowlistedPadding = false;
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

      const PADDING_KEYS = [
        'padding',
        'paddingTop',
        'paddingBottom',
        'paddingLeft',
        'paddingRight',
        'paddingHorizontal',
        'paddingVertical',
      ];

      // Checked on node.props directly, not just node.props.style:
      // AppShell's own Frame takes paddingTop/paddingBottom/paddingLeft/
      // paddingRight as style PROPS, and bobuttons' Tamagui styled()
      // definitions (e.g. ViewPane's Gutter/Card) bake padding in as
      // props too, not as a `style` object - a style-only check would
      // miss both.
      for (const key of PADDING_KEYS) {
        if (key in node.props) {
          const value = node.props[key];
          expect(ALLOWED_PADDING_VALUES.has(value)).toBe(true);
          if (value !== 0) {
            sawAllowlistedPadding = true;
          }
        }
      }

      const style = node.props.style;
      const styles = Array.isArray(style) ? style : [style];
      for (const s of styles) {
        if (s && typeof s === 'object') {
          for (const key of PADDING_KEYS) {
            if (key in s) {
              const value = (s as Record<string, unknown>)[key];
              expect(ALLOWED_PADDING_VALUES.has(value)).toBe(true);
              if (value !== 0) {
                sawAllowlistedPadding = true;
              }
            }
          }
        }
      }

      node = node.parent;
    }

    // Non-vacuity: at least one ancestor must actually hit the
    // allowlist, so a refactor that silently removes ViewPane cannot
    // leave this rule passing trivially.
    expect(sawAllowlistedPadding).toBe(true);
  });
});
