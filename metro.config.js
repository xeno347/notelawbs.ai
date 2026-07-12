const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Don't crawl/watch build caches — they contain thousands of files that
    // blow past the OS file-watcher limit (EMFILE) and slow bundling.
    blockList: exclusionList([
      /\.gradle-codex\/.*/,
      /\.gradle\/.*/,
      /android\/\.gradle\/.*/,
      /android\/build\/.*/,
      /android\/app\/build\/.*/,
      /ios\/Pods\/.*/,
      /ios\/build\/.*/,
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
