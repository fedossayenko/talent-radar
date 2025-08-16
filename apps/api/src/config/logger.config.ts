import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: isDevelopment }),
  winston.format.printf(({ timestamp, level, message, context, stack }) => {
    const contextStr = context ? `[${context}] ` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${level}: ${contextStr}${message}${stackStr}`;
  }),
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: logLevel,
    format: consoleFormat,
  }),
];

// Add file transports in non-development environments
if (!isDevelopment) {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  );
}

// Add HTTP transport for external logging services (optional)
if (process.env.LOG_HTTP_ENDPOINT) {
  transports.push(
    new winston.transports.Http({
      host: process.env.LOG_HTTP_HOST,
      port: parseInt(process.env.LOG_HTTP_PORT || '80', 10),
      path: process.env.LOG_HTTP_PATH || '/logs',
      ssl: process.env.LOG_HTTP_SSL === 'true',
    }),
  );
}

export const loggerConfig: WinstonModuleOptions = {
  level: logLevel,
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'talent-radar-api',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    ...(isDevelopment ? [] : [
      new winston.transports.File({
        filename: 'logs/exceptions.log',
        format: fileFormat,
      }),
    ]),
  ],
  
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    ...(isDevelopment ? [] : [
      new winston.transports.File({
        filename: 'logs/rejections.log',
        format: fileFormat,
      }),
    ]),
  ],
  
  // Exit on handled exceptions
  exitOnError: false,
};

// Create a simple logger instance for use outside of NestJS
export const logger = winston.createLogger(loggerConfig);