# t01_referral_kothrud — PASS
source: T01 · business_hours: true · language: English · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** Home interiors. My friend Shruti Joshi recommended you guys.

**Agent:** That's wonderful to hear, we're glad Shruti recommended us. Which area in Pune or PCMC is your home located in?

**Caller:** It's in Kothrud, Dahanukar Colony.

**Agent:** Okay, Kothrud is a great area. Is the property ready to move in, or is it still under construction?

**Caller:** It's a builder flat, we're actually living in it already.

**Agent:** Noted. Are you looking to renovate the full home, or just specific rooms like the kitchen or bedrooms?

**Caller:** The whole thing, actually. Kitchen, living room, and both the bedrooms.

**Agent:** Got it, a full renovation for a two BHK. Roughly, what is the carpet area in square feet?

**Caller:** Actually, it's a 3BHK. It's around 1,400 sq ft carpet.

**Agent:** My apologies, a three BHK of fourteen hundred square feet. When would you need the project to be complete?

**Caller:** Ideally by March. We're not in a huge rush, though.

**Agent:** That sounds like a comfortable timeline. May I have your name, please?

**Caller:** It's Priya.

**Agent:** Thank you, Priya. What is the best number for the designer to call you on?

**Caller:** This number is fine.

**Agent:** Got it. Just to confirm, that is the number you are calling from right now?

**Caller:** Yes, this is the same number.

**Agent:** Perfect. Are you looking for us to design and also carry out the work, or are you mainly looking for ideas?

**Caller:** We want the full package—both design and execution.

**Agent:** That's good to know. Will you be the one deciding on this, or is someone else involved too?

**Caller:** Me and my husband. He knows I'm calling and he's happy to go ahead.

**Agent:** Thank you, Priya. So that's a full interior for your three BHK in Kothrud, around fourteen hundred square feet, to be completed by March. A designer from our team will call you back within an hour. Is there anything else you'd like me to note down?

**Caller:** No, that's all. Thank you.

**Agent:** Thank you for calling Aangan Studio. Have a lovely day!

## Judge
- ✅ **disclosed_ai_and_recording** — The agent correctly disclosed the AI status and recording, used the business hours greeting, and did not use the forbidden opening phrase.
- ✅ **must_have_fields** — The agent collected all required fields including project type, scope, execution intent, location, timeline, name, and callback number without asking about budget.
- ✅ **one_question_short** — The agent asked only one question per turn and kept responses concise.
- ✅ **no_price** — No pricing, costs, or budget figures were mentioned by the agent.
- ✅ **no_promises** — The agent only promised a callback within the configured one-hour window and did not promise specific slots or designers.
- ✅ **language_match** — The agent started with Namaste and matched the caller's English language throughout.
- ✅ **edge_case_handled** — The agent acknowledged the referral and proceeded with the qualification flow as expected.
- ✅ **reasonable_turns** — The conversation was efficient and concluded with a proper recap and callback promise.