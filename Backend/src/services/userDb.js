// Stub for user database sync — no-op if you don't use per-user databases
async function createUserDatabase(user) {
  // intentionally left empty
}

async function syncUserProperty(user, property, action) {
  // intentionally left empty
}

module.exports = { createUserDatabase, syncUserProperty };
