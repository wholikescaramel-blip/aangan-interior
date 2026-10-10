# Vaani dashboard settings

> **Status:** Vaani's docs weren't available while this was written, so setting names below are
> generic. Exact field names, and whether Vaani can fill per-call variables, will be confirmed from
> your dashboard and the first real webhook payload. Values marked **TBC** get filled in then.

| Setting | Value |
|---|---|
| **Agent name** | Aangan Studio – Intake |
| **System prompt** | Contents of `agent/rendered/vaani_prompt_v2_business_hours.md` (or `_after_hours.md`), produced by `npm run render-prompt`. If Vaani supports per-call variables, paste `agent/vaani_prompt_v2.md` instead and map the variables below. |
| **First message / greeting** (if Vaani asks for it separately) | Business hours: "Namaste, thank you for calling Aangan Studio! I'm Aangan's virtual assistant, an AI. This call is recorded so our designers can help you better. Are you planning a home or an office interior?" After hours: use the after-hours opening from section 4 of the prompt. |
| **Who speaks first** | Agent |
| **Language** | English (India), with Hindi enabled / multilingual auto-detect. If only one language can be chosen, pick the multilingual/Hinglish option. |
| **Voice** | A warm Indian-English female voice that also speaks Hindi naturally. Pick the same voice for both languages. Exact voice name: TBC from Vaani's list. |
| **LLM** | The most capable model Vaani offers on your plan. Temperature 0.3–0.4. |
| **Max call duration** | 6 minutes (the prompt targets under 5) |
| **Silence timeout / end on silence** | About 8 seconds, with one re-prompt (the prompt handles "Hello, can you hear me?") |
| **Interruptions / barge-in** | On |
| **End-call tool / hang up** | On (the agent ends the call after its goodbye) |
| **Call recording** | **On** (the opening tells callers the call is recorded) |
| **Transcript** | On, included in the post-call webhook |
| **Post-call webhook URL** | `https://<your-vercel-app>/api/webhooks/vaani?token=<VAANI_WEBHOOK_SECRET>` (the secret is in `.env`) |
| **Webhook events** | Call ended / call completed / analysis ready. Not "call started". |
| **Webhook auth header** (if Vaani has a field for one) | `x-webhook-secret: <VAANI_WEBHOOK_SECRET>`. You can then drop `?token=` from the URL. |
| **Phone number** | Your inbound +91 number, assigned to this agent for **inbound** calls. TBC which number. |
| **Business hours** | Leave the agent answering 24/7. The prompt picks the right greeting. |

## Per-call variables (only if Vaani supports them)

| Variable | Value |
|---|---|
| `IS_BUSINESS_HOURS` | `true` Mon–Sat 10:00–19:00 IST, else `false` |
| `CALLBACK_WINDOW` | `within an hour` if the call is Mon–Sat 10:00–18:00 IST; otherwise `by eleven a.m. on the next working day` |
| `CALLER_NUMBER_LAST4` | Last 4 digits of the caller ID |
| `TODAY` | e.g. `Monday, 12 October 2026` |
| `APPROVED_PRICE_BAND_TEXT` | empty (studio decision: no figures) |

If Vaani can only call a URL at the start of a call to fetch these, tell me and I'll add a `/api/vaani/call-context` endpoint.

## After the first test call
Send me the payload that arrives (the dashboard's Errors section shows "payload had no transcript" if the field names differ). I'll then pin the exact fields in `lib/vaani.ts`, and switch to Vaani's signature check if it has one.
