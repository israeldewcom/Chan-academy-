const Redis = require('ioredis');
const logger = require('./logger');

class RedisConnection {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
    this.isInitialized = false;
  }

  connect() {
    if (this.isInitialized) return this;

    const options = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        if (times > 10) {
          logger.error('Redis max retries reached');
          return null;
        }
        logger.info(`Redis retry attempt ${times} in ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      lazyConnect: false,
    };

    if (process.env.REDIS_PASSWORD) {
      options.password = process.env.REDIS_PASSWORD;
    }

    if (process.env.NODE_ENV === 'production') {
      options.tls = {};
    }

    this.client = new Redis(process.env.REDIS_URL, options);
    this.subscriber = new Redis(process.env.REDIS_URL, options);

    this.client.on('connect', () => {
      logger.info('✅ Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      logger.error('❌ Redis client error:', err.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('⚠️ Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('🔄 Redis client reconnecting...');
    });

    this.client.on('end', () => {
      logger.warn('📴 Redis client connection ended');
      this.isConnected = false;
    });

    this.subscriber.on('connect', () => {
      logger.info('✅ Redis subscriber connected');
    });

    this.subscriber.on('error', (err) => {
      logger.error('❌ Redis subscriber error:', err.message);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
    });

    this.isInitialized = true;
    return this;
  }

  async shutdown() {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.client) {
        await this.client.quit();
      }
      this.isConnected = false;
      this.isInitialized = false;
      logger.info('Redis connections closed gracefully');
    } catch (error) {
      logger.error('Error shutting down Redis:', error);
    }
  }

  // ==================== BASIC OPERATIONS ====================

  async get(key) {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Redis GET error for key "${key}":`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key "${key}":`, error.message);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key "${key}":`, error.message);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis EXISTS error for key "${key}":`, error.message);
      return false;
    }
  }

  async expire(key, ttl) {
    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key "${key}":`, error.message);
      return false;
    }
  }

  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key "${key}":`, error.message);
      return -2;
    }
  }

  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis KEYS error for pattern "${pattern}":`, error.message);
      return [];
    }
  }

  async delPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info(`Deleted ${keys.length} keys matching pattern "${pattern}"`);
      }
      return keys.length;
    } catch (error) {
      logger.error(`Redis DEL pattern error for "${pattern}":`, error.message);
      return 0;
    }
  }

  // ==================== COUNTER OPERATIONS ====================

  async increment(key, amount = 1) {
    try {
      return await this.client.incrby(key, amount);
    } catch (error) {
      logger.error(`Redis INCR error for key "${key}":`, error.message);
      return null;
    }
  }

  async decrement(key, amount = 1) {
    try {
      return await this.client.decrby(key, amount);
    } catch (error) {
      logger.error(`Redis DECR error for key "${key}":`, error.message);
      return null;
    }
  }

  async getCounter(key) {
    try {
      const value = await this.client.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      logger.error(`Redis GET counter error for key "${key}":`, error.message);
      return 0;
    }
  }

  // ==================== SET OPERATIONS ====================

  async sadd(key, ...members) {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      logger.error(`Redis SADD error for key "${key}":`, error.message);
      return null;
    }
  }

  async srem(key, ...members) {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      logger.error(`Redis SREM error for key "${key}":`, error.message);
      return null;
    }
  }

  async sismember(key, member) {
    try {
      return await this.client.sismember(key, member);
    } catch (error) {
      logger.error(`Redis SISMEMBER error for key "${key}":`, error.message);
      return false;
    }
  }

  async smembers(key) {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error(`Redis SMEMBERS error for key "${key}":`, error.message);
      return [];
    }
  }

  async scard(key) {
    try {
      return await this.client.scard(key);
    } catch (error) {
      logger.error(`Redis SCARD error for key "${key}":`, error.message);
      return 0;
    }
  }

  // ==================== SORTED SET OPERATIONS ====================

  async zadd(key, score, member) {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      logger.error(`Redis ZADD error for key "${key}":`, error.message);
      return null;
    }
  }

  async zrem(key, member) {
    try {
      return await this.client.zrem(key, member);
    } catch (error) {
      logger.error(`Redis ZREM error for key "${key}":`, error.message);
      return null;
    }
  }

  async zscore(key, member) {
    try {
      return await this.client.zscore(key, member);
    } catch (error) {
      logger.error(`Redis ZSCORE error for key "${key}":`, error.message);
      return null;
    }
  }

  async zrank(key, member) {
    try {
      return await this.client.zrank(key, member);
    } catch (error) {
      logger.error(`Redis ZRANK error for key "${key}":`, error.message);
      return null;
    }
  }

  async zrevrank(key, member) {
    try {
      return await this.client.zrevrank(key, member);
    } catch (error) {
      logger.error(`Redis ZREVRANK error for key "${key}":`, error.message);
      return null;
    }
  }

  async zrange(key, start, stop, withScores = false) {
    try {
      return withScores
        ? await this.client.zrange(key, start, stop, 'WITHSCORES')
        : await this.client.zrange(key, start, stop);
    } catch (error) {
      logger.error(`Redis ZRANGE error for key "${key}":`, error.message);
      return [];
    }
  }

  async zrevrange(key, start, stop, withScores = false) {
    try {
      return withScores
        ? await this.client.zrevrange(key, start, stop, 'WITHSCORES')
        : await this.client.zrevrange(key, start, stop);
    } catch (error) {
      logger.error(`Redis ZREVRANGE error for key "${key}":`, error.message);
      return [];
    }
  }

  async zcard(key) {
    try {
      return await this.client.zcard(key);
    } catch (error) {
      logger.error(`Redis ZCARD error for key "${key}":`, error.message);
      return 0;
    }
  }

  async zincrby(key, increment, member) {
    try {
      return await this.client.zincrby(key, increment, member);
    } catch (error) {
      logger.error(`Redis ZINCRBY error for key "${key}":`, error.message);
      return null;
    }
  }

  // ==================== HASH OPERATIONS ====================

  async hset(key, field, value) {
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      return await this.client.hset(key, field, serialized);
    } catch (error) {
      logger.error(`Redis HSET error for key "${key}":`, error.message);
      return null;
    }
  }

  async hget(key, field) {
    try {
      const value = await this.client.hget(key, field);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Redis HGET error for key "${key}":`, error.message);
      return null;
    }
  }

  async hdel(key, field) {
    try {
      return await this.client.hdel(key, field);
    } catch (error) {
      logger.error(`Redis HDEL error for key "${key}":`, error.message);
      return null;
    }
  }

  async hgetall(key) {
    try {
      const data = await this.client.hgetall(key);
      if (!data) return {};
      const result = {};
      for (const [field, value] of Object.entries(data)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      return result;
    } catch (error) {
      logger.error(`Redis HGETALL error for key "${key}":`, error.message);
      return {};
    }
  }

  async hincrby(key, field, increment) {
    try {
      return await this.client.hincrby(key, field, increment);
    } catch (error) {
      logger.error(`Redis HINCRBY error for key "${key}":`, error.message);
      return null;
    }
  }

  async hexists(key, field) {
    try {
      return await this.client.hexists(key, field);
    } catch (error) {
      logger.error(`Redis HEXISTS error for key "${key}":`, error.message);
      return false;
    }
  }

  // ==================== LIST OPERATIONS ====================

  async lpush(key, value) {
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      return await this.client.lpush(key, serialized);
    } catch (error) {
      logger.error(`Redis LPUSH error for key "${key}":`, error.message);
      return null;
    }
  }

  async rpush(key, value) {
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      return await this.client.rpush(key, serialized);
    } catch (error) {
      logger.error(`Redis RPUSH error for key "${key}":`, error.message);
      return null;
    }
  }

  async lpop(key) {
    try {
      return await this.client.lpop(key);
    } catch (error) {
      logger.error(`Redis LPOP error for key "${key}":`, error.message);
      return null;
    }
  }

  async rpop(key) {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error(`Redis RPOP error for key "${key}":`, error.message);
      return null;
    }
  }

  async lrange(key, start, stop) {
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      logger.error(`Redis LRANGE error for key "${key}":`, error.message);
      return [];
    }
  }

  async llen(key) {
    try {
      return await this.client.llen(key);
    } catch (error) {
      logger.error(`Redis LLEN error for key "${key}":`, error.message);
      return 0;
    }
  }

  // ==================== PUB/SUB OPERATIONS ====================

  async publish(channel, message) {
    try {
      const serialized = typeof message === 'object' ? JSON.stringify(message) : message;
      const receivers = await this.client.publish(channel, serialized);
      return receivers;
    } catch (error) {
      logger.error(`Redis PUBLISH error for channel "${channel}":`, error.message);
      return 0;
    }
  }

  async subscribe(channel, callback) {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            callback(JSON.parse(message));
          } catch {
            callback(message);
          }
        }
      });
      return true;
    } catch (error) {
      logger.error(`Redis SUBSCRIBE error for channel "${channel}":`, error.message);
      return false;
    }
  }

  async unsubscribe(channel) {
    try {
      await this.subscriber.unsubscribe(channel);
      return true;
    } catch (error) {
      logger.error(`Redis UNSUBSCRIBE error for channel "${channel}":`, error.message);
      return false;
    }
  }

  // ==================== PIPELINE & TRANSACTIONS ====================

  multi() {
    return this.client.multi();
  }

  pipeline() {
    return this.client.pipeline();
  }

  // ==================== CACHE HELPERS ====================

  async cacheGetOrSet(key, fetchFn, ttl = 3600) {
    try {
      const cached = await this.get(key);
      if (cached !== null) return cached;

      const data = await fetchFn();
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      logger.error(`Redis cacheGetOrSet error for key "${key}":`, error.message);
      return fetchFn();
    }
  }

  async invalidateCache(pattern) {
    try {
      return await this.delPattern(pattern);
    } catch (error) {
      logger.error(`Redis invalidateCache error for pattern "${pattern}":`, error.message);
      return 0;
    }
  }

  // ==================== UTILITY METHODS ====================

  getClient() {
    return this.client;
  }

  getSubscriber() {
    return this.subscriber;
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      status: this.client?.status || 'unknown',
      mode: this.client?.mode || 'unknown',
    };
  }

  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async flushAll() {
    if (process.env.NODE_ENV === 'test') {
      await this.client.flushall();
      logger.info('Redis flushed (test environment)');
    } else {
      throw new Error('Cannot flush Redis in non-test environment');
    }
  }

  async getInfo() {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Redis INFO error:', error.message);
      return null;
    }
  }

  async getMemoryUsage() {
    try {
      const info = await this.client.info('memory');
      const usedMemoryMatch = info.match(/used_memory_human:(.+)/);
      const peakMemoryMatch = info.match(/used_memory_peak_human:(.+)/);
      return {
        used: usedMemoryMatch ? usedMemoryMatch[1].trim() : 'N/A',
        peak: peakMemoryMatch ? peakMemoryMatch[1].trim() : 'N/A',
      };
    } catch (error) {
      return { used: 'N/A', peak: 'N/A' };
    }
  }

  // ==================== RATE LIMITING HELPERS ====================

  async rateLimitCheck(key, limit, windowMs) {
    const luaScript = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      if current > tonumber(ARGV[2]) then
        return 0
      end
      return 1
    `;

    try {
      const result = await this.client.eval(luaScript, 1, key, windowMs, limit);
      return result === 1;
    } catch (error) {
      logger.error(`Redis rateLimitCheck error for key "${key}":`, error.message);
      return true; // Allow on error
    }
  }

  async getRateLimitRemaining(key, limit) {
    try {
      const current = parseInt(await this.client.get(key) || '0');
      return Math.max(0, limit - current);
    } catch (error) {
      return 0;
    }
  }
}

const redisInstance = new RedisConnection();
module.exports = redisInstance;
