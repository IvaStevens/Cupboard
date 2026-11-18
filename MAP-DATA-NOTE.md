# Map data note (CUPBOARD-4)

Per-source-file provenance, the exact conversion commands, and the
property/attribute decisions behind the five committed map layers under
`android/app/src/main/assets/mapdata/` and the three licence/terms
copies under `android/app/src/main/assets/licences/`. This satisfies CTA
Developer License Agreement section III.2 ("reasonable efforts to keep
the CTA Data up to date") by making the conversion reproducible, and
records why a converted layer's feature count differs from the source
the ticket named.

This file lives at the repo root (not `docs/`, which is gitignored).

## Why the .kml files in `CTA/` are NOT used

The ticket named four `.kml` files (`CTARailLines.kml`,
`CTARailStations.kml`, `CTA_BusRoutes.kml`, `CTABusStops.kml`) as
authoritative. During implementation, the `Chicago Data Portal/` folder
was found to already hold GeoJSON exports of the same four CTA datasets
(file date stamp `20261117`), so the converter is a pure GeoJSON
**normaliser** - no KML parsing, no XML parser dependency. The four
`.kml` files, their parallel `.kmz` twins (`CTA_RailLines.kmz`,
`CTA_RailStations.kmz`, `CTA_BusRoutes.kmz`, `CTA_BusStops.kmz`), the
GTFS feed (`CTA/google_transit/`, `CTA/google_transit.zip`,
`CTA_STOP_XFERS.txt`), `CTA_garage_poly.kmz` and `CTA_ServiceArea.kmz`
are all unused - none of them are read by the converter or the app.

**Snapshot difference, recorded rather than explained away:** the portal
GeoJSON files are not the same snapshot as the `.kml` files. Feature
counts differ:

| Layer | `.kml` (unused) | Portal GeoJSON (used) | Delta |
| --- | --- | --- | --- |
| Rail lines | 154 | 153 | -1 segment |
| Rail stations | 144 | 145 | +1 station |
| Bus routes | 129 | 127 | -2 routes |
| Bus stops | 10,963 | 10,760 | -203 stops |

No cause is asserted for these deltas (e.g. a route discontinued between
snapshots, a segment merged) - they are two different exports taken at
different times, and the counts below are asserted against the file
actually converted. The 16 distinct rail `lines` values are **identical**
between the two snapshots (only the Red Line's segment count differs:
18 segments in the portal export vs. 19 in the `.kml`), so the
route-name -> colour table (see `src/map/railRoutes.ts`) is unaffected.

## Source files and conversion commands

All five source files live in `Chicago Data Portal/` in the main
checkout only (gitignored - see `.gitignore`'s `/Chicago Data Portal/`
entry). Re-run the conversion after refreshing that folder with:

```
node tools/convertMapData.js "Chicago Data Portal"
node tools/convertLicences.js .
```

(also available as `npm run convert:map-data` / `npm run convert:licences`
from the repo root - see `package.json`). Both commands are
developer-run only: neither is wired into Gradle or Metro, and both fail
loudly (non-zero exit, no partial writes) if a source file is missing or
a feature count does not match what is recorded below.

| Source file | Source | Snapshot date | Committed asset | Features |
| --- | --- | --- | --- | --- |
| `CTA_-_'L'_(Rail)_Lines_20261117.geojson` | Chicago Data Portal (CTA dataset); URL not recorded on disk - **supplied by the repo author** | 2026-11-17 (file date stamp) | `cta-rail-lines.geojson.js` | 153 (950 total MultiLineString parts across all layers; rail lines alone: 153) |
| `CTA_-_'L'_(Rail)_Stations_20261117.geojson` | Chicago Data Portal (CTA dataset); URL not recorded on disk - **supplied by the repo author** | 2026-11-17 | `cta-rail-stations.geojson.js` | 145 |
| `CTA_-_Bus_Routes_20261117.geojson` | Chicago Data Portal (CTA dataset); URL not recorded on disk - **supplied by the repo author** | 2026-11-17 | `cta-bus-routes.geojson.js` | 127 (950 MultiLineString parts) |
| `CTA_BusStops_20261117.geojson` | Chicago Data Portal (CTA dataset); URL not recorded on disk - **supplied by the repo author** | 2026-11-17 | `cta-bus-stops.geojson.js` | 10,760 |
| `Neighborhoods_2012b_20261117.geojson` | Chicago Data Portal, dataset `Neighborhoods_2012b` (attribution "City of Chicago", http://www.cityofchicago.org, licence "See Terms of Use" / `SEE_TERMS_OF_USE` - read from the saved landing page `Chicago Data Portal/Neighborhoods_2012b _ City of Chicago _ Data Portal.html`, not committed) | 2026-11-17 | `chicago-neighbourhoods.geojson.js` | 98 |

**Portal licence/attribution gap for the four CTA files:** the folder
holds a saved Data Portal landing page only for `Neighborhoods_2012b`
(and, unused, Bike Routes) - none for the four CTA datasets above. Their
Data Portal licence/attribution therefore cannot be confirmed from
anything on disk; this is left as an **open item** rather than inventing
licence text. The CTA Developer License Agreement still governs this
data (CTA owns and maintains it regardless of which export format it is
downloaded in - see the agreement's "CTA Data" definition, "including,
but not limited to..."), so the CTA credit (AC22) and the shipped
agreement (AC18) stay in place either way.

## What each conversion does (`tools/mapDataConversion.js` / `tools/convertMapData.js`)

Pure GeoJSON normalisation, no coordinate reprojection and no filtering
by any attribute value:

1. **Coordinates rounded to 6 decimal places** (the source carries up to
   15; e.g. `-87.627596097033753` in the raw file rounds to
   `-87.627596`). This is the largest size reduction - at 15 decimals the
   committed assets would be roughly twice their current size.
2. **Properties reduced to a per-layer whitelist** - every other key is
   dropped by omission (not by name-matching), so a column Socrata adds
   later is dropped automatically rather than needing a new "deny" rule:
   - `cta-rail-lines`: `lines`, `description`, `type`, `legend`. (The
     `.kml`-only fields `ALT_LEGEND`/`PHOTOLINK`/`JLLINK` do not exist in
     the portal GeoJSON - see "What was dropped and why" below for why
     they would have been dropped anyway.)
   - `cta-rail-stations`: `station_id`, `longname`, `lines`, `ada`,
     `legend`.
   - `cta-bus-routes`: `route`, `name`, `wkday`, `sat`, `sun`.
   - `cta-bus-stops`: `systemstop`, `public_nam`, `routesstpg`, `dir`.
   - `chicago-neighbourhoods`: `pri_neigh`, `sec_neigh` (`pri_neigh` is
     the stable per-polygon key a later ticket can colour/link through).
3. **Output serialised with `JSON.stringify` and no pretty-print
   whitespace**, wrapped as one `cupboardRegisterLayer("<id>", <geojson>)`
   call per file - see "Delivery mechanism" below for why.

### What was dropped and why

- Every Socrata `:`-prefixed field (`:id`, `:version`, `:created_at`,
  `:updated_at`, `:@computed_region_*`) - internal portal bookkeeping,
  not map data.
- Rail stations' `point_x`/`point_y` - **State Plane feet** (e.g.
  `1144440.97667316`), not lon/lat; actively misleading if shipped next
  to the feature's real lon/lat geometry.
- Rail stations' `address`/`pknrd` - out of scope for this ticket's five
  layers (no popups/info panels are built - AC "out of scope" list).
- `shape_len`/`shape_area` (rail lines/neighbourhoods) - derivable from
  the geometry itself if ever needed; not used by any layer this ticket
  renders.
- No bus stop was dropped on attribute grounds. The portal bus-stops
  file carries no `STATUS` field at all (unlike the `.kml`, which has
  one taking values including `In Service` and `Flag` - both real
  stops); since the field is absent here, there is nothing to filter and
  nothing was.
- The CTA rail-line `.kml`'s `PHOTOLINK`
  (`http://gisweb/Photos/raillines/CTALogo_Dot.jpg`, a CTA logo URL, on
  all 154 `.kml` placemarks) and `JLLINK` (a Jones Lang LaSalle
  portfolio-tracker URL) do not exist in the portal GeoJSON's
  properties at all - there is no HTML `<description>` blob in the
  portal export to carry them. Both markers are nonetheless asserted
  absent from the committed assets by
  `__tests__/mapDataAssets.test.js`, alongside `gisweb`,
  `joneslanglasalle`, `CTALogo` and `<table`, as a guard against a
  future re-conversion from the `.kml`/`.kmz` files reintroducing them.

### Feature-count assertions

`tools/convertMapData.js` asserts the exact feature count of each source
file before converting it (153 / 145 / 127 / 10,760 / 98 - the table
above) and exits non-zero without writing anything if a count does not
match. A future refresh that intentionally changes a count must update
both the expected count in that script and this note's snapshot-
difference table.

## Delivery mechanism (AC10)

`MapScreen.tsx`'s WebView deliberately leaves `allowFileAccess`,
`allowFileAccessFromFileURLs` and `allowUniversalAccessFromFileURLs`
unset (unchanged from CUPBOARD-1 - see that file's header comment for
the full security rationale). Fetching `file:///android_asset/*.geojson`
with `fetch`/`XHR` from the `file://` map document is blocked by that,
so each committed asset is instead the GeoJSON **wrapped in one
`cupboardRegisterLayer("<id>", <geojson>)` call**, loaded as a same-
origin `<script src="../mapdata/<file>">` - a SUBRESOURCE load, exactly
the mechanism map.html already uses for `leaflet.js`/`leaflet.css`, and
one the three file-access flags do not govern. `originWhitelist`/
`shouldAllowNavigation` still gate top-level navigation only, unaffected
by this. See `src/map/mapConstants.ts`'s `MAP_DATA_DIR_RELATIVE` and
`android/app/src/main/assets/leaflet/map.html`'s
`cupboardRegisterLayer`/`cupboardSetLayers`.

## Rail-line colour rule (AC2/AC3)

See `src/map/railRoutes.ts` for the full rule and the 16 verified source
`lines` values, and `src/map/mapConstants.ts` for the 8 colour values
themselves. Summary: a segment is coloured by the **first route named**
in its `lines` property; both Blue Line branch labels resolve to Blue.
`__tests__/mapLayers.test.ts` asserts all 16 names resolve correctly.

## Licence/terms assets (`tools/convertLicences.js`)

- `android/app/src/main/assets/licences/cta-developer-license-agreement.html`
  (AC18): `CTA/developers_license_agreement.htm`, re-encoded
  Windows-1252 -> UTF-8 (verified: Node's `TextDecoder('windows-1252')`
  resolves the label without throwing but decodes this document's upper
  byte range as an identity/Latin-1 mapping in this toolchain, which
  would leave the curly quotes as C1 control characters - `convertLicences.js`
  therefore hand-rolls the WHATWG windows-1252 extra-byte table instead
  of trusting the runtime decoder), with the browser-injected ad-blocking
  `<style>` element and the three `<img>` references into a
  `developers_license_agreement_files/` directory (which does not exist
  on disk; one image's `alt` text is "Chicago Transit Authority (logo)",
  a CTA Brand Asset this app does not ship - III.4/III.5) removed. Every
  word of the agreement's own text is unchanged.
- `android/app/src/main/assets/licences/chicago-terms-of-use.txt` (AC19):
  lines 36-50 of `Chicago Data Portal/TIF Information.html`, verbatim,
  as plain text (DISCLAIMER OF LIABILITY, USE OF DATA, RESERVATION OF
  RIGHTS, INDEMNITY). That file's true provenance is recorded in the
  output itself: an HTTrack mirror of
  `webapps1.cityofchicago.org/ChicagoTif/disclaimer.html`, captured
  2016-07-05 (the file's own HTML comment also records an earlier
  `webapps1int.cityofchicago.org` mirror from 2016-06-22; both are
  recorded). It is **not** a saved copy of the Data Portal's own Terms
  of Use page - the Neighborhoods_2012b landing page links to no such
  page, so that page is not on disk and fetching it is out of scope.
  None of `TIF Information_files/` is committed.
- `android/app/src/main/assets/licences/neighbourhoods-dataset-licence.txt`
  (AC20): the `Neighborhoods_2012b` dataset's licence metadata (dataset
  name, attribution, attribution link, licence, `licenseId`) as a short
  text record, read from the saved landing page. The 4.9 MB landing page
  and its `_files/` directory (including `chicago.gov-logo_H_lB.png`)
  are not committed.

## CTA licence compliance note (AC23)

Citations below are against `CTA/developers_license_agreement.htm`
(committed sanitised at
`android/app/src/main/assets/licences/cta-developer-license-agreement.html`):

- **I.1** (limited licence, purpose restricted to assisting bus/rail
  riders or promoting public transportation): the CTA data is used only
  for the four map layers in this ticket - no other use is built.
- **II.3** / **III.3** (no selling/bartering/transferring CTA Data
  separate from the application): the data ships only as part of the
  app's assets; there is no export/download feature.
- **III.1** (no expressed/implied affiliation, relationship, sponsorship
  or endorsement): the UI names no relationship with CTA beyond the
  optional credit line (III.6); `src/views/LicencesView.tsx` states the
  app is not affiliated with, endorsed by or sponsored by CTA.
- **III.4/III.5** (no CTA Brand Assets - names, logos, trademarks, title
  treatments or art - in the UI, assets or data; no CTA mark or
  confusingly similar term in the app name): "Cupboard" contains no CTA
  mark; no CTA logo is shipped (the three `<img>` references into
  `developers_license_agreement_files/` were removed from the committed
  agreement for exactly this reason).
- **III.6** (crediting is optional; "Data provided by CTA" is an
  explicitly blessed form): this app credits CTA with exactly that
  string (`CTA_CREDIT_TEXT` in `src/map/mapConstants.ts`), shown in the
  Leaflet attribution control while any of the four CTA layers is
  visible.

## Asset size and APK delta (AC9)

See README.md's "Map data" section for the committed asset total and the
measured debug-APK size delta.

## Bus-stops performance technique (AC15)

See README.md's "Bus stops performance" section for the full writeup.
