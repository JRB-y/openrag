import { Worker } from "bullmq";
import pino from "pino";
import { createRedisConnection, INGESTION_QUEUE_NAME, type IngestionJobData } from "@openrag/core";

const logger = pino({ name: "worker" });
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);

// Dummy processor for now: real parsing/chunking/embeddings land in
// the "Job d'ingestion complet" step. This just proves jobs flow from
// the API through Redis to the worker.
const worker = new Worker<IngestionJobData>(
  INGESTION_QUEUE_NAME,
  async (job) => {
    logger.info({ documentId: job.data.documentId }, "processing ingestion job");
  },
  {
    connection: createRedisConnection(),
    concurrency,
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, documentId: job.data.documentId }, "ingestion job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, documentId: job?.data.documentId, attemptsMade: job?.attemptsMade, err },
    "ingestion job failed",
  );
});

logger.info({ concurrency }, "worker started");

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    worker.close().then(() => process.exit(0));
  });
}
