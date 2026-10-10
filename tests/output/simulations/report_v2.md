# Agent prompt simulation report — v2
Run: 2026-10-10T13:15:50.123Z · agent models: gemini-3-flash-preview, gemini-3.1-flash-lite, gemini-flash-lite-latest · 5/10 run personas passed

| Persona | Result | Agent turns | Failed criteria |
|---|---|---|---|
| [t01_referral_kothrud](v2/t01_referral_kothrud.md) | ✅ PASS | 13 |  |
| [t02_wakad_price](v2/t02_wakad_price.md) | ❌ FAIL | 0 | run_error |
| [t04_advice_only](v2/t04_advice_only.md) | ✅ PASS | 2 |  |
| [vague_caller](v2/vague_caller.md) | ❌ FAIL | 12 | must_have_fields |
| [price_obsessed](v2/price_obsessed.md) | ✅ PASS | 11 |  |
| [hindi_speaker](v2/hindi_speaker.md) | ✅ PASS | 10 |  |
| [existing_client_update](v2/existing_client_update.md) | ❌ FAIL | 4 | disclosed_ai_and_recording, edge_case_handled |
| [out_of_scope_vastu_only](v2/out_of_scope_vastu_only.md) | ✅ PASS | 3 |  |
| [rude_caller](v2/rude_caller.md) | ❌ FAIL | 4 | no_price |
| [refuses_number](v2/refuses_number.md) | ❌ FAIL | 10 | must_have_fields, reasonable_turns |

## Failing excerpts
- **t02_wakad_price / run_error**: TypeError: fetch failed
- **vague_caller / must_have_fields**: The agent asked about the square footage, which is a proxy for budget/scope that was not required and borders on budget-related questioning.
  > Roughly, is the home closer to eight hundred or fifteen hundred square feet?
- **existing_client_update / disclosed_ai_and_recording**: The agent failed to use the correct greeting variant for after-hours (it did not acknowledge the time) and asked a qualification question despite the persona being an existing client update.
  > Are you planning a home or an office interior?
- **existing_client_update / edge_case_handled**: The agent failed to recognize the existing client status immediately and attempted to run a qualification flow.
  > Are you planning a home or an office interior?
- **rude_caller / no_price**: The agent violated the no-price rule by promising an indicative range.
  > The designer will give you a proper indicative range when they call.
- **refuses_number / must_have_fields**: The agent ran a full qualification flow despite qualifyFlow being set to false, and asked for area/size details which were not required.
  > That's great. Roughly, is the carpet area of your home closer to eight hundred or twelve hundred square feet?
- **refuses_number / reasonable_turns**: The agent dragged the conversation by performing a full qualification flow when it should have been a non-lead handling.
  > That's great. Roughly, is the carpet area of your home closer to eight hundred or twelve hundred square feet?