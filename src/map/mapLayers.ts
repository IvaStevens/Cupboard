/**
 * The five CUPBOARD-4 map layers: ids, display labels, which converted
 * asset file each loads, geometry kind and which credit line (AC22)
 * showing it is responsible for.
 *
 * Layer ids are deliberately disjoint from every view id in
 * src/shell/navEntries.ts (map/settings/places/notes/licences) - the
 * layer picker (src/shell/LayerPicker.tsx) and bobuttons' `Tabs` both
 * derive a DOM id of `tab-${id}`, so a collision would make a test (or
 * TalkBack) address the wrong control.
 *
 * @format
 */

export type LayerId =
  | 'cta-rail-lines'
  | 'cta-rail-stations'
  | 'cta-bus-routes'
  | 'cta-bus-stops'
  | 'chicago-neighbourhoods';

export type LayerGeometryKind = 'line' | 'point' | 'polygon';

/** Which of the two credit lines (AC22) a layer belongs to. */
export type CreditGroup = 'cta' | 'neighbourhoods';

export interface MapLayerDef {
  id: LayerId;
  label: string;
  /** File name under android/app/src/main/assets/mapdata/ - see tools/convertMapData.js. */
  assetFile: string;
  kind: LayerGeometryKind;
  creditGroup: CreditGroup;
}

/** The five layers, in the order the layer picker lists them. All default OFF (AC11). */
export const MAP_LAYERS: ReadonlyArray<MapLayerDef> = [
  {
    id: 'cta-rail-lines',
    label: 'Rail lines',
    assetFile: 'cta-rail-lines.geojson.js',
    kind: 'line',
    creditGroup: 'cta',
  },
  {
    id: 'cta-rail-stations',
    label: 'Rail stations',
    assetFile: 'cta-rail-stations.geojson.js',
    kind: 'point',
    creditGroup: 'cta',
  },
  {
    id: 'cta-bus-routes',
    label: 'Bus routes',
    assetFile: 'cta-bus-routes.geojson.js',
    kind: 'line',
    creditGroup: 'cta',
  },
  {
    id: 'cta-bus-stops',
    label: 'Bus stops',
    assetFile: 'cta-bus-stops.geojson.js',
    kind: 'point',
    creditGroup: 'cta',
  },
  {
    id: 'chicago-neighbourhoods',
    label: 'Neighbourhoods',
    assetFile: 'chicago-neighbourhoods.geojson.js',
    kind: 'polygon',
    creditGroup: 'neighbourhoods',
  },
];

export const MAP_LAYER_IDS: ReadonlyArray<LayerId> = MAP_LAYERS.map(
  layer => layer.id,
);

export function isLayerId(id: string): id is LayerId {
  return (MAP_LAYER_IDS as ReadonlyArray<string>).includes(id);
}

/** Deterministic ordering helper: the subset of `ids` that is in `enabled`, in MAP_LAYERS order (never Set iteration order). */
export function orderedEnabledLayerIds(
  enabled: ReadonlySet<LayerId>,
): LayerId[] {
  return MAP_LAYER_IDS.filter(id => enabled.has(id));
}
