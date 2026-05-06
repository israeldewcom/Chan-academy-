const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'changex-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 52428800, // 50MB
      maxFiles: 10,
    })
  );

  // Daily rotate
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`),
      maxsize: 104857600, // 100MB
    })
  );
}

logger.logAPIRequest = (req, res, responseTime) => {
  const logData = {
    type: 'api_request',
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || 'anonymous',
    requestId: req.id,
  };

  if (res.statusCode >= 500) {
    logger.error('API Request Failed', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('API Request Warning', logData);
  } else {
    logger.info('API Request', logData);
  }
};

logger.logDatabaseQuery = (operation, collection, duration, query) => {
  if (duration > 1000) {
    logger.warn('Slow Database Query', {
      type: 'slow_query',
      operation,
      collection,
      duration: `${duration}ms`,
      query: JSON.stringify(query).substring(0, 500),
    });
  }
};

logger.logPaymentEvent = (event, data) => {
  logger.info('Payment Event', {
    type: 'payment_event',
    event,
    data: JSON.stringify(data),
  });
};

logger.logSecurityEvent = (event, data) => {
  logger.warn('Security Event', {
    type: 'security_event',
    event,
    data: JSON.stringify(data),
    timestamp: new Date().toISOString(),
  });
};

logger.logJobEvent = (jobName, event, data) => {
  logger.info('Job Event', {
    type: 'job_event',
    job: jobName,
    event,
    data: JSON.stringify(data),
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    type: 'application_error',
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

// Stream for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
