module.exports = {
  preset: 'react-native',
  // bobuttons' native build (dist/index.native.js) is ESM
  // ("type": "module"), so the preset's default transformIgnorePatterns
  // (which only re-includes react-native/@react-native(-community))
  // leaves it untransformed and an import throws
  // "Cannot use import statement outside a module". Appending it here
  // keeps the preset's own alternation intact - overriding this key
  // without re-including it would break transform handling for
  // react-native itself, not just for bobuttons. react-native-feather is
  // "type": "module" and its CommonJS entry requires ESM files, so it
  // needs the same treatment.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|bobuttons|react-native-feather)/)',
  ],
  // The converted map-data assets (~5 MB of generated JS under
  // android/app/src/main/assets/mapdata/) are never `require`d -
  // excluding the directory from Jest's haste map keeps Jest from trying
  // to parse every one of those files as a module on every run.
  modulePathIgnorePatterns: [
    '<rootDir>/android/app/src/main/assets/mapdata/',
  ],
};
