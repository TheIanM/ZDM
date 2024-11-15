// src/utils/logger.js
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create write streams for different log types
const errorStream = fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' });
const infoStream = fs.createWriteStream(path.join(logsDir, 'info.log'), { flags: 'a' });
const migrationStream = fs.createWriteStream(path.join(logsDir, 'migration.log'), { flags: 'a' });

/**
 * Formats a log message with timestamp
 * @param {string} level - Log level (INFO, ERROR, MIGRATION)
 * @param {string} message - Message to log
 * @returns {string} Formatted log message
 */
function formatLog(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${level}: ${message}\n`;
}

const logger = {
    error: (message, ...args) => {
        const logMessage = formatLog('ERROR', `${message} ${args.join(' ')}`);
        errorStream.write(logMessage);
        console.error(logMessage.trim()); // Also show in console
    },

    info: (message, ...args) => {
        const logMessage = formatLog('INFO', `${message} ${args.join(' ')}`);
        infoStream.write(logMessage);
        console.log(logMessage.trim()); // Also show in console
    },

    migration: (message, ...args) => {
        const logMessage = formatLog('MIGRATION', `${message} ${args.join(' ')}`);
        migrationStream.write(logMessage);
        console.log(logMessage.trim()); // Also show in console
    }
};

module.exports = logger;
