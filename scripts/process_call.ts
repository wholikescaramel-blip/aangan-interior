/** Re-runs the after-call pipeline for one call id (or all stuck ones): npx tsx --env-file=.env scripts/process_call.ts <id> */
import { processCall } from "../lib/pipeline";
import { generate } from "../lib/gemini";
(async () => {
  const t0 = Date.now();
  if (process.argv[3] === "--probe") {
    const r = await generate({ system: "Reply OK", contents: "ping" }).catch((e) => ({ text: "ERR " + e.message, model: "-" }));
    console.log("probe:", r.model, r.text.slice(0, 80), Date.now() - t0, "ms");
  }
  await processCall(process.argv[2]);
  console.log("done in", Date.now() - t0, "ms");
})();
