const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    format: logFormat,
    transports: [
        // Console logging
        new winston.transports.Console({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        }),
        // File logging
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'combined.log')
        })
    ]
});

// Add wallet-specific logging function
logger.wallet = (message, data = null) => {
    const logMessage = data ? 
        `WALLET_CTRL: ${message} | Data: ${JSON.stringify(data)}` : 
        `WALLET_CTRL: ${message}`;
    logger.info(logMessage);
};

module.exports = { logger };
