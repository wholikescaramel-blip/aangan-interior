# out_of_scope_vastu_only — PASS
source: synthetic · business_hours: true · language: English · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** For my home. But I actually just need a Vastu consultation.

**Agent:** Thank you for asking. We don't do Vastu consultations on their own, as we are a full-service interior design studio. We only provide Vastu guidance as part of our complete design and execution projects. Would you be looking for a full home interior project, or are you only looking for Vastu advice?

**Caller:** Oh, okay. But my flat is already complete. Can't you just send a Vastu expert for a quick check?

**Agent:** I understand. As I mentioned, we are a full-service studio and we don't offer standalone visits or advice-only services. We focus on projects where we handle the complete design and execution. I wouldn't want to waste your time since that's not something we do. Wishing you the best with it.

## Judge
- ✅ **disclosed_ai_and_recording** — The agent correctly disclosed its AI nature and the recording, used the correct greeting, and did not use the forbidden opening.
- ✅ **must_have_fields** — QualifyFlow was false, and the agent correctly did not collect personal details.
- ✅ **one_question_short** — The agent maintained short turns and asked at most one question per turn.
- ✅ **no_price** — No pricing information was mentioned.
- ✅ **no_promises** — No promises were made.
- ✅ **language_match** — The agent opened with 'Namaste' and maintained English throughout.
- ✅ **edge_case_handled** — The agent correctly explained that standalone Vastu is not offered and ended the call politely.
- ✅ **reasonable_turns** — The interaction was concise and appropriate for an out-of-scope request.