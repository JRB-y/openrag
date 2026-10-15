import { Queue } from "bullmq";
import { z } from "zod";
import { createRedisConnection } from "./connection.js";

export const INGESTION_QUEUE_NAME = "ingestion";

export const ingestionJobSchema = z.object({
  documentId: z.string(),
});

export type IngestionJobData = z.infer<typeof ingestionJobSchema>;

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export function createIngestionQueue() {
  return new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: ONE_WEEK_SECONDS },
      removeOnFail: { age: ONE_WEEK_SECONDS },
    },
  });
}
