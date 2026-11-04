/// <reference types="node" />
/**
 * AC17: ties the vendored Android Leaflet assets to the pinned `leaflet`
 * devDependency, so the vendored copy and the pinned package version
 * cannot drift unnoticed.
 *
 * Reads the vendored assets by EXPLICIT path, never a glob: two build
 * copies of `leaflet.js` already exist on disk at
 * `android/app/build/intermediates/assets/{debug,release}/merge{Debug,Release}Assets/leaflet/leaflet.js`
 * and a glob would find and byte-compare those too.
 *
 * `leaflet.js` is NOT a whole-file byte-compare against
 * `node_modules/leaflet/dist/leaflet.js`: the vendored copy has one
 * `/* eslint-disable *\/` line prepended (see README.md), so a whole-file
 * compare fails at byte 4 on an otherwise-correct tree. The prepended
 * line itself is pinned so the strip is not silently wrong.
 *
 * `/// <reference types="node" />` is required because this template's
 * tsconfig sets `types: ["jest"]`, which keeps @types/node out of the
 * program - a bare `fs`/`path` import would otherwise be TS2307.
 *
 * @format
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '..');
const VENDORED_DIR = path.join(
  REPO_ROOT,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'leaflet',
);
const VENDORED_CSS = path.join(VENDORED_DIR, 'leaflet.css');
const VENDORED_JS = path.join(VENDORED_DIR, 'leaflet.js');

const NODE_MODULES_LEAFLET_DIST = path.join(
  REPO_ROOT,
  'node_modules',
  'leaflet',
  'dist',
);
const NODE_MODULES_CSS = path.join(NODE_MODULES_LEAFLET_DIST, 'leaflet.css');
const NODE_MODULES_JS = path.join(NODE_MODULES_LEAFLET_DIST, 'leaflet.js');

const PINNED_LEAFLET_VERSION = '1.9.4';

describe('vendored Leaflet assets match the pinned leaflet devDependency', () => {
  it('leaflet.css is byte-identical to node_modules/leaflet/dist/leaflet.css', () => {
    const vendored = fs.readFileSync(VENDORED_CSS);
    const installed = fs.readFileSync(NODE_MODULES_CSS);
    expect(vendored.equals(installed)).toBe(true);
  });

  it("leaflet.js's prepended first line is exactly the pinned eslint-disable comment", () => {
    const vendored = fs.readFileSync(VENDORED_JS, 'utf8');
    const firstNewline = vendored.indexOf('\n');
    expect(firstNewline).toBeGreaterThan(-1);
    expect(vendored.slice(0, firstNewline)).toBe('/* eslint-disable */');
  });

  it('leaflet.js is byte-identical to node_modules/leaflet/dist/leaflet.js after stripping the prepended line', () => {
    const vendored = fs.readFileSync(VENDORED_JS);
    const installed = fs.readFileSync(NODE_MODULES_JS);
    const firstNewlineIdx = vendored.indexOf(0x0a);
    expect(firstNewlineIdx).toBeGreaterThan(-1);
    const vendoredTail = vendored.subarray(firstNewlineIdx + 1);
    expect(vendoredTail.equals(installed)).toBe(true);
  });

  it('the vendored banner version, the installed package version, and the pinned devDependency are all 1.9.4', () => {
    const vendoredJs = fs.readFileSync(VENDORED_JS, 'utf8');
    expect(vendoredJs).toContain(`Leaflet ${PINNED_LEAFLET_VERSION}`);

    const installedPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, 'node_modules', 'leaflet', 'package.json'),
        'utf8',
      ),
    ) as {version: string};
    expect(installedPackageJson.version).toBe(PINNED_LEAFLET_VERSION);

    const ownPackageJson = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as {devDependencies?: Record<string, string>};
    expect(ownPackageJson.devDependencies?.leaflet).toBe(PINNED_LEAFLET_VERSION);
  });
});
