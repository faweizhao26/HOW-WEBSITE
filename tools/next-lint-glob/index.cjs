const { isAbsolute } = require("node:path")
const { globSync: scan } = require("tinyglobby")

// Next's root-directory helper uses only this synchronous directory scanner.
exports.globSync = function globSync(pattern, options = {}) {
  if (typeof pattern !== "string" || Object.keys(options).some(key => key !== "onlyDirectories")) {
    throw new TypeError("Unsupported Next lint glob API; review the adapter before upgrading the plugin")
  }
  return scan(pattern, {
    ...options,
    absolute: isAbsolute(pattern),
    expandDirectories: false,
  }).map(entry => entry.length > 1 && entry.endsWith("/") ? entry.slice(0, -1) : entry)
}
