# CUPBOARD-1 — Initialize Cupboard Android app with Chicago map

Architect context, **revision 7**. Supersedes revisions 3, 4, 5 and 6 in full.

Branch: `CUPBOARD-1-initialize-cupboard-android-app-with-chicago-map` — **verified today**: exists locally, is checked out, and tracks `origin`. Do not create or rename a branch.
Domain: Mobile (React Native 0.83 Android) app initialization; bobuttons/Tamagui UI; Leaflet 1.9.4 in `react-native-webview` loaded from `file:///android_asset`.
TaskSpec: **revision 2, 26 acceptance criteria**, each with an ALL-CAPS tag. Every reference below uses the tag, never a number.

---

## 0. Why revision 6 existed (retained: the revision 5 → 6 delta is still load-bearing)

Revision 5 was written against a **16-criterion** TaskSpec. TaskSpec revision 2 has **26**, and three of them contradict or extend revision 5. Revision 6 also replaces four *rules* with *measurements*.

| Change | Revision 5 said | Revision 6 says | Section |
| --- | --- | --- | --- |
| **HEADER** | `AppShell > AppHeader` with `APP_TITLE = 'Cupboard'`, and "renders the literal string Cupboard from a named constant" was treated as an AC | **Withdrawn.** The author's instruction is *"dont put anything in the header for now"*. `AppShell` is rendered with its **`header` prop omitted**. `APP_TITLE` does not exist. No `AppHeader`, no title, no date | §5.3 |
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
| `App.tsx` | `BobuttonsProvider` → generated `SafeAreaProvider`/`StatusBar` → `AppShell` (**no `header`**, real `insets`) → map |
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
5. **Putting an app name, title or date in the header.** The author's instruction is explicit, and bobuttons' `AppHeader` declares `title: string` **required** and also renders a date — so `title=""` still leaves visible content, and editing bobuttons is forbidden. Omit `header`. Revision 5's `APP_TITLE = 'Cupboard'` plan is void (§5.3).
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
30. **Adding custom back handling.** No `BackHandler`, no WebView `goBack`. The hardware back button must exit the app.

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

### 5.3 Composition: provider, shell, empty header, insets, map

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
- **Header: omit the prop.** `AppShell` is rendered with **no `header` prop at all**. Rationale: bobuttons' `AppHeader` declares `title: string` as **required** and also renders a date, so `title=""` would still leave visible header content, and modifying bobuttons is forbidden. Omitting is the only mechanism that renders *nothing*. **`npx tsc --noEmit` is the test of this decision**: if `header` is non-optional, the typecheck fails and the ordered fallback applies — pass `AppHeader` with `title=""` and record in the PR that the library-rendered date is an unavoidable library constraint. **No bobuttons edit and no local re-implementation of `AppHeader` in either case.** There is no `APP_TITLE` constant and no app-name string anywhere in this ticket.
- **Insets — an ordered ladder, because `AppShell`'s prop surface is unread until `npm ci` (U10).** (a) Pass the `useSafeAreaInsets()` result into `AppShell`'s `insets` prop — the AC's mechanism, and the library's default is all-zero with safe-area handling explicitly on the consuming app. (b) If `tsc` rejects the **shape**, construct `{ top, right, bottom, left }` explicitly from the hook result — no cast, no new dependency. (c) If `insets` turns out to have an **incompatible type** (a number, differently-named keys) or **not to exist**, that contradicts the AC's own premise: **report SAFE AREA WIRED blocked, naming the prop and quoting the `.d.ts` line.** Do **not** invent a padding wrapper above `AppShell` as an agent decision — it is a defensible option but it is the author's call, and it interacts with the ancestor test (§5.7). Never edit bobuttons, never edit `gradle.properties`.
- **Where the WebView sits.** Preferred `AppShell > ViewPane > ViewBody > MapScreen`, **used only if `ViewBody` neither pads nor scrolls** — determined by reading the installed `bobuttons` source after `npm ci` (grep `ViewBody`/`ViewPane` for `ScrollView`, `contentContainerStyle`, `padding`). If either pads or scrolls, `MapScreen` goes **directly under `AppShell`**. Whichever is used is stated in the PR with its evidence, and §5.7's ancestor test asserts it. Either way **the map is inside the AppShell** — never a bare full-screen WebView replacing the shell.
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

- `'header' in appShell.props === false` — the header is omitted, as a mechanism check (the device screenshot remains the proof that nothing is *painted*);
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

**`__tests__/App.test.tsx`** stays a smoke test in the shape the generator produced (`act` + `create`, no assertions), with the mandatory `react-native-webview` mock added. Its job is "App composes without throwing", not prop verification: it renders through the **real** `SafeAreaProvider`, which yields zero children (§2.6), so it can assert nothing about the tree. The header and insets mechanism checks live in `map.test.tsx`, where the provider is mocked; `tsc` proves `header` is omittable and the device screenshot proves the header is empty.

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
4. Screenshot 1 (Chicago at zoom 12, OSM attribution visible, **nothing in the header**, content clear of the status and navigation bars), then pan by drag and zoom by pinch **and** by Leaflet's `+`/`−` control (the control is the dependable evidence; the gesture is the on-device check), then screenshot 2. Both via `adb exec-out screencap -p` into `/home/ivana/Desktop/Code/tmp/`, named by absolute path in the PR body for the author to attach. **Not committed.**
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

- **BACK BUTTON.** Add **no** `BackHandler` wiring and **no** WebView `goBack`. The hardware back button exits the app. Confirmed once on device (§5.14 step 5). A `grep -r "BackHandler\|goBack" src App.tsx` returning nothing is the source-side evidence.
- **LAUNCHER IDENTITY LEFT AS GENERATED.** `app.json`'s `name`, `MainActivity`, `MainApplication`, `android/app/build.gradle`'s `applicationId` and `strings.xml` are left **exactly** as generated (lowercase `cupboard` / `com.cupboard`). A capitalized launcher label is explicitly not part of this ticket, and editing `app.json`'s `name` breaks the launch.

---

## 6. Risks and constraints

- **Irreversibility.** One `rsync --delete`, `git init` or `git commit --amend` destroys a human author's history and the remote link. The history gate exists for this.
- **The typecheck is a new gate that invalidates two of revision 5's test mechanisms** (§2.5, measured). `findByType('WebView')` and bare `import fs from 'fs'` both fail `tsc`. Remedies pinned: the component reference, and `/// <reference types="node" />`. A Developer following revision 5 verbatim would ship a red typecheck.
- **The header decision is enforced by the typecheck, not by a test.** The real `SafeAreaProvider` renders nothing under Jest, so no Jest assertion can prove the header is empty. `tsc` proves `header` is omittable; the screenshot proves it is empty. If `header` is required, the fallback leaves a library-rendered date that must be disclosed, not hidden.
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
- **Scope-creep pressure points to resist:** an app name or title in the header, an offline banner or retry UI, `Linking.openURL` on the attribution tap, vendoring Leaflet's marker images, a human-readable launcher label, `BackHandler` wiring, a second UI library, a testing library, and "fixing" lint, Jest, TS or the tree gate by configuration.

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
5. **HEADER SHOWS NOTHING and SAFE AREA WIRED gained real unit-level evidence.** Revision 6 declared both unassertable in Jest; under the already-pinned safe-area mock, `AppShell`'s props *are* inspectable, so `'header' in props === false` and `props.insets` are now asserted — the device screenshot remains the proof of what is painted.
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
- **Removals:** none needed beyond revision 6's (`APP_TITLE` and all `AppHeader` usage on the primary path stay removed).
- **Still explicitly absent:** error UI, offline banner, retry, `Linking.openURL`, Leaflet marker images, `.eslintignore`, `ignorePatterns`, `.prettierignore`, new `.gitignore` rules, a capitalized launcher label, `BackHandler`, iOS work, native map SDKs.
- **Blocked paths preserved and extended to six:** `newArchEnabled=false`; a genuine AGP-classpath failure; a red pristine baseline fixable only by configuration; an unsignable/uninstallable release APK; **an emulator that will not boot**; and **an `AppShell` without a usable `insets` prop**. None is engineered around.

All three passes are clean or resolved. The one deliberate deviation from a reviewer suggestion (§5.13) is recorded with its reason, and the plan is ready for human approval.
