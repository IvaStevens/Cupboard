# Cupboard

An Android app for finding points of interest around Chicago and keeping
notes about them.

## Using the app

The map of Chicago is the main screen. Pan and pinch to explore the city;
the +/- buttons zoom too.

The side panel switches between the app's sections:

- **Places** - the points of interest you have found around the city.
- **Notes** - the notes you have saved about them.
- **Settings** - app preferences.

Choose **Back to map** (or press the Android back button) to return to
the map. Map tiles come from OpenStreetMap, so the map needs a network
connection.

## Development

Built with React Native 0.83 and the [bobuttons](#bobuttons) component
library. The map is Leaflet running inside `react-native-webview`.

### Prerequisites

- Node and `npm ci` for the JavaScript dependencies.
- JDK 17 or newer.
- The Android SDK with `platform-tools`, `ANDROID_HOME` (or
  `ANDROID_SDK_ROOT`) set, and licences accepted (`sdkmanager --licenses`).
- A device or emulator. The first Gradle build needs network access.

### Run

```
npm start          # Metro bundler, in one terminal
npm run android    # build, install and launch, in another
```

To build the debug APK on its own:

```
cd android && ./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/`.

### Checks

```
npm test
npm run lint
npm run typecheck
```

### Project layout

- `App.tsx` - the bobuttons `AppShell`: header, side panel, and the active view.
- `src/map/` - the Leaflet map: view constants (Chicago's coordinates, zoom,
  tile URL, attribution), the WebView screen, and the init script.
- `src/shell/`, `src/views/` - side panel entries and their views.
- `android/app/src/main/assets/leaflet/` - `map.html` and the vendored Leaflet.

### Troubleshooting the map

If the map is grey, tiles could not be fetched (no network, or
OpenStreetMap rate-limiting). The page logs the first failed tile and a
throttled summary:

```
adb logcat -d | grep CupboardMap
```

### bobuttons

bobuttons is private and not on any registry. It is vendored as a tarball,
`vendor/bobuttons-0.1.0.tgz`, referenced from `package.json` as
`file:vendor/bobuttons-0.1.0.tgz`. Its package version stays `0.1.0` across
many commits, so the source commit and pack date identify the build; both
are recorded in `package.json` under `bobuttonsProvenance`.

- Source commit (Bobuttons `main`): `de3fe609ea34d5f7e0aab51b0a1fc8f81e89de98`
- Packed (UTC): `2026-10-27`

bobuttons bundles its own copy of Tamagui, so **never add a `@tamagui/*`
package** to this app. A second copy makes the app crash at runtime with
"can't find Tamagui configuration". Render `<BobuttonsProvider>` alone at
the root; do not wrap the tree in a `TamaguiProvider`.

Jest needs `bobuttons` in `transformIgnorePatterns` (already set in
`jest.config.js`) because its native build is ESM.

### Leaflet

Leaflet 1.9.4 (BSD-2-Clause) is vendored from npm into
`android/app/src/main/assets/leaflet/`, not loaded from a CDN. `leaflet.js`
has one `/* eslint-disable */` line prepended so it passes lint. To refresh
both files after bumping the `leaflet` devDependency:

```
cp node_modules/leaflet/dist/leaflet.css android/app/src/main/assets/leaflet/leaflet.css
printf '/* eslint-disable */\n' > android/app/src/main/assets/leaflet/leaflet.js
cat node_modules/leaflet/dist/leaflet.js >> android/app/src/main/assets/leaflet/leaflet.js
```

### Licences

See `THIRD-PARTY-NOTICE.md` for the React Native template, bobuttons, the
packages bobuttons bundles, and `react-native-svg`.
