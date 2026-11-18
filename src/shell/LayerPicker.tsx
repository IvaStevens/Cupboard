/**
 * The map layer picker (AC14): a bobuttons `Tabs` sub-selector listing
 * the map layers, rendered beneath `TabBar` in
 * AppShell's sidebar (see App.tsx). `Tabs` is the app's one SUB
 * selector - it never decides which view `ViewPane` shows; only
 * `TabBar` (the MAIN selector) does that.
 *
 * `Tabs` is single-select (`TabsProps.current` is one `Id`, matching at
 * most one tab); the vendored Bobuttons build has no
 * toggle/checkbox-list primitive suited to an independently-toggleable
 * list. So this reuses the SENTINEL pattern navEntries.ts already uses
 * for `TabBar`'s `current` while the map shows (a value matching none of
 * the real ids), and encodes each layer's actual on/off/unavailable
 * state in its LABEL TEXT rather than in `active`/`aria-selected`.
 * `onChange` still fires once per tap, with the tapped layer's real id -
 * that is read as "toggle this layer", not "select this tab".
 *
 * ACCESSIBILITY TRADEOFF (documented, not fixed here): because the
 * sentinel never matches, `aria-selected` reads `false` for every item
 * no matter its on/off state, so TalkBack announces every item as "tab,
 * not selected" regardless. Only the label text ("Rail lines (on)" /
 * "(off)" / "(unavailable)") carries the real state - a screen-reader
 * user has to read the label, not the tab/selected state, to know
 * whether a layer is showing. `Checkbox` would be the semantically
 * correct control for an independent on/off list; AC14 requires a
 * `Tabs` instance here, so a later accessibility pass should read this
 * comment before "fixing" the apparent mis-selection rather than
 * treating it as a regression.
 *
 * SMALL-PHONE LAYOUT: `TabBar` above this already wraps to icon-only on
 * `media.mobile`; this adds five more label rows under it, which costs
 * real vertical space on a small phone (bobuttons' `CollapsibleSection`
 * is the noted remedy, not built in this ticket).
 *
 * @format
 */

import * as React from 'react';
import {Tabs} from 'bobuttons';
import {MAP_LAYERS, type LayerId} from '../map/mapLayers';

/** Matches none of the real layer ids - see the header comment. */
const LAYER_PICKER_SENTINEL = '__cupboard_no_layer_selected__';

export interface LayerPickerProps {
  enabledLayerIds: ReadonlySet<LayerId>;
  failedLayerIds: ReadonlySet<LayerId>;
  /** Called once per tap, with the tapped layer's id - toggles it, never selects it. */
  onToggle: (id: LayerId) => void;
}

function labelFor(
  baseLabel: string,
  id: LayerId,
  enabledLayerIds: ReadonlySet<LayerId>,
  failedLayerIds: ReadonlySet<LayerId>,
): string {
  if (failedLayerIds.has(id)) {
    return `${baseLabel} (unavailable)`;
  }
  if (enabledLayerIds.has(id)) {
    return `${baseLabel} (on)`;
  }
  return `${baseLabel} (off)`;
}

function LayerPicker(props: LayerPickerProps): React.ReactElement {
  const {enabledLayerIds, failedLayerIds, onToggle} = props;
  const tabs = MAP_LAYERS.map(layer => ({
    id: layer.id,
    label: labelFor(layer.label, layer.id, enabledLayerIds, failedLayerIds),
  }));
  return (
    <Tabs<string>
      tabs={tabs}
      current={LAYER_PICKER_SENTINEL}
      onChange={id => onToggle(id as LayerId)}
      aria-label="Map layers"
    />
  );
}

export default LayerPicker;
