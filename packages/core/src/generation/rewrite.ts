import { generateText } from "ai";
import { getLanguageModel } from "./llm.js";
import type { ChatMessage } from "./types.js";

const REWRITE_SYSTEM_PROMPT = `Reformule la dernière question de l'utilisateur pour qu'elle soit compréhensible seule, sans le reste de la conversation. Ne réponds pas à la question, ne fournis que sa reformulation, sans guillemets ni préambule.`;

// Only called when there's history - a first message is already
// standalone, so skipping the LLM round-trip for it is both faster and
// avoids the model subtly rephrasing a question that didn't need it.
export async function rewriteQuestion(history: ChatMessage[], question: string): Promise<string> {
  if (history.length === 0) return question;

  const transcript = history.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`).join("\n");

  const { text } = await generateText({
    model: getLanguageModel(),
    system: REWRITE_SYSTEM_PROMPT,
    prompt: `${transcript}\nUtilisateur : ${question}`,
  });

  return text.trim();
}
