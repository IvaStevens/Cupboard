/**
 * CUPBOARD-4's riskiest new UI logic: default-off, toggle-driven
 * show/hide for each of the five layers (AC11/AC14), that toggling never
 * changes which view ViewPane shows, that layer state survives a
 * placeholder round trip (AC11), and that a remount (here: the WebView's
 * `init-ok` heartbeat, which is what both onRenderProcessGone and a
 * placeholder-and-back round trip ultimately produce) re-sends every
 * layer the picker shows as enabled (AC12), plus a reported layer-load
 * failure flipping to "(unavailable)" and retrying.
 *
 * Needs its own CLASS-based `react-native-webview` mock (unlike
 * map.test.tsx/shell.test.tsx/App.test.tsx's function-component mock):
 * MapScreen now calls `injectJavaScript` imperatively via a ref, and
 * react-test-renderer only gives a ref a usable instance for a class
 * component (see MapScreen.tsx's `safeInjectJavaScript` header comment
 * for what happens with the other suites' function-component mock).
 *
 * @format
 */

import * as React from 'react';
import renderer, {act} from 'react-test-renderer';
import type {ReactTestInstance} from 'react-test-renderer';
import {TabBar} from 'bobuttons';

import App from '../App';
import MapScreen from '../src/map/MapScreen';
import PlaceholderView from '../src/views/PlaceholderView';
import {MAP_LOG_TAG} from '../src/map/mapConstants';
import {buildSetLayersScript} from '../src/map/mapInitScript';
import {MAP_LAYERS, type LayerId} from '../src/map/mapLayers';
import {MAP_VIEW_ID} from '../src/shell/navEntries';

jest.mock('react-native-webview', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  class MockWebView extends ReactActual.Component {
    injectJavaScript = jest.fn();
    render() {
      return ReactActual.createElement(View, {
        testID: 'mock-webview',
        ...this.props,
      });
    }
  }
  return {
    __esModule: true,
    default: MockWebView,
    WebView: MockWebView,
  };
});

const ZERO_INSETS = {top: 0, right: 0, bottom: 0, left: 0};
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
    useSafeAreaInsets: () => ZERO_INSETS,
  };
});

const {WebView: MockWebViewType} = jest.requireMock('react-native-webview') as {
  WebView: React.ComponentType;
};

function renderApp(): renderer.ReactTestRenderer {
  let instance!: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(<App />);
  });
  return instance;
}

function pressTab(root: ReactTestInstance, id: string): void {
  const tab = root.findAll(
    node =>
      node.props &&
      node.props.id === `tab-${id}` &&
      typeof node.props.onPress === 'function',
  )[0];
  act(() => {
    (tab.props.onPress as () => void)();
  });
}

function webviewInstance(root: ReactTestInstance): {
  injectJavaScript: jest.Mock;
} {
  return root.findByType(MockWebViewType).instance as unknown as {
    injectJavaScript: jest.Mock;
  };
}

describe('layer toggle (AC11/AC14)', () => {
  it('all five layers default OFF', () => {
    const app = renderApp();
    const text = JSON.stringify(app.toJSON());
    for (const layer of MAP_LAYERS) {
      expect(text).toContain(`${layer.label} (off)`);
    }
    expect(app.root.findByType(MapScreen).props.enabledLayerIds.size).toBe(0);
  });

  it.each(MAP_LAYERS.map(layer => [layer.id, layer.label] as const))(
    'toggling %s on injects exactly that layer and leaves the view unchanged',
    (id, label) => {
      const app = renderApp();
      const root = app.root;
      pressTab(root, id);

      // AC14: never changes which view ViewPane shows.
      expect(root.findByType(TabBar).props.current).toBe(MAP_VIEW_ID);
      expect(root.findByType(MapScreen)).toBeTruthy();
      expect(root.findAllByType(PlaceholderView)).toHaveLength(0);

      expect(root.findByType(MapScreen).props.enabledLayerIds.has(id)).toBe(
        true,
      );
      expect(JSON.stringify(app.toJSON())).toContain(`${label} (on)`);

      const {injectJavaScript} = webviewInstance(root);
      expect(injectJavaScript).toHaveBeenCalledWith(buildSetLayersScript([id]));
    },
  );

  it('toggling a layer off again injects the empty set', () => {
    const root = renderApp().root;
    const id: LayerId = 'cta-rail-lines';
    pressTab(root, id);
    pressTab(root, id);

    expect(root.findByType(MapScreen).props.enabledLayerIds.size).toBe(0);
    const {injectJavaScript} = webviewInstance(root);
    expect(injectJavaScript).toHaveBeenLastCalledWith(buildSetLayersScript([]));
  });

  it('toggling two layers injects both, in MAP_LAYERS order', () => {
    const root = renderApp().root;
    pressTab(root, 'cta-bus-stops');
    pressTab(root, 'cta-rail-lines');

    const {injectJavaScript} = webviewInstance(root);
    expect(injectJavaScript).toHaveBeenLastCalledWith(
      buildSetLayersScript(['cta-rail-lines', 'cta-bus-stops']),
    );
  });

  it('layer state survives switching to a placeholder and back (AC11)', () => {
    const root = renderApp().root;
    pressTab(root, 'chicago-neighbourhoods');
    expect(root.findByType(MapScreen).props.enabledLayerIds.has('chicago-neighbourhoods')).toBe(true);

    pressTab(root, 'settings');
    expect(root.findByType(PlaceholderView)).toBeTruthy();
    expect(() => root.findByType(MapScreen)).toThrow();

    const backButton = root.findAll(
      node => node.props && node.props.label === 'Back to map',
    )[0];
    act(() => {
      (backButton.props.onPress as () => void)();
    });

    expect(root.findByType(MapScreen).props.enabledLayerIds.has('chicago-neighbourhoods')).toBe(true);
  });
});

describe('layer restoration after a remount (AC12)', () => {
  function sendMessage(root: ReactTestInstance, data: string): void {
    const webview = root.findByType(MockWebViewType);
    act(() => {
      (webview.props.onMessage as (event: unknown) => void)({
        nativeEvent: {data},
      });
    });
  }

  it("re-sends the full enabled set on the page's init-ok heartbeat", () => {
    const enabledLayerIds = new Set<LayerId>(['cta-bus-stops', 'cta-rail-lines']);
    let instance!: renderer.ReactTestRenderer;
    act(() => {
      instance = renderer.create(
        <MapScreen enabledLayerIds={enabledLayerIds} onLayerError={() => {}} />,
      );
    });
    const root = instance.root;
    const {injectJavaScript} = webviewInstance(root);
    injectJavaScript.mockClear();

    sendMessage(root, `${MAP_LOG_TAG} init-ok`);

    // MAP_LAYERS order: rail-lines before bus-stops, regardless of the
    // Set's insertion order above.
    expect(injectJavaScript).toHaveBeenCalledWith(
      buildSetLayersScript(['cta-rail-lines', 'cta-bus-stops']),
    );
  });

  it('re-sends the full set again after onRenderProcessGone remounts the WebView', () => {
    const root = renderApp().root;
    pressTab(root, 'cta-rail-stations');

    const webviewBefore = root.findByType(MockWebViewType);
    act(() => {
      (webviewBefore.props.onRenderProcessGone as (event: unknown) => void)({
        nativeEvent: {didCrash: false},
      });
    });

    // A new WebView instance (new `key`) - its own fresh injectJavaScript mock.
    sendMessage(root, `${MAP_LOG_TAG} init-ok`);
    const {injectJavaScript} = webviewInstance(root);
    expect(injectJavaScript).toHaveBeenCalledWith(
      buildSetLayersScript(['cta-rail-stations']),
    );
  });
});

describe('layer load failure (AC "picker state and map state cannot diverge")', () => {
  it('a reported layer-error flips MapScreen\'s onLayerError and the picker to "(unavailable)"', () => {
    const app = renderApp();
    const root = app.root;
    pressTab(root, 'cta-bus-stops');
    expect(root.findByType(MapScreen).props.enabledLayerIds.has('cta-bus-stops')).toBe(true);

    const webview = root.findByType(MockWebViewType);
    act(() => {
      (webview.props.onMessage as (event: unknown) => void)({
        nativeEvent: {data: `${MAP_LOG_TAG} layer-error: cta-bus-stops`},
      });
    });

    expect(root.findByType(MapScreen).props.enabledLayerIds.has('cta-bus-stops')).toBe(false);
    expect(JSON.stringify(app.toJSON())).toContain('Bus stops (unavailable)');
  });

  it('tapping an "(unavailable)" layer retries it (re-enables)', () => {
    const app = renderApp();
    const root = app.root;
    pressTab(root, 'cta-bus-stops');
    const webview = root.findByType(MockWebViewType);
    act(() => {
      (webview.props.onMessage as (event: unknown) => void)({
        nativeEvent: {data: `${MAP_LOG_TAG} layer-error: cta-bus-stops`},
      });
    });

    pressTab(root, 'cta-bus-stops');

    expect(root.findByType(MapScreen).props.enabledLayerIds.has('cta-bus-stops')).toBe(true);
    expect(JSON.stringify(app.toJSON())).toContain('Bus stops (on)');
  });

  it('ignores an unrecognised layer-error id (e.g. the unknown-layer:/unbuildable-layer: guards)', () => {
    const root = renderApp().root;
    const webview = root.findByType(MockWebViewType);
    expect(() => {
      act(() => {
        (webview.props.onMessage as (event: unknown) => void)({
          nativeEvent: {data: `${MAP_LOG_TAG} layer-error: unknown-layer:bogus`},
        });
      });
    }).not.toThrow();
    expect(root.findByType(MapScreen).props.enabledLayerIds.size).toBe(0);
  });
});
