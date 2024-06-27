const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const logDir = path.join(app.getPath('userData'), 'logs');

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir);
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
}


const customFormat = format.combine(
    format.timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
    format.align(),
    format.printf((i: { level: any; timestamp: any; message: any; }) => `${i.level}: ${[i.timestamp]}: ${i.message}`)
);
const defaultOptions = {
    format: customFormat,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
};
const globalLogger = createLogger({
    format: customFormat,
    transports: [
        new transports.DailyRotateFile({
            filename: logDir + "/info-%DATE%.log",
            level: "info",
            ...defaultOptions,
        }),
        new transports.DailyRotateFile({
            filename:  logDir + "/error-%DATE%.log",
            level: "error",
            ...defaultOptions,
        }),
    ],
});

export default globalLogger