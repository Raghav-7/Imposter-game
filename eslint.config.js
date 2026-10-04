// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'credentials/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.js', 'plugins/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.js', 'plugins/**/*.js', 'tests/**/*', 'src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },
]);
