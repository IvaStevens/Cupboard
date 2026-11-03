/// <reference types="node" />
/**
 * NO SECOND TAMAGUI OR WEB COPY - proven, not merely asserted against
 * package.json, because `react-dom` is an optional peer of bobuttons and
 * a lockfile can list a package the installed tree does not actually
 * materialise. Reads package.json for direct entries, then runs
 * `npm ls --json --all` against the real installed tree and parses its
 * stdout, ignoring its exit code (npm ls exits non-zero for unrelated
 * ELSPROBLEMS such as an unmet optional peer).
 *
 * MEASURED DEVIATION FROM THE TICKET'S LITERAL WORDING, disclosed rather
 * than silently special-cased: the ticket's AC text says this should
 * assert "exactly one @tamagui/core instance". Measured on this
 * installed tree (`npm ls --json --all`, grepped case-insensitively for
 * "tamagui"): zero occurrences anywhere. bobuttons' own README states
 * why - Tamagui is bundled *inside* bobuttons' built files
 * (dist/index.native.js) and "is not itself a dependency of this
 * generated app... not as a separate node_modules entry". So a correct
 * tree has ZERO resolved `@tamagui/core` node_modules entries, and
 * finding even one would be the regression this guard exists to catch
 * (a second, separately-installed Tamagui copy alongside the one
 * bobuttons bundles - the exact scenario that produces the "can't find
 * Tamagui configuration" runtime crash). This test therefore asserts
 * "zero resolved @tamagui/core entries" rather than "exactly one": a
 * `toBe(0)` bound, not `toBeLessThanOrEqual(1)` - the laxer bound would
 * stay green if a transitive @tamagui/core ever materialised as a
 * single node_modules entry, which alongside bobuttons' bundled copy is
 * precisely the second-copy regression this guard exists to catch. The
 * PR documents this wording deviation explicitly.
 *
 * @format
 */

import {spawnSync} from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const REPO_ROOT = path.join(__dirname, '..');
const NPM_LS_MAX_BUFFER = 64 * 1024 * 1024; // measured 351,893 bytes on a bare RN tree vs Node's 1MB default
const NPM_LS_TIMEOUT_MS = 60_000;

type NpmLsNode = {
  version?: string;
  dependencies?: Record<string, NpmLsNode>;
};

function countResolvedOccurrences(
  node: NpmLsNode | undefined,
  name: string,
  seen = new Set<NpmLsNode>(),
): number {
  if (!node || seen.has(node)) {
    return 0;
  }
  seen.add(node);
  let count = 0;
  const deps = node.dependencies ?? {};
  for (const [depName, depNode] of Object.entries(deps)) {
    if (depName === name && depNode && typeof depNode.version === 'string') {
      count += 1;
    }
    count += countResolvedOccurrences(depNode, name, seen);
  }
  return count;
}

describe('package.json declares no second Tamagui or web copy', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  function directEntries(): string[] {
    return [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
  }

  it('declares no direct @tamagui/* dependency', () => {
    const tamaguiEntries = directEntries().filter(name =>
      name.startsWith('@tamagui/'),
    );
    expect(tamaguiEntries).toEqual([]);
  });

  it('declares no direct react-dom or react-native-web dependency', () => {
    const entries = directEntries();
    expect(entries).not.toContain('react-dom');
    expect(entries).not.toContain('react-native-web');
  });
});

describe('installed tree has no second Tamagui or web copy', () => {
  it('npm ls --json --all shows no resolved @tamagui/core, react-dom, or react-native-web entry', () => {
    const childEnv: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.toLowerCase().startsWith('npm_config_')) {
        childEnv[key] = value;
      }
    }

    const result = spawnSync('npm', ['ls', '--json', '--all'], {
      cwd: REPO_ROOT,
      env: childEnv,
      timeout: NPM_LS_TIMEOUT_MS,
      maxBuffer: NPM_LS_MAX_BUFFER,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    // npm ls's exit code is ignored on purpose: it exits non-zero for
    // unrelated ELSPROBLEMS (e.g. bobuttons' unmet optional react-dom
    // peer), which is expected and not itself a failure here.
    if (result.error) {
      throw result.error;
    }

    const stdout = result.stdout ?? '';
    let tree: NpmLsNode;
    try {
      tree = JSON.parse(stdout) as NpmLsNode;
    } catch (err) {
      throw new Error(
        `npm ls --json --all produced unparseable output (${stdout.length} bytes): ${
          (err as Error).message
        }`,
      );
    }

    // 0, not the ticket text's literal "exactly one" - see the MEASURED
    // DEVIATION note at the top of this file. No @tamagui/core is a
    // node_modules entry at all, bundled or otherwise, since bobuttons
    // bundles its own copy inside its built files rather than declaring
    // it as a dependency; a resolved entry here would be the second-copy
    // regression this guard exists to catch.
    expect(countResolvedOccurrences(tree, '@tamagui/core')).toBe(0);
    expect(countResolvedOccurrences(tree, 'react-dom')).toBe(0);
    expect(countResolvedOccurrences(tree, 'react-native-web')).toBe(0);
  }, NPM_LS_TIMEOUT_MS + 10_000);
});
