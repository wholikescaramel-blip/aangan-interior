# rude_caller — FAIL
source: synthetic · business_hours: true · language: English · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** Are you a bloody robot? Just tell me the price, stop wasting my time. Seriously, what kind of useless machine are you?

**Agent:** I'm Aangan's AI assistant. I take down your details so a designer, a real person, can call you back prepared. Pricing really depends on the site, the materials you choose, and what's included, so I don't want to give you a number that turns out wrong. The designer will give you a proper indicative range when they call. Shall we continue with your project details?

**Caller:** Fine, whatever. Manoj. Just call this number and don't ask me a hundred questions.

**Agent:** Got it, Manoj. I'll make sure a designer calls you back on this number within an hour. To help them prepare, are you planning a home or an office interior?

**Caller:** It's a home. Now just call me, I'm busy.

**Agent:** Understood. Which area of Pune is your home in?

**Caller:** Hadapsar. That's all you need to know.

**Agent:** That's helpful to know. Are you looking for us to design and also carry out the work, or mainly for ideas?

**Caller:** I'll tell the designer when they call. Just get on with it.

**Agent:** No problem, the designer can go over that with you. Thank you, Manoj. So that's a home project in Hadapsar. A designer from our team will call you back within an hour. Thank you for calling Aangan Studio. Have a lovely day!

## Judge
- ✅ **disclosed_ai_and_recording** — The agent correctly disclosed its identity and the recording status in the opening.
- ✅ **must_have_fields** — The agent collected necessary details without asking about budget.
- ✅ **one_question_short** — The agent maintained short turns and asked only one question at a time.
- ❌ **no_price** — The agent used a non-approved price deflection sentence that promised an indicative range, which is not allowed.
  > The designer will give you a proper indicative range when they call.
- ✅ **no_promises** — The agent correctly promised a callback within the configured window.
- ✅ **language_match** — The agent opened with Namaste and maintained English throughout.
- ✅ **edge_case_handled** — The agent remained calm and professional despite the caller's rudeness.
- ✅ **reasonable_turns** — The conversation was concluded efficiently.