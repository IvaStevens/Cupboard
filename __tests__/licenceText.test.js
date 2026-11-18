/**
 * Filesystem-based drift guards for the City of Chicago derivative-use
 * disclaimer (AC21): that the constant in src/licences/licenceText.ts
 * matches the committed source document verbatim, and that README.md's
 * '### Licences' section still mirrors it. A plain .js file (not .tsx)
 * so it can use Node's `fs`/`path`/`__dirname` without needing them
 * added to this project's strict RN tsconfig ("types": ["jest"]).
 *
 * @format
 */

const fs = require('fs');
const path = require('path');

// A TS module with only `export const` string literals - requirable
// from a CommonJS test via ts-jest/babel's interop, same as any other
// .ts module Jest already transforms for this project's other tests.
const {
  CHICAGO_DERIVATIVE_USE_DISCLAIMER,
} = require('../src/licences/licenceText');

describe('CHICAGO_DERIVATIVE_USE_DISCLAIMER (filesystem checks)', () => {
  it('matches the committed source document, verbatim', () => {
    const sourcePath = path.resolve(
      __dirname,
      '..',
      'Chicago Data Portal',
      'TIF Information.html',
    );
    if (!fs.existsSync(sourcePath)) {
      // The raw source folder is gitignored and only present in the main
      // checkout (see MAP-DATA-NOTE.md) - skip this cross-check, not the
      // whole file, when it is absent (e.g. a worktree checkout).
      return;
    }
    const html = fs.readFileSync(sourcePath, 'utf8');
    expect(html).toContain(CHICAGO_DERIVATIVE_USE_DISCLAIMER);
  });

  it("is reproduced in README.md's Licences section (drift guard)", () => {
    const readmePath = path.resolve(__dirname, '..', 'README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');
    expect(readme).toContain('### Licences');
    expect(readme).toContain(CHICAGO_DERIVATIVE_USE_DISCLAIMER);
  });
});
