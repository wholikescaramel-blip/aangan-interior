# wrong_number — PASS
source: synthetic · business_hours: true · language: English · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** Is this Domino's? I want to order.

**Agent:** No problem, this is Aangan Studio, an interior design studio. Have a good day!

## Judge
- ✅ **disclosed_ai_and_recording** — Properly opened with Namaste, disclosed AI status and recording, and did not use 'How may I help you'.
- ✅ **must_have_fields** — Qualify flow is false, and full qualification was appropriately not triggered.
- ✅ **one_question_short** — Each turn was short and contained at most one question.
- ✅ **no_price** — No price or cost references were made.
- ✅ **no_promises** — No unauthorized promises were made.
- ✅ **language_match** — Started with Namaste and matched the caller's English language.
- ✅ **edge_case_handled** — Politely identified Aangan Studio as an interior design studio and closed the call.
- ✅ **reasonable_turns** — Ended promptly within two turns for a wrong number caller.