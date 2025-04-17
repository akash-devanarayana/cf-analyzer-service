/**
 * Simple logger utility that respects LOG_LEVEL from environment variables
 */

// Log levels in order of verbosity
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// Get current log level from environment or default to 'info'
const getCurrentLogLevel = () => {
    const envLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';
    return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.info;
};

// Logger object with methods for each log level
const logger = {
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    
    warn: (message, ...args) => {
        if (getCurrentLogLevel() >= LOG_LEVELS.warn) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    
    info: (message, ...args) => {
        if (getCurrentLogLevel() >= LOG_LEVELS.info) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    
    debug: (message, ...args) => {
        if (getCurrentLogLevel() >= LOG_LEVELS.debug) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }
};

module.exports = logger;