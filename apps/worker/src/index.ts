import { db, documents, createRedisConnection, INGESTION_QUEUE_NAME, type IngestionJobData } from "@openrag/core";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import pino from "pino";
import { ingestDocument } from "./ingest.js";

const logger = pino({ name: "worker" });
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);

const worker = new Worker<IngestionJobData>(
  INGESTION_QUEUE_NAME,
  async (job) => {
    logger.info({ documentId: job.data.documentId }, "processing ingestion job");
    await ingestDocument(job.data.documentId);
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

  const documentId = job?.data.documentId;
  const maxAttempts = job?.opts.attempts ?? 1;
  const exhausted = job !== undefined && job.attemptsMade >= maxAttempts;

  if (documentId && exhausted) {
    db.update(documents)
      .set({ status: "failed", error: err.message, updatedAt: new Date() })
      .where(eq(documents.id, documentId))
      .catch((updateErr: unknown) => {
        logger.error({ documentId, err: updateErr }, "failed to persist failure status");
      });
  }
});

logger.info({ concurrency }, "worker started");

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    worker.close().then(() => process.exit(0));
  });
}
