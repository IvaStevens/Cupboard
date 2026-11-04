# CUPBOARD-1 — Initialize Cupboard Android app with Chicago map

**Revision 12 note (developer, post-approval).** At plan approval the author made the WebView-retention call explicitly, overriding §0.5's `opacity: 0` recommendation below: *"the map unmounts when a placeholder view is selected and reloads re-centred on Chicago when returning - accepted."* The shipped implementation (`App.tsx`) therefore conditionally renders `MapScreen`/`PlaceholderView` — a plain unmount/remount, not the `opacity: 0` + `pointerEvents: 'none'` hide-in-place §0.5.1 below describes. `README.md`, `App.tsx`'s own file-header comment, and `__tests__/shell.test.tsx` already reflect the unmount model and are the sources of truth for the shipped behaviour; §0.5.1's `opacity: 0` text, its decision-table row at "WEBVIEW RETENTION", and anti-pattern **47** ("Hiding the WebView instead of unmounting it … while a placeholder is shown. The AC says *not rendered*") are **superseded by this later, explicit author decision** and are kept below only as a record of the reasoning that was considered and the device-risk tradeoff that the author chose not to take (an unmounted-then-remounted WebView reloads and re-centres from the pinned constants on every return, at the cost of losing in-session pan/zoom position — accepted). Do not revert the code to match §0.5.1.

Architect context, **revision 11**. Supersedes revisions 3–10 in full. **Read §0.5 FIRST, then §0.4, then §0.2 and §0.3.** §0.5 answers ten review concerns on the revision-10 plan and carries **one structural reversal**: the map is no longer hidden with `display: 'none'` (which drove the WebView to 0x0 and took three bugs with it) but with `opacity: 0` + `pointerEvents: 'none'`, so its layout never changes; the return path is now a **visible, label-only `Button`** in the placeholder's `ViewToolbar` `actions` slot instead of a derived tap-active-tab toggle; `map.html` gains a **size-conditional init-view guard** up front; the ancestor-walk padding rule becomes a **measured allowlist** instead of being dropped; and `./gradlew assembleDebug` becomes a **required gate**. §0.4 is written against the **current TaskSpec (21 criteria)** and reverses three decisions that §0.2/§0.3 recorded — the map WebView **stays mounted** across a view switch, `package.json`'s `scripts` block is a **required** edit, and the OSM attribution's legibility is a **criterion with a required fix** rather than a reported finding — and it names **two existing test assertions that go RED on a correct implementation** (§0.4.9). §0.2 reverses revision 7's header, `ViewPane` and back-button decisions (and the generation step it plans is already DONE); §0.3 answers six review concerns against the revision-8 plan. Sections that still assert a superseded form are marked **SUPERSEDED** inline; where §0.5 and any earlier section disagree, **§0.5 wins**, and where §0.4 and §§0–0.3 disagree, §0.4 wins.

Branch: `CUPBOARD-1-initialize-cupboard-android-app-with-chicago-map` — **verified today**: exists locally, is checked out, and tracks `origin`. Do not create or rename a branch.
Domain: Mobile (React Native 0.83 Android) app initialization; bobuttons/Tamagui UI; Leaflet 1.9.4 in `react-native-webview` loaded from `file:///android_asset`.
TaskSpec: **a NEW spec, 21 acceptance criteria** (revision 10). Revisions 8–9 were written against revision 3's 24, and revision 7 against revision 2's 26; those earlier criteria carried ALL-CAPS tags and §§0.1–7 reference them by tag. The new 21 criteria are unnamed, so §0.4 references them as **AC1–AC21 in the order they appear in the TaskSpec**: 1 preserve-the-repo, 2 build/launch, 3 Leaflet+default view, 4 pan/zoom, 5 AppHeader, 6 Tabs sidebar, 7 placeholders, 8 navigation model, 9 ViewPane sizing, 10 attribution, 11 App.tsx comment, 12 Leaflet-in-WebView, 13 OSM endpoint, 14 pinned constants + test, 15 tile-failure diagnosability, 16 shell test, 17 asset/version parity test, 18 single provider, 19 no second Tamagui/web copy, 20 Jest config, 21 gates. Revision 10 changes three AC readings outright (§0.4) and adds two pieces of genuinely new work: tile-failure diagnosability (AC15) and an asset/version parity test (AC17).

---

## 0. Why revision 6 existed (retained: the revision 5 → 6 delta is still load-bearing)

Revision 5 was written against a **16-criterion** TaskSpec. TaskSpec revision 2 has **26**, and three of them contradict or extend revision 5. Revision 6 also replaces four *rules* with *measurements*.

| Change | Revision 5 said | Revision 6 says | Section |
| --- | --- | --- | --- |
| **HEADER** | `AppShell > AppHeader` with `APP_TITLE = 'Cupboard'` | Revision 7: **withdrawn**, `header` prop omitted. **SUPERSEDED (rev 8): REVERSED again — `header` is REQUIRED, `<AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago" />`. See §0.2** | §0.2 |
| **SAFE AREA** | `SafeAreaProvider`/`StatusBar` "left as generated", nothing wired | New criterion: real insets from `useSafeAreaInsets` are **passed into `AppShell`'s `insets` prop**. The generated `App.tsx` already has the exact shape for this | §5.3, §2.6 |
| **TYPE CHECK** | Rev 5's scope pass explicitly recorded "no typecheck step" as *out* of scope | New criterion. `npx tsc --noEmit` is now a gate — and it **falsifies two of revision 5's own test mechanisms** (§2.5). This is the single biggest change | §2.5, §5.7, §5.10 |
| **BRANCH** | not covered | Pinned, and verified on disk | §2.1 |
| **BACK BUTTON / LAUNCHER IDENTITY** | not covered | Both are *negative* criteria — nothing to implement, two things never to add | §5.17 |
| U9 (vendored lint line) | "measure it" | **Measured.** 12 errors without the line, 0 errors + 1 warning with it, `npm run lint` exit 0 | §2.4 |
| U7 (pristine baseline) | "unknown colour" | Community-template baseline **measured green** for test, lint *and* tsc. Still re-measured on the real scaffold | §2.4, §5.9 |
| SDK pre-check | "no `sdkmanager`, so pre-check" | **Pre-checked.** Every SDK component RN 0.83.10 asks for is present, including an exact NDK match | §2.1 |
| Leaflet digests | recorded | **Re-verified today** from `npm pack`, and the `tail -n +2` digest reproduced byte-exactly | §2.2 |

Revision 5's measured facts are retained where re-verified. Its §5.3 (`AppHeader`/`APP_TITLE`), its `findByType('WebView')` mechanism in §5.7, and its §7 AC-coverage claim are **void**.

## 0.1 Why revision 7 exists — fourteen review concerns, every one measured

Revision 6 was reviewed and fourteen concerns were raised (4 HIGH, 7 MEDIUM, 3 LOW). None was dismissed and none was answered by argument alone: each was turned into a measurement on this host or in the pinned package sources. Four of them falsified something revision 6 asserted.

| # | Concern | Resolution | Section |
| --- | --- | --- | --- |
| 1 (H) | `_gitignore` → `.gitignore` rename contradicts the tree gate | **Real, and revision 6 was self-contradictory.** Measured: renaming on the repo side makes the gate exit **1**; renaming inside the generated dir **before** `rsync` makes it exit **0**. Rename on the **generated** side | §2.10, §5.1 |
| 2 (H) | `git add -A` can commit `node_modules` | **Real.** Two fixes, both pinned: commit the scaffold **before** `npm ci` ever runs, and gate every `git add -A` on `git check-ignore -q node_modules` (exit **0** = ignored = pass, measured) | §2.10, §5.11 |
| 3 (H) | `grep CupboardMap` unproven on the release variant | **Real, and it splits in two.** Measured: JS `console.warn` **does** reach release logcat (the polyfill is not `__DEV__`-gated, the babel preset strips nothing); in-page `console.*` is **swallowed** in release by the library's own chrome client. Every in-page signal must exit via `postMessage` | §2.8, §5.5 |
| 4 (H) | The WebView's own scroll host is never addressed | **Real, and the obvious remedy does not exist.** Measured: `scrollEnabled` is **not an Android prop**; `nestedScrollEnabled` already defaults to `false`. The fix is page sizing in `map.html` | §2.9, §5.4 |
| 5 (M) | Nothing launches the emulator | Pre-checked and pinned: `DISPLAY=:0`, `/dev/kvm` writable via ACL, absolute-path binary, boot poll with a timeout and a blocked trigger | §2.11, §5.14 |
| 6 (M) | `window.onerror` → `postMessage` has no bridge guard | Guard pinned and asserted by a test — **but the first fix was wrong and measurement caught it.** `document.title` + `onNavigationStateChange` is dead (no `onReceivedTitle` override), and the bridge object is in fact *always* injected. Replaced with an `init-ok` **success heartbeat**, which makes silence itself diagnostic, and one prop was **removed** | §2.8c, §5.5 |
| 7 (M) | The Leaflet copy step is not reproducible | Exact commands recorded in `README.md` (where the AC puts provenance) and enforced by the digest test. Also measured: `@react-native/eslint-config` has **no** import/unused-dependency rule, so the `leaflet` devDependency trips no lint — and the AC's own expected-lockfile list names `leaflet`, so the devDependency is AC-implied | §5.6 |
| 8 (M) | `npm ls` inside Jest is non-hermetic | The AC **pins** this mechanism, so it stays — hardened instead: `npm_config_*` stripped from the child env, explicit `cwd`, a large `maxBuffer` (an `ENOBUFS` truncation would silently corrupt the JSON), a subprocess timeout, a generous `it()` timeout, and a loud failure if the JSON will not parse | §5.13 |
| 9 (M) | The `diff -r` gate is only satisfiable in a narrow window | Made explicit: the gate is **time-scoped**, runs immediately after `rsync` and before any hand-written file, its output is captured to a file, and the generated directory is **retained** until the PR evidence is written | §5.1, §5.12 |
| 10 (M) | `leaflet.css` references `images/*` that are deliberately absent | Measured: exactly three refs (`layers.png`, `layers-2x.png`, `marker-icon.png`), all in rules that match nothing unless a layers control or a default marker is created ⇒ **zero** requests expected; any such log line is attributable, never suppressed | §2.2, §5.5 |
| 11 (M) | `AppShell`'s `insets` shape is unread, with no fallback | Ladder pinned — and the audit found a **conflict revision 6 had missed**: insets applied as padding above the WebView would make the ancestor test fail. Resolved by running the ancestor walk at **zero** stub insets | §5.3, §5.7 |
| 12 (L) | Asserting the script "contains `12`" is near-tautological | Replaced: the init call's argument is emitted as JSON, extracted, `JSON.parse`d, and each field asserted **both** against the literal and against the constant | §5.7 |
| 13 (L) | Exact-equality URL gating is brittle | Replaced with a prefix match on the asset directory, plus the measured fact that the **initial** load is never gated (`shouldOverrideUrlLoading` is not called for it) | §5.4 |
| 14 (L) | Generated-file classification is inconsistent; the `assets` dir is missing | One rule now: `files_to_modify` = paths that exist **today**; everything the generator produces is `files_to_create`. Measured: the template ships **no** `android/app/src/main/assets`, so `mkdir -p` is a real step | §2.10, §6.1 |

Four revision-6 statements are now **void**: that the single `grep` command works everywhere (it does, but only because of a mechanism revision 6 had not identified); that an in-page `console.error` is a usable fallback; that `HEADER SHOWS NOTHING` cannot be asserted in Jest (it can — §5.7); and the implicit assumption that the `_gitignore` rename is gate-neutral.
---

## 0.2 Why revision 8 exists — the REVISED shell layout, which REVERSES two recorded decisions

TaskSpec **revision 3, 24 acceptance criteria**, each with an ALL-CAPS tag. **The generation step is DONE** — commit `6046ce0` ("Generate Cupboard with AppGenerator's react-native-bobuttons target") followed by `5e4be11`, `dba2a4c`, `6275767`, on the already-checked-out branch, with **PR #1 open** (`https://github.com/IvaStevens/Cupboard/pull/1`). Everything in §§1–7 below that describes generating, moving in, renaming dotfiles, installing or running the tree gate is **history, not a plan**: it must not be re-run. The remaining delta is the **shell** around the already-built map.

Two of revision 7's decisions are **reversed** by the ticket's REVISED "Approach decisions" bullet, which post-dates them. Older sections that still assert the superseded form are marked **SUPERSEDED (rev 8)** inline and point here.

| Revision 7 said | Revision 8 says | Evidence |
| --- | --- | --- |
| **HEADER** — omit `AppShell`'s `header` prop; nothing goes in the header; no `AppHeader`, no title, no date (§5.3, anti-pattern 5, §5.7's `'header' in props === false`) | **`header` is REQUIRED**: `<AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago" />` in the `header` slot | AC SHELL + AC HEADER TITLE AND DATE, which name the reversal explicitly |
| **VIEWPANE** — the map goes *directly* under `AppShell`, because "`ViewPane`/`ViewBody` apply non-zero padding … either would fight the map's own pan/zoom" (§5.3, App.tsx's file comment) | The active view (map **and** placeholders) is rendered **inside `ViewPane`**, never `ViewBody` | Measured in the installed native build — §0.2.2 below. `ViewPane` contains **no** scroll host; `ViewBody` **is** one |
| **BACK BUTTON** — add no `BackHandler`; the hardware back button always exits (§5.17, anti-pattern 30) | While a **placeholder** is active, back returns to the map and **consumes** the event; while the **map** is active the app does **not** consume back (system default: it exits) | AC BACK NAVIGATION. The map has no sidebar entry of its own (exactly three entries are pinned), so a placeholder would otherwise be a dead end |

### 0.2.1 What this leaves untouched

**Expected to need no edit** (the shell delta happens *above* `MapScreen`): `src/map/mapConstants.ts`, `src/map/mapInitScript.ts`, `src/map/MapScreen.tsx`, `android/app/src/main/assets/leaflet/map.html`, `index.js`, `app.json`, `THIRD-PARTY-NOTICE.md`. **Untouchable — an edit is a blocked report, not a fix:** `android/app/src/main/assets/leaflet/leaflet.js` and `leaflet.css`, `android/app/src/main/AndroidManifest.xml`, every `android/**/*.gradle`, `android/gradle.properties`, `tsconfig.json`, `package.json`, `package-lock.json`, `jest.config.js`, `vendor/bobuttons-0.1.0.tgz`. **CORRECTED IN REVISION 9:** revision 8's blanket "`android/**`" also made `map.html` untouchable, which is wrong — it is authored in this branch (`5e4be11`, `dba2a4c`), it is not a generated file, and it is not digest-pinned, so it is the sanctioned remediation site if the device shows a sizing/centring regression (§0.3.2). The pinned WebView prop set (AC WEBVIEW SECURITY AND ASSET CONFIG PINNED) and the Leaflet digests (AC LEAFLET ASSET / VERSION LOCK) must still come through the layout rewrite **byte-equivalent**: the rewrite happens above `MapScreen`, not inside it.

### 0.2.2 Measurements taken for revision 8 (installed `node_modules/bobuttons/dist/index.native.js`, and this host)

Read, not inferred. Line numbers are that file's.

- **`ViewPane` (13783–13819) adds no gesture host.** `Gutter` = `styled(View, {flex:1, flexDirection:'column', minWidth:0, overflow:'hidden', position:'relative', paddingVertical:'$1.5', paddingRight:'$1.5'})` → `Card` = `styled(View, {flex:1, …, paddingTop:'$2.5', backgroundColor:'$surface', borderRadius:'$3'})` → `[Stripe (position absolute, top/left/right 0, height '$0.5', zIndex 1, **pointerEvents:'none'**), props.children]`. No `Scroll`, no `ScrollView`, no scroll prop. It **insets and rounds** the map surface; it does not take the drag. The stripe cannot take it either — `pointerEvents: 'none'` — and on native it is not even a gradient: `useAccentStripeStyle` (13291) is a flat-colour stub returning `{backgroundColor: '$accent'}`, so there is no gradient native module anywhere in this path (the same is true of `AppHeader`'s `useAccentTextStyle` → `{color: '$primary'}`). Nothing here can fail to render under Jest or on device for want of a native dependency.
- **`ViewBody` (13855–13860) IS the scroll host.** `ViewBody` = `Scroll(tabIndex 0, paddingHorizontal, paddingBottom)`, and `Scroll.native` (13351–13406) imports `ScrollView` from `react-native` and wires `onScroll`/`onContentSizeChange`. So revision 7's "either would fight the map" was right about `ViewBody` and wrong about `ViewPane`. **Never `ViewBody` here.**
- **`AppShell` (13769–13781).** `Frame(paddingTop/Bottom/Left/Right = insets)` → `[header, Body(flexDirection: media.mobile ? 'column' : 'row') → [sidebar && Sidebar(width: media.mobile ? '100%' : '$sidebarWidth'), Content(children)], overlay]`. `breakpoints.mobile = 599`, so on **every phone** the "side panel" is a **full-width strip above the content**, not a left rail. Accepted by the AC; not to be worked around by modifying Bobuttons. Consequence to expect on the screenshot: the map gets the remaining height below header + strip.
- **`Tabs` (14308–14357) is the right sidebar widget.** `Bar(role='tablist', flexWrap:'wrap', paddingTop '$2.5', paddingHorizontal '$4', borderBottom)` → one `TabItem` per entry with `aria-selected: active` and `borderBottomColor: active ? '$primary' : 'transparent'`, where `active: current === id`; the **label is always rendered** as text (`TabLabel2 … children: label`), on mobile as well as desktop. No icon, no `Scroll`. ⇒ a `current` that matches no entry renders `active:false` on all three — the 'map' sentinel is safe, as the AC assumes.
- **`TabBar` is correctly rejected.** `BobuttonsTab.icon: IconSource` is **required** (no `?` in `TabBar.d.ts`), and `Icon.d.ts` states a React Native consumer "supplies its own icon components" — bobuttons ships none. Authoring icons is out of scope. TabBar's own internals use `Scroll` (a `ScrollView`).
- **`AppHeader` (13301–13346) — two facts that matter.** (a) Defaults are `now = Date.now()`, `locale = 'en-US'`, `timeZone = 'UTC'` ⇒ the AC's `timeZone="America/Chicago"` is the correct call and needs no Bobuttons change. (b) **The date is rendered only when `!mobile`**: `!mobile && <DateLabel …>`, and mobile is every viewport ≤ 599px. So on the phone **no date is painted at all**, and `HeaderFrame`'s `paddingLeft: '$sidebarWidth'` is overridden to `'$4'` with `justifyContent:'flex-start'`. Do not expect a date in the device screenshot, and do not "fix" its absence — Bobuttons is not modified. The `timeZone` prop is still required by the AC (it is also what makes the desktop/tablet rendering correct). **Revision 9 states the consequence plainly instead of only disclosing it:** on the only supported target (an Android phone) the date is *never painted*, so `locale`/`timeZone` have no observable effect there and matter only at tablet/desktop widths — see §0.3.6, which flags that for the author rather than treating AC HEADER TITLE AND DATE's motivation as demonstrated.
- **`ViewToolbar` is the right placeholder caption — but it is NOT the only one that could paint text (CORRECTED IN REVISION 9).** Revision 8 called it "the only package-root way to paint a bare caption"; that is false and must not be committed as measured evidence. The root also exports `SettingsHint` (arbitrary children text), `Badge` (`label`), `ListRow` (`title` + `detail`), `SettingsRow` and `AddRow`. The true statement: the package root exports **no plain `Text`**, so a caption must come from a component that renders text internally, and `ViewToolbar` is the one whose documented role is a view's own heading — `title?: string` → `role="heading"`, `aria-level={2}` (13829–13853 + `.d.ts`), with no icon, no input and no data. The others are rejected on **semantics, not availability**: `SettingsHint` is explanatory text *under a section title* that would not exist here; `Badge` is an identifier chip with an optional remove button; `ListRow`/`SettingsRow`/`AddRow` are data/affordance rows. `PlaceholderView`'s file comment states the choice **and** these rejections in those terms. See §0.3.5.
- **Jest runs the iOS `BackHandler`.** `react-native/jest-preset.js` sets `haste.defaultPlatform: 'ios'`, so `BackHandler` resolves to `BackHandler.ios.js` — a plain, mutable object whose `addEventListener` is a stub returning `{remove}`. ⇒ `jest.spyOn(BackHandler, 'addEventListener')` captures our handler with no native emitter involved, and `spy.mock.calls.at(-1)[1]` is the handler to invoke. RN 0.83 has **no `removeEventListener`** (see `BackHandler.d.ts`): the subscription's `.remove()` is the only teardown. The Jest leg proves the handler's logic and registration, **not** Android delivery — the device leg is what proves that.
- **Jest's media is not the device's.** The RN preset's `Dimensions` mock is desktop-sized, so under Jest `media.mobile` is false (date label present, sidebar at `$sidebarWidth`) while the device is mobile (no date, full-width strip). **No test may assert anything media-dependent** — this is a second, independent reason the header date is asserted only as props.
- **Baseline, measured today:** `npm test` → `Test Suites: 3 passed`, `Tests: 22 passed`, `Snapshots: 0 total`, exit 0. **22 is the floor** the PR records. `emulator -list-avds` → exactly `Medium_Phone_API_37.0`; `adb devices` currently lists **no** attached device, so the emulator must be started (§5.14) or the NOT VERIFIED fallback reported with the exact error.
- **One AC/repo mismatch found.** AC LEAFLET ASSET / VERSION LOCK says README.md "keeps the exact `npm pack leaflet@1.9.4` reproduction command". Measured: `README.md` has the version, the source URL, both digests and a `cp`-from-`node_modules` reproduction, but **no `npm pack` line**. The AC's "keeps" assumed it was already there. Minimal, AC-anchored action: add the `npm pack leaflet@1.9.4` fetch line next to the existing reproduction block, and say in the PR that it was added rather than kept. `THIRD-PARTY-NOTICE.md` already names 1.9.4 + BSD-2-Clause and needs no edit; the `leaflet` devDependency is already exactly `1.9.4`.

### 0.2.3 Pinned composition

```
SafeAreaProvider                              (unchanged — sanctioned import)
└─ BobuttonsProvider                          (exactly one, NO config prop — unchanged)
   ├─ StatusBar barStyle="dark-content"        (unchanged — sanctioned import)
   └─ AppContent  → useSafeAreaInsets()        (unchanged)
      └─ AppShell insets={insets}
         header  = <AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago" />
         sidebar = <Tabs tabs={SIDEBAR_ENTRIES} current={activeView} onChange={setActiveView} />
         children=
           <ViewPane>                          (exactly one, wrapping BOTH branches)
             {isSidebarEntryId(activeView)
               ? <PlaceholderView entryId={activeView} />   (ViewToolbar title={label})
               : <MapScreen />}                             (unchanged WebView)
           </ViewPane>
```

- **State.** `const [activeView, setActiveView] = useState<ViewId>(MAP_VIEW_ID)` in `AppContent`. In-memory only — no storage, no module-level variable, no navigation library. A relaunch or a Fast Refresh reload returns to the map with no entry active (AC DEFAULT VIEW).
- **The sentinel is typed, not stringly.** `ViewId = 'map' | SidebarEntryId`, and `SIDEBAR_ENTRIES: ReadonlyArray<BobuttonsTabsItem<ViewId>>`. This is deliberate: `TabsProps<Id>` infers `Id` from **both** `tabs` and `current`, so an untyped `['settings','places','notes']` array plus `current='map'` gives two conflicting inference candidates and a `tsc` error. Declaring the array at `BobuttonsTabsItem<ViewId>` makes `Id = ViewId` from both positions. `BobuttonsTabsItem` is a type-only import **from the package root** (no deep import).
- **One `ViewPane`, wrapping the switch** rather than one inside each view: it guarantees both branches are inside it, keeps "exactly one `ViewPane`, zero `ViewBody`" trivially assertable, and avoids nesting two cards.
- **The WebView is unmounted while a placeholder is shown** (AC PLACEHOLDER VIEWS), not hidden with `display:none`/opacity. Accepted consequence, stated in the PR: returning to the map **re-creates** the WebView, so the page reloads and re-centres on Chicago (tiles come from the WebView's HTTP cache). No map state needs to survive in this ticket.
- **Back navigation — ONE registration for the app's lifetime, current view read through a ref (CHANGED IN REVISION 9; revision 8 re-subscribed on `activeView`).**
  ```ts
  const activeViewRef = React.useRef<ViewId>(MAP_VIEW_ID);
  React.useEffect(() => { activeViewRef.current = activeView; }, [activeView]);
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeViewRef.current === MAP_VIEW_ID) { return false; }
      setActiveView(MAP_VIEW_ID);
      return true;
    });
    return () => sub.remove();
  }, []);
  ```
  Why, measured: `BackHandler.android.js` invokes subscriptions in **reverse registration order** and stops at the first truthy one (`BackHandler.d.ts` documents this), so a leaked registration captured while a placeholder was active would consume back **on the map** and the app would stop exiting — a bug the Jest iOS stub cannot show, because its `remove()` is `emptyFunction`. Registering once makes that class unreachable *and* assertable (§0.3.3). Returning `false` is "not consumed": RN falls through to `exitApp()`.
- **No `aria-label` on `Tabs`, no app-title constant.** `title="Cupboard"` is an inline literal (the AC's test asserts the literal); resurrecting an `APP_TITLE` indirection would add nothing. `aria-label` is optional and not in the AC — a follow-up, not this ticket.

### 0.2.4 Tests (AC JEST IS GREEN AND NON-VACUOUS, AC SUPERSEDED TEST ASSERTIONS UPDATED)

**`__tests__/shell.test.tsx` (new).** Needs both existing mocks: `react-native-webview` (ESM entry — mandatory in every file that reaches it) and the test-file-local `react-native-safe-area-context` shim at **zero** insets (the real provider renders zero children under Jest — §2.6). Covers:

1. `AppShell`'s `header` slot is an `AppHeader` element with exactly `title: 'Cupboard'`, `locale: 'en-US'`, `timeZone: 'America/Chicago'` — asserted on the **element's props**, never on rendered date text (AC TEST DETERMINISM: `now` defaults to the clock, and on mobile no date is painted at all). No snapshot anywhere in this file.
2. `AppShell`'s `sidebar` slot is a `Tabs` element whose `tabs` prop deep-equals the three `{id, label}` entries with the visible labels `Settings`, `Places`, `Notes`; `findAllByType(TabBar)` is empty. Labels are asserted on the prop because `Tabs` renders `label` unconditionally (measured, §0.2.2); the device screenshot is the proof of paint.
3. Default view: a `WebView` is present, `PlaceholderView` is absent, and `Tabs.props.current === MAP_VIEW_ID`, which matches no entry ⇒ no entry active.
4. Selecting each entry **by pressing the rendered tab node** — `act(() => node.props.onPress())`, where `node` is found with the props predicate `n.props.id === 'tab-<id>'` plus `typeof n.props.onPress === 'function'` — **not** by invoking `Tabs`' own `onChange` prop, which would prove only our own state wiring (§0.3.4, CHANGED IN REVISION 9). Asserts: `PlaceholderView` with that `entryId` and a `ViewToolbar` whose `title` is that entry's label; `findAllByType(WebView)` is **empty**; `Tabs.props.current === id`.
5. Back navigation, both branches, **plus listener hygiene** (§0.3.3), through `jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({remove: removeSpy}))` — the mock implementation is required because the real iOS stub's `remove` is `emptyFunction` and cannot be observed. On the map the handler returns **false** and the view stays the map; on a placeholder it returns **true** and the `WebView` is back; `addEventListener` is called **exactly once** across mount + every selection + every back press (the handler is read from `mock.calls[0][1]`, never `.at(-1)`, so a second registration fails the test instead of hiding behind it); `removeSpy` is not called before unmount and is called exactly once after it.
6. Structure: exactly one `BobuttonsProvider` with no `config` prop; exactly one `ViewPane`; zero `ViewBody`.
7. UI SOURCE BOUNDARY, as a source scan over `App.tsx` + `src/**/*.ts(x)`: no `@tamagui/*` import, no `bobuttons/dist` deep import, and no non-Bobuttons UI import beyond the four sanctioned ones (`react-native-webview`, `react-native-safe-area-context`, and `StatusBar`/`BackHandler` from `react-native`). Needs the `/// <reference types="node" />` first line, like the two existing file-reading suites. This is the only automated guard that AC has.

`findByType` is always called with an **imported component reference**, never a string (§2.5 Finding B).

**`__tests__/map.test.tsx` — the two superseded assertions are rewritten, not worked around.**

- `expect('header' in shell.props).toBe(false)` → assert the `header` IS supplied, as an `AppHeader` element carrying the three props. The `insets` assertion stays.
- The ancestor walk keeps its scroll-host and scroll-prop rules (`ScrollView`/`FlatList`/`SectionList`/`VirtualizedList`; `scrollEnabled`/`onScroll`/`horizontal`/`pagingEnabled`/`contentContainerStyle`) and **drops the blanket non-zero-padding rule**, because `ViewPane`'s `paddingVertical/$1.5`, `paddingRight/$1.5` and `Card`'s `paddingTop/$2.5` are now **required**. Rationale recorded at the call site: padding only shrinks the map, it does not consume touches; the scroll-host rule is the load-bearing one, which is also what revision 7 concluded (§5.7's closing paragraph). The zero-insets safe-area stub **stays** — it is what keeps `AppShell`'s own inset padding out of the walk.
- The file's header comment is updated: "HEADER SHOWS NOTHING" is no longer a criterion.

**`__tests__/App.test.tsx`** stays a smoke test (real providers ⇒ zero children ⇒ nothing to assert; `AppContent` never mounts, so no `BackHandler` registration happens there). Comment-only correction: it currently advertises "header omission" as a mechanism check in the sibling file.

**`__tests__/dependencies.test.ts`** is untouched — its mechanism is AC-pinned (package.json direct entries + `npm ls --json --all` with `npm_config_*` stripped and the exit code ignored; `react-dom` stays an UNMET optional peer).

### 0.2.5 Anti-pattern findings for the shell delta (numbering continues §3)

**HIGH**

41. **Re-running the generator, or any history rewrite.** The generation is DONE and PR #1 is open. No `git init`, no `rsync --delete`, no amend/rebase/force-push, no second branch, no second PR. `vendor/bobuttons-0.1.0.tgz`, the `bobuttons` `file:` specifier and `bobuttonsProvenance` stay byte-unmodified.
42. **"Fixing" the ancestor walk by dropping `ViewPane`.** The AC requires `ViewPane`; the *rule* is what narrows. The opposite error — weakening the scroll-host checks — is just as bad. If on-device testing shows `ViewPane` actually degrading pan/zoom, the required outcome is a **reported finding with evidence**, not a silent switch back.
43. **Reaching for `ViewBody`, or any `ScrollView`/`FlatList` wrapper above the WebView.** `ViewBody` *is* a `ScrollView` (measured). This is the one change that would silently kill the drag.
44. **`TabBar` as the sidebar.** Requires a per-tab `icon: IconSource`; bobuttons ships no icon sources, and in mobile mode TabBar renders items icon-only ⇒ three unlabelled glyphs, failing SIDEBAR ENTRIES in any user-visible sense.
45. **Asserting the rendered header date.** `now` defaults to the clock, and the label is media-dependent. Any such test is green today and red tomorrow, in another timezone, or in CI. Props only; no snapshot may capture the date. (If a date-text test is ever wanted, it renders `AppHeader` **directly** with an injected fixed `now` and explicit `timeZone`.)
46. **Relaxing the WebView config while moving code around.** The pinned set (source uri, `originWhitelist: ['file://*']`, `setBuiltInZoomControls: false`, the load predicate, the four diagnostic callbacks + `onMessage`, `onRenderProcessGone` returning true) and the seven props that must stay **UNSET** survive the rewrite unchanged. `javaScriptEnabled` stays on the library default.

**MEDIUM**

47. **Hiding the WebView instead of unmounting it** (`display:'none'`, `opacity:0`, zero height) while a placeholder is shown. The AC says *not rendered*.
48. **Persisting the selection** — AsyncStorage, a module-level `let`, a navigation library, deep links. In-memory only.
49. **`BackHandler.removeEventListener`** (removed in RN 0.83) or a listener that is never unsubscribed. Use the subscription's `.remove()` in the effect's cleanup.
50. **Deep-importing `bobuttons/dist/**`**, adding `@tamagui/*`, `react-dom` or `react-native-web`, or "fixing" the UNMET optional `react-dom` peer. The unmet peer is the required state.
51. **Editing a generated file to make something pass** — `AndroidManifest.xml`, any `*.gradle`, `gradle.properties`, `tsconfig.json` — or "fixing" `jest.config.js`/`package.json`. Each is a **blocked report** instead. The expected single `eslint-comments/no-unlimited-disable` warning on the vendored `leaflet.js` is not to be fixed either.
52. **Letting `Tabs`' generic infer two conflicting `Id` candidates** (§0.2.3). It reads as a mysterious `tsc` error about `'map'`; the fix is the typed entries array, not a cast.
53. **Scraping the three labels out of Tamagui's rendered `Text` internals.** Brittle. Assert `Tabs.props.tabs`; the screenshot proves the paint.
54. **Building anything behind the entries** — settings rows, a places list, notes. Empty placeholders only: a caption and nothing else. Equally: no offline banner, retry button or tile cache.

### 0.2.6 Shared services and blast radius (delta)

| Surface | Risk | Guard |
| --- | --- | --- |
| `Bobuttons` (vendored tarball + installed `node_modules/bobuttons`) | Any edit breaks the merged BOBUTTONS-1/2 guarantee and cannot ship | Read-only. Every finding about AppHeader's date, ViewPane's padding, TabBar's icon and the mobile strip is **accepted**, never patched |
| `src/map/*` + `android/.../assets/leaflet/*` | Already-green, AC-pinned mechanisms (digests, WebView props, injected config) | Not in the delta. `map.test.tsx`'s *other* assertions must stay green unchanged |
| Branch `CUPBOARD-1-…` + PR #1 + commits `1ef152e…6275767` | A human's history and the existing review thread | Commit on top only; one PR, updated in place |
| The single AVD `Medium_Phone_API_37.0` and shared `~/.gradle` | Shared with every other project on this host | Boot, verify, shut down cleanly; never interrupt a cold Gradle build; never `rm -rf ~/.gradle` |
| `docs/context/*` | Two opposite recorded decisions in the same repo | This revision, plus the App.tsx comment rewrite and the one stale study-guide bullet |

### 0.2.7 Risks and constraints (delta)

- **The screenshot will look unlike a desktop mock**: header with "Cupboard" and **no date** (mobile), the three entries as a **full-width strip** below it, and the map in the remaining area inside a rounded, slightly inset card with a thin solid accent stripe along its top (measured: flat colour on native, not a gradient). All four are measured, accepted consequences — stated in the PR so none is read as a defect.
- **Jest and the device disagree about `media.mobile`** (§0.2.2). Tests must stay media-independent.
- **`ViewPane` is asserted safe by source reading, confirmed only on device.** The gesture evidence is the on-device pan/zoom; if it degrades, report with evidence (AC VIEWPANE) rather than dropping the pane.
- **`adb devices` is currently empty.** The device leg needs the emulator started; if it cannot be, AC ANDROID BUILD AND LAUNCH requires an explicit **NOT VERIFIED** report with the exact error plus `assembleDebug` exit 0, `tsc --noEmit`, `npm run lint`, `npm test` green. Silent omission is a failure. Debug and release APKs from the earlier commits already exist under `android/app/build/outputs/apk/`, so the build path is known-good.
- **The offline check, if performed, must use the RELEASE variant** — a debug APK embeds no JS bundle and gives a false white-screen negative.
- **`npm test` must stay non-vacuous**: the script is `jest --passWithNoTests`, so the PR quotes the summary with the executed file list and counts, at **≥ 22** tests and 4 suites.
- **`strict: true` applies to the new files**; the `/// <reference types="node" />` first line is required in any test using `fs`/`path`.
- **Scope-creep pressure points now specific to the shell:** a real settings screen, icons for the entries, an `aria-label`/a11y sweep, theme switching, a left-rail layout workaround, persisting the selection, a map-state-preserving hidden WebView, an offline banner, and "fixing" Bobuttons' date format, title offset or ViewPane padding.

### 0.2.8 Self-audit record (revision 8)

Three passes, revising between passes.

**Pass 1 — AC coverage (24 criteria).** Each tag mapped to a concrete file change. Findings, all resolved by revision: (a) AC LEAFLET ASSET / VERSION LOCK's `npm pack leaflet@1.9.4` command is **absent** from README.md, so "keeps" cannot be satisfied passively — a one-line README addition was added to the plan and disclosed (§0.2.2). (b) AC HEADER TITLE AND DATE's rationale assumes a visible date; measured, the date is **not rendered on a phone** — the props are still passed (AC-required, and correct for tablet/desktop), and the PR states the date is desktop-only, so the screenshot is not read as a failure. (c) AC UI SOURCE BOUNDARY had no mechanism; a source-scan test was added. (d) AC PLACEHOLDER VIEWS needs a text-rendering component and the package root exports no `Text`; `ViewToolbar title` resolves it.

**Pass 2 — Risk.** Every file re-checked against §3 and §0.2.5, the blast-radius table and the irreversibility rules. Findings: (a) the `Tabs` generic-inference trap (anti-pattern 52) would surface as a confusing `tsc` error — the typed entries array is now pinned in `views.ts`; (b) under Jest `BackHandler` is the **iOS stub**, so a test that relied on real delivery would be vacuous — the spy mechanism and its limit are written down; (c) the narrowed ancestor walk could be read as a weakened assertion — the rationale is pinned at the call site and the scroll-host rules are untouched; (d) unmounting the WebView re-loads the page — recorded as an accepted consequence rather than discovered in review. Multi-tenancy, N+1 and migrations remain **not applicable** (§3, unchanged): single-user device app, no backend, no schema, no persisted state.

**Pass 3 — Scope.** Walked every step against the 24 criteria and the out-of-scope list. **Rejected:** icons of any kind (and therefore `TabBar`); any Bobuttons edit (AppHeader's date/format/title offset, ViewPane's padding/stripe, TabBar's `icon`); a left-rail workaround; `aria-label`/theming/dark-mode work; an `APP_TITLE` constant; persisting the selection; preserving map state across view switches; offline UI; `@testing-library/react-native`; any config or generated-file edit. **Kept as AC-anchored, not creep:** the README `npm pack` line (AC LEAFLET), the UI-source-boundary scan (the only guard for AC UI SOURCE BOUNDARY), the one-line comment fix in `App.test.tsx` and the one stale bullet in the study guide (AC IN-REPO DOCS, which forbids leaving two opposite recorded decisions).

All three passes are clean or resolved.


---

## 0.3 Why revision 9 exists — six review concerns on the revision-8 shell plan

Review of the revision-8 ImplementationPlan raised six concerns (three medium, three low). Each is answered below by a decision, a measurement, or a new evidence requirement. Four of them **changed** revision 8's text, which has been corrected **in place** (§0.2.1, §0.2.2 ×2, §0.2.3, §0.2.4 ×2) rather than annotated. Nothing was dismissed.

### 0.3.1 `ViewPane` was cleared for GESTURES, not for PAINTING (medium — new evidence requirement)

Revision 8 proved `ViewPane` takes no gesture (no `Scroll` primitive; the `Stripe` is `pointerEvents:'none'`). It said nothing about whether the WebView is **clipped**. `Card` is `overflow:'hidden'` + `borderRadius:'$3'` (`radius.3 = 8`, index.native.js 12941–12950) and `Stripe` is absolutely positioned at `zIndex: 1`. An Android `WebView` draws its own hardware-accelerated surface and is **not reliably clipped by a parent's rounded-corner path**, so the map may square off the card's top corners and paint over the stripe. This is not knowable from source — it is a device observation, and revision 8 required no evidence for it (the screenshot acceptance named only header/entries/map).

Decisions:

- The screenshot evidence is extended with two items that must be **visible and explicitly assessed**: the **top two corners of the map card**, and the **accent stripe along the card's top edge**.
- If the map squares the corners or hides the stripe, that is a **reported finding with evidence** in PR #1 — the same handling AC VIEWPANE pins for padding/stripe degrading pan/zoom. It is cosmetic: the stripe is `pointerEvents:'none'`, so no gesture is affected either way.
- Forbidden remedies, now and in review: modifying Bobuttons; dropping `ViewPane`; hardcoding `borderRadius: 8` (or any Bobuttons token value) onto the WebView or its container in `src/map/MapScreen.tsx` — duplicating a library token in app code is drift waiting to happen, and the WebView's prop/style surface is AC-pinned.
- Recorded so the finding is not a dead end: `bobuttonsConfig` **is** exported from the package root, so a follow-up ticket could clip the WebView using the library's own `tokens.radius` rather than a literal. Out of scope here.

### 0.3.2 The one-shot re-centre in `map.html`, and the editability of that file (medium — boundary corrected)

Commit `dba2a4c` fixed mis-centring with a **one-shot** double-`requestAnimationFrame` `invalidateSize() + setView()` that runs when the page's `load` event fires. The WebView now settles at a different, smaller size (ViewPane's `paddingVertical`/`paddingRight` + `Card`'s `paddingTop`, under a sidebar strip whose height depends on `Tabs`' `flexWrap:'wrap'`), yet revision 8 declared `android/**` untouched — fencing off the only natural remediation site.

- **`android/app/src/main/assets/leaflet/map.html` is editable.** It is authored in this branch, it is **not** generated (AC GENERATED-FILE BOUNDARY names only `AndroidManifest.xml`, `android/**/*.gradle`, `android/gradle.properties`, `tsconfig.json`), and it is **not** digest-pinned (AC LEAFLET ASSET / VERSION LOCK pins `leaflet.js`/`leaflet.css`; `map.test.tsx` asserts only that `map.html` is non-empty, plus its mechanism greps). `leaflet.js`, `leaflet.css` and every gradle/manifest file stay untouched.
- **Why a regression is nevertheless unlikely — measured in the vendored asset, not assumed.** Leaflet 1.9.4 defaults `trackResize: !0` and binds `window.resize` → `_onResize` → `invalidateSize({debounceMoveend:!0})`; `invalidateSize` pans by the **half-size delta** (`oldSize.divideBy(2).round().subtract(newSize.divideBy(2).round())`), i.e. it **preserves the visual centre** across a later resize. So a strip that wraps to two lines, a rotation or the keyboard are handled by Leaflet itself, centre-preserving. The one-shot also re-runs on **every mount**, including the remount after returning from a placeholder.
- **If the device shows a wrong initial view** (centre pinned off, or a 0-height map): the sanctioned fix is in `map.html` — defer `L.map()`/the re-centre until `#map` reports a non-zero size, or additionally re-apply `invalidateSize()+setView()` on the first `resize`. Constraints such an edit must keep, all of them existing green assertions: no coordinate/zoom/tile/attribution literal in the file (`map.test.tsx` asserts `41.8781`, `-87.6298` and `tile.openstreetmap.org` are absent — every value keeps coming from `config`), the `typeof L === 'undefined'` guard, the `init-ok` heartbeat, the guarded `post()` helper, the `user-scalable=no` viewport meta, `overflow: hidden`, and the relative `<script>`/`<link>` tags. **No** RN-side fudging (no fixed heights, no `onLayout`-driven remount key), and never "fix" centring by dropping `ViewPane`.
- **Device evidence added:** the screenshot must show the Chicago lakefront/Loop at z12 **centred in the map card**, not pinned near a corner — the `dba2a4c` regression is explicitly re-checked at the new, smaller WebView size.

### 0.3.3 `BackHandler` hygiene is now structural, not assumed (medium — composition changed)

Revision 8 re-subscribed on every `activeView` change and read `spy.mock.calls.at(-1)[1]`, which **hides** a leaked or duplicated registration; and the Jest iOS stub's `remove()` is `emptyFunction`, so removal was unobservable. Measured in `BackHandler.android.js` (and documented in `BackHandler.d.ts`): subscriptions are invoked in **reverse registration order** and the first truthy one wins. A handler leaked while a placeholder was active would therefore consume back **on the map** — the app would stop exiting. Green in CI, wrong on device.

Decision: **register once, read the current view through a ref** (code in §0.2.3). This makes the leak class unreachable and the hygiene assertable:

- `addEventListener` called **exactly once** across mount + every selection + every back press;
- the handler is read from `mock.calls[0][1]` — never `.at(-1)` — so a second registration **fails** the test;
- the subscription's `remove` comes from the spy's own `mockImplementation(() => ({remove: removeSpy}))`; `removeSpy` is not called before unmount and is called exactly once after it;
- the ref is updated in a `[activeView]` effect, not during render; effects flush inside `act()`, so the press-then-back ordering the test exercises is the device ordering.

The Jest leg still proves logic + registration only; Android **delivery** is proven by the device leg (§0.3.4).

### 0.3.4 "Selectable" means pressed, not `onChange`-invoked (low — test mechanism pinned + device item)

Invoking the `Tabs` element's own `onChange` prop proves our state wiring and nothing about Bobuttons'. Measured (index.native.js 14334–14357): `Tabs` maps each entry to `TabItem`, which renders `Tab` with `id: 'tab-<id>'`, `role: 'tab'`, `aria-selected: active`, `hitSlop` and **`onPress: onSelect`**, where `onSelect = () => onChange(id)`. So the test presses the **rendered tab node**:

- find it with a props predicate — `root.findAll(n => n.props.id === 'tab-settings' && typeof n.props.onPress === 'function')[0]` — and call `node.props.onPress()` inside `act()`. Tamagui's `styled()` components appear in the react-test-renderer tree (`ForwardRef`/`MemoComponent` are valid wrapper types) and pass `id`/`role` through to the host view, so more than one instance can match: take the first, and keep the "exactly three entries" assertion on `Tabs.props.tabs`, not on a node count. `findByType` is still only ever called with an **imported component reference** (§2.5 Finding B) — a props predicate is not a string type lookup.
- Honest limit: this proves Bobuttons' id/label/active mapping and its `onSelect` closure reach our handler. It does **not** prove Android touch delivery through Tamagui's responder chain. Hence the device leg gains an explicit item: **tap each of the three entries** on the AVD (`adb shell input tap`, or by hand), screenshot one placeholder, then `adb shell input keyevent 4` and screenshot the restored map — which is also the only end-to-end proof of AC BACK NAVIGATION.

### 0.3.5 The `ViewToolbar` rationale was overstated (low — corrected in §0.2.2)

Revision 8 called `ViewToolbar title` "the only package-root way to paint a bare caption", and that claim was slated to be written into `PlaceholderView.tsx`'s file comment as measured evidence. It is **false**: the root also exports `SettingsHint`, `Badge`, `ListRow`, `SettingsRow` and `AddRow`, all of which paint text. The corrected statement, and the rejections on semantics rather than availability, are in §0.2.2. `ViewToolbar` remains the choice. General lesson, recorded as anti-pattern 58: state the choice and the rejected alternatives; never commit a uniqueness claim as fact.

### 0.3.6 On the only supported target, `locale`/`timeZone` are inert (low — flagged to the author, not silently accepted)

Stated plainly, because AC HEADER TITLE AND DATE's rationale ("a Chicago app left on defaults shows tomorrow's date after 18:00 CST") **cannot be demonstrated on this ticket's target**: `AppHeader` renders `DateLabel` only when `!mobile` (index.native.js 13331–13345), bobuttons' `mobile` media query is `maxWidth: 599`, Tamagui's native matchMedia is Dimensions-driven and really installed (`setupMedia` → `setupMatchMedia(matchMedia3)`, index.native.js 12432), and the host's only AVD is a phone. So **no date is painted on device at all**, and `locale="en-US"`/`timeZone="America/Chicago"` have **no observable effect** on Android phones.

They are still passed and still asserted: the AC requires them, they cost nothing, they are correct at tablet/desktop widths, and they *are* exercised under Jest (whose mocked `Dimensions` is 750 px wide → `media.mobile` false → the date **does** render in the test tree, which is the second reason no test may assert its text). The PR says this in one sentence and leaves the author two options, **neither in this ticket**: accept the props as correct-by-construction, or raise a Bobuttons follow-up to paint the date on mobile. No Bobuttons change here, and the absent date is not a defect to be "fixed" in review.

### 0.3.7 Anti-pattern findings added by revision 9 (numbering continues §0.2.5)

**HIGH**

55. **Re-subscribing the back handler per view, or reading the *last* registration in the test.** Android calls handlers newest-first and stops at the first truthy one, so a leak consumes back on the map. Register once, read `mock.calls[0][1]`, assert `remove()` (§0.3.3).

**MEDIUM**

56. **Treating `android/app/src/main/assets/leaflet/map.html` as untouchable.** It is authored, not generated, and not digest-pinned; it is the sanctioned remediation site for a sizing/centring regression under §0.3.2's constraints. (`leaflet.js`/`leaflet.css`, the gradle files, the manifest, `tsconfig.json`, `package.json` and `jest.config.js` **are** untouchable.)
57. **Hardcoding Bobuttons' radius/padding values into app code** to fix WebView corner bleed, or dropping `ViewPane` for it. Report it; it is cosmetic (§0.3.1).

**LOW**

58. **Committing a uniqueness claim as measured evidence.** §0.3.5 is the worked example.

### 0.3.8 Self-audit record (revision 9)

Three passes, revising between passes.

**Pass 1 — AC coverage (24 criteria).** Re-walked every tag against the revised plan. The criteria the concerns touch are now *better* covered, and none lost a step: AC VIEWPANE gains a paint-evidence item (§0.3.1); AC MAP ON LAUNCH / PAN AND ZOOM gain a "centred at z12" screenshot item plus a named remediation site (§0.3.2); AC BACK NAVIGATION gains listener-hygiene assertions and an on-device `keyevent 4` item (§0.3.3–4); AC SIDEBAR ENTRIES' "selectable" gains a press-through test and a device tap (§0.3.4); AC PLACEHOLDER VIEWS keeps `ViewToolbar` with an honest rationale (§0.3.5). Finding: AC HEADER TITLE AND DATE cannot be **demonstrated** on the supported target — resolved as a plain disclosure plus an author decision point (§0.3.6), not as a Bobuttons change, and not as a silent pass.

**Pass 2 — Risk.** Every file in the plan re-checked against §3, §0.2.5 and §0.3.7, the blast-radius table and the irreversibility rules. The `map.html` carve-out is the only widening of the touchable set, and it is fenced by the six mechanism greps `map.test.tsx` already enforces plus "no edit without a device finding". Everything else narrowed (one back-handler registration instead of N; a press-through instead of a prop poke). Residual and accepted, all stated in the PR: WebView corner/stripe painting is unknown until the device leg; Android touch delivery is proven only by the device taps; `media.mobile` still differs between Jest and device; the WebView reload on every view switch re-centres the map. Multi-tenancy, N+1 and migrations: re-checked, still not applicable (single-user device app, no backend, no schema, no persisted state).

**Pass 3 — Scope.** The revision-9 additions are evidence and assertions, not features — no new file, no new dependency, no new user-visible behaviour. Rejected again, explicitly: clipping or styling the WebView to match the card; an `onLayout`-driven remount key; a speculative `map.html` resize rewrite with no device finding to justify it; a tablet AVD so the header date can be seen; `aria-label`/a11y, theming, icons, `TabBar`; and any Bobuttons edit.

All three passes are clean or resolved.

---

## 0.4 Why revision 10 exists — a NEW TaskSpec (21 AC), the author's navigation answer, and THREE more reversals

Revisions 8–9 were written against **TaskSpec revision 3 (24 criteria)**. This round carries a **new TaskSpec: 21 criteria**, rewritten after the reviewer's eleven concerns were resolved and after `CUPBOARD-2.md` ("Add icons to side panel entries") appeared and settled the `Tabs`-vs-`TabBar` question in `Tabs`' favour. The map screen, constants, bundled assets and dependency guard are unchanged and still good. **Three decisions recorded in revisions 8–9 are now reversed**, and they are corrected *in place* below rather than annotated.

| Revisions 8–9 said | Revision 10 says | Authority |
| --- | --- | --- |
| **WEBVIEW RETENTION** — "The WebView is **unmounted** while a placeholder is shown … not hidden with `display:'none'`/opacity" (§0.2.3), promoted to MEDIUM anti-pattern **47** | The map WebView **stays mounted** while a placeholder is shown, so the user's pan/zoom survives the return | New AC8 makes retention the author's call, and the TaskSpec states "the map WebView stay mounted so the user's pan/zoom position survives the return (**my recommendation**)". The author's reply approved the round |
| **`package.json` / the gates** — "**Untouchable — an edit is a blocked report, not a fix:** … `package.json`, `package-lock.json`, `jest.config.js`, `tsconfig.json`" (§0.2.1) and anti-pattern **51** | `package.json`'s **`scripts` block only** is now a **required** edit: drop `--passWithNoTests` from `test`, add `"typecheck": "tsc --noEmit"` | New AC21 ("GATES, all green") names both changes explicitly. Everything else in `package.json` stays byte-unmodified |
| **ATTRIBUTION / CARD CLIPPING** — a corner/stripe collision is "a **reported finding with evidence**… It is cosmetic" (§0.3.1) | Attribution legibility is a **criterion with a required fix**: if the default Leaflet position collides with Card's radius or the Stripe, adjust the in-page Leaflet/CSS side | New AC10. §0.3.1's *report-don't-patch* rule still governs the **WebView's own corner painting**, which remains cosmetic and unfixable from app code |

Two further criteria are **new work**, not reversals: AC15 (tile-fetch failure must be diagnosable through `MAP_LOG_TAG` and documented in the README) and AC17 (a test tying the bundled assets to the pinned `leaflet` devDependency). Both are additions to files this ticket already owns.

### 0.4.1 The author's navigation answer, and exactly how far it reaches

The TaskSpec was `blocked` on one question in two parts: **how the user returns to the map** (options a–d), and **whether the map WebView stays mounted**. The author's reply, relayed verbatim, is:

> "1. yes thats the plan, 2, yup that too. we will need another ticket later ti get icons. 4. ok. 5. ok... 6 thgats fine too. approved"

**What that answers, read honestly.** The numbering matches the TaskSpec notes' "How each review concern was addressed" list (1–11), not the lettered options: **1** is the `Tabs`-not-`TabBar`, no-bespoke-nav resolution ("yes thats the plan"), **2** is the navigation-state model ("yup that too"), **4** the ViewPane sizing AC, **5** the preserve-the-repo AC, **6** the tile-failure AC — and the aside "we will need another ticket later to get icons" confirms CUPBOARD-2. So the author **approved the AC set as written**, which carries the recommendation stated inside the blocking question. It does **not** contain a letter.

**Therefore: WebView retention is answered directly** (the recommendation was approved: it stays mounted). **The return path is derived, not quoted** — and the derivation is forced, which is why this is not re-blocking:

- **(a) a fourth "Map" entry is excluded by an AC the author explicitly approved.** AC6 pins "exactly three label-only entries in this order: Settings, Places, Notes", and the TaskSpec itself notes (a) "contradicts the ticket's three tabs". "1. yes thats the plan" is assent to that AC.
- **(b) hardware back alone is excluded by the TaskSpec's own objection to it**: "no on-screen affordance and invisible under gesture navigation". It is not *wrong*, it is *insufficient* on its own.
- **(c) tapping the already-active entry returns to the map** is the only option left that keeps three entries, needs no icons, gives an on-screen affordance, and makes `Tabs`' `current` well-defined while the map shows.

**Pinned navigation model:**

1. **`current` while the map shows is a typed `'map'` sentinel** that matches no entry, so `Tabs` renders all three inactive (measured in §0.2.2: `active: current === id`, and the label is painted either way). This is why the sentinel has to be *typed* — see anti-pattern 52.
2. **Tap an inactive entry → its placeholder. Tap the active entry → back to the map.** (option c)
3. **Android hardware back**: from a placeholder it returns to the map and **consumes** the event; on the map it is **not** consumed (system default — the app exits). This is not an extra feature smuggled in: AC8 enumerates "Android hardware-back behaviour" as one of the four legs of the decision, so *some* answer is mandatory, and "a placeholder swallows back silently" would be the one answer that makes a placeholder a dead end for a user who reaches for back first.
4. **The map WebView stays mounted.** Mechanism in §0.4.2.

**Flagged for the review round, not re-blocked:** item 3 of the TaskSpec's option list was never lettered back by the author. If the author wants **(b) only** — no toggle-off on the active tab — the deletion is two lines in `App.tsx` and two assertions in `shell.test.tsx`. Said plainly in the PR so the author can veto cheaply instead of discovering it.

### 0.4.2 Keeping the map mounted — the mechanism, and the AC9 tension it has to resolve

`display: 'none'` is the right tool and it is **the library's own pattern**: `CollapsibleSection` renders `View(display: open ? "flex" : "none", children)` (index.native.js 13740). It removes the node from layout *and* from the accessibility tree, and React does not unmount the child, so the Android `WebView`'s page — and all of Leaflet's state — survives.

**The tension with AC9, resolved rather than glossed.** AC9 requires "the map's wrapper View and the WebView must therefore keep an explicit `flex: 1` so the WebView does not collapse to zero height and render blank", while `display:'none'` collapses it to zero height deliberately. The resolution is to make the two orthogonal: the wrapper carries **`flex: 1` unconditionally**, and hiding is `display: 'none'` **in addition to** it, never *instead of* it.

- Visible state: wrapper style is exactly `{flex: 1}`; `MapScreen`'s own `container`/`webview` styles (already `flex: 1` each — unchanged) sit under it.
- Hidden state: `{flex: 1, display: 'none'}`.
- Both states are asserted in `shell.test.tsx`, so "the wrapper kept `flex: 1`" is a test, not a comment.

**Will pan/zoom actually survive? Measured in the vendored asset, already recorded in §0.3.2.** Leaflet 1.9.4 defaults `trackResize: true` and binds `window.resize → _onResize → invalidateSize({debounceMoveend: true})`, and `invalidateSize` pans by the **half-size delta** (`oldSize.divideBy(2).round().subtract(newSize.divideBy(2).round())`), i.e. it **preserves the visual centre** across a resize; zoom is untouched. The hidden state takes the WebView to a 0×0 layout and the return takes it back to the same size, so the two half-size deltas cancel and centre + zoom come back. Expect a brief **tile reflow** on return (tiles unloaded at 0×0, refetched from the WebView's HTTP cache) — that is a repaint, not a position loss, and it is stated in the PR so it is not read as a defect.

**If the device disagrees**, the sanctioned remediation site is `android/app/src/main/assets/leaflet/map.html` under §0.3.2's constraints (defer or re-apply `invalidateSize()` on the first non-zero resize). **Not** sanctioned: an `onLayout`-driven remount key, a fixed pixel height, dropping `ViewPane`, or touching `MapScreen`'s AC-pinned prop set.

### 0.4.3 AC10 — the attribution collision is REAL, and measured today

Not a judgement call; the stylesheet decides it.

- `node_modules/leaflet/dist/leaflet.css:413` — `.leaflet-container .leaflet-control-attribution { background: …; margin: 0; }`. That rule is **two classes** of specificity and sits **later** in the file than `.leaflet-bottom .leaflet-control { margin-bottom: 10px }` (`:166`) and `.leaflet-right .leaflet-control { margin-right: 10px }` (`:172`), so it **wins**: the attribution is flush in the container's bottom-right corner with only `padding: 0 5px`.
- The container fills `ViewPane`'s `Card`, which is `overflow: 'hidden'` + `borderRadius: '$3'` = **8 px** (`radius.3 = 8`, index.native.js 12941–12950). A box whose corner point sits at inset `d` from both edges is inside an `r`-radius corner only when `d ≥ r(1 − 1/√2) ≈ 0.293 r` ≈ **2.4 px**. At `d = 0` the corner is clipped, taking the tail of "contributors" with it.
- **The top `Stripe` is not a factor, and must not be "fixed" for.** The attribution is bottom-right by Leaflet default; the `Stripe` is a 2 px band (`height: '$0.5'`) at the Card's **top** edge. No collision. AC10's stripe leg is answered by this measurement, not by relocating the control.
- **The zoom control is also clear**, measured the same way: it is top-left with `margin-top/left: 10px`, and the Leaflet container starts *below* Card's `paddingTop: '$2.5'` (= 10 px), so the control sits ~20 px below the Card's outer top — past both the 2 px stripe and the 8 px arc. Nothing to do.

**Required fix, and the exactly-one place it may go:** one rule in **`map.html`'s own `<style>` block**, which is parsed after the `<link rel="stylesheet" href="leaflet.css">` and so wins at equal specificity:

```css
/* Clear ViewPane's Card: overflow:hidden + borderRadius $3 (8px at the time
   of writing) clips a control sitting flush in the corner. Leaflet's own
   `.leaflet-container .leaflet-control-attribution { margin: 0 }` beats its
   `.leaflet-bottom/.leaflet-right` 10px rules, so the inset is restored here.
   A literal, not a token: this document is inside a WebView and has no access
   to Tamagui tokens. It only has to EXCEED the radius. */
.leaflet-container .leaflet-control-attribution {
  margin-bottom: 6px;
  margin-right: 6px;
}
```

**HIGH anti-pattern (new, 59): putting this in `leaflet.css`.** AC10's phrase "the bundled CSS" reads like a licence to edit it; AC17 and the existing digest test make it a guaranteed failure — `leaflet.css` is byte-compared against `node_modules/leaflet/dist/leaflet.css` (verified byte-identical today). `leaflet.css` and `leaflet.js` stay untouched.

Note the interaction with §0.3.1, which still stands: whether an Android `WebView`'s own hardware-accelerated surface is clipped by the parent's rounded-corner path is a **device observation**. If it is *not* clipped, this CSS inset is harmless belt-and-braces; if it *is*, the inset is what AC10 requires. Correct either way, which is why it is pinned up front rather than held for a device finding.

### 0.4.4 AC15 — tile-fetch failure made diagnosable without flooding the channel

`map.html` has **no** `tileerror` handler today (read, not assumed). Adding one naively is a trap the repo has already been bitten by: commit `6275767` had to move the `init-ok` heartbeat from `console.warn` to `console.log` because a LogBox banner was covering the map on every launch. Offline, **every tile in the viewport errors** — dozens at z12, more on each pan — and each one would become a `console.warn`.

Pinned mechanism, two halves:

- **In `map.html`**, inside `initLeafletMap`, on the tile layer: count errors, and `post()` only the **first** one (carrying `e.tile.src`, so the condition is identifiable) and then at most one **summary** line per throttle window (`TILE_ERROR_POST_INTERVAL_MS = 5000`), carrying the running count. A runtime URL is not a literal, so `map.test.tsx`'s "no coordinate/zoom/tile-URL literal in `map.html`" assertions stay green.
- **In `MapScreen.tsx`**, extend the existing `handleMessage` router: a line beginning `${MAP_LOG_TAG} tile-error` goes to `console.log`, like the heartbeat — it is an **expected degraded condition**, not a JS error — while every other in-page message keeps going to `console.warn`. The prefix is mirrored as a local literal exactly as `MAP_INIT_OK_LOG_LINE` already is; the file's own comment records why a log tag/message is exempt from the no-duplication rule that map *parameters* carry, so **`mapConstants.ts` needs no change**.

The WebView's pinned prop set is untouched — only `handleMessage`'s body changes — so `map.test.tsx`'s props assertions stay green unchanged.

**README (AC15 requires it):** blank/grey map offline or on a blocked/rate-limited endpoint, **by design, no error or retry UI in this ticket**; the condition is read with `adb logcat -d | grep CupboardMap`, which shows the throttled `tile-error count=N url=…` lines; any user-facing surface is a separate ticket.

### 0.4.5 AC17 — tying the vendored assets to the pinned package (all four facts measured today)

1. `android/app/src/main/assets/leaflet/leaflet.css` is **byte-identical** to `node_modules/leaflet/dist/leaflet.css` (`cmp` → identical).
2. `…/leaflet.js` is **byte-identical after its single prepended first line** `/* eslint-disable */` (`tail -n +2 | cmp -` → identical). A **whole-file** compare fails at byte 4 — a test written the obvious way goes red on a correct tree.
3. The vendored banner reads `Leaflet 1.9.4`; `node_modules/leaflet/package.json`.version is `1.9.4`; `package.json`.devDependencies.leaflet is `1.9.4`.
4. **Point the test at `android/app/src/main/assets/leaflet/`, never `android/app/build/…`.** Measured: `android/app/build/intermediates/assets/{debug,release}/…/leaflet/leaflet.js` exist as build copies — `npm run lint` reaches them today (three identical warnings, exit 0). A glob-based test would compare the wrong file.

So the new `__tests__/leafletAssets.test.ts` asserts: the CSS byte-compare; the first line is exactly `/* eslint-disable */` *and* the remaining bytes byte-compare; the banner version, the installed version and the `package.json` pin are all the same string. It needs the `/// <reference types="node" />` first line (tsconfig sets `types: ["jest"]`).

**The existing digest block in `map.test.tsx` stays.** It is a *different* guarantee — "these are the exact bytes `README.md` and `THIRD-PARTY-NOTICE.md` document" — and no AC asks for its removal. Deleting it would be unrequested scope and would drop the test count.

### 0.4.6 Corrections to the composition pinned in §0.2.3

§0.2.3's tree stands except where noted. The replacement:

```
SafeAreaProvider                              (unchanged)
└─ BobuttonsProvider                          (exactly one, NO config prop — unchanged)
   ├─ StatusBar barStyle="dark-content"        (unchanged)
   └─ AppContent  → useSafeAreaInsets()        (unchanged)
      └─ AppShell insets={insets}
         header  = <AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago" />
         sidebar = <Tabs tabs={SIDEBAR_ENTRIES} current={activeView} onChange={selectView} />
         children=
           <ViewPane>                          (exactly one)
             <View style={[styles.mapFill, !mapActive && styles.hidden]}>
               <MapScreen />                   (STAYS MOUNTED — CHANGED, §0.4.2)
             </View>
             {isSidebarEntryId(activeView) ? <PlaceholderView entryId={activeView} /> : null}
           </ViewPane>
```

- **`onChange` is `selectView`, not `setActiveView` (CHANGED).** `selectView(id) => setActiveView(current => current === id ? MAP_VIEW_ID : id)` — the toggle-off that is the on-screen return path (§0.4.1). Written as an updater so it cannot read a stale `activeView`.
- **No `AppNav.tsx` (CHANGED from the TaskSpec's proposed `key_files`).** `<Tabs>` is rendered **directly** into `AppShell`'s `sidebar`. The TaskSpec says those paths are "proposals, not mandates", and AC6 forbids "a bespoke nav component" — a wrapper component named `AppNav` invites exactly that reading at review for zero benefit. The typed entries, the `ViewId` union, the `MAP_VIEW_ID` sentinel and `isSidebarEntryId` live in **`src/shell/navEntries.ts`**, which is data and a type guard, not a component.
- **One parameterised `src/views/PlaceholderView.tsx`, not three near-identical files (CHANGED from the TaskSpec's proposed `key_files`).** AC7 wants "an empty placeholder view for that entry"; what is observable is that selecting each entry renders *that entry's* placeholder, which the test proves via `entryId` **and** the rendered `ViewToolbar` title. Three byte-identical files would be duplication with no behavioural difference. `ViewToolbar title={label}` remains the text source, with §0.2.2's corrected rationale (the package root exports no plain `Text`; the alternatives are rejected on semantics, not availability).
- **The back handler is unchanged from §0.3.3** — register **once**, read the current view through a ref, return `false` on the map and `true` from a placeholder. Android invokes handlers newest-first and stops at the first truthy one, so a per-view re-subscription leaks a handler that would consume back **on the map** and stop the app exiting.
- **`tsconfig.json` is NOT edited.** The TaskSpec's `key_files` lists it "for the new typecheck gate"; measured today, `npx tsc --noEmit` already exits **0** against the current `tsconfig.json`, and AC21 asks only for a **package.json script**. Read, not written (§2.5's rules still apply to the new files: `strict: true`, and `/// <reference types="node" />` in any test that touches `fs`/`path`).

### 0.4.7 Baseline measured today, before any change

| Gate | Result |
| --- | --- |
| `npm test` | **3 suites, 22 tests, 22 passed**, exit 0 (`--passWithNoTests` still in the script) |
| `npx tsc --noEmit` | exit **0** |
| `npm run lint` | **0 errors, 3 warnings**, exit 0. All three are the same `eslint-comments/no-unlimited-disable` on `leaflet.js` — the vendored asset plus its **two build-output copies** under `android/app/build/intermediates/assets/` |
| `git log --oneline` | `6275767`, `dba2a4c`, `5e4be11`, `6046ce0`, `3603980`, `1ef152e` — six commits; branch `CUPBOARD-1-…` checked out and tracking `origin` |
| `git status --porcelain` | ` M docs/context/CUPBOARD-1-…md`, `?? docs/context/CUPBOARD-1-study-guide.md` |

**22 tests is the floor**, and after this ticket the suite must be **5 files** with the two new ones actually discovered — which is what removing `--passWithNoTests` protects.

Two more facts re-verified for the test design: `react-native/jest-preset.js` sets `haste.defaultPlatform: 'ios'`, so `BackHandler` resolves to `BackHandler.ios.js`, whose `addEventListener` returns `{remove: emptyFunction}` — removal is **unobservable** without `mockImplementation(() => ({remove: removeSpy}))`. And `Tabs`' `TabLabel` is `styled(Text)` with `children: label`, so the three labels **do** materialise as strings in the `react-test-renderer` tree.

### 0.4.8 `shell.test.tsx` — what it must assert (AC16, and AC8's "covered by the shell test")

Needs both mocks: `react-native-webview` (ESM entry) and the file-local `react-native-safe-area-context` shim at **zero** insets (the real provider renders zero children under Jest). No snapshots.

1. **Header title** — `AppShell.props.header` is an `AppHeader` element with exactly `{title: 'Cupboard', locale: 'en-US', timeZone: 'America/Chicago'}`, asserted on the **element's props**. Never on rendered date text: `now` defaults to the clock, and the date is media-dependent (§0.3.6).
2. **Exactly three labels, in order** — `Tabs.props.tabs` deep-equals the three `{id, label}` entries in order, **and** the label strings collected from the sidebar subtree are `['Settings', 'Places', 'Notes']` in that order (props prove the contract, the collected strings prove the paint). `findAllByType(TabBar)` is empty.
3. **Map is the default view** — `Tabs.props.current === MAP_VIEW_ID` (matches no entry ⇒ none underlined); a `WebView` is present and its wrapper style has `flex: 1` with **no** `display: 'none'`; `findAllByType(PlaceholderView)` is empty.
4. **Selecting each entry** — press the **rendered tab node** (`n.props.id === 'tab-<id>' && typeof n.props.onPress === 'function'`, first match, inside `act()`), not the `Tabs` element's own `onChange` prop, which would prove only our own wiring (§0.3.4). Asserts `PlaceholderView` with that `entryId`; `ViewToolbar.props.title` is that entry's label; `Tabs.props.current === id`; and — **the AC8 retention leg** — the `WebView` is **still mounted** with its wrapper at `flex: 1` **plus** `display: 'none'`.
5. **Return to the map, both paths** — pressing the **already-active** tab restores `current === MAP_VIEW_ID`, drops `PlaceholderView` and un-hides the map wrapper; and the hardware-back handler returns `true` from a placeholder (map restored) and `false` on the map (map stays). Listener hygiene per §0.3.3: `addEventListener` called **exactly once** across mount + every selection + every back press, the handler read from `mock.calls[0][1]` (never `.at(-1)`, which would hide a duplicate registration), `removeSpy` not called before unmount and exactly once after.
6. **Structure** — exactly one `BobuttonsProvider` with no `config` prop; exactly one `ViewPane`; **zero** `ViewBody`.
7. **UI source boundary**, as a source scan over `App.tsx` + `src/**/*.ts(x)`: no `@tamagui/*` import, no `bobuttons/dist` deep import, and no non-Bobuttons UI import beyond the sanctioned set (`react-native-webview`, `react-native-safe-area-context`, and `StatusBar`/`View`/`StyleSheet`/`BackHandler` from `react-native`). Needs the `/// <reference types="node" />` first line.

`findByType` is only ever called with an **imported component reference**, never a string (§2.5 Finding B). A props predicate is not a string type lookup.

### 0.4.9 The two existing tests that FAIL unless they are rewritten

Both are in `__tests__/map.test.tsx`, and both fail on a **correct** implementation — they encode revision 7's withdrawn decisions. Confirmed by reading the file, not predicted:

- `'renders AppShell with no header prop and the safe-area insets'` asserts `expect('header' in shell.props).toBe(false)` (line 274). AC5 requires the header. → Rewrite to assert the `header` **is** an `AppHeader` element carrying the three props. The `insets` assertion stays.
- `'has no scroll-host ancestor, scroll-prop ancestor, or non-zero-padding ancestor above the WebView'` (lines 290–362) fails the moment `ViewPane` is in the tree: `Gutter` adds `paddingVertical: '$1.5'` + `paddingRight: '$1.5'` and `Card` adds `paddingTop: '$2.5'`, and the walk checks padding on `node.props` as well as `node.props.style` precisely because Tamagui bakes it in as props. → **Drop the blanket non-zero-padding rule; keep the scroll-host and scroll-prop rules**, which are the load-bearing ones (padding only shrinks the map; it does not take the drag). The zero-insets stub stays — it is what keeps `AppShell`'s own inset padding out of the walk. Record the rationale at the call site so the narrowing is not read as a weakened assertion.

Note the TaskSpec's AC9 layout description lists Card's `paddingTop: $2.5` and `borderRadius: $3` but **not** `Gutter`'s `paddingVertical`/`paddingRight: $1.5`. Measured, both exist (index.native.js 13785–13793). The AC understates the padding slightly; the walk has to accommodate what is actually there.

Also: `__tests__/App.test.tsx`'s header comment still advertises "header omission" as a mechanism check in the sibling file — comment-only correction. Its body stays a smoke test (real providers ⇒ zero children ⇒ `AppContent` never mounts ⇒ no `BackHandler` registration). `__tests__/dependencies.test.ts` is **untouched** and must stay green (AC19).

### 0.4.10 Anti-pattern findings added by revision 10 (numbering continues §0.3.7)

**HIGH**

59. **Editing `leaflet.css` (or `leaflet.js`) to fix the attribution.** AC10's "the bundled CSS" reads like permission; AC17 and the existing digest test make it a guaranteed red. The rule goes in `map.html`'s `<style>` block, which already wins on source order (§0.4.3).
60. **Re-asserting `'header' in shell.props === false`, or leaving the padding walk as-is.** Both existing assertions fail on a *correct* tree (§0.4.9). The failure mode to guard against is "fixing" them by dropping `AppHeader` or `ViewPane` instead of rewriting the assertions.
61. **Unthrottled `tileerror` → `console.warn`.** Offline this is dozens of lines per viewport and a LogBox banner over the map — re-creating by hand the exact regression commit `6275767` fixed. Throttle in the page, and route the line to `console.log` (§0.4.4).
62. **Treating `package.json` as untouchable (reverses anti-pattern 51 in part).** AC21 requires the two `scripts` edits. The narrow licence is the **`scripts` block only**: `dependencies`, `devDependencies`, the `bobuttons` `file:` specifier and `bobuttonsProvenance` stay byte-unmodified, and `package-lock.json`, `jest.config.js`, `tsconfig.json`, the gradle files and the manifest **are still untouchable**.

**MEDIUM**

63. **Unmounting the WebView on a view switch (reverses anti-pattern 47).** The author approved retention. Conditional rendering of `<MapScreen />` is the wrong shape now; `display: 'none'` on a wrapper that keeps `flex: 1` is the right one (§0.4.2).
64. **Dropping `flex: 1` from the wrapper when hiding it**, i.e. toggling `{flex: 1}` → `{display: 'none'}` instead of adding the second declaration. AC9 pins the explicit `flex: 1`; both states are asserted.
65. **A whole-file byte-compare of `leaflet.js` against `node_modules`.** Fails at byte 4 on a correct tree because of the prepended lint line. Strip exactly one first line, and assert that line's content so the strip is pinned (§0.4.5).
66. **Pointing an asset test at `android/app/build/…`.** Two build copies of `leaflet.js` exist on disk right now (§0.4.5 item 4).
67. **Removing the existing SHA-256 digest block from `map.test.tsx`** because AC17's new test looks like a replacement. Different guarantee, no AC asks, and it lowers the test count.
68. **Adding an `AppNav` component or three per-entry view files** because the TaskSpec's `key_files` lists those paths. They are explicitly "proposals, not mandates"; an `AppNav` wrapper invites the "bespoke nav component" reading AC6 forbids (§0.4.6).

### 0.4.11 Shared services and blast radius (revision-10 delta)

| Surface | Risk | Guard |
| --- | --- | --- |
| `android/.../leaflet/leaflet.js`, `leaflet.css` | Now guarded **twice** (the digest block **and** the new parity test); an edit reds both | Byte-untouched. The attribution fix goes in `map.html` (§0.4.3) |
| `package.json` | First sanctioned edit in this ticket; a careless one breaks `dependencies.test.ts` or the vendored `bobuttons` resolution | `scripts` block only, two keys. `git diff -- package.json` reviewed before commit; `dependencies.test.ts` re-run |
| `src/map/MapScreen.tsx` | Its WebView prop set is AC-pinned and asserted | Only `handleMessage`'s body changes; the props assertions must stay green unchanged |
| `map.html` | Six mechanism greps in `map.test.tsx` already enforce its invariants | No coordinate/zoom/tile-URL/attribution literal; keep the `typeof L` guard, the `init-ok` heartbeat, the guarded `post()`, `user-scalable=no`, `overflow: hidden` and the relative `<script>`/`<link>` tags |
| Bobuttons (vendored tarball + `node_modules/bobuttons`) | Unchanged from §0.2.6 | Read-only. Every finding about the date, the padding, the stripe, TabBar's icon and the mobile strip is **accepted**, never patched |
| Branch + PR #1 + six commits | A human's history and an open review thread | Commit on top only; one PR, updated in place |
| `docs/context/*` | Now **four** reversed decisions recorded across revisions 7→10 | This revision corrects in place; the study guide's one stale bullet (`line 358`, "the omitted `header` prop") is fixed with it |

### 0.4.12 Risks and constraints (revision-10 delta)

- **Pan/zoom survival across a hide/show is reasoned from the vendored Leaflet source, confirmed only on device.** Expect a tile reflow on return. Remediation site named (`map.html`), forbidden remedies named (§0.4.2).
- **Whether the Android WebView surface is clipped by Card's rounded corners is still unknown until the device leg** (§0.3.1). The CSS inset is correct under both outcomes.
- **The return-to-map affordance is derived from the author's approval, not quoted from it** (§0.4.1). Stated in the PR as a cheap veto point.
- **Six on-device legs, none automatable**: debug build installs and launches (AC2); the map is real Leaflet centred on Chicago at z12 and fills the card with non-zero height (AC3, AC9); pan and zoom work inside ViewPane (AC4); the attribution is visible and legible, unclipped (AC10); tapping each entry shows its placeholder and tapping the active one returns to the map, with hardware back doing the same (AC8); and pan/zoom position survives the return. §5.14's partial-verification rule still governs: if the emulator will not boot, report **NOT VERIFIED** with the exact error plus the four green gates — silent omission is a failure.
- **`media.mobile` still differs between Jest and the device**, so no test may assert anything media-dependent — including the header date, which is not painted on a phone at all (§0.3.6).
- **Scope-creep pressure points, revision-10 specific:** icons (CUPBOARD-2); a fourth "Map" tab; `aria-label`/a11y work; a `border-radius` or any other cosmetic restyle of the attribution chip beyond the two margins; three per-entry view files; an `AppNav` wrapper; removing the digest block; an offline banner, retry button or tile cache; editing `tsconfig.json`; and "fixing" Bobuttons' date, padding or stripe.

### 0.4.13 Self-audit record (revision 10)

Three passes, revising between passes.

**Pass 1 — AC coverage (21 criteria).** Every criterion mapped to a concrete file change or a named verification step. Findings, each resolved by revising the plan rather than annotating it:

- **AC21's typecheck leg had a phantom file.** The TaskSpec's `key_files` lists `tsconfig.json` "for the new typecheck gate"; measured, `tsc --noEmit` already exits 0 and the AC asks only for a package.json **script**. `tsconfig.json` moved from *modify* to *read-only* (§0.4.6).
- **AC8 had no mechanism at all** — it defers to an author answer that arrived without a letter. Resolved by deriving the only option the approved ACs leave open, pinning all four legs, and flagging the derivation for cheap veto (§0.4.1) instead of re-blocking a second round.
- **AC9 and AC8 pulled in opposite directions** (`flex: 1` always vs. deliberately collapsing the map). Resolved structurally: `flex: 1` unconditional, `display: 'none'` additive, both states asserted (§0.4.2). Promoted the inverse to anti-pattern 64.
- **AC10's stripe leg needed answering, not implementing.** Measured: the attribution is bottom-right, the stripe is a 2 px band at the top — no collision. The corner clip **is** real and is specified (§0.4.3). Had this not been measured, the plan would have carried a pointless control relocation.
- **AC15 had a second half nobody had costed**: surfacing tile errors is trivial, surfacing them *without* re-creating the LogBox regression of commit `6275767` is the actual requirement. Throttle + `console.log` routing pinned (§0.4.4).
- **AC16's "renders exactly the three labels" was about to be satisfied by a props assertion alone.** Verified that `Tabs`' label strings do materialise in the test tree, and added the rendered-string collection alongside the props deep-equal (§0.4.8).
- **AC20 needs no work**: `jest.config.js` already appends `bobuttons` to the preset's own pattern, and the `react-native-webview` mock is already in every file that reaches it. Recorded as satisfied rather than listed as a file.

**Pass 2 — Risk.** Every file re-checked against §3, §0.2.5, §0.3.7 and §0.4.10, the blast-radius table and the irreversibility rules.

- **The biggest finding is a pair of existing tests that go RED on a correct implementation** (§0.4.9). They are not "tests to update" in the routine sense — they encode a withdrawn decision, and the tempting fix is to drop `AppHeader` or `ViewPane`. Promoted to HIGH anti-pattern 60 and given explicit rewrite instructions.
- **`leaflet.js` is now guarded twice and the obvious parity test fails on a correct tree** (byte 4). Measured, pinned, and promoted to anti-pattern 65; the build-output copies to anti-pattern 66.
- **`package.json` becomes writable for the first time in four revisions**, and `dependencies.test.ts` is the thing most likely to break on a careless edit. Narrowed the licence to the `scripts` block and two keys, with a diff review and a re-run before commit.
- **`map.html` gains two changes at once** (attribution CSS, tile-error handler) while six mechanism greps guard it. Listed the invariants each change must preserve.
- Multi-tenancy, N+1 and migrations re-checked: still **not applicable** — single-user device app, no backend, no schema, no persisted state. The nearest analogue to request amplification is OSM tile volume, and the new throttle *reduces* the bridge traffic a failing tile layer produces.

**Pass 3 — Scope.** Walked every step against the 21 criteria and the out-of-scope list. **Removed from the plan during this pass:** a `mapConstants.ts` change for the tile-error prefix (the file's existing comment already exempts log tags from the no-duplication rule, so a local literal is the established pattern — one fewer file); `src/shell/AppNav.tsx` (anti-pattern 68); two of the three proposed per-entry view files; a `tsconfig.json` edit; and a `border-radius` on the attribution chip (cosmetic). **Rejected:** icons and `TabBar`; a fourth "Map" entry; `aria-label`; any Bobuttons edit; clipping or styling the WebView to match the card; an `onLayout`-driven remount key; persisting the selection; any offline/retry UI; removing the digest block; `@testing-library/react-native`. **Kept as AC-anchored, not creep:** the hardware-back leg (AC8 enumerates it), the rendered-label collection (AC16 says "renders"), the README offline section (AC15 names it), and the one-line study-guide fix (two opposite recorded decisions in one repo is the thing §0.2.6 exists to prevent).

All three passes are clean or resolved.


---
---

## 0.5 Why revision 11 exists — ten review concerns on the revision-10 plan, and ONE STRUCTURAL REVERSAL

The revision-10 plan was reviewed and ten concerns were raised (1 HIGH, 6 MEDIUM, 3 LOW). None is dismissed. One of them falsifies the **mechanism** revision 10 chose for keeping the map mounted, and the fix replaces it rather than patching it. **Where §0.5 and §0.4 disagree, §0.5 wins.**

### 0.5.1 THE REVERSAL: `display: 'none'` is out; `opacity: 0` + `pointerEvents: 'none'` is in

Revision 10 hid the map by putting `display: 'none'` on its wrapper while keeping `flex: 1`. Three of the ten concerns (1 HIGH, 2 MEDIUM) are all **consequences of the same root cause**: `display: 'none'` takes the node out of Yoga layout, so the WebView is driven to **0x0** and back.

| Consequence | Why it is real | Status under the new mechanism |
| --- | --- | --- |
| **Init race (HIGH).** `map.html`'s only `invalidateSize()+setView()` is the double-`requestAnimationFrame` added by commit `dba2a4c`. Tap Settings in the first frames after launch and that deferred call runs while the container is 0x0, Leaflet bakes a zero-size transform, and nothing re-runs it on return — re-creating the exact mis-centering bug `dba2a4c` fixed. | Correct. Verified in `map.html:131-136`: the deferred call is unconditional and one-shot, with no size check and no re-apply path. | **Structurally eliminated.** The wrapper is never 0x0, so the deferred call always runs at the real card size. Additionally hardened — see §0.5.2. |
| **Retention rests on an unestablished event (MEDIUM).** Retention assumed Leaflet's `trackResize` window-`resize` listener fires on the way back. In RN, `display: 'none'` removes the node from layout rather than resizing it; that the inner page's `window` emits `resize` at all is **not established**, and revision 10's "symmetric `_rawPanBy` half-delta cancels out" argument is reasoning about Leaflet's resize math *through a 0x0 state*. | Correct, and the reviewer also correctly notes that the structurally safe alternative was never evaluated. | **Moot.** The map's Yoga layout is **identical** in both states, so no resize event is needed and no resize math is relied on. Retention becomes structural rather than inferred. |
| **Render-process reclaim (MEDIUM).** A 0x0 hidden WebView is a prime target for Android render-process reclaim; `MapScreen`'s existing `onRenderProcessGone` bumps `remountKey` and reloads from the pinned constants, so after a long dwell on a placeholder the user can silently return to a **reset** Chicago view. | Correct. Verified in `MapScreen.tsx:104-114`. | **Reduced, not removed** — see §0.5.4. The WebView stays full-size and window-visible, which is the state Android is least likely to reclaim. |

**The new mechanism.** `App.tsx` owns the stacking; the map's layout never changes:

- Map wrapper: a flow child of `ViewPane`, `style={[styles.mapFill, !mapActive && styles.mapHidden]}` where `mapFill = {flex: 1}` and `mapHidden = {opacity: 0}`, plus `pointerEvents={mapActive ? 'auto' : 'none'}`. **`flex: 1` is unconditional and additive** — AC9's letter ("the map's wrapper View and the WebView must keep an explicit `flex: 1`") is satisfied in *both* states, which `display: 'none'` only satisfied in one.
- Placeholder: an absolutely-positioned fill `View` (`StyleSheet.absoluteFillObject`), rendered only when an entry is active.
- `pointerEvents: 'none'` on the hidden map is **required, not belt-and-braces**: RN hit-tests by frame and `opacity` does not affect hit testing, so a full-size invisible WebView would otherwise still be able to take the drag.

**Why the overlay needs no background of its own.** Measured: `ViewPane`'s `Card` is `backgroundColor: "$surface"` (`index.native.js:13794-13803`) and sits *behind* both children. At `opacity: 0` the map paints nothing, so what the user sees is the Card's own `$surface` with the placeholder's text on it. This is what makes the overlay viable at all — the reviewer's "absolutely-positioned **opaque** View" would have needed a colour, and the public API offers no opaque full-bleed surface to borrow one from. Checked, all of them: `dist/index.d.ts` exports no `Card`, no `Surface` and no plain `Text`; `SettingsLayout`'s `Frame` is `flex: 1` with **no** `backgroundColor` (`index.native.js`, `SettingsLayout.tsx` block); `SettingsSection` is a bounded card, not a fill. The only remaining source would be the public `palette` export, which is the *theme-independent named* palette, not the semantic `$surface` — so it would be a theme-wrong hardcode. **Do not give the overlay a background colour.**

**Remediation ladder if `opacity: 0` does not hide the WebView on-device.** Android applies parent alpha to a hardware-accelerated WebView texture via an off-screen layer (`ViewGroup.setAlpha` + `hasOverlappingRendering`), which is expected to work, but this is a device-leg unknown. If the WebView is still visible: **add** `transform: [{translateX: 10000}]` to the same `mapHidden` style object — `Card` is `overflow: "hidden"`, so the translated child is clipped away, and transforms do not affect Yoga layout, so the 0x0 class of bug stays closed. **Not sanctioned:** reverting to `display: 'none'` (reopens all three consequences above), giving the overlay a hardcoded colour, a fixed pixel height, an `onLayout`-driven remount key, or dropping `ViewPane`.

### 0.5.2 The init-view guard is now pinned up front, not listed as device-only remediation

The reviewer asked for a re-apply-on-first-non-zero-size guard in `map.html` **up front**. Granted, and for a reason broader than the race: commit `dba2a4c`'s double-`requestAnimationFrame` is a **timing guess**, not a condition. On a slow device, two frames may still not be enough and the zero-size transform is baked with no recovery path — a latent bug independent of navigation, directly against AC3 ("displays a real Leaflet map centered on Chicago") and AC9 ("must fill the card with non-zero height").

Replace the bare double-rAF with a **size-conditional, bounded** apply inside `initLeafletMap`:

- Keep the two-frame defer as the first attempt, so `dba2a4c`'s fix is not regressed.
- Then check `#map`'s `clientWidth`/`clientHeight`. Non-zero ⇒ `invalidateSize()` + `setView(...)`, done.
- Zero ⇒ re-check on the next frame, bounded by a named attempt cap. Exhausting the cap posts one tagged line (so the condition is diagnosable per AC15's spirit) **and** applies anyway, with a flag recording that it was applied at zero size.
- If it was applied at zero size, a one-shot `resize`/next-frame re-apply fires the first time a non-zero size is observed.

No API the Android WebView might lack (no `ResizeObserver`); no new coordinate, zoom, tile-URL or attribution literal. All six `map.html` mechanisms that `map.test.tsx` greps survive unchanged.

### 0.5.3 The return path is now CHOSEN, not derived — a visible, icon-free control

The reviewer is right that revision 10's derivation was self-defeating: tapping the already-active tab has **no on-screen affordance**, which is the *exact* objection the TaskSpec used to reject hardware-back-only, and with empty placeholders the only cue is an underline the user has no reason to read as a toggle.

**Chosen:** a label-only `Button` in `PlaceholderView`'s `ViewToolbar` `actions` slot. Measured and available:

- `ViewToolbarProps` has `actions?: React.ReactNode` ("Controls or stats on the right") — `ViewToolbar.d.ts`.
- `ButtonProps` is `{label: string; variant?: "primary"|"secondary"|"ghost"; disabled?; onPress?; "aria-label"?}` — `Button.d.ts`. **No icon anywhere in its API**, so AC7 ("built only from Bobuttons components and using no icons") holds.
- It is **not** a fourth sidebar entry: it lives inside the placeholder view, so AC6's "exactly three label-only entries" is untouched.

**Consequence — the tap-active-tab toggle is REMOVED.** With a visible control it is a redundant, undiscoverable second path, and it is the thing that made pressing a selected tab deselect it (the reviewer's LOW concern). Dropping it keeps `Tabs` semantics ordinary: selecting a tab selects it. Two return paths remain, both AC8 legs: the `Button`, and Android hardware back.

Four legs of AC8, all pinned:

| Leg | Decision |
| --- | --- |
| How the user returns | `Button label="Back to map" variant="secondary"` in `ViewToolbar`'s `actions`, **plus** Android hardware back |
| `current` while the map shows | the typed `'map'` sentinel — matches no entry, so `Tabs` underlines none |
| Android hardware back | returns to the map from a placeholder (handler returns `true`); **not consumed** on the map (returns `false`, app exits) |
| WebView mounted while a placeholder shows | **yes** — §0.5.1's mechanism |

`Tabs` renders `aria-selected: false` on every tab while the sentinel is current (`index.native.js:14344`). That is **deliberate** and must be stated in `navEntries.ts`: the map is not one of the three entries, so no entry is selected while it shows. Recorded so a later a11y pass or CUPBOARD-2's possible `Tabs`→`TabBar` move does not read it as a bug.

### 0.5.4 `onRenderProcessGone` vs. the retention guarantee — scoped, not engineered around

Reloading **is** the only correct recovery from a dead renderer; there is nothing left to preserve. So the guarantee is scoped precisely: **pan/zoom survives the navigation round trip**, not a renderer crash. Three actions, no code change to the handler:

1. `MapScreen`'s `onRenderProcessGone` stays exactly as it is.
2. README documents it: a renderer crash resets the view to the pinned Chicago constants, this is the designed recovery, and it is logged via `MAP_LOG_TAG` (the handler already `console.warn`s).
3. Persisting map view state across a renderer crash is **out of scope** — no AC asks for it and it would need a new map→RN state channel.

### 0.5.5 The ancestor walk keeps its padding rule, as an allowlist

Revision 10 dropped the blanket non-zero-padding rule outright. The reviewer is right that this removes the only guard against a future wrapper that shrinks the map to nothing. **Replaced with an allowlist**, values measured today:

| Source | Property | Token | Resolved px |
| --- | --- | --- | --- |
| `ViewPane` → `Gutter` | `paddingVertical`, `paddingRight` | `$1.5` | **6** (`tokens/space.d.ts:7`) |
| `ViewPane` → `Card` | `paddingTop` | `$2.5` | **10** (`tokens/space.d.ts:9`) |

The rule becomes: every ancestor's padding must be `0` **or** a member of the named allowlist. Because Tamagui bakes these as props and the value can surface either as the token string or resolved, the allowlist admits **both** forms (`0`, `6`, `10`, `"$1.5"`, `"$2.5"`) and the developer pins the exact observed forms when the test is run. **Plus a non-vacuity assertion**: at least one ancestor must actually hit the allowlist, so a future refactor that silently removes `ViewPane` cannot leave the rule passing trivially. The scroll-host and scroll-prop rules and the zero-insets stub are unchanged — those are the load-bearing ones (padding shrinks the map; it does not take the drag).

For the record, AC9's own layout description omits `Gutter`'s `paddingVertical`/`paddingRight` — it names only Card's `paddingTop $2.5` and `borderRadius $3`. Both exist. The walk accommodates what is in the tree, not what the AC lists.

### 0.5.6 A real Android build gate — the toolchain is present, measured today

The reviewer is right that ACs 2, 3, 4, 9 and 10 were entirely manual with a "report NOT VERIFIED" escape hatch, and that **no gradle step ran at all**, so manifest/gradle breakage could ship with all three green gates. The toolchain is here:

| Fact | Measured |
| --- | --- |
| `android/gradlew` | present, executable (8728 bytes) |
| `ANDROID_HOME` | `/home/ivana/Android/Sdk`, populated (`build-tools`, `cmake`, `emulator`, `licenses`, `ndk`) |
| Gradle cache | **4.4 GB** at `~/.gradle` |
| Java | OpenJDK **17.0.20.1** |
| Prior build | **both APKs already on disk** — `android/app/build/outputs/apk/debug/app-debug.apk` and `.../release/app-release.apk` |
| `android/local.properties` | **absent** — the build resolves the SDK from `ANDROID_HOME` |

So `cd android && ./gradlew assembleDebug` (add `--offline` if the network is unavailable; the cache is warm) is a **required pre-PR gate**, reported with its exit status. It is deliberately **not** a new `package.json` script: AC21 licenses exactly two script keys and a third would exceed it. This gate is what separates AC2's "builds" half (now automated) from its "launches on a device" half (still manual).

### 0.5.7 Tile-error throttle gets a hard cap

Granted. A 5-second window with no cap means a summary line every 5 s for the life of the session while offline. The handler posts: the **first** error (carrying `e.tile.src`), then at most one summary per `TILE_ERROR_POST_INTERVAL_MS = 5000`, up to a named `TILE_ERROR_MAX_POSTS` cap, after which it goes silent. Only the first line carries a URL; the summaries carry the running count. The reviewer's alternative — only posting while the map is the active view — is **unreachable from inside the page**: the document has no knowledge of the RN-side active view, and under §0.5.1's mechanism the map is always laid out anyway. The cap is the answer.

### 0.5.8 The BackHandler listener-hygiene assertions get a call-site comment

Granted, as written. `addEventListener` called **exactly once** and reading the handler from `mock.calls[0][1]` are guarding **one specific device bug**: Android invokes back handlers newest-first and stops at the first truthy one, so a leaked per-view registration consumes back **on the map** and the app stops exiting — green in CI, wrong on device. They are *not* guarding against StrictMode double-invocation or a legitimate remount, and if one of those ever changes they will fail in a way that reads as a handler leak. The comment at the call site must say exactly that, so the next reader fixes the harness rather than the component.

### 0.5.9 The study guide is corrected but NOT committed

`docs/context/CUPBOARD-1-study-guide.md` is untracked and no AC asks for a study guide in repo history. Its one stale bullet (line 358, "the omitted `header` prop") is still corrected — two opposite recorded decisions in one repo is what §0.2.6 exists to prevent — but the file is **left untracked**, and whether the author wants it tracked is an explicit PR question. The *tracked* context file (this one, added by commit `3603980`) is the one that carries the decision record.

### 0.5.10 Anti-patterns 69–75 (this round)

69. **HIGH — hiding a WebView by removing it from layout.** `display: 'none'` drives it to 0x0, which bakes a zero-size Leaflet transform, makes retention depend on an unestablished `resize` event, and invites render-process reclaim. Hide with `opacity: 0` + `pointerEvents: 'none'` and never change the map's layout.
70. **HIGH — a deferred one-shot `invalidateSize()+setView()` with no size condition.** A frame count is a guess; a non-zero-size check is a condition. Bound it, log the timeout, re-apply once if it ever applied at zero size.
71. **MEDIUM — a navigation return path with no on-screen affordance.** Tap-active-to-deselect fails the same test hardware-back-only failed. Use a visible, label-only control.
72. **MEDIUM — giving an overlay a hardcoded or palette-sourced background to cover a sibling.** The `Card`'s own `$surface` is already behind both children; an `opacity: 0` sibling needs no cover. A colour from the public `palette` export is theme-independent and therefore theme-wrong.
73. **MEDIUM — deleting a guard rule because it now trips.** The non-zero-padding ancestor rule exists to catch a wrapper that shrinks the map; convert it to a measured allowlist with a non-vacuity assertion rather than dropping it.
74. **MEDIUM — three green JS gates with no compile of the Android app.** `npm test`/`lint`/`typecheck` cannot see manifest or gradle breakage. `assembleDebug` can, and the toolchain is present.
75. **LOW — a throttle with a window but no cap.** A periodic diagnostic line with no end condition is log spam, not diagnosability.

### 0.5.11 Audit passes, revision 11

**Pass 1 — AC coverage.** Re-walked all 21 criteria against the revised plan. **Findings resolved:** AC8's four legs are now all *chosen* rather than one derived (§0.5.3) — the return control is visible, which removes the objection that killed the previous derivation. AC9's letter is now satisfied in **both** navigation states rather than one (§0.5.1), where the `display: 'none'` form violated "must keep an explicit `flex: 1`" precisely when the map was hidden. AC2's "builds" half moves from manual to automated (§0.5.6). AC3/AC9's "centered on Chicago" / "non-zero height" gain a real guard instead of a timing guess (§0.5.2). AC7 re-verified against the new return control: `Button` is label-only, no icon in its API.

**Pass 2 — Risk.** Re-walked every file against the new mechanism. **Findings resolved:** the retention guarantee is now scoped to the navigation round trip and the renderer-crash path is documented rather than silently contradicted (§0.5.4); the `opacity: 0` device unknown has a bounded, sanctioned remediation ladder that does not reopen the 0x0 class (§0.5.1); the padding allowlist keeps the regression guard (§0.5.5); the tile-error handler cannot become a permanent log loop (§0.5.7). `map.html` now takes **three** changes under six grep-pinned mechanisms — the invariants are restated per change. Multi-tenancy, N+1 and migrations re-checked: still not applicable (single-user device app, no backend, no schema, no persisted state); the nearest analogue to request amplification is OSM tile volume, and the capped throttle strictly reduces bridge traffic.

**Pass 3 — Scope.** **Removed this round:** the tap-active-tab toggle (now redundant — §0.5.3), and committing the study guide (§0.5.9). **Not added, though adjacent:** `accessibilityElementsHidden`/`importantForAccessibility` on the hidden WebView — a genuine limitation (an invisible WebView stays in the a11y tree) but a11y work was already ruled out of scope, so it is a stated limitation, not a change; a third `package.json` script for the gradle gate (AC21 licenses two keys); any map-view-state persistence; any `onRenderProcessGone` change. **Kept as AC-anchored:** the gradle gate (AC2's "builds" half), the init-view guard (AC3/AC9), the return `Button` (AC8's first leg), the padding allowlist (AC9).

All three passes are clean or resolved.

## 1. Domain and key files

From the TaskSpec (resolved by the Product Owner — not re-investigated).

| Path | Role |
| --- | --- |
| `/home/ivana/Desktop/Code/Cupboard/` | Target repo. One commit `1ef152e first commit`; remote `origin` → `https://github.com/IvaStevens/Cupboard.git` (fetch + push); tracked `README.md` (0 bytes); untracked `docs/`. **Re-verified today** |
| `README.md` | Empty tracked placeholder → replaced by the generated README, which then gains the Leaflet provenance section |
| `package.json` | Scaffold output; gains `react-native-webview` (exact) and `leaflet` (exact devDep). `bobuttons` `file:` specifier and `bobuttonsProvenance` left **unmodified** |
| `package-lock.json` | Diff read before committing |
| `vendor/bobuttons-<ver>.tgz` | Vendored tarball — moved in and **committed**, never gitignored |
| `.gitignore` | From the template's `_gitignore`, **renamed inside the generated directory before `rsync`** (§2.10a — the only gate-neutral place), **content unchanged**; **no new rules of any kind** |
| `App.tsx` | `SafeAreaProvider` → `BobuttonsProvider` → `StatusBar` → `AppContent` → `AppShell` (**`header` = `AppHeader`**, **`sidebar` = three-entry `Tabs`**, real `insets`) → **`ViewPane`** → map or placeholder. **SUPERSEDED (rev 8): revision 7's "no `header`" and "map directly under `AppShell`" are reversed — §0.2** |
| `src/map/` | `mapConstants.ts`, `mapInitScript.ts`, `MapScreen.tsx` |
| `android/app/src/main/assets/leaflet/` | `map.html`, `leaflet.js`, `leaflet.css`. **The directory is created by this ticket** — the template ships no `assets/` (§2.10c) |
| `android/app/src/main/AndroidManifest.xml` | **Byte-identical to the scaffold** |
| `android/app/build.gradle`, `android/build.gradle`, `android/gradle.properties` | **Read, never written** (`gradle.properties` is read for `newArchEnabled` — U6) |
| `tsconfig.json` | **Read, not edited.** It is the typecheck's configuration — see §2.5 |
| `__tests__/` | `App.test.tsx` (rewired), `map.test.tsx` (new), `dependencies.test.ts` (new) |
| `jest.config.js` | A `transformIgnorePatterns` **append** only, and only if proven necessary |
| `THIRD-PARTY-NOTICE.md` | Leaflet BSD-2-Clause entry (create with only that entry if the target ships none — U2) |

**Project scope honoured.** `/home/ivana/Desktop/Code/AppGenerator`, `/home/ivana/Desktop/Code/Bobuttons`, `/home/ivana/Desktop/Code/.claude` and `/home/ivana/Desktop/Code/tickets` were **not read**, including the `AppGenerator/templates/react-native-bobuttons/` path listed in the TaskSpec's `key_files` — the scope rule in the task overrides it. Consequence: **the real scaffold's file list, `App.tsx` shape, scripts and `tsconfig.json` are unverified here.** Everything marked *indicative* below comes from `@react-native-community/template@0.83.10` unpacked and installed in an isolated scratch directory (`/home/ivana/Desktop/Code/tmp/arch-cupboard1-rev6-probe`), which AppGenerator's target is presumed to derive from. U1–U3 and U9 are the mechanism for reconciling it at first contact. Likewise, `bobuttons`' own `.d.ts` files were not read — they arrive inside `node_modules` after `npm ci`, at which point they **are** in scope, and U10 governs.

### 1.1 Ten unknowns, each with a decision rule instead of an assumption

Resolved by the Developer **at first contact**, once the generated output is inside the Cupboard repo and therefore in scope. None changes the required outcome; several change the mechanism or the verification route.

- **U1 — vendored tarball path.** Read `package.json`'s `dependencies.bobuttons`; whatever `file:` path it names is the path to move in and commit. Do not rewrite the specifier. Confirm with `git check-ignore -v <path>`; if ignored, `git add -f` and say so in the PR — **never** add or edit an ignore rule.
- **U2 — `THIRD-PARTY-NOTICE.md`.** Ships one → **append** the Leaflet entry. Does not → **create** it with only the Leaflet entry.
- **U3 — generated `App.tsx` shape.** Read before editing. Keep `SafeAreaProvider` and `StatusBar` as generated **if present**; do not add them if absent. If the scaffold already renders a `BobuttonsProvider`, reuse it — **never add a second**. Change only what the map rewire requires.
- **U4 — lockfile presence.** `--no-install` may leave **no `package-lock.json`**, which breaks both `npm ci` and the clean-clone gate. Present → `npm ci`. Absent → regenerate in a **fresh** throwaway directory **without** `--no-install`, rsync in (still excluding `node_modules`), then `npm ci`. Never hand-write a lockfile.
- **U5 — release signing.** The offline check runs on the **release** variant. Read `android/app/build.gradle`'s `signingConfigs` and `buildTypes.release` **before** building. Pointing at the shared debug keystore → build and install as-is. Otherwise **do not edit the generated Gradle files**: try `./gradlew installRelease`; if that fails too, report OFFLINE / TILE-FAILURE BEHAVIOUR **blocked** with the exact Gradle error. The merged manifest is still readable from `android/app/build/intermediates/merged_manifests/release/` even when installation is impossible.
- **U6 — `newArchEnabled`.** Read `android/gradle.properties` **before** choosing the `react-native-webview` version. Full rule and verified mechanism in §5.8.
- **U7 — pristine baseline colour.** Measured green on the community template (§2.4) — but that is *indicative*. Re-measure `npm test`, `npm run lint` **and** `npx tsc --noEmit` on the untouched scaffold and record all three verbatim. Classification rule in §5.9.
- **U8 — bobuttons/Tamagui under Jest.** Unknown whether a real `BobuttonsProvider` renders under `react-test-renderer`. Remedy ladder in §5.7, which keeps the AC-bearing assertions independent of the answer.
- **U9 — what `npm run lint` reaches.** Measured on the community template: `eslint .` **does** lint `android/app/src/main/assets/leaflet/leaflet.js`, and the single `/* eslint-disable */` line is **necessary and sufficient** (§2.4). Re-confirm on the real scaffold; the AC pins the mechanism either way.
- **U10 — `AppShell`'s prop surface (new in rev 6).** Whether `header` is optional, what `insets` accepts, and whether `ViewBody` pads or scrolls. Resolved by reading `node_modules/bobuttons` **after `npm ci`** (its `.d.ts` plus the component source). `npx tsc --noEmit` is the enforcement: omitting a required prop is a type error, so the typecheck — not prose — decides. Rules in §5.3, including the **ordered `insets` ladder** whose last rung is a blocked report rather than an invented wrapper.

---

## 2. Measured facts

### 2.1 This host (all re-verified today)

**Repo.** `git log --oneline` → `1ef152e first commit` (one commit). `git branch -vv` → `* CUPBOARD-1-initialize-cupboard-android-app-with-chicago-map 1ef152e [origin/CUPBOARD-1-initialize-cupboard-android-app-with-chicago-map]` and `main 1ef152e [origin/main]`. `git ls-files` → `README.md` only, 0 bytes. `git status --porcelain` → `?? docs/`. Remote fetch **and** push → `https://github.com/IvaStevens/Cupboard.git`. **The branch the TaskSpec names is the branch already checked out** — no checkout, no rename, no second PR.

**Toolchain.** Node `v22.20.0` (≥ 22.12.0 ✓), npm `10.9.3`, OpenJDK `17.0.20.1` ✓. `ANDROID_HOME=/home/ivana/Android/Sdk`; **`ANDROID_SDK_ROOT` is empty/unset** — either is accepted by the RN CLI, so **make no environment change**.

**`cmdline-tools` does not exist** (`ls` → *No such file or directory*). There is **no `sdkmanager`**, so a missing SDK component cannot self-install and would fail with a confusing message. Hence the pre-check — which now **passes**:

| RN 0.83.10 asks for (`android/build.gradle`) | Installed under `/home/ivana/Android/Sdk` | |
| --- | --- | --- |
| `compileSdkVersion = 36`, `targetSdkVersion = 36` | `platforms/android-36` (also `android-37.0`) | ✓ |
| `buildToolsVersion = "36.0.0"` | `build-tools/36.0.0` (also `35.0.0`) | ✓ |
| `ndkVersion = "27.1.12297006"` | `ndk/27.1.12297006` — exact match | ✓ |
| `minSdkVersion = 24`, `kotlinVersion = "2.1.20"` | n/a (not SDK components) | — |
| `platform-tools/adb` | present | ✓ |

Indicative, not authoritative: if the bobuttons target pins different versions, re-run this comparison **before** the first Gradle build. A mismatch is a **blocked** report, not an SDK edit.

**Emulator.** `emulator -list-avds` → exactly one line, `Medium_Phone_API_37.0`. `adb devices` → empty (nothing attached right now). **Create no AVD, change no AVD config.**

**Tools for the gates:** `/usr/bin/unzip`, `/usr/bin/zipinfo`, `/usr/bin/python3`, `/usr/bin/rsync`, `sha256sum`, `tail`.

### 2.2 Leaflet 1.9.4 (digests re-verified today)

`npm pack leaflet@1.9.4` into an isolated empty directory:

- `dist/leaflet.js` → `db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a` ✓ matches the AC
- `dist/leaflet.css` → `a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6` ✓ matches the AC
- `package.json` `license` → `BSD-2-Clause`; `LICENSE` → "BSD 2-Clause License, Copyright (c) 2010-2023, Volodymyr Agafonkin"
- With `/* eslint-disable */` prepended, `tail -n +2 leaflet.js | sha256sum` → `db49d009…641a` — **reproduced byte-exactly today**. The AC's digest mechanism works as written.

`dist/images/*` are deliberately **not** vendored: `leaflet.css` references them only via `.leaflet-control-layers-toggle` (a layers control never added) and `.leaflet-default-icon-path` (read only when a default marker icon is instantiated — markers are out of scope). A 404 for one of them would be a *signal* that out-of-scope UI crept in.

### 2.3 `react-native-webview` — re-verified on disk at 14.0.1

**(a) 14.0.1 supports the New Architecture.** `codegenConfig` = `{ name: 'RNCWebViewSpec', type: 'all', jsSrcsDir: './src', android: { javaPackageName: 'com.reactnativecommunity.webview' } }`, and `android/build.gradle` carries both `src/newarch` and `src/oldarch` source sets. The stale `new-arch` dist-tag (`12.0.0-rc.2`) is **not** evidence to the contrary.

**(b) The source set is chosen by a Gradle property, and the choice is silent.** `android/build.gradle:39` — verbatim:

```
def isNewArchitectureEnabled() {
    return project.hasProperty("newArchEnabled") && project.newArchEnabled == "true"
}
```

then `java.srcDirs += ['src/newarch']` (line 87) or `+= ['src/oldarch']` (line 89). Meanwhile `@react-native/gradle-plugin@0.83.10` warns that `newArchEnabled=false` "is not supported anymore since React Native 0.82 … The application will run with the New Architecture enabled by default." So **on RN 0.83 the runtime is always Fabric**, while 14.0.1 compiles the **legacy** ViewManager unless the property is literally present and `"true"`. That combination compiles cleanly and fails at runtime. Hence U6 and the runtime fallback trigger in §5.8. The RN 0.83.10 template ships `newArchEnabled=true` (verified in its `android/gradle.properties`), so the expected path is the good one.

**(c) The 16.0.0 fallback cannot fix an AGP-classpath failure.** Both versions contain `classpath("com.android.tools.build:gradle:7.0.4")` hardcoded at `android/build.gradle:13`, not routed through `safeExtGet`, so it cannot be overridden from the root project. The template root, by contrast, declares `classpath("com.android.tools.build:gradle")` with **no version** (version supplied by the RN settings plugin). The AC's phrasing ("fails on its legacy AGP classpath **or** new-arch codegen → fall back to 16.0.0") is therefore only correct for the second half. In practice a subproject buildscript classpath resolves in a child classloader below the root's AGP and this is usually harmless; the point is that **if it does bite, the fallback is not the remedy** and both patching the library and editing Gradle files are forbidden — so the outcome is a blocked report quoting the exact Gradle error.

**Other re-verified details (14.0.1).** Runtime deps exactly `invariant@2.2.4` and `escape-string-regexp@^4.0.0` → expected `package-lock.json` additions are **`react-native-webview`, `leaflet`, `invariant`, `escape-string-regexp` and nothing else**. Peers `react: *`, `react-native: *` → no conflict with RN 0.83.10. Its own `android/gradle.properties` ships `ReactNativeWebView_webkitVersion=1.14.0` (plus `kotlinVersion=1.6.0`, `compileSdkVersion=31`, `targetSdkVersion=31`, `minSdkVersion=24`, the first three overridden by the template root), so **no root `build.gradle` edit and no `ext.webkitVersion` are needed**.

**`main: index.js`, first line `import WebView from './lib/WebView';` — ESM.** The react-native Jest preset's `transformIgnorePatterns` does not whitelist `react-native-webview` (its lookahead matches `react-native/`, not `react-native-webview/`), so an unmocked import is a `SyntaxError`. **The mock is mandatory in every test file that reaches it.**

**Props confirmed present in `src/WebViewTypes.ts`:** `onLoadSubResourceError` (line 1171; native event `onLoadingSubResourceError` at `RNCWebViewNativeComponent.ts:249`) — the only native signal for a failed **subresource**, i.e. a missing `leaflet.js`/`leaflet.css`, which `onError` (main frame only) does not report. Also `onError`, `onHttpError`, `onRenderProcessGone`, `onShouldStartLoadWithRequest`, `originWhitelist`, `setBuiltInZoomControls`, `setDisplayZoomControls`, `allowFileAccess`, `mixedContentMode`. 16.0.0 ships `SubResourceErrorEvent` too, but **re-verify the JS prop name** if the fallback is taken.

### 2.4 The pristine baseline and the vendored-lint line — now measured, not assumed

Measured on `@react-native-community/template@0.83.10`, installed clean (`npm install`, exit 0). **Indicative for the bobuttons target; re-measure there.**

| Command | Pristine result |
| --- | --- |
| `npm test` | **exit 0** — `PASS __tests__/App.test.tsx`, 1 test |
| `npm run lint` (`eslint .`) | **exit 0**, no output |
| `npx tsc --noEmit` | **exit 0** |

**The template ships no `typecheck` script** (`scripts` = `android`, `ios`, `lint`, `start`, `test`). So the TYPES GREEN gate is `npx tsc --noEmit`, exactly as the AC's first alternative says. Re-read the real scaffold's `scripts` and prefer a `typecheck` script if it ships one.

**U9 settled.** With Leaflet's `dist/` copied to `android/app/src/main/assets/leaflet/`:

- **Without** the disable line: `npm run lint` → **exit 1**, `2654 problems (12 errors, 2642 warnings)` in `leaflet.js`. Revision 3's "12 errors" is reproduced on the real RN 0.83 config.
- **With** one prepended `/* eslint-disable */`: `npm run lint` → **exit 0**, exactly `1 problem (0 errors, 1 warning)` — `eslint-comments/no-unlimited-disable`. Plain `eslint .` has no `--max-warnings`, so the warning does not fail the script. **Do not "fix" that warning.**
- `npx tsc --noEmit` is **unaffected**: `@react-native/typescript-config` sets `allowJs: true`, but the template's `tsconfig.json` sets `include: ["**/*.ts", "**/*.tsx"]`, so a `.js` asset is never in the program. If the real scaffold's `tsconfig.json` has a broader `include`, re-check this one line.
- `map.html` is not linted or type-checked (neither tool matches `.html`).

So the AC-pinned mechanism is proven **necessary and sufficient**, and the README reproduction command, §5.6's digest test and the notice all stay on the `tail -n +2` form.

### 2.5 The typecheck falsifies two of revision 5's mechanisms (HIGH — new in rev 6)

`tsconfig.json` is `{ extends: '@react-native/typescript-config', compilerOptions: { types: ['jest'] }, include: ['**/*.ts','**/*.tsx'], exclude: ['**/node_modules','**/Pods'] }`, and the base config sets `strict: true`, `moduleResolution: 'bundler'`, `isolatedModules: true`, `jsx: 'react-native'`, `allowJs: true`, `skipLibCheck: true`, `esModuleInterop: true`.

**Finding A — Node built-ins do not type-check.** `compilerOptions.types: ['jest']` means `@types/node` is **not** added to the program, even though it is installed transitively (jest depends on it; `node_modules/@types/node` is present). Measured, on a test file importing `fs`/`path`/`crypto`/`child_process`:

```
error TS2307: Cannot find module 'fs' or its corresponding type declarations.
error TS2307: Cannot find module 'path' …
error TS2307: Cannot find module 'crypto' …
error TS2307: Cannot find module 'child_process' …
error TS2304: Cannot find name '__dirname'.
```

`tsc` exit **2**. The digest/asset-existence assertions (§5.6) and the `npm ls` dependency guard (§5.13) all need those modules, so **as revision 5 wrote them, they would fail TYPES GREEN.**

**Pinned remedy, measured:** a single first line in each test file that uses a Node built-in —

```
/// <reference types="node" />
```

With it, the same file gives `tsc --noEmit` **exit 0** *and* `eslint` **exit 0** (the `@typescript-eslint/triple-slash-reference` rule is not triggered for a `types` reference under `@react-native/eslint-config`). One line, in a file this ticket owns, **no `tsconfig.json` edit, no Jest/ESLint config change, no new dependency.** Fallback only if `@types/node` is absent from the installed tree: add `@types/node` as a devDependency and say so in the PR.

**Finding B — `root.findByType('WebView')` is a type error.** That is the exact API revision 5 §5.7 pinned. Measured:

```
error TS2345: Argument of type '"WebView"' is not assignable to parameter of type 'ElementType'.
```

`findByType(type: ElementType)` (`@types/react-test-renderer@19.1.0`), and `React.ElementType` admits only `keyof JSX.IntrinsicElements | ComponentType` — and an RN project has no `WebView` intrinsic element.

**Pinned remedy, measured:** import the symbol and pass **the reference**, not a string:

```ts
import { WebView } from 'react-native-webview';   // the jest.mock replaces this binding at runtime
…
const webView = tree.root.findByType(WebView);
```

`tsc` sees the real component type (a valid `ElementType`); Jest sees the mock. This works whether the mock factory returns a function component or the string `'WebView'`, because the imported *binding* is whatever the factory produced. **Pin the function-component form** (`const MockWebView = (_p: unknown) => null`) so props stay inspectable and no host-config assumption is made. Measured clean under `tsc`: `findByType(MockComponent)` on a composite, `.props.source.uri`, `StyleSheet.flatten(node.props.style)`, the `instance.parent` walk typed as `ReactTestRenderer.ReactTestInstance | null`, and `catch (e) { out = (e as { stdout?: string }).stdout ?? '' }` for the `npm ls` capture.

**Finding C — `strict: true` applies to test code.** No implicit `any`. The ancestor walk, the `npm ls` JSON walk and the mock factories all need explicit parameter types. Budget for it; it is not a defect.

### 2.6 Safe area: the template already has the shape, and the real provider renders nothing under Jest

The RN 0.83.10 template's `App.tsx` is, verbatim in structure:

```tsx
function App() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}
function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  return <View style={styles.container}><NewAppScreen … safeAreaInsets={safeAreaInsets} /></View>;
}
```

So SAFE AREA WIRED is a **near drop-in**: the hook call and the inner component already exist, correctly placed below the provider. The rewire replaces `NewAppScreen` with `AppShell insets={safeAreaInsets}` → map. No new dependency (`react-native-safe-area-context@^5.5.2` is already a template dependency), and `useSafeAreaInsets` must stay **inside** `SafeAreaProvider` or it throws.

**`SafeAreaProvider` renders null children under Jest — measured, not inferred.** `src/SafeAreaContext.tsx` renders `{insets != null ? (<Provider>{children}</Provider>) : null}`, and under Jest there is no native insets event and no `initialMetrics`. A probe rendering `SafeAreaProvider > Inner > Text` found **0** `Text` nodes. This is why the template's own `__tests__/App.test.tsx` wraps `create(<App />)` in `act()` and asserts nothing.

Two consequences, both load-bearing:

1. The AC-bearing props/injection assertions must render **`MapScreen`**, not `App` — which is what VIEW CONSTANTS ARE ACTUALLY CONSUMED asks for ("renders the map screen"). An `App`-level version would find no `WebView` and could only pass vacuously.
2. The **ancestor** test needs the chrome rendered, so it needs the provider neutralised. **Measured remedy:** a test-file-local inline mock —

```ts
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }) };
});
```

A probe with this mock rendered the child and returned `top = 24`; `tsc --noEmit` exit 0; `eslint` exit 0. `requireActual` loads the compiled `lib/commonjs/index.js`, so **no transform and no Jest config change**. Do **not** use `react-native-safe-area-context/jest/mock`: it ships as uncompiled TSX (`lib/` holds only `lib/typescript/jest/mock.d.ts`) and would need a third `transformIgnorePatterns` entry the AC does not sanction.

**Why the insets are not decorative.** The template's `android/gradle.properties` has `edgeToEdgeEnabled=false`, but `targetSdkVersion = 36`: on Android 15+ (API 35+) the platform draws apps edge-to-edge for `targetSdk ≥ 35` regardless of that flag, and the device here is **API 37**. So content *will* sit under the status and navigation bars unless real insets are applied — SAFE AREA WIRED is a real requirement with a real failure mode, verified on the screenshot. If the screenshot still shows content under the bars *after* insets are passed, the cause is `AppShell`'s handling of them: **report it, do not edit `gradle.properties`** (forbidden).

### 2.7 RN 0.83 template shape (indicative only — re-verify against the bobuttons target)

- `scripts`: `android`, `ios`, `lint: "eslint ."`, `start`, `test: "jest"`. **No `typecheck`.** `engines.node: ">=20"`.
- `jest.config.js` = `{ preset: 'react-native' }` — nothing else.
- Lint config is the legacy `_eslintrc.js` → `{ root: true, extends: '@react-native' }` with `eslint@^8.19.0`. `eslint .` walks the whole cwd and default-ignores only `node_modules/**` and dotfiles — which is why §2.4's vendored-asset measurement applies.
- `react-test-renderer@19.2.0`, `@types/react-test-renderer@^19.1.0`, `@types/jest@^29.5.13`, `typescript@^5.8.3` are devDependencies. **Do not add `@testing-library/react-native`.**
- Dependencies: `react@19.2.0`, `react-native@0.83.10`, `@react-native/new-app-screen@0.83.10`, `react-native-safe-area-context@^5.5.2`.
- `android/gradle.properties`: `newArchEnabled=true`, `hermesEnabled=true`, `edgeToEdgeEnabled=false`, `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`, `android.useAndroidX=true`.
- File count (no `node_modules`): **52** — 26 under `android/`, 10 under `ios/`, 14 at the root, plus `__tests__/App.test.tsx`. The bobuttons target will differ (at minimum it adds `vendor/`); treat 52 as an order-of-magnitude figure only.
- Dotfile-prefixed template files arrive as `_gitignore`, `_eslintrc.js`, `_prettierrc.js`, `_watchmanconfig`, `_bundle/config`; the generator is expected to rename them. If any arrive still prefixed, that is a generator defect — **report it, and rename it inside the throwaway generated directory before `rsync`** (§2.10), which is the only place a rename is gate-neutral. Renaming is not inventing content; **inventing new config content is still forbidden.**
- `android/app/src/main/` contains exactly `AndroidManifest.xml`, `java/` and `res/` — **no `assets/` directory** (§2.10).
- Published template root listing, confirmed today: `android`, `app.json`, `App.tsx`, `babel.config.js`, `_bundle`, `_eslintrc.js`, `Gemfile`, `_gitignore`, `index.js`, `ios`, `jest.config.js`, `metro.config.js`, `package.json`, `_prettierrc.js`, `README.md`, `__tests__`, `tsconfig.json`, `_watchmanconfig`. **Five underscore-prefixed entries**, so the rename question in §2.10 is live rather than hypothetical.

### 2.8 Logcat has two channels and only one survives release (HIGH — new in rev 7)

The single diagnostic command `adb logcat -d | grep CupboardMap` is quoted in the PR, and OFFLINE / TILE-FAILURE BEHAVIOUR is verified **only** on the release variant. So "does logging work in release?" is load-bearing. Measured, in two places, with opposite answers.

**(a) JS-side `console.*` DOES reach release logcat.** `@react-native/js-polyfills@0.83.10/console.js:574` — the console that forwards to native is installed under a check on the *hook*, not on `__DEV__`:

```js
if (global.nativeLoggingHook) {
  const originalConsole = global.console;
  if (__DEV__ && originalConsole) { … }   // only preserves the original
  global.console = { … }                  // every method calls nativeLoggingHook
```

`global.nativeLoggingHook(str, logLevel)` is called at lines 427, 482, 537, 552–568. `react-native/rn-get-polyfills.js` resolves to `@react-native/js-polyfills`, whose `index.js` unconditionally returns `console.js` + `error-guard.js`, so the polyfill is in **both** bundles. And `@react-native/babel-preset@0.83.10` contains **no** console-stripping transform (the only `NODE_ENV`/`BABEL_ENV` reference is `src/configs/main.js:296`). On Android `nativeLoggingHook` writes to logcat under the tag **`ReactNativeJS`**; our `[CupboardMap]` prefix lives in the *message*, so the grep matches regardless of tag.

**(b) In-page `console.*` inside `map.html` is SWALLOWED in release.** `react-native-webview@14.0.1`, `android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java:114–121`, verbatim:

```java
@Override
public boolean onConsoleMessage(ConsoleMessage message) {
    if (ReactBuildConfig.DEBUG) {
        return super.onConsoleMessage(message);
    }
    // Ignore console logs in non debug builds.
    return true;
}
```

Returning `true` means "handled", so Android's default logcat write never happens. The library deliberately drops page console output in non-debug builds.

**(c) The bridge is always there, and even a disabled bridge is not silent.** Measured in `RNCWebView.java`: `JAVASCRIPT_INTERFACE = "ReactNativeWebView"` (`:56`) is attached with `addJavascriptInterface(fallbackBridge, JAVASCRIPT_INTERFACE)` (`:269`) **unconditionally** — a fallback bridge exists even before messaging is enabled. And if `postMessage` is called while messaging is off, the library writes a **native** log line (`:451`):

```
FLog.w(TAG, "ReactNativeWebView.postMessage method was called but messaging is disabled. Pass an onMessage handler to the WebView.");
```

Native `FLog` is not routed through the JS console, so that warning reaches logcat in **both** variants. Since this plan does pass `onMessage`, messaging is enabled anyway. Two consequences: the `typeof` guard is **defensive**, not load-bearing (its real job is to stop a throw inside `window.onerror` from swallowing the error being reported); and **no exotic page→native fallback is needed or available** — see §5.5 for the `document.title` idea that measurement killed.

**Consequences, all load-bearing:**

1. Every in-page signal must leave the document through `window.ReactNativeWebView.postMessage` → `onMessage` → **one JS `console.warn`**. That path is release-visible by (a).
2. An in-page `console.error` is **debug-only evidence**. It may be kept as a secondary aid but must never be the only channel for anything — which is exactly what revision 6's `post()` fallback would have been.
3. The native callbacks (`onError`, `onHttpError`, `onLoadSubResourceError`, `onRenderProcessGone`) are **JS** callbacks, so they log through (a) and are release-visible. Good.
4. Verify once, early, on the release build: `adb logcat -d | grep -E 'ReactNativeJS|CupboardMap'` after launch. If (a) somehow does not hold on this host, say so plainly in the PR and label the tagged lines debug-only — do not quietly let the offline leg rest on a channel that is not there.

### 2.9 Gesture ownership on Android: the prop everyone reaches for does not exist (HIGH — new in rev 7)

PAN, ZOOM AND GESTURE OWNERSHIP is about the WebView's **own** scroll behaviour, which revision 6 addressed only for *ancestors*. Measured in `react-native-webview@14.0.1`:

| Prop | Finding |
| --- | --- |
| `scrollEnabled` | Declared **only** in `MacOSNativeWebViewProps` (`WebViewTypes.ts:344`), `IOSWebViewProps` (`:415`), `MacOSWebViewProps` (`:802`). **Absent** from `AndroidWebViewProps` (`:949`) and `WebViewSharedProps` (`:1174`), and `grep -rn setScrollEnabled android/src/main/java` finds **nothing**. ⇒ **not the Android remedy**; passing it is at best a no-op |
| `nestedScrollEnabled` | **Already defaults to `false`** — `RNCWebView.java:79` and `WebView.android.tsx:77`. The default is the value we want ⇒ **do not pass it** (same rule as the file-access props) |
| `overScrollMode` | Defaults to `'always'` (`WebView.android.tsx:64`; doc `WebViewTypes.ts:986`) |

**So the pan fix lives in `map.html`** — a file this ticket owns, needing no prop and no generated-file edit:

```css
html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
#map { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
```

plus `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`. A document that is exactly the viewport **has nothing to scroll**, so the WebView never begins a page scroll, and Leaflet — which calls `preventDefault` on drags inside the map pane — owns the gesture. `maximum-scale=1` with `user-scalable=no` is what stops Android turning a pinch into a *page* zoom that fights Leaflet and scales the controls.

`overScrollMode="never"` is held **in reserve** as an on-device-only remedy if a drag shows an overscroll glow or drops mid-gesture. It is a library prop, not a generated-file edit, so taking it is cheap — but it is not pinned up front, because with `overflow: hidden` there should be nothing to overscroll.

### 2.10 Three move-in mechanics, measured instead of reasoned (new in rev 7)

**(a) The `_gitignore` rename must happen on the GENERATED side.** Revision 6 was self-contradictory here: it both planned the rename and promised a clean `diff -r`. Measured in a two-directory probe:

| Arrangement | `diff -r -x .git -x node_modules -x docs gen repo` |
| --- | --- |
| `gen/_gitignore` + `repo/.gitignore` (rename on the repo side) | `Only in repo: .gitignore` / `Only in gen: _gitignore`, **exit 1** |
| `gen/.gitignore` + `repo/.gitignore` (rename in the gen dir first) | empty, **exit 0** |

`diff -r` does traverse dotfiles, and `-x` matches basenames. ⇒ **If the generator emits `_gitignore`, rename it inside the throwaway generated directory, before `rsync` and before the gate.** Then the repo and the generated tree agree and the gate is satisfiable as written. If the generator already emits `.gitignore`, there is nothing to do — **check which, do not assume.** Either way the content is the template's, with no added rules.

**(b) `git check-ignore` polarity, both directions, measured in a throwaway repo.**

| Command | No `.gitignore` | With `node_modules` listed |
| --- | --- | --- |
| `git check-ignore -q node_modules` | exit **1** (not ignored) | exit **0** (ignored) |

So the `node_modules` gate passes on **exit 0**, and the `vendor/*.tgz` gate passes on **exit 1**. Same command, opposite polarity, in the same run — label each at its call site and never chain either with `&&` or under `set -e`.

**(c) The template ships no `assets` directory.** `android/app/src/main/` contains exactly `AndroidManifest.xml`, `java/` and `res/`. ⇒ `mkdir -p android/app/src/main/assets/leaflet` is a real step. (It is also why the APK-content gate matters: `src/main/assets` is AGP's default asset dir and is *merged* with the RN plugin's generated bundle dir, but that only helps if the directory exists in the first place.)

### 2.11 The emulator can be launched from this shell (new in rev 7)

Six criteria depend on `Medium_Phone_API_37.0` and `adb devices` is currently empty, so "can this shell start it?" was pre-checked rather than assumed:

- `DISPLAY=:0`, `XDG_SESSION_TYPE=wayland`, `WAYLAND_DISPLAY=wayland-0` ⇒ a **windowed** emulator is possible.
- `/dev/kvm` is `crw-rw----+ 1 root kvm` and the user is **not** in the `kvm` group — but the `+` is an ACL, and `getfacl` shows `user:ivana:rw-`; a direct read/write test confirms access. ⇒ **hardware acceleration is available with no group change and no `sudo`.**
- The binary is at `/home/ivana/Android/Sdk/emulator/emulator` and is **not on `PATH`** — invoke it by absolute path. `emulator -list-avds` → exactly `Medium_Phone_API_37.0`.

Launch, boot-wait and the blocked trigger are pinned in §5.14. This pre-check exists so "no device" is distinguishable from "device launch never attempted" — the latter is what makes a Tier A report dishonest.

---

## 3. Anti-pattern findings the implementation must not replicate

The configured analysis skill resolved to an **empty name** in this invocation (`/home/ivana/.claude/skills` provides `dev-workflow`, `new-ticket` and synced document skills — no anti-pattern analyser), and the project-scope rule bars reading `/home/ivana/Desktop/Code/.claude` where a workflow-local skill would live. The equivalent domain-scoped analysis was therefore performed directly, and several findings below are backed by measurements taken today rather than by pattern matching.

### HIGH — would destroy work or silently defeat a criterion

1. **`rsync --delete`, `git init`, `git commit --amend`, rebase or force-push.** The only irreversible class of step in the ticket. `--delete` removes `docs/`; `git init` orphans `1ef152e` and the remote. The history gate runs *before* the first commit for exactly this reason.
2. **"Fixing" the tree gate by deleting `docs/`.** The gate carries `-x docs` and then succeeds with empty output. Drop `-x docs` and it prints `Only in <repo>: docs` — a **correct** line that must never be "fixed" by deletion or `--delete`.
3. **Generating into the live repo.** The generator refuses a non-empty target, and the tracked `README.md` makes `Cupboard` non-empty. Forcing past it would overwrite a human's file. Generate into a throwaway directory, then move in.
4. **Creating a second branch or a second PR.** The named branch already exists and is checked out (§2.1). A "nicer" slug produces a duplicate branch and a duplicate PR.
5. ~~**Putting an app name, title or date in the header.**~~ **SUPERSEDED (rev 8).** The header is now required: `AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago"` in the `header` slot (§0.2). Still true, and still the reason no Bobuttons edit is needed: `title` is required and the date is library-rendered — both are accepted as-is. Measured in rev 8: on a phone the date is not rendered at all.
6. **A green suite over a map that never initialises.** A constants-equal-literals assertion proves nothing about what the WebView received. The props/injection assertion under a WebView mock is mandatory.
7. **A silent white screen with nothing in logcat.** `injectedJavaScript` runs from `onPageFinished` and is skipped when the load failed; `onRenderProcessGone` must return `true` (returning `false` crashes the app) and leaves a blank WebView that nothing reloads. Both need the layered failure path.
8. **Assuming the four obvious callbacks cover a missing asset.** If `leaflet.js`/`leaflet.css` are absent from the APK the document still loads: `onError` (main frame only), `onHttpError` (HTTP status codes; `file://` has none) and `onRenderProcessGone` all stay silent, `window.initLeafletMap` may be defined while `L` is `undefined` → white screen, empty logcat. Needs §5.5's layering, including `onLoadSubResourceError`.
9. **Letting `react-native-webview` compile its legacy source set.** On RN 0.83 the runtime is Fabric regardless of the property, but 14.0.1 picks `src/oldarch` unless `newArchEnabled` is literally present and `"true"` (§2.3b). Compiles clean, fails at runtime.
10. **Verifying the offline behaviour on a debug APK.** A debug APK embeds no JS bundle, so killing the network yields exactly the white screen the criterion forbids — a false negative. Verify on the **release** variant. **Never** hand-bundle `index.android.bundle`.
11. **An ancestor test that cannot see the real tree.** Rendering `App` through the real `SafeAreaProvider` yields **zero** children (§2.6, measured), so a naive ancestor test finds no `WebView` and either errors or passes vacuously while the gesture is still eaten on device.
12. **NEW — writing the tests the way revision 5 specified.** `findByType('WebView')` and bare `import fs from 'fs'` both **fail `tsc --noEmit`** (§2.5, measured). Use the component reference and the `/// <reference types="node" />` line.
13. **Touching AppGenerator or Bobuttons.** Invoke the generator by absolute path from a cwd outside it. Never `cd` into it, never install in it, never regenerate its generated-output pin test.

### MEDIUM — would violate a pinned constraint

14. **Editing the generated Android project.** Autolinking handles `react-native-webview`: no `MainApplication.kt` registration, no `AndroidManifest.xml` edit, no `android/app/build.gradle`, root `build.gradle` or **`gradle.properties`** edit. `gradle.properties` is *read* for U6 and never written; if `newArchEnabled` is wrong, the remedy is the version choice or a blocked report, not the file.
15. **Loosening WebView security to make `file://` work.** `allowFileAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs` and `mixedContentMode` are **not passed at all**. `file:///android_asset` is exempt from `allowFileAccess`, and HTTPS tiles fetched as `<img>` subresources from a `file://` document are **not** mixed content.
16. **`source={{ html }}` instead of a URI.** An inline document has no real base URL, so relative `<script src="leaflet.js">` / `<link href="leaflet.css">` cannot resolve.
17. **Duplicating the map parameters into `map.html`.** Coordinates, zoom, tile URL and attribution live in **one** TypeScript module and reach the page via `injectedJavaScript`. An HTML copy lets the test pass while the map shows something else.
18. **CDN-loading Leaflet**, and **native map SDKs** (`react-native-maps`, MapLibre, Google Maps SDK) — out of scope, and both defeat the pinned mechanism.
19. **Fixing lint by configuration.** No `.eslintignore`, no `ignorePatterns`, no `.prettierignore`. The fix is the one prepended `/* eslint-disable */` line, now **measured** sufficient (§2.4).
20. **Editing `tsconfig.json` to make the typecheck pass.** The `/// <reference types="node" />` line lives in files this ticket owns; `tsconfig.json` is scaffold configuration and stays as generated.
21. **Adding `.gitignore` rules**, including anything that would exclude `vendor/` or `*.tgz`.
22. **A second UI library, or a direct `@tamagui/*` dependency** (icon packages included). bobuttons bundles its own Tamagui; a second copy causes the "can't find Tamagui configuration" crash. Also no `react-dom` / `react-native-web` anywhere in the installed tree — and because `react-dom` is an **optional peer** of bobuttons, this must be *verified* against the installed tree, not asserted.
23. **Icon-dependent bobuttons usage.** bobuttons ships **no icons**, so `Icon`, `TabBar` and `TessellatedBackground` are not used at all, and `SquareGrid` — if used — carries no icon cells.
24. **Hand-editing `app.json`'s `name`, `strings.xml`, `applicationId` or `MainActivity`.** `app.json`'s `name` is bound to `AppRegistry.registerComponent` and `MainActivity.getMainComponentName()`; editing it breaks the launch. A capitalized launcher label is explicitly out of scope.
25. **Trusting an `npm install` lockfile diff.** `npm install <pkg>` can rewrite unrelated entries. Read the diff; expect only the four packages in §2.3.
26. **Letting Android steal the pinch.** `setBuiltInZoomControls` defaults to `true`, so a pinch becomes a *page* zoom that fights Leaflet and scales the controls. Needs the prop **and** the `user-scalable=no` viewport meta.
27. **Putting the WebView inside a padding or scrolling container.** A scroll ancestor eats the drag. Hence the arrangement rule and the ancestor test.
28. **A permissive `originWhitelist`.** The default `['http://*','https://*']` turns the visible OSM attribution link into a one-way trip with no back affordance in a single-screen app (and the hardware back button deliberately exits — BACK BUTTON). Use `['file://*']` plus `onShouldStartLoadWithRequest`. These gate *top-level navigations*, not subresources, so tiles are unaffected.
29. **Provenance that lives only in prose.** Two SHA-256 digests in `README.md`/`THIRD-PARTY-NOTICE.md`, verifiable only by a hand-run command, rot the first time someone touches the vendored file. A committed digest assertion costs four lines (§5.6).
30. ~~**Adding custom back handling.** No `BackHandler`, no WebView `goBack`.~~ **SUPERSEDED (rev 8).** AC BACK NAVIGATION now requires a `BackHandler` listener: from a placeholder, back returns to the map and consumes the event; on the map the app does not consume it (system default — it exits). No WebView `goBack` — that part stands (§0.2.3).

### HIGH — added in revision 7, each one measured

31. **Renaming `_gitignore` on the repo side.** It makes the tree gate exit **1** with two `Only in` lines (§2.10a, measured). The danger is not the exit code — it is that the obvious "fix" is to weaken the gate or delete a file. Rename inside the **generated** directory, before `rsync`.
32. **`git add -A` before proving `node_modules` is ignored.** If the dotfile arrived underscore-prefixed — a case this plan explicitly anticipates — and `npm ci` has already run, one `git add -A` commits tens of thousands of files. Two independent guards: commit the scaffold **before `npm ci` ever runs** (§5.11), and gate every `git add -A` on `git check-ignore -q node_modules` returning **exit 0** (§2.10b).
33. **Relying on in-page `console.*` for release diagnostics.** The library's own chrome client returns `true` from `onConsoleMessage` in non-debug builds, so the message never reaches logcat (§2.8b, verbatim source). Everything in-page must exit via `postMessage`. Getting this wrong leaves the **offline leg** — the one verified only on release — with no diagnostic channel at all.
34. **Reaching for `scrollEnabled` to fix the pan.** It is not an Android prop (§2.9, measured). Writing it produces a reassuring diff that changes nothing, and the drag stays eaten. The fix is page sizing in `map.html`.

### MEDIUM — added in revision 7

35. **An unguarded `window.ReactNativeWebView.postMessage`.** If the bridge is absent or the handler throws, the error is swallowed — precisely what DIAGNOSABLE FAILURE PATH forbids. Needs the `typeof` guard **and** a release-visible fallback (§5.5).
36. **Deleting the throwaway generated directory before the tree-gate output is captured.** The `diff -r` criterion is satisfiable only in a narrow window and its output must be quoted in the PR. Lose the directory and the evidence is unreproducible (§5.1).
37. **Asserting `injectedJavaScript` merely *contains* `12`.** A bare `12` matches incidental text and is close to the tautology VIEW CONSTANTS ARE ACTUALLY CONSUMED explicitly rejects. Parse the emitted call's JSON argument (§5.7).
38. **Exact-equality URL gating in `onShouldStartLoadWithRequest`.** Brittle against normalisation and against the post-`onRenderProcessGone` remount. Use a prefix match on the asset directory (§5.4).
39. **`execSync` without `maxBuffer` for `npm ls --json --all`.** Measured: **351,893 bytes** on a *bare* RN template tree, and Cupboard adds bobuttons + Tamagui on top. Node's 1 MB default is within one multiple of that floor, and an `ENOBUFS` truncation lands in the `catch` branch as a *partial* JSON string — a confusing parse error, or worse a silently weakened guard (§5.13).
40. **Running the ancestor padding assertion at non-zero insets.** SAFE AREA WIRED puts real insets into `AppShell`; if `AppShell` renders them as padding, a padding-forbidding ancestor walk fails — making two criteria mutually unsatisfiable. Render that block at **zero** stub insets so non-zero padding is attributable to layout (§5.7). Revision 6 missed this.

### Not applicable — stated so the absence is not read as an omission

Multi-tenancy, N+1 queries and database migrations have **no surface here**: a single-user device app, no backend, no schema, no persisted state, no user data, no tenant identifier anywhere in the design. The nearest analogue to request amplification is OSM tile volume, bounded by `maxZoom 19`, Leaflet's default `keepBuffer`, the WebView's default HTTP cache (`cacheEnabled` defaults true, which *reduces* repeat requests) and no prefetching.

---

## 4. Shared services and blast radius

| Surface | Risk | Guard |
| --- | --- | --- |
| `AppGenerator` (incl. its generated-output pin test) | A stray install or template edit breaks a merged ticket's guarantee | Absolute-path invocation from a cwd outside it; `git -C … status --porcelain` empty **before and after** |
| `Bobuttons` | Nothing here needs to modify it; it arrives as a vendored tarball | Never `cd`-ed into or edited; clean `git status` at the end |
| Cupboard's commit `1ef152e` + GitHub remote | A human author's history and the repo link | No `git init`, amend, rebase, force-push or remote change; ancestry + `git remote -v` checked before the first commit |
| Cupboard's branch (already on `origin`) | A renamed/duplicated branch means a duplicate PR | Stay on the checked-out branch; one PR against `main` |
| Cupboard's untracked `docs/` | Deleted by a careless gate "fix" | `-x docs` on the tree gate; **committed first, in commit 0** (§5.11), so it is never in unstaged limbo |
| Shared `~/.gradle` cache | A killed first build leaves a half-populated cache used by **every** project on this host | §5.15: run it detached, do not interrupt, never `rm -rf ~/.gradle` |
| The single AVD `Medium_Phone_API_37.0` | Also the only emulator for every other project here | Boot, verify, shut down cleanly; create no AVD, change no config |
| Android SDK at `/home/ivana/Android/Sdk` | **No `cmdline-tools`** → no `sdkmanager`, so a missing component cannot self-install | §2.1's pre-check table — which currently passes; re-run it if the target pins other versions |
| `/home/ivana/Desktop/Code/tmp` | Shared scratch space | Use a uniquely named subdirectory; the throwaway generation dir is not a deliverable |

---

## 5. Approach and rationale

### 5.1 Generate-then-move (and why there is no alternative)

The generator rejects uppercase app names and refuses a non-empty target. `Cupboard` fails both. So: generate `cupboard` with the **`react-native-bobuttons`** target into a throwaway directory under `/home/ivana/Desktop/Code/tmp`, then `rsync -a --exclude .git --exclude node_modules` (**no `--delete`**) into the existing repo. `1ef152e` stays an ancestor, the remote and branch are untouched, `docs/` survives, and the generated `README.md` replaces the empty placeholder.

**The order is not negotiable**, because the `diff -r` criterion is satisfiable only in a narrow window and two steps would break it if taken later:

1. Generate into `GEN=/home/ivana/Desktop/Code/tmp/cupboard-gen-<timestamp>` (absolute-path invocation, cwd outside AppGenerator).
2. **Resolve the dotfile renames inside `GEN`** — `_gitignore` → `.gitignore`, and likewise any other underscore-prefixed entry the generator left behind. This is the **only** gate-neutral place to rename (§2.10a). Content unchanged, no rules added. Report the generator defect if there was one.
3. `rsync -a --exclude .git --exclude node_modules "$GEN"/ /home/ivana/Desktop/Code/Cupboard/` — **never `--delete`**.
4. **Run the tree gate now, before any hand-written file exists**, and capture its output: `diff -r -x .git -x node_modules -x docs "$GEN" /home/ivana/Desktop/Code/Cupboard > "$EVID/tree-gate.txt" 2>&1; echo "exit=$?" >> "$EVID/tree-gate.txt"`. Expect empty output and `exit=0`. Once `src/map/`, `assets/leaflet/` or `THIRD-PARTY-NOTICE.md` exist, this gate can never pass again — it is **time-scoped by design**, and the captured file is the PR evidence.
5. Run the history gate (`git merge-base --is-ancestor 1ef152e HEAD`, `git remote -v`) and the identity gate.
6. **Retain `GEN`** until the PR body is written. It is a throwaway in the sense that it is not a deliverable and not committed — **not** in the sense that it may be deleted early. Deleting it before step 4's output is captured destroys the only evidence for GENERATE AND MOVE IN.

### 5.2 Layout of the map feature

- **`src/map/mapConstants.ts`** — the single source of truth: `CHICAGO_LATITUDE = 41.8781`, `CHICAGO_LONGITUDE = -87.6298`, `INITIAL_ZOOM = 12`, `MAP_MAX_ZOOM = 19`, `OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'`, `OSM_ATTRIBUTION_HTML`, `MAP_HTML_ASSET_URI = 'file:///android_asset/leaflet/map.html'`, `MAP_LOG_TAG = '[CupboardMap]'`.
- **`src/map/mapInitScript.ts`** — a pure `buildMapInitScript()` returning the injected string. Component-free and importing no `react-native-webview`, so it can be asserted without the mock and no coordinate is ever duplicated into the HTML.
- **`src/map/MapScreen.tsx`** — the full-bleed WebView (§5.4), in a plain RN `View`/`StyleSheet` container (`flex: 1`, no padding) because bobuttons has no full-bleed layout equivalent.
- **`android/app/src/main/assets/leaflet/{map.html,leaflet.js,leaflet.css}`** — `map.html` defines `window.initLeafletMap(config)`, carries `<meta name="viewport" content="… user-scalable=no">`, the `window.onerror` → `postMessage` bridge, the missing-`L` guard (§5.5), and **no coordinates, zoom value, tile URL or attribution string**. It contains **no `http(s)` `<script>` or `<link>` tag** — asserted by a test.

### 5.3 Composition: provider, shell, empty header, insets, map — **SUPERSEDED (rev 8) in two bullets; see §0.2.3 for the pinned composition**

**Pinned arrangement** (reconciles HEADER SHOWS NOTHING, LAYOUT INSIDE THE APP SHELL and SAFE AREA WIRED; replaces revision 5 §5.3 entirely):

```
BobuttonsProvider            (exactly one, at the root, NO config prop)
└─ SafeAreaProvider          (as generated — U3)
   ├─ StatusBar              (as generated)
   └─ AppContent             (as generated: calls useSafeAreaInsets())
      └─ AppShell insets={safeAreaInsets}      ← header prop OMITTED
         └─ [ViewPane > ViewBody >] MapScreen
```

- **`BobuttonsProvider` outermost.** Both providers must be above `AppShell`, and `useSafeAreaInsets` must be below `SafeAreaProvider`; putting `BobuttonsProvider` outside satisfies "exactly one at the root" literally and leaves the generated `SafeAreaProvider`/`StatusBar` block structurally untouched. **If the scaffold already renders a `BobuttonsProvider`, reuse it** (U3) — never add a second.
- ~~**Header: omit the prop.**~~ **SUPERSEDED (rev 8) — see §0.2.** `AppShell` is rendered **with** `header={<AppHeader title="Cupboard" locale="en-US" timeZone="America/Chicago" />}`. What survives from this bullet: `title` is required, the date is library-rendered, and **no Bobuttons edit and no local re-implementation of `AppHeader`** in any case.
- **Insets — an ordered ladder, because `AppShell`'s prop surface is unread until `npm ci` (U10).** (a) Pass the `useSafeAreaInsets()` result into `AppShell`'s `insets` prop — the AC's mechanism, and the library's default is all-zero with safe-area handling explicitly on the consuming app. (b) If `tsc` rejects the **shape**, construct `{ top, right, bottom, left }` explicitly from the hook result — no cast, no new dependency. (c) If `insets` turns out to have an **incompatible type** (a number, differently-named keys) or **not to exist**, that contradicts the AC's own premise: **report SAFE AREA WIRED blocked, naming the prop and quoting the `.d.ts` line.** Do **not** invent a padding wrapper above `AppShell` as an agent decision — it is a defensible option but it is the author's call, and it interacts with the ancestor test (§5.7). Never edit bobuttons, never edit `gradle.properties`.
- ~~**Where the WebView sits.** Preferred `AppShell > ViewPane > ViewBody > MapScreen` … if either pads or scrolls, `MapScreen` goes directly under `AppShell`.~~ **SUPERSEDED (rev 8) — see §0.2.2, where both were measured.** `ViewPane` pads but adds **no** scroll host; `ViewBody` **is** a `ScrollView`. Pinned: `AppShell > ViewPane > (MapScreen | PlaceholderView)`, **never `ViewBody`**. The map stays inside the `AppShell` — never a bare full-screen WebView replacing the shell.
- No `Icon`, `TabBar` or `TessellatedBackground`; no icon cells in `SquareGrid`.

### 5.4 WebView props

**Passed:** URI source (`MAP_HTML_ASSET_URI`), `injectedJavaScript={buildMapInitScript()}`, `originWhitelist={['file://*']}`, `onShouldStartLoadWithRequest`, `setBuiltInZoomControls={false}`, a React `key` bumped on `onRenderProcessGone` (whose handler returns `true`), and the four diagnostic callbacks of §5.5 plus `onMessage`. **`onNavigationStateChange` is deliberately not passed** — it was pinned mid-revision as a fallback channel and then measured useless (§5.5); passing it would be a prop with no consumer.

**Deliberately NOT passed, each for a measured reason:**

| Prop | Why not |
| --- | --- |
| `allowFileAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs`, `mixedContentMode` | Defaults are correct. `file:///android_asset` is exempt from `allowFileAccess`, and HTTPS tiles fetched as `<img>` subresources from a `file://` document are not mixed content. Passing them is the "loosen security until it works" anti-pattern |
| `scrollEnabled` | **Not an Android prop at all** (§2.9, measured). A no-op that looks like a fix |
| `nestedScrollEnabled` | **Already defaults to `false`** (§2.9, measured). Nothing to change |
| `overScrollMode` | Defaults to `'always'`; with `overflow: hidden` there is nothing to overscroll. Held in reserve as an on-device-only remedy (§2.9) |
| `setDisplayZoomControls` | Irrelevant once `setBuiltInZoomControls={false}` — the docs state controls are always hidden then |

**`onShouldStartLoadWithRequest` — prefix, not equality.** Return `true` iff `request.url.startsWith('file:///android_asset/leaflet/')`; otherwise log one tagged line and return `false`. Exact equality against `map.html` is brittle against URL normalisation (trailing slash, query) and against the remount after `onRenderProcessGone`. Two measured facts make this safe and cheap:

- Android calls `shouldOverrideUrlLoading` only for navigations the page *initiates*; the **initial** `loadUrl` from the `source` prop is never gated (`RNCWebViewClient.java:87/136`). So neither the first load nor the post-remount load depends on this predicate — it exists to block the OSM attribution tap and any stray navigation.
- It gates **top-level navigations only**, not subresources, so tiles are unaffected.

Logging the blocked navigation turns "the attribution link does nothing" into an observable, explained event rather than a mystery. No `BackHandler`, no `goBack`, no `Linking.openURL`, no error UI.

### 5.5 The diagnosable failure path, layered — logcat only

The four obvious callbacks do not catch the most likely silent failure (anti-pattern 8). **And §2.8 constrains the wiring:** in-page `console.*` is swallowed in release, so every in-page signal must leave the document through `postMessage`, whose consumer logs it with a JS `console.warn` — a channel measured to survive release.

**The `post()` helper in `map.html`, guarded (concern 6).** Every in-page layer routes through it:

```js
function post(msg) {
  var line = '[CupboardMap] ' + msg;
  try {
    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
      window.ReactNativeWebView.postMessage(line);
      return;
    }
  } catch (e) { /* fall through — never let reporting throw */ }
  if (typeof console !== 'undefined' && console.error) { console.error(line); }  // debug-only (§2.8b)
}
```

An unguarded `postMessage` throws when the bridge is missing, and a throw inside `window.onerror` swallows the very error being reported — that is what the `typeof` guard prevents, and **a test asserts the guard is present in `map.html`** so it cannot be dropped.

**A mid-revision fix that measurement killed, recorded so it is not re-attempted.** The obvious release-visible fallback is `document.title = line`, read back through `onNavigationStateChange`. It does **not** work: `title` is attached to events only in `RNCWebViewClient.java:311` (page start/finish) and `RNCWebChromeClient.java:133` (progress), and there is **no `onReceivedTitle` override**, so a title set *after* load — exactly when `post()` runs — emits no event at all. It would have been reassuring dead code. Dropped, along with the `onNavigationStateChange` prop it required. And it is not needed: §2.8c measured that the bridge object is always injected and that even a disabled bridge logs a native warning.

**Instead, make silence meaningful — an `init-ok` heartbeat.** On successful init, `map.html` calls `post('init-ok')` as the last statement of `initLeafletMap`. This costs one line and closes the only remaining hole:

- `[CupboardMap] init-ok` in logcat **plus** a visible map = success, and it is the line quoted in the PR.
- A tagged **error** line = the failing layer names itself.
- **Neither line, with a blank map** = previously ambiguous, now itself a diagnosis: the document never ran our script at all (asset missing, wrong URI, or a WebView that never loaded) — which is precisely the white-screen case the four obvious callbacks miss. The APK-content gate (layer 5) then distinguishes "asset absent" from "asset present but not loaded".

A test asserts `map.html` contains the heartbeat, so it cannot be dropped either. This is still **logcat-only**: no error UI, no banner, no retry, no fallback screen.

Five layers, **all logcat-only — no error UI, no banner, no retry, no fallback screen**:

1. **In `map.html`:** `initLeafletMap(config)` begins with `if (typeof L === 'undefined') { post('leaflet-missing'); return; }`. Catches a missing/404 `leaflet.js`.
2. **In the injected script:** before calling, `if (typeof window.initLeafletMap !== 'function') { post('init-fn-missing') } else { try { window.initLeafletMap(cfg) } catch (e) { post('init-threw:' + e.message) } }`. Catches a missing/empty/wrong `map.html` and any throw inside init. The injected script is the one piece guaranteed to run whenever the document loaded at all. **`__tests__/map.test.tsx` asserts this guard's text, so it cannot be silently dropped.** Its `post` is defined inline in the injected string, not borrowed from the page — if `map.html` failed to load there is no page helper to borrow.
3. **Native callbacks:** `onError`, `onHttpError`, `onRenderProcessGone` (returns `true`, bumps the `key`) **plus `onLoadSubResourceError`** — verified present in 14.0.1 (§2.3) and the only native signal for a failed subresource. One tagged `console.warn` each; these are **JS** callbacks, so §2.8a makes them release-visible. Re-verify the prop name if the 16.0.0 fallback is taken.
4. **`window.onerror` → `post`, consumed by `onMessage`**, which logs one tagged line per message. Every message type above — including `init-ok` — arrives here, so `onMessage` is the single place the page's voice becomes a logcat line.
5. **APK-content gate, before any device conclusion:** `unzip -l <apk> | grep leaflet` must list `assets/leaflet/map.html`, `assets/leaflet/leaflet.js`, `assets/leaflet/leaflet.css`. `src/main/assets` is AGP's default asset dir and is *merged* with the RN plugin's generated bundle directory rather than replaced — but only if the directory exists at all (§2.10c), so `mkdir -p` is part of the work. Cheap, and it converts "white screen, empty logcat" into one line of output.

Every logged line shares one grep-able tag (`[CupboardMap]`) so **`adb logcat -d | grep CupboardMap`** is the single diagnostic command quoted in the PR. On Android the JS lines carry the tag `ReactNativeJS` and the message holds `[CupboardMap]`, so the grep matches either way.

**Expected-silence note for `images/*` (concern 10).** `leaflet.css` references exactly three images — `images/layers.png`, `images/layers-2x.png`, `images/marker-icon.png` (§2.2) — and they are deliberately **not** vendored. Their rules (`.leaflet-control-layers-toggle`, `.leaflet-default-icon-path`) match nothing unless a layers control or a default marker is created, and both are out of scope, so a browser fetches **none** of them. Therefore: **zero `images/` subresource errors are expected, and any that appear are a signal that out-of-scope UI crept in.** Such a line is reported in the PR, never suppressed and never used to justify vendoring the images.

### 5.6 Provenance that cannot rot

`__tests__/map.test.tsx` additionally asserts, from disk (first line `/// <reference types="node" />` — §2.5):

- all three files in `android/app/src/main/assets/leaflet/` **exist and are non-empty**;
- `leaflet.css` → `sha256` of the file bytes equals `a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6`;
- `leaflet.js` → the first line is exactly `/* eslint-disable */` and the `sha256` of **the bytes after the first `\n`** equals `db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a`.

The second digest must be computed **byte-exactly** the way `tail -n +2 … | sha256sum` is: find the first `0x0a` in the buffer and hash `buf.subarray(idx + 1)`. A `split('\n').slice(1).join('\n')` round-trip is not guaranteed byte-identical and must not be used. Both digests were reproduced today (§2.2). If the disable line ever proves unnecessary, the test, the README command and the notice change **together**; §2.4 shows it is necessary.

**The copy step is recorded, not folklore (concern 7).** `README.md`'s provenance section carries the exact reproduction, so a future refresh is not guesswork:

```sh
mkdir -p android/app/src/main/assets/leaflet                     # the template ships no assets dir (§2.10c)
cp node_modules/leaflet/dist/leaflet.css android/app/src/main/assets/leaflet/leaflet.css
{ printf '/* eslint-disable */\n'; cat node_modules/leaflet/dist/leaflet.js; } \
  > android/app/src/main/assets/leaflet/leaflet.js
# verify
sha256sum android/app/src/main/assets/leaflet/leaflet.css        # a7837102…24d04c6
tail -n +2 android/app/src/main/assets/leaflet/leaflet.js | sha256sum   # db49d009…f4e5641a
```

`leaflet@1.9.4` is installed with `--save-exact` as a **devDependency** purely as the provenance-pinned source of those two files. Two reasons it is the right call rather than a stray `npm pack`: the AC's own expected-lockfile list **names `leaflet`**, so a lockfile entry is AC-implied; and `npm ci` then reproduces the exact bytes the digests pin. Measured — it carries no lint cost: `@react-native/eslint-config@0.83.10` ships no import plugin and **no `import/no-extraneous-dependencies` or unused-dependency rule**, so an unimported devDependency trips nothing. It is not a runtime dependency and nothing imports it; the committed assets are the artifact.

### 5.7 Tests: what renders what, and how a scroll ancestor is detected

`react-test-renderer@19.2.0` and `@types/react-test-renderer` are already devDependencies. **Do not add a testing library.** Every test file that reaches `react-native-webview` mocks it (§2.3) and uses `findByType(WebView)` with the **imported reference**, never a string (§2.5 Finding B).

**`__tests__/map.test.tsx` — the AC-bearing file.** Renders **`MapScreen` directly** under `jest.mock('react-native-webview', …)`, then:

- `source.uri === MAP_HTML_ASSET_URI`;
- **the injected script, parsed rather than substring-matched (concern 12).** `buildMapInitScript()` emits exactly one `window.initLeafletMap(…)` call whose argument is `JSON.stringify(config)`. The test extracts that argument with a single anchored match, `JSON.parse`s it, and asserts each field **twice** — against the literal the AC names **and** against the imported constant: `cfg.latitude === 41.8781 === CHICAGO_LATITUDE`, `cfg.longitude === -87.6298 === CHICAGO_LONGITUDE`, `cfg.zoom === 12 === INITIAL_ZOOM`, `cfg.tileUrlTemplate === OSM_TILE_URL_TEMPLATE`, `cfg.maxZoom === 19`, plus a non-empty `cfg.attributionHtml`. A bare `includes('12')` would match incidental text and is exactly the tautology the criterion rejects. The script must additionally contain the §5.5 layer-2 init guard — i.e. this **proves the Leaflet init consumes the constants**;
- `originWhitelist` equals `['file://*']`, `setBuiltInZoomControls === false`, the `onShouldStartLoadWithRequest` predicate returns `true` for `file:///android_asset/leaflet/map.html` and `false` for `https://www.openstreetmap.org/copyright` (the attribution target), and the security props are **absent** (`'allowFileAccessFromFileURLs' in props === false`, and the same for `allowFileAccess`, `allowUniversalAccessFromFileURLs`, `mixedContentMode`, `scrollEnabled`, `nestedScrollEnabled`);
- `map.html` contains no `http(s)` `<script>`/`<link>` tag; carries the `user-scalable=no` viewport meta and the `overflow: hidden` / full-bleed `#map` sizing of §2.9; and contains the §5.5 `post()` `typeof` guard, the `typeof L === 'undefined'` guard and the `init-ok` heartbeat;
- §5.6's asset existence and digest assertions.

Rendering `MapScreen` rather than `App` is deliberate: the real `SafeAreaProvider` renders zero children under Jest (§2.6, measured), so an `App`-level version would find nothing.

**The composition block — and a revision-6 claim corrected.** Revision 6 said HEADER SHOWS NOTHING "cannot be proven by a Jest assertion". That was true only of a render through the *real* `SafeAreaProvider`. Under the test-file-local safe-area mock of §2.6 the chrome **does** render, so `AppShell`'s props are inspectable and two assertions become available at no cost:

- ~~`'header' in appShell.props === false`~~ **SUPERSEDED (rev 8): AC SUPERSEDED TEST ASSERTIONS UPDATED requires this to become an assertion that `header` IS supplied, as an `AppHeader` element carrying `title`/`locale`/`timeZone` (§0.2.4);**
- `appShell.props.insets` deep-equals the stubbed insets — unit-level evidence for SAFE AREA WIRED, which revision 6 left entirely to the device.

`AppShell` is found the same way as the WebView: `import { AppShell } from 'bobuttons'` and `findByType(AppShell)`, so the reference type-checks against the real `.d.ts` while resolving to whatever U8's remedy ladder left in place.

**The ancestor assertion** needs the chrome rendered, so in that block: (1) neutralise the safe-area provider with the **test-file-local inline mock** of §2.6 — no Jest config change — but stub `useSafeAreaInsets` to return **all-zero** insets here; (2) render the real composition, find the `WebView`, and walk `instance.parent` to the root. For every ancestor, fail if **any** of:

- it is a **host** node (`typeof type === 'string'`) whose type is one of `RCTScrollView`, `AndroidHorizontalScrollView`, `RCTScrollContentView`, `ScrollView`;
- its props carry a scroll signature: `contentContainerStyle`, `scrollEnabled`, `showsVerticalScrollIndicator`, `showsHorizontalScrollIndicator` or `onScroll` present;
- `StyleSheet.flatten(props.style)` has a non-zero `padding`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `paddingVertical` or `paddingHorizontal`;
- secondary, belt-and-braces: a **composite** ancestor whose `type.displayName ?? type.name` matches `/ScrollView|FlatList|SectionList|VirtualizedList/`.

The host-type and prop checks are the dependable ones: an `Animated`- or Tamagui-wrapped scroller still renders `RCTScrollView` as a host node, and RN's `ScrollView` always passes `scrollEnabled`/indicator props down. The padding check is included because the criterion forbids a **padding or scrolling** container.

**U8 remedy ladder, if bobuttons/Tamagui cannot render under Jest.** In order, stopping at the first that works: (a) a **test-file-local** `jest.mock`/`requireActual` shim, as for safe-area; (b) if bobuttons documents a required Jest setup, adopt it and justify it explicitly in the PR; (c) if the ESM entry is the problem, **append** `bobuttons` to `transformIgnorePatterns` **keeping the react-native preset's own pattern** (explicitly pre-authorised); (d) last resort, `jest.mock('bobuttons', () => ({ BobuttonsProvider: ({children}) => children, AppShell: 'AppShell', ViewPane: 'ViewPane', ViewBody: 'ViewBody' }))` — which keeps the ancestor assertion meaningful for *our* composition but **can no longer see inside `ViewBody`**. If (d) is used, the `ViewBody`-scrolls question is answered by the source read in §5.3, and the PR must say so plainly rather than implying the test proved it.

**Why that block runs at ZERO insets — a conflict revision 6 missed (concern 11).** SAFE AREA WIRED pushes real insets into `AppShell`; if `AppShell` renders them as padding, then a padding-forbidding ancestor walk would **fail on a correct implementation**, making two criteria mutually unsatisfiable. Running the walk at all-zero insets resolves it honestly: any non-zero padding found is then attributable to the **layout**, which is what PAN, ZOOM AND GESTURE OWNERSHIP is actually about. The non-zero-inset case is covered by the separate `props.insets` assertion above and by the device screenshot. Padding also does not *consume* touches — it only shrinks the map — so the scroll-host checks remain the load-bearing ones.

**`__tests__/App.test.tsx`** stays a smoke test in the shape the generator produced (`act` + `create`, no assertions), with the mandatory `react-native-webview` mock. Its job is "App composes without throwing": it renders through the **real** `SafeAreaProvider`, which yields zero children (§2.6), so it can assert nothing about the tree — and `AppContent` never mounts there, so no `BackHandler` registration happens in this file. **SUPERSEDED (rev 8):** the trailing claim that "`tsc` proves `header` is omittable and the device screenshot proves the header is empty" is void — the header now carries a title, asserted as props in `map.test.tsx`/`shell.test.tsx` (§0.2.4).

**`__tests__/dependencies.test.ts`** — see §5.13.

### 5.8 Choosing the `react-native-webview` version (U6)

**Before installing**, read `android/gradle.properties` from the generated scaffold:

| `newArchEnabled` | Choice | Why |
| --- | --- | --- |
| `true` (expected — the RN 0.83.10 template ships it; verified) | **14.0.1 `--save-exact`** | Compiles `src/newarch` with the codegen delegate; matches the Fabric runtime |
| **absent** | **16.0.0 `--save-exact`**, reason recorded in the PR | 14.0.1's check is `hasProperty && == "true"`, so an absent property silently selects the **legacy** ViewManager while RN 0.83 runs Fabric. 16.0.0 has no legacy path. Passing `-PnewArchEnabled=true` would have to be threaded through `npm run android` every time, and editing `gradle.properties` is a forbidden generated-file patch |
| explicitly `false` | **Report blocked**, naming the property | RN's own Gradle plugin says this is unsupported since 0.82 and runs Fabric anyway; 16.0.0 raises a clear `GradleException`. The honest outcome is a blocked report, not a file edit |

Installation is **autolinking-only**: no edits to `MainApplication.kt`, `AndroidManifest.xml`, `android/app/build.gradle`, `android/build.gradle` or `android/gradle.properties`. Read the `package-lock.json` diff before committing; expect only the four packages in §2.3.

**Runtime fallback trigger**, in addition to the build-time one: fall back to 16.0.0 — or re-check `newArchEnabled` — if the app *installs and launches* but the map area is blank **with no WebView callback firing and no `[CupboardMap]` line in logcat**, especially alongside logcat lines about an unimplemented/unresolved `RNCWebView` component. Corroborating check: `node_modules/react-native-webview/android/build/generated/source/codegen/java/com/facebook/react/viewmanagers/RNCWebViewManagerDelegate.java` exists only when the new-arch path was compiled.

**After any fallback these gates are re-derived, not reused:** the expected lockfile additions, the self-supplied `ReactNativeWebView_webkitVersion`, the no-Gradle-edit guarantee, and the `onLoadSubResourceError` prop name. State in the PR that they were re-derived for 16.0.0.

**The AGP-classpath half of the criterion's fallback trigger is void (§2.3c).** If the build genuinely fails *on that classpath*, no version change helps and both patching the library and editing Gradle files are forbidden → **blocked report quoting the exact Gradle error.**

### 5.9 If the pristine baseline is RED (U7)

Run `npm ci`, then `npm test`, `npm run lint` **and** `npx tsc --noEmit` on the **untouched** scaffold and record all three verbatim before any hand-written change. The community template measures green on all three (§2.4), so a red scaffold is a target-specific signal worth reporting. If red, classify:

- **(a) Red for something this ticket's own work removes or replaces** — e.g. the generated smoke test asserts on scaffold content the map rewire deletes. Proceed, note the baseline failure and the reason in the PR, and show the same command green at the end.
- **(b) Red for a template defect fixable inside files this ticket legitimately owns** — test files, hand-written source, `README.md`. Fix it there, and say in the PR that the fix was required to meet TESTS, LINT AND TYPES GREEN and that it touched no configuration. **This is the one allowed exception**: the criterion freezes *configuration*, not test files and not app source.
- **(c) Red for a defect whose only fix is a lint/Jest/TS **configuration** rewrite or a generator change** — the ticket is **blocked on AppGenerator**, reported with the exact failure. Do not "fix" it with `.eslintignore`, `ignorePatterns`, a `tsconfig.json` edit, a `transformIgnorePatterns` rewrite beyond the pre-authorised append, or an edit inside AppGenerator.

The baseline exists so that a failure after the map work is attributable. Skipping it forfeits that, so it is not optional.

### 5.10 The vendored-`leaflet.js` lint line (U9 — settled)

Measured on the community template (§2.4): `eslint .` reaches the file; without the line it is **12 errors / exit 1**; with one prepended `/* eslint-disable */` it is **0 errors, 1 warning, exit 0**; `tsc` is unaffected. Keep the line exactly as the criterion pins it. Re-run the measurement on the real scaffold; if errors survive there, report the **exact surviving rule names** and stop — the only remedies would be configuration changes the criterion forbids, so surface the choice to the author instead of taking it.

### 5.11 Commits

Three commits on the **already-checked-out** branch, one PR against `main`:

0. **`docs: CUPBOARD-1 architect context (rev 7)`** — only `docs/context/CUPBOARD-1-…md`. Committing it first means a mid-flight abort cannot lose it, keeps the planning artifact out of the functional commit, and removes any `git add -A && git reset -- docs` dance.
1. **Scaffold** — the untouched generator output, including `vendor/bobuttons-<ver>.tgz` and the README that replaces the placeholder. Reviewable as "this is exactly what the generator produced".

   **This commit happens BEFORE `npm ci` ever runs (concern 2).** `git add -A` at this point cannot capture `node_modules` because `node_modules` does not yet exist on disk — `rsync` excluded it and nothing has installed. That ordering is the primary guard; the `.gitignore` is the secondary one. Both are required, because a later `git add -A` (commit 2) runs in a tree that **does** have `node_modules`:

   - **Before every `git add -A`**, assert `git check-ignore -q node_modules` exits **0** (= ignored; §2.10b, measured). Exit 1 means the dotfile rename did not happen — fix that in the generated dir and re-`rsync`; **never `git add -A` anyway**, and never "fix" it by adding an ignore rule of our own invention beyond the template's content.
   - Corroborate with `git status --porcelain | grep node_modules` → empty.
   - If `git add -A` is ever in doubt, stage explicit paths instead. Nothing about this ticket requires `-A`.
2. **Map** — `react-native-webview` + `leaflet` devDep + the vendored Leaflet assets + `src/map/*` + the `App.tsx` rewire + the three test files + the README/notice provenance.

### 5.12 Gates, in order, with explicit success conditions

**Never wire these into a bare `set -e` / `&&` chain** — three succeed with a non-zero exit code.

| Gate | Command | Success condition |
| --- | --- | --- |
| Siblings clean | `git -C …/AppGenerator status --porcelain` (and Bobuttons) | **empty stdout**, exit 0. Run **before and after** |
| Branch | `git rev-parse --abbrev-ref HEAD` | equals `CUPBOARD-1-initialize-cupboard-android-app-with-chicago-map`. No checkout, no rename |
| Generate | generator invoked by **absolute path** with target `react-native-bobuttons`, app name lowercase `cupboard`, from a cwd under `/home/ivana/Desktop/Code/tmp` | exit 0; then resolve **U4** |
| Move-in | `rsync -a --exclude .git --exclude node_modules <gen>/ /home/ivana/Desktop/Code/Cupboard/` | exit 0. **No `--delete`, ever** |
| Tree equality (**time-scoped**) | `diff -r -x .git -x node_modules -x docs <gen> /home/ivana/Desktop/Code/Cupboard`, **output captured to a file** | **empty stdout and exit 0.** Runs immediately after `rsync`, **before any hand-written file exists** — it can never pass afterwards. With `-x docs` there is no `Only in` line; if one appears, either `-x docs` was dropped (restore it, never delete `docs/`) or the `_gitignore` rename happened on the wrong side (§2.10a). **Retain `<gen>` until the PR body is written** |
| History | `git merge-base --is-ancestor 1ef152e HEAD` | **exit 0**. Plus `git remote -v` still showing the GitHub URL for fetch and push |
| `.gitignore` | `_gitignore` became `.gitignore` | present, content = template's, **no added rules**. The repo had none, so no collision; if one ever appears, **merge, never overwrite** |
| `node_modules` ignored | `git check-ignore -q node_modules` | **exit 0** (= ignored). Run **before every `git add -A`**. Exit 1 = not ignored → the rename failed; fix it in `<gen>` and re-`rsync`, never `git add -A` anyway (§2.10b) |
| Tarball not ignored | `git check-ignore -v vendor/bobuttons-<ver>.tgz` | **exit 1 with empty stdout** (= not ignored). Exit 0 means ignored → `git add -f` and record it in the PR |
| Identity | read `app.json`, `MainActivity`, `MainApplication`, `strings.xml`, `android/app/build.gradle` | all lowercase `cupboard` / `com.cupboard`, **as generated**; `app.json` `name` unedited |
| Manifest | `git diff --stat -- android/app/src/main/AndroidManifest.xml` after the map commit | **empty** (byte-identical to the scaffold) |
| bobuttons dep | read `package.json` | `bobuttons` present as a `file:` dep; `bobuttonsProvenance` present; **no direct** `@tamagui/*`, no `react-dom`, no `react-native-web` |
| SDK pre-check | §2.1's table against the scaffold's `android/build.gradle` | every component present; otherwise **blocked** (no `sdkmanager`) |
| Baseline | `npm ci`, then `npm test`, `npm run lint`, `npx tsc --noEmit` on the pristine scaffold | all exit 0 — or classify per **§5.9** |
| Lockfile diff | `git diff -- package-lock.json` | read by a human; only the expected additions (§2.3, re-derived after a fallback) |
| APK assets | `unzip -l …/app-release.apk \| grep leaflet` | all **three** asset paths listed |
| Crash log | `adb logcat -d -b crash \| grep -i cupboard` | **empty stdout**; `grep` exits **1**, which is the pass. Quote the empty result in the PR |
| Map log | `adb logcat -d \| grep CupboardMap` | quoted in the PR — an *empty* map log is only good news together with a visible map |
| Emulator up | `adb shell getprop sys.boot_completed`, polled | returns `1` within the §5.14 timeout; otherwise **blocked** with the emulator log tail. `adb devices` must list the AVD before any device claim |
| Release log channel | `adb logcat -d \| grep -E 'ReactNativeJS\|CupboardMap'` after the **release** launch | non-empty, proving JS logging survives release (§2.8a). If empty, label the tagged lines **debug-only** in the PR rather than resting the offline leg on a channel that is not there |
| Dependency guard | `npm ls --json --all` inside the Jest test | **exit code ignored**, stdout parsed (§5.13) |
| Final green | `npm test`, `npm run lint`, `npx tsc --noEmit` | all exit 0 |
| Clean clone | `git clone <repo> <new empty dir>` then `npm ci` there | both exit 0 |

### 5.13 The dependency guard must not be flaky

`npm ls` exits non-zero for unrelated `ELSPROBLEMS` (peer warnings), so asserting on its exit code would be flaky. `__tests__/dependencies.test.ts` therefore: (a) reads `package.json` directly for **direct** `@tamagui/*`, `react-dom`, `react-native-web` entries — fast, no subprocess; and (b) runs `npm ls --json --all` with `cwd` at the repo root, **capturing stdout even when the process exits non-zero** (`catch (e) { out = (e as { stdout?: string }).stdout ?? '' }`), parses the JSON and walks the tree — asserting **exactly one** `@tamagui/core` instance and **zero** `react-dom` / `react-native-web`. First line is `/// <reference types="node" />` (§2.5). A generous per-test timeout is passed as `it()`'s third argument, which is not a Jest *configuration* change.

**On the reviewer's suggestion to replace the subprocess (concern 8).** Reading `package-lock.json` plus a filesystem glob would indeed be hermetic and fast — but the criterion **pins this mechanism by name** ("runs `npm ls --json --all` at the repo root capturing stdout even when the process exits non-zero … parses the JSON and asserts exactly one `@tamagui/core` instance"), precisely because `react-dom` is an optional peer of bobuttons and the lockfile can list a package the installed tree does not materialise. Swapping it out would be a scope decision against an explicit AC. So it stays — **hardened** instead, on four measured points:

- **`maxBuffer`.** Measured today: `npm ls --json --all` emits **351,893 bytes** on a *bare* `@react-native-community/template@0.83.10` tree, before bobuttons/Tamagui/webview/leaflet. Node's `execSync` default is 1 MB, which is within one multiple of that floor — and an `ENOBUFS` failure lands in the `catch` branch as *truncated* stdout, so the guard would fail with a baffling `JSON.parse` error or, worse, be weakened. Pin `maxBuffer: 64 * 1024 * 1024`.
- **Environment.** Jest is launched by `npm run test`, so the child inherits `npm_config_*`. Build the child env by **deleting every `npm_config_*` key** from a copy of `process.env` (one `Object.fromEntries(Object.entries(process.env).filter(...))`), so a parent's registry/prefix/depth setting cannot change the answer.
- **Bounds.** Explicit `cwd` (the repo root, derived from `__dirname`, not `process.cwd()`), `encoding: 'utf8'`, a subprocess `timeout`, and `stdio: ['ignore','pipe','ignore']` so npm's stderr noise does not reach the buffer.
- **Loud failure.** If the captured text will not `JSON.parse`, fail with a message naming the byte count and the first 200 characters. A guard that cannot run must **fail**, never skip — a silently skipped dependency guard is the anti-pattern this test exists to prevent. Likewise, do not swallow a missing `npm` binary: on this host `npm 10.9.3` is on `PATH` (§2.1).

### 5.14 Device verification, and what gets reported when it is partial

1. **Boot the emulator (concern 5).** Pre-checked feasible in §2.11: `DISPLAY=:0`, `/dev/kvm` writable via ACL, binary present but **not on `PATH`**.

   ```sh
   /home/ivana/Android/Sdk/platform-tools/adb start-server
   nohup /home/ivana/Android/Sdk/emulator/emulator -avd Medium_Phone_API_37.0 \
     -no-snapshot-save -netdelay none -netspeed full \
     > /home/ivana/Desktop/Code/tmp/<run>/emulator.log 2>&1 &
   ```

   Then `adb wait-for-device`, then **poll** `adb shell getprop sys.boot_completed` until it returns `1`, at 5-second intervals with a **300-second cap**. `wait-for-device` alone returns as soon as adb sees the device, long before Android is usable, so installing at that point fails confusingly.

   - Run it **detached** — it does not exit, so a foreground call would hit the 10-minute timeout.
   - **If the windowed launch fails** (GPU/Wayland), retry once with `-no-window -gpu swiftshader_indirect`. Note in the PR that headless mode was used, because then the **pinch** gesture cannot be performed by the agent at all and the Leaflet `+`/`−` control (tapped via `adb shell input tap`) is the only zoom evidence — which the criterion already designates as the dependable one.
   - **If it still does not boot within the cap:** report Tier A **blocked** quoting the last 30 lines of `emulator.log`. Do **not** create or reconfigure an AVD, do not change `ANDROID_HOME`, do not `sudo`.
   - Leave the emulator running until every device check is done, then shut it down cleanly (`adb emu kill`). It is the only AVD on this host and other projects share it.
2. Metro in one terminal; `npm run android` in another → capture the install output for the PR.
3. `adb logcat -d -b crash | grep -i cupboard` → empty (pass = grep exit 1), quoted. Also `adb logcat -d | grep CupboardMap` → quoted.
4. Screenshot 1 (Chicago at zoom 12, OSM attribution visible, **the "Cupboard" header and the three entries Settings/Places/Notes visible** — **SUPERSEDED (rev 8)**: revision 7 asked for "nothing in the header" here; AC ANDROID BUILD AND LAUNCH now requires header + entries + map in the shot, and on a phone the header shows no date (§0.2.2) — content clear of the status and navigation bars), then pan by drag and zoom by pinch **and** by Leaflet's `+`/`−` control, then screenshot 2. Both via `adb exec-out screencap -p` into `/home/ivana/Desktop/Code/tmp/`, named by absolute path in the PR body for the author to attach. **Not committed.**
5. Press the hardware back button once: the app **exits** (BACK BUTTON). Confirm no `BackHandler`/`goBack` exists in the source.
6. Resolve **U5**, then `./gradlew assembleRelease`, the APK-content gate (§5.5 layer 5), `adb install -r`, airplane mode on, launch → Leaflet surface with zoom control and visible OSM attribution over an empty tile grid; no crash, no hang, no blank white screen. The same build supplies the **release merged manifest showing `usesCleartextTraffic="false"`**.
7. `npm test`, `npm run lint`, `npx tsc --noEmit` green; both sibling repos' `git status --porcelain` empty.

**Reporting tiers — no criterion is ever marked met by inference from another.**

- **Tier A, no SDK / emulator / device.** BUILDS AND LAUNCHES, CHICAGO MAP RENDERS, PAN/ZOOM AND GESTURE OWNERSHIP, SAFE AREA WIRED, BACK BUTTON and OFFLINE / TILE-FAILURE BEHAVIOUR are **NOT met**. A successful `assembleDebug` plus a green Jest suite does **not** satisfy them. Report **blocked-on-device-verification** with the exact failure.
- **Tier B, partial — emulator boots, debug install and render succeed, but the release/offline leg is blocked** (U5, or an unsignable/uninstallable release APK). The debug-observable criteria are reported **met with evidence**; OFFLINE / TILE-FAILURE BEHAVIOUR is reported **blocked** with the exact Gradle or `adb` error. The PR lists met-with-evidence and blocked criteria **separately**, and the ticket is **not** marked done. Never substitute an airplane-mode test on the *debug* variant (anti-pattern 10).
- **Tier C, everything green.** All reported met, with the install output, both logcat quotes, the APK-content listing, the merged-manifest `false`, and the two screenshot paths.

### 5.15 The shared Gradle cache

The first build downloads the Gradle distribution, Maven artefacts and NDK bits into `~/.gradle`, which **every project on this host shares**.

- **Expect 15–40 minutes cold.** The agent's foreground command timeout caps at 10 minutes, so run the first build **detached** (background, output to a log file) and poll the log. A killed build is the thing to avoid.
- **Do not interrupt it.** No Ctrl-C, no parallel second Gradle invocation on the same project.
- **If interrupted anyway:** `./gradlew --stop`, then simply re-run. Gradle resumes from a partial cache.
- **If a later build fails with a corrupt-cache signature** ("Could not read workspace metadata", a zip/jar read error, a truncated artefact): delete only the **named** cache entry, or this project's `android/.gradle` and `android/app/build`. **Never** `rm -rf ~/.gradle` and never wipe `~/.gradle/caches/modules-2` wholesale — that re-downloads for every other project here, and with **no `sdkmanager`** (§2.1) a missing SDK component cannot be re-fetched automatically.
- `--no-daemon` is not recommended: it repeats work and makes the slow path slower.

### 5.16 Four things stated in the PR so they are not read as defects

- **`usesCleartextTraffic` in the debug variant.** The scaffold manifest ships RN's own `${usesCleartextTraffic}` placeholder, which the RN Gradle plugin resolves to `true` for debug (so Metro can serve the bundle over `http://localhost:8081`) and `false` for release. Hardcoding `false`, or adding a debug manifest with `tools:replace`, breaks the debug launch another criterion requires. The manifest stays byte-identical; this ticket adds no cleartext allowance (every URL the app fetches is HTTPS, the document is `file://`); the release merged manifest shows literal `false`.
- **Tapping the OSM attribution link does nothing.** A deliberate consequence of `originWhitelist={['file://*']}` + `onShouldStartLoadWithRequest`. The criterion requires the attribution *visible*, not followable; `Linking.openURL` is out of scope.
- **The default WebView User-Agent is sent to OSM.** Accepted risk for this dev-only app; a custom UA/Referer is out of scope. Tile volume is bounded by `maxZoom 19`, no prefetching, and the WebView's default HTTP cache.
- **One lint warning is expected**, `eslint-comments/no-unlimited-disable` on the vendored `leaflet.js`. Measured: 0 errors, exit 0. Do **not** "fix" it.

### 5.17 The two negative criteria (nothing to build)

- ~~**BACK BUTTON.** Add **no** `BackHandler` wiring and **no** WebView `goBack`.~~ **SUPERSEDED (rev 8).** AC BACK NAVIGATION requires one `BackHandler` listener (§0.2.3): back from a placeholder returns to the map and consumes the event; on the map the app does not consume it, so the system exits. No WebView `goBack`, no navigation library — those still stand. A `grep` for `BackHandler` now **must** find the listener in `App.tsx`.
- **LAUNCHER IDENTITY LEFT AS GENERATED.** `app.json`'s `name`, `MainActivity`, `MainApplication`, `android/app/build.gradle`'s `applicationId` and `strings.xml` are left **exactly** as generated (lowercase `cupboard` / `com.cupboard`). A capitalized launcher label is explicitly not part of this ticket, and editing `app.json`'s `name` breaks the launch.

---

## 6. Risks and constraints

- **Irreversibility.** One `rsync --delete`, `git init` or `git commit --amend` destroys a human author's history and the remote link. The history gate exists for this.
- **The typecheck is a new gate that invalidates two of revision 5's test mechanisms** (§2.5, measured). `findByType('WebView')` and bare `import fs from 'fs'` both fail `tsc`. Remedies pinned: the component reference, and `/// <reference types="node" />`. A Developer following revision 5 verbatim would ship a red typecheck.
- ~~**The header decision is enforced by the typecheck, not by a test.**~~ **SUPERSEDED (rev 8).** The header is now asserted directly: under the test-file-local safe-area mock the chrome renders, so `AppShell.props.header` is an inspectable `AppHeader` element and its `title`/`locale`/`timeZone` are asserted as props. The date string is never asserted (§0.2.4, AC TEST DETERMINISM).
- **New-architecture mismatch (HIGH).** On RN 0.83 the runtime is Fabric regardless of the property, while `react-native-webview@14.0.1` silently compiles its **legacy** ViewManager unless `newArchEnabled` is literally present and `"true"`. Compiles clean, blank at runtime. Mitigated by U6's pre-install read **and** the runtime fallback trigger.
- **The AGP 7.0.4 classpath is shared by both candidate versions**, so the 16.0.0 fallback is **not** a remedy for an AGP-classpath failure — only for new-arch/codegen failures. If it bites, the outcome is a blocked report.
- **Version-specific gates expire on fallback.** The four-package lockfile expectation, the self-supplied `webkitVersion`, the no-Gradle-edit guarantee and the `onLoadSubResourceError` prop name are all 14.0.1 measurements and must be re-derived for 16.0.0.
- **Edge-to-edge is platform-enforced at `targetSdk 36` on API 37**, so safe-area insets are load-bearing rather than cosmetic (§2.6). The remedy for a bad result is never a `gradle.properties` edit.
- **Ten template unknowns (U1–U10).** All have decision rules. U4/U5/U7 can change the verification route; U1/U2/U3 can change the file list; U6 can change the dependency version; U8/U9 can change how a test or the lint line is written; U10 can change the composition's inner two levels. **None changes the required outcome.** The biggest residual is that the whole §2.4/§2.5/§2.7 measurement set is taken on `@react-native-community/template@0.83.10`, not on the bobuttons target, which project scope barred from reading — every such fact is marked indicative and has a re-measure instruction.
- **A red pristine baseline has no configuration-shaped escape.** §5.9's tier (c) is a genuine blocked path, and it is the honest one.
- **Jest and the ESM packages.** `react-native-webview`'s entry is ESM, so the mock is mandatory in every test file that reaches it. `bobuttons`/Tamagui under Jest is unknown (U8); the remedy ladder prefers test-file-local mocks over any config change, and the AC-bearing assertions render `MapScreen`, so they survive even remedy (d).
- **`strict: true`** applies to the new test files; explicit parameter types are needed throughout.
- **First Gradle build:** network-bound, 15–40 minutes cold, shared `~/.gradle`, and longer than the agent's foreground timeout — §5.15.
- **Lockfile churn.** `npm install` can move unrelated pinned versions. Read the diff.
- **Emulator pinch is fiddly**, and a grey tile grid while *online* is usually OSM rate-limiting rather than a bug. The `+`/`−` control is the dependable zoom evidence.
- **Screenshots depend on the author attaching them** — an agent cannot upload images to a PR body.
- **No `cmdline-tools`/`sdkmanager`**, so a surprise missing SDK component cannot self-install. §2.1's pre-check currently passes for RN 0.83.10's pinned versions.
- **Scope-creep pressure points to resist** (**revised in rev 8**: a title in the header and `BackHandler` wiring are now **required**, not creep — §0.2): an offline banner or retry UI, `Linking.openURL` on the attribution tap, vendoring Leaflet's marker images, a human-readable launcher label, a second UI library, a testing library, icons of any kind, real functionality behind the three entries, persisting the selection, and "fixing" lint, Jest, TS or a generated file by configuration.

**Added in revision 7, each from a measured review concern:**

- **The release diagnostic channel is narrower than it looks.** In-page `console.*` is dropped by the library in non-debug builds (§2.8b). The offline criterion is verified **only** on release, so an implementation that logs from the page instead of posting through the bridge would leave that leg with no diagnostics at all — and would look fine in debug.
- **The pan remedy everyone reaches for does not exist on Android.** `scrollEnabled` is iOS/macOS-only (§2.9). A developer can "fix" the drag with a prop that compiles, reads well in review, and does nothing.
- **Two gates in this plan pass on opposite exit codes** (`check-ignore` on `node_modules` passes on 0; on the vendored tarball it passes on 1 — §2.10b), and a third (`grep` on the crash log) passes on 1. A single `set -e` or `&&` chain silently inverts one of them.
- **The `diff -r` evidence is perishable.** It is satisfiable only between `rsync` and the first hand-written file, and only while `<gen>` still exists. An ordinary tidy-up of the scratch directory destroys the proof for GENERATE AND MOVE IN.
- **Two criteria are in latent conflict.** Real insets into `AppShell` versus "no padding ancestor" (§5.7). Resolved by running that assertion at zero insets; a developer who misses this will either see a false failure or weaken the scroll checks to make it pass.
- **`AppShell`'s `insets` prop is still unread** (U10). If it does not exist or is incompatibly typed, the honest outcome is a blocked report, not an invented padding wrapper — which would also interact with the ancestor test.
- **The dependency guard shells out from inside Jest.** AC-mandated, so it stays, but it makes `npm test` depend on a fully installed tree and on `npm` being on `PATH`; `maxBuffer`, env stripping and a loud parse failure are what keep it from degrading into a guard that passes without checking (§5.13).

## 6.1 How files are classified in the ImplementationPlan (concern 14)

Revision 6 split generated files inconsistently — `App.tsx` and `__tests__/App.test.tsx` under *modify*, while the equally generated `android/`, `index.js` and `app.json` sat under *create*. That makes the modify list useless as a review checklist. **One rule now, applied mechanically:**

- **`files_to_modify`** = paths that exist **today**, before any work. Measured: that is exactly **two** — the tracked empty `README.md` and the untracked `docs/context/CUPBOARD-1-…md`.
- **`files_to_create`** = everything else, including every file the generator produces. Each reason states its provenance and whether it is afterwards hand-edited: *"Generated; committed untouched"* versus *"Generated, then hand-edited:"*. So a reviewer reads the hand-edit set off the reasons, not off the list split.
- Large generated trees (`android/`, `ios/`) are listed **once** as a directory with a file count in the reason, per the plan format; the hand-added `assets/leaflet/*` files are listed individually and excluded from those counts.
- `android/app/src/main/assets/` does not exist in the template (§2.10c), so `mkdir -p android/app/src/main/assets/leaflet` is called out as a step in the approach rather than smuggled in as a phantom "file".

---

## 7. Self-audit record (revision 7)

Three passes, each from a different angle; the plan was **revised between passes**, not annotated. Revision 7's starting point was the fourteen review concerns of §0.1 — every one was treated as a hypothesis to be measured, not an opinion to be argued with.

**Pass 1 — AC coverage (26 criteria).** Each tag re-mapped to a concrete step after the concern-driven changes. Findings, all resolved by revision:

1. **GENERATE AND MOVE IN was not satisfiable as written** — the `_gitignore` rename and the `diff -r` gate contradicted each other. Measured both arrangements (§2.10a) and pinned the rename to the generated side, with the gate's output captured and `<gen>` retained (§5.1).
2. **DIAGNOSABLE FAILURE PATH was partly inoperative on the only variant that matters.** The offline criterion is release-only; in-page `console.*` is swallowed in release. Rewrote §5.5 so every in-page signal exits via `postMessage`, added the guarded `post()` helper and a release-visible `document.title` fallback, and added a gate that proves the channel exists (§2.8).
3. **PAN, ZOOM AND GESTURE OWNERSHIP addressed only ancestors, not the WebView itself.** Measured the prop surface (§2.9) and moved the fix into `map.html`'s sizing, which is a file this ticket owns.
4. **VIEW CONSTANTS ARE ACTUALLY CONSUMED was still one step from a tautology** (`includes('12')`). Replaced with a parsed JSON argument asserted against both the literal and the constant (§5.7).
5. ~~**HEADER SHOWS NOTHING** and SAFE AREA WIRED gained real unit-level evidence.~~ **SUPERSEDED (rev 8) for the header half**: `HEADER SHOWS NOTHING` is no longer a criterion, and `'header' in props === false` is replaced by an assertion that the `AppHeader` element and its three props ARE supplied (§0.2.4). The SAFE AREA half stands: `props.insets` is asserted under the zero-insets stub, and the device screenshot proves what is painted.
6. **BUILDS AND LAUNCHES had no step that produced a device.** Six criteria depended on an emulator that nothing started. Pre-checked feasibility (§2.11) and pinned the launch, the boot poll, the timeout and the blocked trigger (§5.14).

**Pass 2 — Risk.** Every file re-checked against the anti-patterns, the blast-radius table, the irreversibility rules and the migration/multi-tenancy/N+1 checklist (confirmed not applicable, recorded rather than dropped). The pass also re-checked **revision 7's own additions**, which is how the `document.title` fallback was caught and removed. Findings:

- **`git add -A` could commit `node_modules`** in a tree where `npm ci` had run. Two independent guards added: the scaffold commit now precedes `npm ci`, and every `git add -A` is gated on `git check-ignore -q node_modules` exiting 0 (measured polarity, §2.10b). Promoted to HIGH anti-pattern 32.
- **Exit-code polarity is now a named hazard.** Three gates pass on non-zero or on inverted codes; two of them are the *same command*. Called out in §6 and at each call site.
- **The dependency guard could silently truncate.** Measured 351,893 bytes on a bare tree; pinned `maxBuffer`, env stripping, explicit `cwd`, a timeout and a loud parse failure (§5.13, anti-pattern 39).
- **A latent two-criterion conflict was found** (insets-as-padding versus the no-padding-ancestor walk) that revision 6 would have failed on a correct implementation. Resolved by running that block at zero insets, with the rationale written down so it is not mistaken for a weakened assertion (anti-pattern 40).
- **`leaflet.css`'s three `images/*` references** were measured and an expected-silence note added, so a stray subresource error is attributable rather than noise to be masked (§5.5).
- Six anti-patterns added (31–34 HIGH, 35–40 MEDIUM), each backed by a measurement rather than by pattern matching.

**Pass 3 — Scope.** Walked every step against the 26 criteria and the out-of-scope list.

- **Rejected the one concern that asked for scope to change:** replacing `npm ls --json --all` with a lockfile read. The criterion names that mechanism explicitly, so swapping it would be an architect overriding an AC. Kept and hardened instead, with the reasoning recorded (§5.13) so the decision is reviewable rather than silent.
- **Additions weighed and kept** — each closes a HIGH or MEDIUM finding at minimal cost, inside files this ticket already owns: the guarded `post()` helper and the one-line `init-ok` heartbeat (which makes logcat silence diagnostic instead of ambiguous); `map.html`'s sizing CSS (replaces a prop that does not exist); the prefix URL predicate; the parsed-JSON assertion; the `check-ignore` and emulator-boot gates; and two assertions on `AppShell`'s props that use machinery already pinned.
- **One addition was made and then withdrawn by the risk pass itself**: `onNavigationStateChange` as a `document.title` fallback channel. Reading `RNCWebViewClient.java:311` and `RNCWebChromeClient.java:133` showed no `onReceivedTitle` override, so a post-load title set emits no event — reassuring dead code. Withdrawn, the prop removed, and the dead end written down (§5.5) so a later reader does not re-derive it. **Net effect of this pass on the prop list: one fewer prop than the plan it reviewed.**
- **Additions rejected:** `scrollEnabled`/`nestedScrollEnabled`/`overScrollMode` as pinned props (the first does not exist on Android, the second already defaults correctly, the third is held in reserve for an on-device symptom); an `insets` padding wrapper invented by the agent (author's call — blocked report instead); a fourth test file; a copy script as a new committed file (the commands live in `README.md`, where the AC puts provenance, and the digest test is the enforcement); vendoring `dist/images/*`; `@types/node` as a dependency; any `tsconfig.json`/lint/Jest configuration edit.
- **Removals:** ~~none needed beyond revision 6's (`APP_TITLE` and all `AppHeader` usage on the primary path stay removed).~~ **SUPERSEDED (rev 8):** `AppHeader` is back on the primary path, with an inline `title="Cupboard"` literal rather than an `APP_TITLE` constant (§0.2.3).
- **Still explicitly absent** (**revised in rev 8**: `BackHandler` is now required — §0.2.3): error UI, offline banner, retry, `Linking.openURL`, Leaflet marker images, `.eslintignore`, `ignorePatterns`, `.prettierignore`, new `.gitignore` rules, a capitalized launcher label, icons, iOS work, native map SDKs, and any real functionality behind Settings/Places/Notes.
- **Blocked paths preserved and extended to six:** `newArchEnabled=false`; a genuine AGP-classpath failure; a red pristine baseline fixable only by configuration; an unsignable/uninstallable release APK; **an emulator that will not boot**; and **an `AppShell` without a usable `insets` prop**. None is engineered around.

All three passes are clean or resolved. The one deliberate deviation from a reviewer suggestion (§5.13) is recorded with its reason, and the plan is ready for human approval.
