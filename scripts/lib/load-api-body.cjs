module.exports = body => {
  try { return JSON.parse(body).status === "ready" } catch { return false }
}
