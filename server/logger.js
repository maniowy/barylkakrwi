module.exports = function() {
  const config = require('../config/logger.json');
  const logger = require('simple-node-logger').createSimpleLogger({
    logFilePath: config.path,
    timestampFormat: config.timestamp
  });
  logger.setLevel(config.level);
  return logger;
}
