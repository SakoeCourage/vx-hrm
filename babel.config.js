module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        test: /node_modules\/react-native\/src\/private\/webapis\/geometry\/DOMRect(ReadOnly)?\.js$/,
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        ],
      },
    ],
    plugins: ['react-native-worklets-core/plugin', 'react-native-worklets/plugin'],
  };
};
