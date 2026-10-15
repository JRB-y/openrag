import IORedis from "ioredis";
import { env } from "../config.js";

// BullMQ requires maxRetriesPerRequest: null on connections used for
// blocking commands (Worker, QueueEvents) - see BullMQ's Redis docs.
export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
