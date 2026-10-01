/**
 * Static host for the songreply app. The lyric model is a bundled JSON file
 * and all retrieval runs in the browser - the worker serves files only.
 */
export default {
  async fetch(req, env) {
    return env.ASSETS.fetch(req);
  },
};
