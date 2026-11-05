module.exports = {
  preset: 'react-native',
  // bobuttons' native build (dist/index.native.js) is ESM
  // ("type": "module"), so the preset's default transformIgnorePatterns
  // (which only re-includes react-native/@react-native(-community))
  // leaves it untransformed and an import throws
  // "Cannot use import statement outside a module". Appending it here
  // keeps the preset's own alternation intact - overriding this key
  // without re-including it would break transform handling for
  // react-native itself, not just for bobuttons.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|bobuttons)/)',
  ],
};
