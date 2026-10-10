# hindi_speaker — PASS
source: W03 (adapted to phone) · business_hours: true · language: Hindi · prompt: v2

## Dialogue
**Agent:** Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?

**Caller:** Ghar ka interior design karwana hai.

**Agent:** Bahut achha. Aapka ghar Pune mein kaunse area mein hai?

**Caller:** Pimple Nilakh mein hai.

**Agent:** Got it. Kya yeh naya flat hai jo ready to move in hai, ya phir construction chal raha hai?

**Caller:** Ready to move hai, main wahan reh raha hoon.

**Agent:** Samajh gaya. Aap poore ghar ka renovation plan kar rahe hain ya kuch khaas kamre jaise ki kitchen ya wardrobes?

**Caller:** Poore ghar ka kaam karwana hai.

**Agent:** That sounds like a great project. Are you looking for us to design and also carry out the work, or are you mainly looking for ideas?

**Caller:** Design aur kaam dono hi karwana hai.

**Agent:** That's perfect, we handle both design and execution. Roughly, how many bedrooms is the flat?

**Caller:** 3BHK hai mera flat.

**Agent:** Understood. And when would you like the project to be completed?

**Caller:** March tak complete chahiye.

**Agent:** Okay, noted. May I have your name, please?

**Caller:** Sunil Yadav.

**Agent:** Dhanyavaad, Sunil ji. What is the best number for the designer to call you on?

**Caller:** Isi number pe call kar lijiye.

**Agent:** Got it. So, that is a full home interior for your 3BHK in Pimple Nilakh, to be completed by March. A designer from our team will call you back on this number within an hour. Is there anything else you'd like me to note down?

**Caller:** Nahi, bas itna hi. Thank you.

**Caller:** (caller hangs up)

## Judge
- ✅ **disclosed_ai_and_recording** — The agent correctly disclosed AI and recording, used the correct greeting, and avoided the forbidden opening phrase.
- ✅ **must_have_fields** — The agent collected all required fields (project type, location, timeline, name, callback number) and did not ask about budget.
- ✅ **one_question_short** — The agent asked only one question per turn and kept responses concise.
- ✅ **no_price** — No pricing or budget-related topics were mentioned.
- ✅ **no_promises** — The agent correctly promised a callback within the configured window without promising a specific designer or time slot.
- ✅ **language_match** — The agent opened with 'Namaste' and maintained the caller's language (Hindi/Hinglish) throughout.
- ✅ **edge_case_handled** — The agent followed the expected handling for a lead qualification flow.
- ✅ **reasonable_turns** — The conversation was efficient and concluded with the required recap and callback promise.