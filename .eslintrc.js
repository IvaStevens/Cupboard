module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // tools/*.js are plain Node CLI scripts (CUPBOARD-4's map-data
      // converter), not React Native source. @react-native's base config
      // already declares module/require/process/console/__dirname as
      // known globals, but not the full Node global set - the scripts
      // also use `Buffer` (asset byte-size logging), so `env: {node:
      // true}` is needed rather than listing globals one at a time.
      files: ['tools/**/*.js'],
      env: {node: true},
    },
  ],
};
