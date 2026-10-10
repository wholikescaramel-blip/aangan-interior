# Aangan Studio: Qualification Rules (v1, approved 2026-10-09)

Source of truth: `knowledge/qualified.md` (Nikhil Deshpande's rubric), with service limits from
`knowledge/services.md`. Quotes are verbatim. Items marked **[DECISION]** were approved by the studio on
2026-10-09 to resolve vague or conflicting points (see "Decision log" at the end).

This file is given to Gemini for post-call qualification and defines what the Vaani agent must ask.
`pricing.md` is never given to Gemini or to the agent.

---

## 1. Statuses

| Status | Meaning | HubSpot | Telegram |
|---|---|---|---|
| `qualified` | Criteria C1, C2 and C3 pass. C4 and C5 pass or are unclear. All must-have fields collected. | Deal at QUALIFIED | Posted 🟢 |
| `needs_review` | No clear fail, but something stops a confident "qualified": a must-have is missing, C1/C2/C3 is still unclear, or a boundary case below says needs_review. | Deal at NEEDS_REVIEW | Posted 🟡 (if SEND_NEEDS_REVIEW=true) |
| `not_qualified` | A genuine enquiry that clearly fails at least one of C1–C4. | Contact + call only | Not posted |
| `not_a_lead` | Vendor, job seeker, spam, wrong number, existing client (incl. complaints). | Call logged + tagged, no deal (no contact if spam) | Not posted |

- If unsure between `qualified` and `not_qualified`, return `needs_review`.
- Never return `not_qualified` for a caller who passes all five criteria.
- Use only what the caller actually said. Never infer a value they did not give.

---

## 2. Fields

### MUST-HAVE (all needed for `qualified`)
| # | Field | Used by |
|---|---|---|
| M1 | **Project type and scope** (home / office; full home / partial / single room / office fit-out / other) **and intent to do design + execution** | C1 |
| M2 | **Location** (locality) | C2 |
| M3 | **Timeline**: when the project must be **complete** (qualified.md: *"Ask: 'When would you need the project complete?'"*); also the start / possession date if given | C3 |
| M4 | **Name** | handoff |
| M5 | **Callback number** (the calling number confirmed, or another number given) | handoff |

If M1–M4 is still missing after the agent asked twice, the result is `needs_review`. M5: see section 5.

### SHOULD-ASK (asked; a missing answer never blocks `qualified`)
- Approximate **carpet area** (sq ft). Needed for the commercial size limit and the deal name.
- **Property status**: under construction / ready / occupied.
- **Decision-maker** (C5), asked lightly.


### NEVER ASKED, recorded only if volunteered
- **Budget** [DECISION]. qualified.md: *"Don't quote. Don't probe."*
- **asked_about_pricing** (true/false). Never disqualifying.
- **How they heard of Aangan** (source). Not asked (studio decision 2026-10-10); recorded only if the caller mentions it.

---

## 3. The five criteria

qualified.md: *"An enquiry reaches a designer when it passes all five criteria below. If any one is
unclear, ask one direct question. If it fails one, close gracefully — don't forward an incomplete lead."*

### C1. Real project, not just advice
- Quote: *"The person wants design and execution, not a consultation or a second opinion."*
- Red flags (quoted): *"just looking for ideas," "can you come and advise," "I'll do the execution myself."*
- Quote: *"Our minimum engagement is a room redesign with full execution."*
- **FAIL**:
  - advice / styling / decor only
  - standalone furniture sourcing
  - Vastu-only consultation
  - design without execution
  - restaurant, hotel, retail store or gym (*"out of scope"*)
  - architecture / structural work as the main request
  - commercial space **over 3,500 sq ft** [DECISION]
- **PASS**:
  - full home (any BHK, including 1BHK [DECISION])
  - partial home (*"a full floor, or 2+ rooms with execution"*)
  - single room with *"complete redesign with all materials, furniture, and execution"*
  - office / clinic / studio up to ~3,000 sq ft, **with no minimum size** [DECISION]
- **needs_review**:
  - commercial 3,000–3,500 sq ft
  - intent to execute still unclear (e.g. "just exploring", nothing more)
- A good project that **also** asks for structural changes (e.g. knocking down a wall): `qualified`, with a
  note that the structural part is out of scope [DECISION].

### C2. In our service area
- Quote: *"Pune city or PCMC. If the site is in Talegaon, Nashik, Mumbai, or anywhere outside our area — decline politely."*
- **IN** (from services.md): Kothrud, Baner, Aundh, Wakad, Koregaon Park, Kalyani Nagar, Viman Nagar, Hadapsar,
  Magarpatta, NIBM, Kondhwa, Undri, Shivane, Warje, Erandwane, Deccan, and adjoining areas; PCMC: Pimpri,
  Chinchwad, Pimple Saudagar, Pimple Nilakh, Ravet, Hinjewadi.
- **IN, because they're inside PMC or PCMC limits** [DECISION]:
  - Pune: Kharadi, Balewadi, Bavdhan, Pashan, Sus, Sinhagad Road, Nanded City, Wagholi, Shivajinagar, Camp,
    Yerwada, Wanowrie, Bibwewadi, Katraj, Dhanori, Lohegaon, Mundhwa, Keshav Nagar, Karve Nagar, Sahakar Nagar
  - PCMC: Moshi, Bhosari, Akurdi, Nigdi, Tathawade, Punawale, Pimple Gurav, Sangvi, Thergaon
- **OUT**: Talegaon, Lonavala, Nashik, Mumbai, Chakan, and any other city.
- **needs_review**: a locality not listed above whose status inside PMC/PCMC limits isn't certain (e.g.
  Khadakwasla, Kirkatwadi, Pirangut, Hinjewadi Phase 3 outskirts). Put the locality in the reasons.

### C3. Realistic timeline [DECISION]
- qualified.md: *"The site must be available for execution within 8–10 weeks of the consultation. If someone
  needs it done in 3 weeks, we cannot serve them well."*
- services.md: *"Minimum lead time: we cannot begin execution on a project that needs to be ready in under
  6 weeks from today."*
- Rule:
  - Needs the project **complete in under 6 weeks** from the call: **FAIL**.
  - Needs it complete in **6–10 weeks**: `needs_review` (tight; designer decides).
  - Complete **more than 10 weeks** away, flexible, or "no rush": **PASS**.
  - A start date far in the future (e.g. execution from Feb 2027) **passes**.
  - If the caller first names an impossible date but then accepts a later one on the same call, judge on the
    date they accepted.
  - Possession in a few weeks with design starting now **passes**.

### C4. Right budget band (broadly) [DECISION]
- qualified.md: *"Don't quote. Don't probe. ... If budget is not mentioned, treat as qualified."* and *"If they
  volunteer a number that clearly fails, note it and do not forward."*
- Not mentioned: **PASS**.
- Volunteered total **under ₹2 lakh for any scope bigger than a single room** (e.g. kitchen + a bedroom,
  a full flat, an office fit-out): **FAIL**.
- Any other volunteered figure: **PASS**, with "budget mentioned by caller, designer to confirm fit" in the summary.
- The agent never comments on whether a budget is enough, and never states any figure.

### C5. Decision-maker on the call (or represented)
- Quote: *"The person should be the one who decides, or calling on behalf of someone who has authorised
  them to move forward."*
- **PASS**: owner, co-owner, founder or manager with a mandate, or someone saying they are authorised.
- Unclear or not asked: `qualified` with a note (qualified.md: *"Unclear on 4 or 5: do not push. Treat as
  qualified and note the uncertainty"*) [DECISION].
- Clearly just researching for someone else with no mandate (*"I'm just doing initial research for my
  in-laws"*): `needs_review`, not `not_qualified` [DECISION].

---

## 4. Combining the criteria [DECISION]
1. Check not_a_lead first (section 5).
2. **Any one clear FAIL on C1, C2, C3 or C4: `not_qualified`.**
3. Otherwise, any needs_review condition or missing must-have: `needs_review`.
4. Otherwise: `qualified`.

### What does NOT disqualify (quoted from qualified.md)
- *Not knowing exactly what they want*
- *Calling outside office hours (answer, qualify, book)*
- *Asking for pricing (deflect, but do not disqualify)*
- *Being uncertain about materials, style, or layout*
- *A single room project (one room with full execution is fine)*
- *A rented apartment (fine, as long as no structural changes)*
- Also: frustration about an earlier missed callback. Flag it in the summary as "handle with care".

---

## 5. not_a_lead and edge cases

| Situation | Status |
|---|---|
| Vendor / supplier / contractor pitching services | `not_a_lead` (tag: vendor) |
| Job seeker / internship | `not_a_lead` (tag: job_seeker) |
| Spam, robocall, wrong number | `not_a_lead` (tag: spam / wrong_number; no contact for spam) |
| Existing client, incl. complaints | `not_a_lead` (tag: existing_client); summary states the issue and urgency |
| Repeats an earlier enquiry nobody followed up | normal qualification; summary flags "repeat caller, earlier follow-up missed" |
| Call drops / silence before any project info | `needs_review` if caller ID present, else `not_a_lead` (tag: no_content) |
| Caller won't confirm a number but caller ID is present | qualify normally; callback = caller ID |
| Caller ID withheld and no number given | `needs_review`, missing_info includes "callback number" |
| Asks only about price and gives no project info | `needs_review` |

---

## 6. Output hygiene
- `summary` and `suggested_next_step` must **never contain a rupee amount, "lakh", "crore" or any per-sq-ft rate**,
  including the caller's own budget. Write "Budget: mentioned by caller" or "Budget: not mentioned".
- `reasons` must each cite the rule, e.g. "C2 FAIL: site in Talegaon (outside service area)".
- `collected.budget` may hold the caller's exact words (it goes to Neon/HubSpot only, never Telegram).

---

## Decision log (2026-10-09)
| # | Question | Decision |
|---|---|---|
| Q1a | Ask budget? | No. Record only if volunteered. |
| Q1b | "Clearly too low"? | Under ₹2 lakh for anything bigger than a single room gives not_qualified; anything else, qualified + note. |
| Q1c | Budget in Telegram? | Only "Mentioned: yes/no". No rupee figures in Telegram. |
| Q2 | Timeline | Complete in <6 wk: fail; 6–10 wk: needs_review; >10 wk or flexible: pass; far-off start passes. |
| Q3 | Researching for someone else, no mandate | needs_review |
| Q4 | Area fringe | In if inside PMC/PCMC limits; out-of-limits named towns are out; uncertain localities go to needs_review. |
| Q5 | One fail vs two | One clear fail on C1–C4 gives not_qualified. |
| Q6 | Commercial minimum / 1BHK | No commercial minimum; 1BHK full home counts. |
| Q7 | Pricing line | pricing.md's sentence without "I can book that for you right now". |
| Q8 | Unclear C4/C5 | qualified + note (qualified.md wins over "uncertain gives needs_review"). |
| Q9 | Structural add-on | qualified + note that the structural part is out of scope. |
| Q10 | Price sentence after repeated asks (2026-10-10) | None. APPROVED_PRICE_BAND_TEXT stays empty; agent never says any figure. |
