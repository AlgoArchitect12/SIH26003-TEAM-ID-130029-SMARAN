// Native Maps keys belong in Expo/EAS environment variables, never in JS extras.
module.exports = ({ config }) => {
  const androidKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();
  const valid = key => !!key && /^AIza[\w-]{35}$/.test(key);
  if ((androidKey && !valid(androidKey)) || (iosKey && !valid(iosKey))) {
    throw new Error('Invalid Google Maps key configuration.');
  }
  if (process.env.EAS_BUILD === 'true' && !valid(process.env.EAS_BUILD_PLATFORM === 'ios' ? iosKey : androidKey)) {
    throw new Error('Configure the platform Google Maps key in the selected EAS environment before building.');
  }
  return { ...config,
    android: { ...config.android, ...(androidKey ? { config: { ...config.android?.config, googleMaps: { apiKey: androidKey } } } : {}) },
    ios: { ...config.ios, ...(iosKey ? { config: { ...config.ios?.config, googleMapsApiKey: iosKey } } : {}) },
    extra: { ...config.extra, mapsConfigured: { android: valid(androidKey), ios: valid(iosKey) } },
  };
};
