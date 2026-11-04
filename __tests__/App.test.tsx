/**
 * Kept in the generator's shape: renders the app through the real
 * SafeAreaProvider and BobuttonsProvider and asserts nothing about the
 * resulting tree - under Jest, `SafeAreaProvider` renders zero children,
 * so there is nothing here to assert against. The mechanism checks
 * (AppHeader, insets, injected script, security props, gesture
 * ownership) live in map.test.tsx, which renders `MapScreen` directly
 * under a mocked safe-area provider; the shell/navigation checks
 * (sidebar labels, default view, placeholder selection, return-to-map)
 * live in shell.test.tsx, which also mocks safe-area-context so
 * `AppContent` actually mounts.
 *
 * react-native-webview is mocked because its package entry is ESM and
 * is not whitelisted by the react-native Jest preset's
 * `transformIgnorePatterns` - an unmocked import is a SyntaxError.
 *
 * @format
 */

import 'react-native';
import * as React from 'react';
import App from '../App';

import renderer, {act} from 'react-test-renderer';

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

test('renders correctly', async () => {
  await act(async () => {
    renderer.create(<App />);
  });
});
