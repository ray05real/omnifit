// The standard version of the app is built without the Bluetooth library (see app.config.js).
const variant = require('./variant.json');

module.exports = variant.scale
  ? {}
  : { dependencies: { 'react-native-ble-plx': { platforms: { ios: null, android: null } } } };
