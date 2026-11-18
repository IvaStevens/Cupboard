module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // tools/*.js are plain Node CLI scripts (CUPBOARD-4's map-data and
      // licence converters), not React Native source. @react-native's
      // base config already declares module/require/process/console/
      // __dirname as known globals, but not the full Node global set -
      // these scripts also use `Buffer` (asset byte-size logging) and
      // `TextDecoder` (considered and rejected in favour of a hand-
      // rolled table - see tools/convertLicences.js - but still
      // referenced in that file's comments/tests), so `env: {node:
      // true}` is needed rather than listing globals one at a time.
      files: ['tools/**/*.js'],
      env: {node: true},
    },
  ],
};
