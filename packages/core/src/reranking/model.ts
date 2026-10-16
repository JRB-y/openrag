import { AutoModelForSequenceClassification, AutoTokenizer } from "@huggingface/transformers";
import { env } from "../config.js";

// Loaded once per process and reused: downloading/compiling the ONNX
// session on every call would dominate latency. The promise is created
// at module scope (not inside a function), so the first import of this
// module - typically at process startup - already kicks off loading;
// every caller of rerank() just awaits the same promise.
//
// dtype "fp32", not the faster "q8": testing showed q8's 8-bit
// quantization makes a chunk's score depend on which other chunks
// happen to share its batch (its calibration shifts with batch
// composition), which defeats the point of a fixed RERANK_MIN_SCORE
// threshold. fp32 is batch-invariant - same chunk, same score, always -
// at the cost of landing slightly over DOCS.md's <1s-for-30-candidates
// target (~1.02s measured).
const modelPromise = Promise.all([
  AutoTokenizer.from_pretrained(env.RERANKER_MODEL),
  AutoModelForSequenceClassification.from_pretrained(env.RERANKER_MODEL, { dtype: "fp32" }),
]);

export async function getRerankerModel() {
  const [tokenizer, model] = await modelPromise;
  return { tokenizer, model };
}
