/**
 * Single source of truth for every parameter the Leaflet map needs.
 *
 * Nothing here is ever duplicated into map.html: these values are passed
 * into the page as one JSON-stringified config via
 * `buildMapInitScript()` (see mapInitScript.ts), which calls
 * `window.initLeafletMap(<config>)`. map.html itself carries no
 * coordinate, zoom, tile URL or attribution string.
 *
 * @format
 */

/** Chicago latitude, the pinned initial map centre. */
export const CHICAGO_LATITUDE = 41.8781;

/** Chicago longitude, the pinned initial map centre. */
export const CHICAGO_LONGITUDE = -87.6298;

/** Initial Leaflet zoom level. */
export const INITIAL_ZOOM = 12;

/** Maximum zoom level the tile layer will request. */
export const MAP_MAX_ZOOM = 19;

/** Standard OpenStreetMap HTTPS tile endpoint, with no prefetching. */
export const OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Attribution HTML shown on the map; deliberately not followable. */
export const OSM_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Directory the bundled Leaflet assets live under, as a file:// URI. */
export const MAP_ASSET_DIR_URI = 'file:///android_asset/leaflet/';

/** The map.html document, as a file:// URI, loaded by the WebView. */
export const MAP_HTML_ASSET_URI = `${MAP_ASSET_DIR_URI}map.html`;

/** One grep-able tag shared by every diagnostic line this feature logs. */
export const MAP_LOG_TAG = '[CupboardMap]';

// ---------------------------------------------------------------------
// CUPBOARD-4: CTA / neighbourhood layer colours, styles and credits.
//
// Same rule as above: every colour, style number and credit string lives
// here and travels into the page as config; map.html does one lookup
// and holds no colour/attribution literal of its own. The route-NAME ->
// colour-KEY rule (first route named wins, both Blue branches -> blue)
// lives in railRoutes.ts, which imports RAIL_ROUTE_COLOURS from here to
// build the `{name: colour}` dictionary actually sent to the page.
// ---------------------------------------------------------------------

/** The 8 CTA rail route colour keys a rail segment's first-named route can resolve to. */
export type RailColourKey =
  | 'red'
  | 'blue'
  | 'brown'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'yellow';

/**
 * One colour per CTA rail route, matching CTA's own branding colours.
 * Keyed by the colour-key railRoutes.ts's `railRouteKeyFromName()`
 * computes from a rail segment's first-named route - not by the route
 * name itself, so this table only ever needs 8 entries no matter how
 * many of the 16 source route-name labels exist.
 */
export const RAIL_ROUTE_COLOURS: Record<RailColourKey, string> = {
  red: '#C60C30',
  blue: '#00A1DE',
  brown: '#62361B',
  green: '#009B3A',
  orange: '#F9461C',
  pink: '#E27EA6',
  purple: '#522398',
  yellow: '#F9E300',
};

/**
 * CTA bus routes have no route colour (AC4); this is one uniform colour
 * for all of them, deliberately distinct from all 8 RAIL_ROUTE_COLOURS
 * values above, and reused for bus stops' fill so the two bus layers
 * read as a pair.
 */
export const BUS_ROUTE_COLOUR = '#4A4A4A';

/** One uniform colour for Chicago bike routes, distinct from all 8 rail colours and from the bus grey. */
export const BIKE_ROUTE_COLOUR = '#B5179E';

/** Stroke weight for bike-route polylines (px). */
export const BIKE_ROUTE_WEIGHT = 2;

/** Stroke weight for rail-line polylines (px). */
export const RAIL_LINE_WEIGHT = 3;

/** Stroke weight for bus-route polylines (px), thinner than rail so dense bus corridors do not visually dominate. */
export const BUS_ROUTE_WEIGHT = 2;

export interface CircleLayerStyle {
  radius: number;
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
}

/** One style for every rail station marker. */
export const RAIL_STATION_STYLE: CircleLayerStyle = {
  radius: 5,
  color: '#1C1C1C',
  weight: 1,
  fillColor: '#FFFFFF',
  fillOpacity: 1,
};

/** One style for every bus stop marker - small, so 10,760 of them stay legible rather than merging into a solid mass. */
export const BUS_STOP_STYLE: CircleLayerStyle = {
  radius: 3,
  color: BUS_ROUTE_COLOUR,
  weight: 1,
  fillColor: BUS_ROUTE_COLOUR,
  fillOpacity: 0.85,
};

export interface PolygonLayerStyle {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
}

/** One style for the neighbourhood polygons - a light, low-opacity fill so it reads as a backdrop under the CTA layers. */
export const NEIGHBOURHOOD_STYLE: PolygonLayerStyle = {
  color: '#8A8A8A',
  weight: 1,
  fillColor: '#CFCFCF',
  fillOpacity: 0.25,
};

/**
 * Credit shown in the Leaflet attribution control, alongside the OSM
 * credit, while any of the four CTA layers is visible (AC22). 'Data
 * provided by CTA' is the form CTA's Developer License Agreement
 * section III.6 explicitly blesses (crediting is optional under III.6;
 * this is the recommended wording when a developer chooses to credit).
 */
export const CTA_CREDIT_TEXT = 'Data provided by CTA';

/** Credit shown while a City of Chicago layer (neighbourhoods, bike routes) is visible (AC22). */
export const CHICAGO_CREDIT_TEXT = 'Data provided by City of Chicago';

/**
 * Where the converted layer assets live, as a path relative to
 * map.html's own directory (android/app/src/main/assets/leaflet/) -
 * resolves to android/app/src/main/assets/mapdata/. A relative
 * reference, like leaflet.css/leaflet.js above, so no WebView
 * file-access flag needs loosening (see MapScreen.tsx's header comment
 * for why that matters).
 */
export const MAP_DATA_DIR_RELATIVE = '../mapdata/';

/**
 * Zoom level below which the bus-stops layer (10,760 points) is
 * suppressed even when toggled on, as a designed-up-front fallback for
 * the on-device performance risk AC15 flags. `null` ships with no gate:
 * canvas rendering + circleMarker + interactive:false + on-demand
 * loading were sufficient on their own (see README's "Bus stops
 * performance" section for the full tradeoff writeup and how to turn
 * this on if a slower device needs it).
 */
export const BUS_STOPS_MIN_ZOOM: number | null = null;

/** Name and stacking order for the pane the neighbourhood polygons render in - below the default overlay pane (z=400) that rail/bus lines use and the default marker pane (z=600) that rail stations/bus stops use, so neighbourhoods render beneath all four CTA layers regardless of toggle order (AC13). */
export const NEIGHBOURHOOD_PANE_NAME = 'cupboard-neighbourhoods';
export const NEIGHBOURHOOD_PANE_Z_INDEX = 350;

/** map.html mirrors this literal (a message tag, not a map parameter - see its header comment) to report a layer's <script> failing to load or a WebView-side exception while building it. */
export const LAYER_ERROR_LOG_PREFIX = 'layer-error:';
