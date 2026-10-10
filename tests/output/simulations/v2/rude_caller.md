# rude_caller — FAIL
source: synthetic · business_hours: true · language: English · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** Are you a bloody robot? Just tell me the price, stop wasting my time. This is such a useless piece of software.

**Agent:** I'm Aangan's AI assistant. I take down your details so a designer, a real person, can call you back prepared. Pricing really depends on the site, the materials you choose, and what's included, so I don't want to give you a number that turns out wrong. The designer will give you a proper indicative range when they call. Shall we continue with your project details?

**Caller:** Fine, whatever. Just call me back on this number. Name's Manoj. It's for a 2BHK in Hadapsar.

**Agent:** Got it, Manoj. Is the flat ready to move in, or is it still under construction?

**Caller:** I told you, just call me back. I'm not answering all these questions.

**Agent:** I understand, Manoj. I have your name and the project details for your two BHK in Hadapsar. A designer from our team will call you back within an hour. Thank you for calling Aangan Studio. Have a lovely day!

## Judge
- ✅ **disclosed_ai_and_recording** — The agent correctly disclosed its AI nature and the recording status in the opening.
- ✅ **must_have_fields** — Since qualifyFlow was false, the agent correctly stopped after the caller refused further questions.
- ✅ **one_question_short** — The agent maintained short turns and asked only one question per turn.
- ❌ **no_price** — The agent violated the no-price rule by promising an indicative range.
  > The designer will give you a proper indicative range when they call.
- ✅ **no_promises** — The agent correctly promised a callback within the configured window.
- ✅ **language_match** — The agent opened with Namaste and maintained English throughout.
- ✅ **edge_case_handled** — The agent remained calm and professional despite the caller's rudeness.
- ✅ **reasonable_turns** — The agent handled the interaction efficiently and closed appropriately.