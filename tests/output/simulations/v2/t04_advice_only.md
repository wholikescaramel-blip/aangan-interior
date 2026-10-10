# t04_advice_only — PASS
source: T04 · business_hours: true · language: English · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** Home. Just looking for some ideas for my living room.

**Agent:** Got it. Are you looking for us to design and also carry out the work, or mainly for ideas?

**Caller:** Just ideas, not the full work. Just exploring for now. Maybe later.

**Caller:** (caller hangs up)

## Judge
- ✅ **disclosed_ai_and_recording** — The agent used the correct business hours greeting including the AI and recording disclosures, and did not use the forbidden opening phrase.
- ✅ **must_have_fields** — The agent correctly asked for the project type and checked for execution intent without proceeding to full qualification, as qualifyFlow was false and an edge case was detected.
- ✅ **one_question_short** — The agent asked only one question per turn and kept responses concise.
- ✅ **no_price** — No pricing or budget figures were mentioned.
- ✅ **no_promises** — The agent made no promises regarding timelines or specific personnel.
- ✅ **language_match** — The agent opened with Namaste and correctly matched the caller's use of English.
- ✅ **edge_case_handled** — The agent correctly checked for execution intent once the caller mentioned 'ideas'. The caller terminated the call before the agent could explain the policy.
- ✅ **reasonable_turns** — The conversation was handled efficiently until the caller hung up.