/// <reference types="node" />
/**
 * AC16/AC8-bearing shell test for CUPBOARD-1: the header title, the
 * three-entry sidebar (order and labels), the map as the default view,
 * per-entry placeholder selection, and both return-to-map paths (the
 * visible "Back to map" button and the Android hardware back button).
 *
 * NAVIGATION MODEL under test (per author decision): selecting a
 * sidebar entry unmounts the map and mounts that entry's placeholder;
 * returning (by either path) unmounts the placeholder and mounts a
 * fresh `MapScreen`, which reloads centred back on Chicago from the
 * pinned constants. This is a plain conditional render, not a
 * hide-in-place, so there is no "still mounted but hidden" state to
 * assert.
 *
 * @format
 */

import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import renderer, {act} from 'react-test-renderer';
import type {ReactTestInstance} from 'react-test-renderer';
import {BackHandler} from 'react-native';
import {AppHeader, AppShell, BobuttonsProvider, Tabs, ViewBody, ViewPane} from 'bobuttons';

import App from '../App';
import PlaceholderView from '../src/views/PlaceholderView';
import {MAP_VIEW_ID, SIDEBAR_ENTRIES} from '../src/shell/navEntries';

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

// The real SafeAreaProvider never delivers the native onLayout event
// Jest waits on, so it renders zero children and AppContent never
// mounts - no BackHandler registration would happen under the real
// provider. Stubbed here (identity passthrough + fixed zero insets) so
// the shell actually renders.
const ZERO_INSETS = {top: 0, right: 0, bottom: 0, left: 0};
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
    useSafeAreaInsets: () => ZERO_INSETS,
  };
});

const {WebView} = jest.requireMock('react-native-webview') as {
  WebView: React.ComponentType;
};

const SIDEBAR_LABELS = ['Settings', 'Places', 'Notes'];

function renderApp(): {root: ReactTestInstance; instance: renderer.ReactTestRenderer} {
  let instance!: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(<App />);
  });
  return {root: instance.root, instance};
}

function findTabNode(root: ReactTestInstance, id: string): ReactTestInstance {
  const matches = root.findAll(
    node =>
      node.props &&
      node.props.id === `tab-${id}` &&
      typeof node.props.onPress === 'function',
  );
  expect(matches.length).toBeGreaterThan(0);
  return matches[0];
}

function pressTab(root: ReactTestInstance, id: string): void {
  const tab = findTabNode(root, id);
  act(() => {
    (tab.props.onPress as () => void)();
  });
}

describe('shell: header, sidebar, default view', () => {
  it('renders AppHeader with exactly title "Cupboard", locale "en-US", timeZone "America/Chicago"', () => {
    const {root} = renderApp();
    const shell = root.findByType(AppShell);
    const header = shell.props.header as unknown as {
      type: unknown;
      props: {title: string; locale: string; timeZone: string};
    };
    expect(header.type).toBe(AppHeader);
    expect(header.props.title).toBe('Cupboard');
    expect(header.props.locale).toBe('en-US');
    expect(header.props.timeZone).toBe('America/Chicago');
  });

  it('renders exactly the three labels Settings, Places, Notes in that order, via Tabs (never TabBar), as AppShell\'s own `sidebar` prop', () => {
    const {root} = renderApp();
    const shell = root.findByType(AppShell);
    const sidebar = shell.props.sidebar as unknown as {
      type: unknown;
      props: {tabs: unknown; current: unknown};
    };
    // Pinned to AppShell's `sidebar` prop specifically (AC6: "the side
    // panel is AppShell's `sidebar` prop fed with ... Tabs"), not merely
    // to a `Tabs` node anywhere in the tree - the latter would also pass
    // if Tabs were rendered inside ViewPane or elsewhere.
    expect(sidebar.type).toBe(Tabs);
    expect(sidebar.props.tabs).toEqual(SIDEBAR_ENTRIES);

    const tabs = root.findByType(Tabs);
    expect(tabs.props.tabs).toEqual(SIDEBAR_ENTRIES);

    // Styled Tamagui text wraps several composite layers (e.g. TabLabel
    // -> Text -> the host Text) that all carry the same `children`
    // string, so this narrows to the innermost HOST `Text` node (type
    // is the string 'Text', not a composite) to get exactly one match
    // per label.
    const labelNodes = root.findAll(
      node =>
        (node.type as unknown) === 'Text' &&
        typeof node.props.children === 'string' &&
        SIDEBAR_LABELS.includes(node.props.children),
    );
    expect(labelNodes.map(node => node.props.children)).toEqual(SIDEBAR_LABELS);

    expect(root.findAll(node => (node.type as unknown) === 'TabBar')).toHaveLength(
      0,
    );
  });

  it('shows the map as the default view, with no placeholder mounted', () => {
    const {root} = renderApp();
    const tabs = root.findByType(Tabs);
    expect(tabs.props.current).toBe(MAP_VIEW_ID);

    const webview = root.findByType(WebView);
    expect(webview).toBeTruthy();
    expect(root.findAllByType(PlaceholderView)).toHaveLength(0);

    // AC9's static guard: the map's wrapper View AND the WebView itself
    // must keep an explicit `flex: 1`, or the WebView collapses to zero
    // height inside ViewPane's Card and renders blank. StyleSheet.create
    // returns numeric IDs under the RN preset's jest config, so flatten
    // through react-native's own StyleSheet to read the resolved values
    // regardless of whether a style is an object or a registered ID.
    const {StyleSheet} = jest.requireActual('react-native') as {
      StyleSheet: {flatten: (style: unknown) => Record<string, unknown>};
    };
    const webviewStyle = StyleSheet.flatten(webview.props.style);
    expect(webviewStyle.flex).toBe(1);

    const wrapper = webview.parent as ReactTestInstance;
    const wrapperStyle = StyleSheet.flatten(wrapper.props.style);
    expect(wrapperStyle.flex).toBe(1);
  });
});

describe('shell: selecting an entry', () => {
  it.each(SIDEBAR_ENTRIES.map(entry => [entry.id, entry.label] as const))(
    'selecting %s renders its placeholder and unmounts the map',
    (id, label) => {
      const {root} = renderApp();
      pressTab(root, id);

      const placeholder = root.findByType(PlaceholderView);
      expect(placeholder.props.entryId).toBe(id);

      const {ViewToolbar} = jest.requireActual('bobuttons') as {
        ViewToolbar: React.ComponentType;
      };
      const toolbar = root.findByType(ViewToolbar);
      expect(toolbar.props.title).toBe(label);

      const tabs = root.findByType(Tabs);
      expect(tabs.props.current).toBe(id);

      expect(() => root.findByType(WebView)).toThrow();
    },
  );
});

describe('shell: returning to the map', () => {
  it('pressing the rendered "Back to map" button restores the map and unmounts the placeholder', () => {
    const {root} = renderApp();
    pressTab(root, 'places');
    expect(() => root.findByType(PlaceholderView)).not.toThrow();

    const backButton = root.findAll(
      node => node.props && node.props.label === 'Back to map',
    )[0];
    act(() => {
      (backButton.props.onPress as () => void)();
    });

    expect(root.findByType(Tabs).props.current).toBe(MAP_VIEW_ID);
    expect(() => root.findByType(WebView)).not.toThrow();
    expect(root.findAllByType(PlaceholderView)).toHaveLength(0);
  });

  it('registers exactly one hardwareBackPress handler for the component lifetime; back returns true from a placeholder (and to the map) and false on the map', () => {
    const removeSpy = jest.fn();
    const addEventListenerSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation(() => ({remove: removeSpy}));

    const {root, instance} = renderApp();
    pressTab(root, 'notes');
    pressTab(root, 'settings');

    // These two assertions guard exactly ONE device bug: Android
    // dispatches `hardwareBackPress` subscriptions newest-first and
    // stops at the first one that returns true (BackHandler.android.js),
    // so a handler re-subscribed on every navigation would leak one
    // stale registration per navigation, and a leaked registration that
    // still returns true from a since-left placeholder would consume
    // the back press on the map and the app would stop exiting - green
    // here if read loosely, wrong on device. They are NOT guarding
    // StrictMode's double-invocation of effects or a legitimate
    // remount; if a future harness change trips this, fix the harness,
    // not this component.
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy.mock.calls[0][0]).toBe('hardwareBackPress');
    const handler = addEventListenerSpy.mock.calls[0][1] as () => boolean;

    // Currently on the "settings" placeholder (from the second press
    // above): back should return to the map and report "handled".
    let handled: boolean | undefined;
    act(() => {
      handled = handler();
    });
    expect(handled).toBe(true);
    expect(root.findByType(Tabs).props.current).toBe(MAP_VIEW_ID);
    expect(() => root.findByType(WebView)).not.toThrow();

    // On the map now: back should fall through to the platform default
    // (exit), i.e. report "not handled".
    act(() => {
      handled = handler();
    });
    expect(handled).toBe(false);

    // Cleanup path: the effect's teardown must call the subscription's
    // `.remove()` exactly once, and only on unmount - never before. This
    // is the only assertion that distinguishes a correct cleanup from a
    // leaked listener (`removeSpy` is injected via the mocked
    // `addEventListener` return value above but is otherwise
    // unobservable).
    expect(removeSpy).not.toHaveBeenCalled();
    act(() => {
      instance.unmount();
    });
    expect(removeSpy).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
  });
});

describe('shell: structural shape', () => {
  it('renders exactly one BobuttonsProvider with no config prop, exactly one ViewPane, and zero ViewBody', () => {
    const {root} = renderApp();
    const providers = root.findAllByType(BobuttonsProvider);
    expect(providers).toHaveLength(1);
    expect('config' in providers[0].props).toBe(false);

    expect(root.findAllByType(ViewPane)).toHaveLength(1);
    expect(root.findAllByType(ViewBody)).toHaveLength(0);

    pressTab(root, 'settings');
    expect(root.findAllByType(ViewPane)).toHaveLength(1);
  });
});

describe('shell: source scan for sanctioned UI imports only', () => {
  const REPO_ROOT = path.join(__dirname, '..');
  const SOURCE_FILES = [
    path.join(REPO_ROOT, 'App.tsx'),
    ...listSourceFiles(path.join(REPO_ROOT, 'src')),
  ];

  function listSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...listSourceFiles(full));
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const ALLOWED_EXTERNAL_MODULES = new Set([
    'react',
    'react-native',
    'react-native-safe-area-context',
    'react-native-webview',
    'react-native-webview/lib/WebViewTypes',
    'bobuttons',
  ]);

  it('imports no @tamagui/* package, no bobuttons/dist deep import, and no module outside the sanctioned allowlist', () => {
    const importRe = /from\s+['"]([^'"]+)['"]/g;
    for (const file of SOURCE_FILES) {
      const contents = fs.readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = importRe.exec(contents))) {
        const specifier = match[1];
        if (specifier.startsWith('.')) {
          continue; // relative import, always sanctioned
        }
        expect(specifier.startsWith('@tamagui/')).toBe(false);
        expect(specifier.startsWith('bobuttons/')).toBe(false);
        expect(ALLOWED_EXTERNAL_MODULES.has(specifier)).toBe(true);
      }
    }
  });
});
