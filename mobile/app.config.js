/**
 * Dynamic Expo config on top of app.json.
 *
 * Plain-HTTP (cleartext) traffic is allowed only in development: an EAS
 * `development` build, or a local `expo run` / `expo prebuild` with no EAS
 * profile, which needs it to reach an API on localhost or the LAN. Preview and
 * production builds keep the platform default and refuse cleartext, so they
 * can only talk to an HTTPS API (eas.json points them at the deployed one).
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const allowCleartext = !profile || profile === 'development';

  const plugins = (config.plugins ?? []).map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
      ? [
          plugin[0],
          { ...plugin[1], android: { ...(plugin[1]?.android ?? {}), usesCleartextTraffic: allowCleartext } },
        ]
      : plugin
  );

  const infoPlist = { ...(config.ios?.infoPlist ?? {}) };
  if (allowCleartext) {
    infoPlist.NSAppTransportSecurity = { NSAllowsLocalNetworking: true };
  }

  return { ...config, plugins, ios: { ...config.ios, infoPlist } };
};
