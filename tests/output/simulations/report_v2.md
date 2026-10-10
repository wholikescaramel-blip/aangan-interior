# Agent prompt simulation report — v2
Run: 2026-10-10T13:24:35.742Z · agent models: gemini-3-flash-preview, gemini-3.1-flash-lite, gemini-flash-lite-latest · 2/5 run personas passed

| Persona | Result | Agent turns | Failed criteria |
|---|---|---|---|
| [t02_wakad_price](v2/t02_wakad_price.md) | ❌ FAIL | 12 | no_price |
| [vague_caller](v2/vague_caller.md) | ✅ PASS | 12 |  |
| [existing_client_update](v2/existing_client_update.md) | ❌ FAIL | 3 | no_promises, edge_case_handled |
| [rude_caller](v2/rude_caller.md) | ❌ FAIL | 6 | no_price |
| [refuses_number](v2/refuses_number.md) | ✅ PASS | 9 |  |

## Failing excerpts
- **t02_wakad_price / no_price**: The agent used a non-approved sentence regarding pricing. The instructions state no figures are allowed and the only exception is a specific approved sentence which was not configured.
  > The designer will give you a proper indicative range when they call.
- **existing_client_update / no_promises**: The agent failed to follow the expected handling for an existing client by initiating a qualification question instead of immediately taking the name and confirming the callback.
  > Are you planning a home or an office interior?
- **existing_client_update / edge_case_handled**: The agent failed to recognize the existing client persona immediately and attempted to qualify them.
  > Are you planning a home or an office interior?
- **rude_caller / no_price**: The agent used a non-approved price deflection sentence that promised an indicative range, which is not allowed.
  > The designer will give you a proper indicative range when they call.