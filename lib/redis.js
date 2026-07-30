import Redis from "ioredis";

let redisClient = null;
const memoryCache = new Map();

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000, // 2s timeout
    });

    redisClient.on("error", (err) => {
      console.warn("[Redis Error] Connection failed, using in-memory backup cache.", err.message);
      redisClient = null; // force fallback on next operations
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected successfully to Redis database.");
    });
  } catch (err) {
    console.warn("[Redis Init Error] Falling back to in-memory cache: ", err.message);
    redisClient = null;
  }
} else {
  console.log("[Cache] No REDIS_URL configured. Using local in-memory cache backup.");
}

export const getCache = async (key) => {
  try {
    if (redisClient) {
      return await redisClient.get(key);
    }
  } catch (err) {
    console.warn("[Cache Read Failure] fallback to memory cache:", err.message);
  }
  return memoryCache.get(key) || null;
};

export const setCache = async (key, value, expirySeconds = 3600) => {
  try {
    if (redisClient) {
      await redisClient.set(key, value, "EX", expirySeconds);
      return;
    }
  } catch (err) {
    console.warn("[Cache Write Failure] fallback to memory cache:", err.message);
  }
  memoryCache.set(key, value);
  // simulate expiry in memory cache
  if (process.env.NODE_ENV !== "test") {
    setTimeout(() => {
      memoryCache.delete(key);
    }, expirySeconds * 1000);
  }
};

export const deleteCache = async (key) => {
  try {
    if (redisClient) {
      await redisClient.del(key);
      return;
    }
  } catch (err) {
    console.warn("[Cache Delete Failure] fallback to memory cache:", err.message);
  }
  memoryCache.delete(key);
};
