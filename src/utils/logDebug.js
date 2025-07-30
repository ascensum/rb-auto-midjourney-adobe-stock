function logDebug(...args) {
  // Check the environment variable every time the function is called
  const isDebugMode = process.env.DEBUG_MODE === 'true';
  if (isDebugMode) {
    console.log(...args);
  }
}

module.exports = { logDebug }; 