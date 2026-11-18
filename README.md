# Cupboard

An Android app for finding points of interest around Chicago and keeping
notes about them.

## Using the app

The map of Chicago is the main screen. Pan and pinch to explore the city;
the +/- buttons zoom too.

The side panel switches between the app's sections:

- **Places** - the 50 coffee shops from the Chicago Coffee Passport,
  grouped by neighbourhood and colour-coded to match the Neighbourhoods
  map layer. Select a shop for its full details; there is no editing
  (ratings, notes, visited state) in this view yet.
- **Notes** - the notes you have saved about them.
- **Settings** - app preferences, including a link to **Licences**.

Choose **Back to map** (or press the Android back button) to return to
the map. Map tiles come from OpenStreetMap, so the map needs a network
connection.

### Map layers

Below the side panel's Settings/Places/Notes selector is a second list,
the **layer picker**, with six CTA/Chicago map layers, each independently
toggleable and off by default:

- **Rail lines** - CTA 'L' tracks, coloured by route (Red, Blue, Brown,
  Green, Orange, Pink, Purple, Yellow); a shared/multi-route segment takes
  the colour of the first route named on it.
- **Rail stations**
- **Bus routes** - one uniform colour (CTA bus routes have no route colour).
- **Bus stops** - 10,760 stops; see "Bus stops performance" below.
- **Neighbourhoods** - Chicago's 98 named neighbourhoods, rendered beneath
  the four CTA layers. The 17 areas matching a Places neighbourhood are
  coloured with that neighbourhood's own passport colour pair (see
  "Places data" below); every other area keeps the plain grey/light-grey
  default style.
- **Bike routes** - the City's 1,008 bike route segments in one uniform
  colour.

Tapping a layer's name toggles it on/off immediately - the label shows
`(on)`, `(off)`, or `(unavailable)` if that layer's data failed to load (tap
it again to retry). Toggling a layer never changes which screen is showing.
Layer state survives switching to Settings/Places/Notes and back, but not
an app restart.

While any CTA layer is visible, the map's attribution control credits "Data
provided by CTA"; while Neighbourhoods is visible, it credits "Data
provided by City of Chicago".

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
  tile URL, attribution, layer colours/styles/credits), the six map layers'
  definitions (`mapLayers.ts`), the rail route colour rule (`railRoutes.ts`),
  the per-area neighbourhood colour rule (`neighbourhoodColours.ts`, see
  "Places data" below), the WebView screen, and the init script.
- `src/shell/` - the side panel's main selector data and `LayerPicker.tsx`,
  the layer-toggle sub-selector.
- `src/places/` - the Places tab's data: `passportSeed.json` (generated
  once, see "Places data" below) and `passportData.ts`, the typed access
  layer the Places views and `src/map/neighbourhoodColours.ts` both
  import.
- `src/views/` - the side panel's views: `LicencesView.tsx`, `PlacesView.tsx`
  and `PlaceDetailView.tsx` (the Places tab), and `PlaceholderView.tsx`
  (still used for Settings and Notes).
- `src/licences/` - licence/credit text shared by `LicencesView.tsx` and
  this README.
- `android/app/src/main/assets/leaflet/` - `map.html` and the vendored Leaflet.
- `android/app/src/main/assets/mapdata/` - the six converted map layers
  (generated; see "Map data" below - never edit these by hand).
- `android/app/src/main/assets/licences/` - the CTA agreement and City of
  Chicago terms shipped with the app, copied once from the source folders
  (the CTA agreement re-encoded to UTF-8 with its logo images removed).
- `tools/` - the developer-run script that produces the map layers (see
  "Map data" below).

### Places data

`src/places/passportSeed.json` (50 coffee shops across 17 neighbourhoods)
was converted **once** from a gitignored source document,
`docs/passport.tex` (the author's own "Chicago Coffee Passport", not
committed - see `.gitignore`'s "Local workflow docs" entry), using a
throwaway script that was run by hand and then discarded, not committed
under `tools/`. Unlike the map layers above, **there is no re-runnable
converter for this data and none should be added**: the parsing was a
one-time job, and the committed JSON file is the product, not a
generated artifact that gets regenerated and recommitted. From here on,
`src/places/passportSeed.json` is the source of truth - edit it directly
(the author plans to re-match some shops to neighbourhoods by hand) and
commit the result like any other source file.

`src/places/passportData.ts` is a small, hand-written typed layer over
that JSON: it documents the fixed field names (`signatureDrink`,
`website`, `overallRating`, `neighbourhoodRating`, all using `null` as
the one shared "blank" representation) and exports
`PASSPORT_NEIGHBOURHOODS`, `PASSPORT_PLACES` and
`PLACES_BY_NEIGHBOURHOOD_ID`.

**Id stability.** Every neighbourhood and place id is a deterministic
slug derived from its name (never from array position), and a place
references its neighbourhood by id. Because ids are name-derived, **a
future id change is a data migration, not a cosmetic rename**: a planned
on-device database (an upcoming ticket) will use these same ids as
primary keys, so if a hand-edit to `passportSeed.json` ever changes an
id (visible as an id diff, not just a text diff, in
`git diff src/places/passportSeed.json`), any already-stored rows keyed
on the old id need to be migrated rather than silently orphaned.

**What is - and is not - in this file.** The 50 shops' blank `website`
and `overallRating` fields, and the 17 neighbourhoods' blank
`neighbourhoodRating` field, are the passport document's own unfilled
answer sheet (`null`), captured here so a future ratings/notes feature
needs no schema change - they are not where user ratings, notes or
visited state will live; that is on-device database state, out of scope
for this file entirely.

**Map colouring.** Each of the 17 passport neighbourhoods carries its
own colour pair (`colours.backgroundHex`/`frameHex`, taken from the
passport's own `sectionbox` colours) and the `pri_neigh` neighbourhoods-
layer area(s) it corresponds to (`connectedAreas`). `src/map/
neighbourhoodColours.ts` turns that into a `{pri_neigh: style}`
dictionary consumed by the map init config - see the "Map layers" section
above for the visible result, and that file's own header comment for the
precedence rule (South Loop/Pilsen vs. The Loop/Lower West Side,
Bronzeville's two areas).

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

- Source commit (Bobuttons `main`): `1be8a3efb0048c145c53f5c2542ea6ef14acc745`
- Packed (UTC): `2026-11-17`

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

### Map data

The six map layers are converted, once, from source GeoJSON files that are
**not committed** (they live in a gitignored `Chicago Data Portal/` folder
in the main checkout only): the CTA rail lines, rail stations, bus routes and
bus stops exports, the City's `Neighborhoods_2012b` dataset, and its Bike Routes dataset. Each layer
keeps only a short property whitelist, coordinates are rounded to 6 decimal
places, and the converter checks the feature count of every file (153 rail
lines, 145 rail stations, 127 bus routes, 10,760 bus stops, 98
neighbourhoods, 1,008 bike routes). The saved Data Portal pages for the four CTA datasets are not
on disk, so their portal terms are unconfirmed; the CTA Developer License
Agreement is the licence shipped for them. To regenerate the committed assets
after refreshing the source folder:

```
npm run convert:map-data
```

The script is not run by Gradle or Metro - re-run it by hand and commit the
result. The licence texts are one-time copies and have no script.

**Delivery mechanism.** `MapScreen.tsx`'s WebView deliberately leaves
`allowFileAccess`, `allowFileAccessFromFileURLs` and
`allowUniversalAccessFromFileURLs` unset (see that file's header comment
for the full rationale and the security tradeoff this choice avoids).
That blocks `fetch`/`XHR` of `file:///android_asset/*.geojson` from the
`file://` map document, so each layer is instead committed as a `.geojson.js`
file - the GeoJSON wrapped in one `cupboardRegisterLayer("<id>", <geojson>)`
call - and loaded as a same-origin `<script src="../mapdata/...">`
subresource, exactly like `leaflet.js`/`leaflet.css` already are.
`originWhitelist`/`shouldAllowNavigation` continue to gate only top-level
navigation, unaffected by this.

**Asset size.** The six committed layers total **~5.1 MB**
(`android/app/src/main/assets/mapdata/`, coordinates rounded to 6 decimal
places and serialised without pretty-print whitespace); the four licence
assets (`android/app/src/main/assets/licences/`) add another ~25 KB.

Measured debug-APK size delta, from two clean (`rm -rf android/app/build
android/build && ./gradlew assembleDebug`) builds at the commit before this
ticket's assets were added and after (measured before the bike routes layer,
about 0.7 MB of raw JSON, was added):

| | Size |
| --- | --- |
| Before (origin/main, no CUPBOARD-4 assets) | 126,864,825 bytes (121.0 MiB) |
| After (this branch) | 127,877,477 bytes (121.95 MiB) |
| **Delta** | **+1,012,652 bytes (+0.97 MiB)** |

The APK grows by only ~1 MB against ~4.3 MB of raw committed JSON because
the APK's own zip compression already shrinks the repetitive JSON
structure substantially.

### Bus stops performance

The bus-stops layer is 10,760 point features. Three techniques keep the map
responsive with it enabled, all in `map.html`:

1. **Canvas rendering** (`preferCanvas: true`) - one shared `<canvas>` per
   pane instead of one SVG `<path>`/DOM node per feature.
2. **`circleMarker`**, not full `marker` icons, for every point layer
   (rail stations and bus stops) - cheaper to rasterise at this count.
3. **`interactive: false`** on every layer - skips hit-testing entirely,
   so panning/zooming never has to test against 10,760 shapes, and the
   neighbourhood fills never swallow a gesture either.
4. **On-demand loading** - a layer's `<script>` asset is only requested the
   first time it is toggled on, not at page load.

A **zoom gate** (`BUS_STOPS_MIN_ZOOM` in `src/map/mapConstants.ts`) is wired
but shipped `null` (off): if a slower device needs it, setting it to a zoom
level suppresses the bus-stops layer below that zoom, trading "see bus stops
zoomed out" for responsiveness. Turning it on changes visible behaviour, so
update this section if it is ever enabled.

### Licences

See `THIRD-PARTY-NOTICE.md` for the React Native template, bobuttons, the
packages bobuttons bundles, and `react-native-svg`.

**CTA data.** Rail and bus map layers are provided by the Chicago Transit
Authority (CTA) under its Developer License Agreement, committed verbatim
(re-encoded to UTF-8, with the three CTA-logo `<img>` references removed) at
`android/app/src/main/assets/licences/cta-developer-license-agreement.html`.
This app is not affiliated with, endorsed by or sponsored by CTA; "Data
provided by CTA" (CTA licence section III.6's blessed optional credit) is
shown in the map's attribution control while any CTA layer is visible.

**City of Chicago data.** The Neighbourhoods layer uses the City of
Chicago's `Neighborhoods_2012b` dataset (attribution "City of Chicago",
http://www.cityofchicago.org, licence "See Terms of Use") and the Bike
Routes layer uses its Bike Routes dataset (attribution "City of Chicago",
https://www.chicago.gov, licence "See Terms of Use") - see
`android/app/src/main/assets/licences/neighbourhoods-dataset-licence.txt`
and `bike-routes-dataset-licence.txt` for the full records. "Data provided
by City of Chicago" is shown in the map's attribution control while either
layer is visible. The City's Terms of Use (committed at
`android/app/src/main/assets/licences/chicago-terms-of-use.txt`) require
this derivative-use disclaimer wherever the app "can be accessed or
downloaded":

> This site provides applications using data that has been modified for use from its original source, www.cityofchicago.org, the official website of the City of Chicago.  The City of Chicago makes no claims as to the content, accuracy, timeliness, or completeness of any of the data provided at this site.  The data provided at this site is subject to change at any time.  It is understood that the data provided at this site is being used at one's own risk.

It is also shown in-app on the **Licences** view (Settings -> Licences).
