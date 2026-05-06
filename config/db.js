const mongoose = require('mongoose');
const logger = require('./logger');

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

class DatabaseConnection {
  constructor() {
    this.retryCount = 0;
    this.isConnected = false;
    this.connection = null;
  }

  async connect() {
    try {
      const options = {
        maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        w: 'majority',
        readPreference: 'primaryPreferred',
      };

      this.connection = await mongoose.connect(process.env.MONGODB_URI, options);

      this.isConnected = true;
      this.retryCount = 0;

      logger.info(`✅ MongoDB connected: ${this.connection.connection.host} (${this.connection.connection.name})`);

      this.setupEventHandlers();
      return this.connection;
    } catch (error) {
      this.retryCount++;
      logger.error(`❌ MongoDB connection attempt ${this.retryCount}/${MAX_RETRIES} failed: ${error.message}`);

      if (this.retryCount < MAX_RETRIES) {
        logger.info(`🔄 Retrying in ${RETRY_INTERVAL / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
        return this.connect();
      }

      logger.error('💀 Maximum retry attempts reached. Exiting...');
      process.exit(1);
    }
  }

  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      logger.info('📊 Mongoose connection established');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ Mongoose disconnected');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 Mongoose reconnected');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Mongoose connection error:', err);
      this.isConnected = false;
    });

    // Connection pool monitoring
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        const poolStats = mongoose.connection.client?.topology?.s?.poolStats;
        if (poolStats) {
          logger.debug('MongoDB Pool Stats:', poolStats);
        }
      }, 60000);
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Closing MongoDB connection...`);
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected manually');
    }
  }

  getStatus() {
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      isConnected: this.isConnected,
      state: stateMap[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      name: mongoose.connection.name || 'N/A',
      models: Object.keys(mongoose.models),
      poolSize: mongoose.connection.client?.topology?.s?.poolSize || 0,
    };
  }

  async ping() {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('MongoDB ping failed:', error);
      return false;
    }
  }

  async clearDatabase() {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
      logger.info('Database cleared');
    } else {
      throw new Error('Cannot clear database in production');
    }
  }
}

const dbInstance = new DatabaseConnection();
module.exports = dbInstance;
