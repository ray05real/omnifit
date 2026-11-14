// Two versions of Omnifit are built from the same code (the owner, 14 Nov 2026):
//  - the standard one (variant.json: "scale": false): weight is logged by hand, no Bluetooth at all.
//    This is the one for other people and, one day, the App Store.
//  - the owner's own, "with scale" ("scale": true): adds Bluetooth for their Renpho scale.
// The GitHub build writes variant.json before building each one.
const variant = require('./variant.json');

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ...(variant.scale
      ? [
          [
            'react-native-ble-plx',
            {
              isBackgroundEnabled: false,
              bluetoothAlwaysPermission: 'Omnifit reads your weight from your Bluetooth scale when you weigh yourself.',
            },
          ],
        ]
      : []),
  ],
});
