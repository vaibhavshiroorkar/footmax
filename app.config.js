// GitHub Pages serves the site from /footmax, so the deploy build sets
// EXPO_BASE_URL. Local dev leaves it unset and stays at the root.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
