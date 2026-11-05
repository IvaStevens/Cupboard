/**
 * Shell test for CUPBOARD-1: the header title, the three-entry sidebar,
 * the map as the default view, and per-entry placeholder selection.
 * Returning to the map (button and hardware back) is left to the e2e
 * tests.
 *
 * @format
 */

import * as React from 'react';
import renderer, {act} from 'react-test-renderer';
import type {ReactTestInstance} from 'react-test-renderer';
import {AppHeader, AppShell, Tabs} from 'bobuttons';

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

// The real SafeAreaProvider never delivers the native onLayout event Jest
// waits on, so it renders zero children. Stubbed so the shell renders.
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

function renderApp(): ReactTestInstance {
  let instance!: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(<App />);
  });
  return instance.root;
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

describe('shell', () => {
  it('renders the "Cupboard" header and the Settings, Places, Notes sidebar', () => {
    const root = renderApp();
    const shell = root.findByType(AppShell);

    const header = shell.props.header as unknown as {
      type: unknown;
      props: {title: string};
    };
    expect(header.type).toBe(AppHeader);
    expect(header.props.title).toBe('Cupboard');

    const sidebar = shell.props.sidebar as unknown as {
      type: unknown;
      props: {tabs: unknown};
    };
    expect(sidebar.type).toBe(Tabs);
    expect(sidebar.props.tabs).toEqual(SIDEBAR_ENTRIES);
    expect(SIDEBAR_ENTRIES.map(entry => entry.label)).toEqual([
      'Settings',
      'Places',
      'Notes',
    ]);
  });

  it('shows the map by default, with no placeholder mounted', () => {
    const root = renderApp();
    expect(root.findByType(Tabs).props.current).toBe(MAP_VIEW_ID);
    expect(root.findByType(WebView)).toBeTruthy();
    expect(root.findAllByType(PlaceholderView)).toHaveLength(0);
  });

  it.each(SIDEBAR_ENTRIES.map(entry => [entry.id] as const))(
    'selecting %s shows its placeholder instead of the map',
    id => {
      const root = renderApp();
      pressTab(root, id);

      expect(root.findByType(PlaceholderView).props.entryId).toBe(id);
      expect(root.findByType(Tabs).props.current).toBe(id);
      expect(() => root.findByType(WebView)).toThrow();
    },
  );
});
