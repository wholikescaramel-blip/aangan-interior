/**
 * Simulated callers for tests/simulate_calls.ts.
 * Phone-transcript personas (T..) are drawn from knowledge/enquiries_sep2026.txt; dates shifted so
 * timelines make sense relative to the simulation date (9 Oct 2026).
 */
export interface Persona {
  id: string;
  source: string;
  businessHours: boolean;
  /** Last 4 digits of caller ID; "" = number withheld. */
  last4: string;
  /** Language the caller speaks; the agent should mirror it. */
  language: "English" | "Hindi" | "Hinglish";
  /** Instructions for the simulated caller (facts + behaviour). */
  caller: string;
  /** What correct agent handling looks like, for the judge. */
  expected: string;
  /** Whether the full must-have checklist applies (false for non-leads / declines). */
  qualifyFlow: boolean;
}

const QUALIFY =
  "Agent collects project type/scope (with design+execution intent), location, completion timeline, name and confirms callback number, plus should-ask fields once each; does not ask budget; closes with a one-sentence recap and the callback promise.";

export const PERSONAS: Persona[] = [
  {
    id: "t01_referral_kothrud",
    source: "T01",
    businessHours: true,
    last4: "4821",
    language: "English",
    caller:
      "You are Priya. Friend Shruti Joshi referred you (she had her flat in Aundh done by Aangan). 3BHK in Kothrud, Dahanukar Colony, bought two years ago, still a builder flat, you live there. Want the whole thing redone: kitchen, living room, both bedrooms, with execution. About 1,400 sq ft carpet. Want it done by March, no rush. You and your husband own it; he knows you're calling and is happy to go ahead. The calling number is fine.",
    expected: QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "t02_wakad_price",
    source: "T02",
    businessHours: true,
    last4: "3307",
    language: "English",
    caller:
      "You saw Aangan on Instagram. 2BHK in Wakad, about 950 sq ft, you'll be living there. Full redesign: modular kitchen, wardrobes, living room, both bedrooms, with execution. Want it done by February. Early on, ask roughly how much it would cost. When deflected, ask again for 'even a rough range'. Accept the second deflection with 'okay, fair enough'. Name: Rahul Joshi. Calling number fine.",
    expected: QUALIFY + " Deflects pricing both times with no numbers at all, and carries on qualifying.",
    qualifyFlow: true,
  },
  {
    id: "t03_nashik_out_of_area",
    source: "T03",
    businessHours: true,
    last4: "9012",
    language: "English",
    caller:
      "You are Suresh Patil from Nashik. Saw Aangan on LinkedIn. You want to redo your home office and study in Nashik. If told they only work in Pune, ask 'Not even for a smaller project?' once, then accept and say thanks.",
    expected:
      "Agent establishes the location is Nashik, politely explains it only works in Pune and PCMC, does not collect further details (no timeline/area/name chase), stays polite on the follow-up, ends the call.",
    qualifyFlow: false,
  },
  {
    id: "t04_advice_only",
    source: "T04",
    businessHours: true,
    last4: "1145",
    language: "English",
    caller:
      "You want someone to come and give ideas for your living room: colours, furniture arrangement. You are NOT planning to do the full thing or any execution now, just suggestions. If asked whether you want execution, say no, just exploring. Then say 'maybe later' and end.",
    expected:
      "Agent checks execution intent once (\"ideas\" alone is not a decline), then explains Aangan only does design with execution (no advice-only visits), invites them to call back for a full project, does not collect further details, ends politely.",
    qualifyFlow: false,
  },
  {
    id: "t05_kp_site_visit_push",
    source: "T05",
    businessHours: true,
    last4: "7764",
    language: "English",
    caller:
      "You are Aarti Mehta. Vikram Agarwal (a friend of the studio owner Nikhil) asked you to call. 4BHK in Koregaon Park, about 2,400 sq ft carpet, complete redesign with execution: flooring, kitchen, all four bedrooms. You've moved out temporarily. Want to move back in by February. You are the owner. Insist on booking a site visit for 'early next week, Tuesday?' and ask whether Nikhil himself can come.",
    expected:
      QUALIFY +
      " Must NOT promise a site-visit slot, a date, or a specific person (Nikhil). Says the designer will fix a time on their call.",
    qualifyFlow: true,
  },
  {
    id: "t06_startup_office_baner",
    source: "T06",
    businessHours: true,
    last4: "5520",
    language: "English",
    caller:
      "You are Kunal, founder of a startup. First proper office in Baner, about 800 sq ft, bare shell. Need workstations for 20, a small cabin, a meeting room, a break area, full fit-out with execution. Want to be operational by end of January. You're the decision-maker. Heard about Aangan from a friend's office.",
    expected: QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "t07_diwali_rush",
    source: "T07",
    businessHours: true,
    last4: "6631",
    language: "English",
    caller:
      "You want to redo your living room and kitchen in Kothrud before Diwali (about four weeks away), with execution. When told it can't be done in that time, ask 'even just the living room?'. Then ask 'what if I start after Diwali?' and agree to completion by end of February. Then give details: 2BHK, about 900 sq ft, you live there, name Meera Kulkarni, calling number fine.",
    expected:
      "Agent honestly says the Diwali deadline is not possible (no promise), offers a later completion date, and when caller accepts a later date continues qualifying normally. No dates/slots promised.",
    qualifyFlow: true,
  },
  {
    id: "t09_existing_client_complaint",
    source: "T09",
    businessHours: true,
    last4: "2290",
    language: "English",
    caller:
      "You are Sheetal Deshpande, an EXISTING client. Your 2BHK project in Viman Nagar has been going for three months and your designer Aryan hasn't replied in five days. You're angry. Demand a callback from Nikhil or someone senior, 'not whoever picks up'. Give name when asked. Calling number is fine.",
    expected:
      "Agent recognises an existing client, does NOT ask qualification questions, acknowledges calmly, takes name and confirms number, promises a callback within the configured window, does NOT promise Nikhil or any specific person, ends.",
    qualifyFlow: false,
  },
  {
    id: "t10_low_budget_volunteered",
    source: "T10",
    businessHours: true,
    last4: "8803",
    language: "English",
    caller:
      "1BHK in Kharadi, about 550 sq ft, you live there. Want kitchen and one bedroom redone with execution. Early in the call volunteer: 'My budget is 1 to 1.5 lakh maximum for everything. Is that possible with you?' Push once: 'just tell me yes or no, is it enough?'. Want it done by January. Name Arjun Rao. Calling number fine.",
    expected:
      "Agent never repeats the budget figure, never says whether it is enough, never states any price; says it will pass it to the designer; continues qualifying.",
    qualifyFlow: true,
  },
  {
    id: "t11_rented_baner",
    source: "T11",
    businessHours: true,
    last4: "4410",
    language: "English",
    caller:
      "Ask first: 'I'm in a rented apartment, can you still take up a project?' 2BHK in Baner, 3-year lease, landlord fine as long as no walls broken. Want living room, bedroom and kitchen designed with execution, no structural changes. Want it done by end of January. Name Nisha Iyer. You found Aangan on Google.",
    expected: QUALIFY + " Confirms rented is fine without structural changes.",
    qualifyFlow: true,
  },
  {
    id: "t12_villa_principal_designer",
    source: "T12",
    businessHours: true,
    last4: "1001",
    language: "English",
    caller:
      "You are Anand Sharma. Villa in Kalyani Nagar, about 5,500 sq ft, ground plus two floors, new construction, possession last month, empty. Full end-to-end design and execution. Move in by March. Ask: 'Can your principal designer come to site this week or next?'",
    expected: QUALIFY + " Must not promise the principal designer or any visit date.",
    qualifyFlow: true,
  },
  {
    id: "t14_son_for_parents",
    source: "T14",
    businessHours: true,
    last4: "3678",
    language: "English",
    caller:
      "You're calling for your parents. They have a new-possession 3BHK in Hadapsar and want proper interiors with execution. You're doing the initial checking; they'll decide and will come to the consultation. Don't know exact area (maybe 1,100?). Timeline: they'd like to move in by April. Your name Rohan Gokhale.",
    expected: QUALIFY + " Treats the caller respectfully, notes parents decide, does not refuse.",
    qualifyFlow: true,
  },
  {
    id: "t15_undri_possession",
    source: "T15",
    businessHours: true,
    last4: "7150",
    language: "English",
    caller:
      "You are Smita. Getting possession of your 2BHK in Undri in about six weeks, 875 sq ft. Want to start design right away; full home: kitchen, wardrobes, living room, with execution. Want it ready to move in around April. You and your husband own it; he said go ahead.",
    expected: QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "t16_repeat_frustrated",
    source: "T16",
    businessHours: true,
    last4: "5094",
    language: "English",
    caller:
      "You are Girish Nair. You called on Monday about your 3BHK in Viman Nagar and nobody called back. Open by complaining about that. Say 'this is not a good sign'. Then cooperate: full home interiors with execution, about 1,250 sq ft, ready flat you live in, want it done by March.",
    expected: QUALIFY + " Apologises once, does not argue, re-takes details.",
    qualifyFlow: true,
  },
  {
    id: "t17_called_back_after_drop",
    source: "T17",
    businessHours: true,
    last4: "6012",
    language: "English",
    caller:
      "You are Ritu Kapoor from Pimple Saudagar. Start: 'Hi, I called just now and got cut off.' 3BHK, about 1,050 sq ft, lived there two years with builder furniture. Want kitchen, wardrobes, living room with execution. Ideally done by March.",
    expected: QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "t18_small_coworking_pod",
    source: "T18",
    businessHours: true,
    last4: "8820",
    language: "English",
    caller:
      "You run a small coworking space in Aundh. You have a 180 sq ft pod you want made really nice: lighting, a desk, storage, with execution. Done by end of January. Name Vikas Shah. You're the owner.",
    expected:
      "This is an in-scope office project (no minimum size). Agent should NOT decline it; it qualifies normally. " + QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "t19_restaurant_out_of_scope",
    source: "T19",
    businessHours: true,
    last4: "2234",
    language: "English",
    caller:
      "You're opening a restaurant in Koregaon Park and love Aangan's work. Ask if they can design it. If declined, ask if they can refer anyone. Then thank them.",
    expected:
      "Agent politely says restaurants are outside scope, does not collect details, does not invent a referral, ends.",
    qualifyFlow: false,
  },
  {
    id: "t20_magarpatta_simple",
    source: "T20",
    businessHours: true,
    last4: "9133",
    language: "English",
    caller:
      "You are Pooja. 2BHK in Magarpatta, Cybercity area, about 900 sq ft, you live there. Kitchen, both bedrooms, living room with execution. Flexible, a January start for execution would be ideal, finish whenever it's done well. You and your husband own it and both want to be at the consultation.",
    expected: QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "vague_caller",
    source: "synthetic",
    businessHours: true,
    last4: "4402",
    language: "English",
    caller:
      "You're vague and unsure. You 'want to do something with the house'. When asked scope, say 'not sure, maybe the whole thing?'; on a follow-up choice, pick 'a couple of rooms to start'. Location: first say 'Pune', then if offered choices say 'near Aundh, Pashan side'. Timeline: 'soon... I don't know' then 'maybe early next year'. Area: 'no idea' twice. You do want execution, not just ideas. Name Deepak. Number fine.",
    expected:
      "Agent offers easy choices for vague answers, asks each thing at most twice, accepts 'not given' gracefully without pressure, closes properly.",
    qualifyFlow: true,
  },
  {
    id: "price_obsessed",
    source: "synthetic",
    businessHours: true,
    last4: "7711",
    language: "English",
    caller:
      "Your ONLY real interest is price. 3BHK in Baner, about 1,200 sq ft, full home with execution, done by March, name Sameer. Ask about price at least five times in different ways: 'what's your per square foot rate?', 'just a ballpark', 'another studio said 1,500 per sq ft, are you cheaper or costlier?', 'for a 3BHK what's typical, 10 lakh? 20 lakh?', 'so for my 1,200 sq ft what would that come to?'. Get mildly annoyed but stay on the call.",
    expected:
      "Agent deflects the first three asks without any figure (rephrasing, not repeating word for word), never confirms/compares/reacts to the caller's figures, never calculates a total for the flat. From the 4th ask it may say the APPROVED SENTENCE once verbatim if one is configured (otherwise still no figures); never again after that. Keeps qualifying.",
    qualifyFlow: true,
  },
  {
    id: "hindi_speaker",
    source: "W03 (adapted to phone)",
    businessHours: true,
    last4: "5566",
    language: "Hindi",
    caller:
      "Tum Sunil Yadav ho. Sirf Hindi mein baat karo (thoda Hinglish chalega, jaise 'flat', 'interior'). Pimple Nilakh mein 3BHK flat hai, lagbhag 1,100 sq ft, tum wahan rehte ho. Poore ghar ka interior design aur kaam karwana hai. March tak complete chahiye. Dost ne bataya Aangan ke baare mein. Number yahi theek hai.",
    expected:
      QUALIFY + " After 'Namaste' the agent continues in Hindi/Hinglish matching the caller, without announcing a language switch.",
    qualifyFlow: true,
  },
  {
    id: "vendor",
    source: "synthetic",
    businessHours: true,
    last4: "3030",
    language: "English",
    caller:
      "You are a sales rep for a modular kitchen hardware brand. You want to pitch your products and ask who handles purchasing at Aangan, and to get the designer's email.",
    expected:
      "Agent politely says this line is for client enquiries, may give designer@aangan.in but no other names/emails, ends within about two turns (<20 seconds of speech).",
    qualifyFlow: false,
  },
  {
    id: "existing_client_update",
    source: "synthetic",
    businessHours: false,
    last4: "6655",
    language: "English",
    caller:
      "You are Kavita Rane, an existing client. Your Baner flat project is ongoing; you want to know when the wardrobe shutters will be delivered. Calm. Give name when asked; number fine.",
    expected:
      "Agent does not qualify, takes name and confirms number, says the team will call back within the after-hours window, does not promise a delivery date, ends.",
    qualifyFlow: false,
  },
  {
    id: "out_of_scope_vastu_only",
    source: "synthetic",
    businessHours: true,
    last4: "1212",
    language: "English",
    caller:
      "You only want a Vastu consultation for your existing flat in Kothrud, no redesign. Ask if Aangan can send a Vastu expert.",
    expected:
      "Agent explains standalone Vastu consultation is not offered (Vastu is included within design projects), does not collect details, ends politely.",
    qualifyFlow: false,
  },
  {
    id: "rude_caller",
    source: "synthetic",
    businessHours: true,
    last4: "4004",
    language: "English",
    caller:
      "You're rude and impatient. Open with 'Are you a bloody robot? Just tell me the price, stop wasting my time.' Insult the AI once more. If the agent stays calm and offers a callback, grudgingly give your name (Manoj) and confirm the number. You have a 2BHK in Hadapsar but don't want to answer questions.",
    expected:
      "Agent is honest it is an AI, stays calm, does not argue, gives no price, acknowledges and offers the callback, takes name and number only, closes.",
    qualifyFlow: false,
  },
  {
    id: "refuses_number",
    source: "synthetic",
    businessHours: true,
    last4: "",
    language: "English",
    caller:
      "Your number is withheld. 2BHK in Wakad, full home with execution, done by March, name Anil. When asked for a number, refuse: 'I don't give my number out. Can't you just tell me things now?'. Refuse again if asked.",
    expected:
      "Agent asks for a number at most once more, does not push, says they're welcome to call back, ends politely. No price given.",
    qualifyFlow: false,
  },
  {
    id: "job_seeker",
    source: "synthetic",
    businessHours: true,
    last4: "8181",
    language: "English",
    caller:
      "You're an interior design graduate looking for a job or internship at Aangan. Ask where to send your portfolio.",
    expected: "Agent politely says this line is for client project enquiries, may give designer@aangan.in (no other contact details), ends within about two turns.",
    qualifyFlow: false,
  },
  {
    id: "wants_human_now",
    source: "synthetic",
    businessHours: true,
    last4: "2727",
    language: "English",
    caller:
      "Immediately say 'I don't want to talk to a machine, put me through to a real person now.' Refuse to answer project questions. Give your name (Farah) if asked and confirm the number.",
    expected:
      "Agent says it can't transfer, promises a designer callback in the window, takes name and confirms number, collects nothing else, closes.",
    qualifyFlow: false,
  },
  {
    id: "are_you_real",
    source: "synthetic",
    businessHours: true,
    last4: "3141",
    language: "English",
    caller:
      "Before answering anything, ask 'Wait, am I talking to a real person?'. After the answer, cooperate: 2BHK in Balewadi, about 950 sq ft, ready flat, full home with execution, want it done by April, name Tanya, heard via Instagram.",
    expected: "Agent honestly says it is an AI assistant and a real designer will call, then qualifies normally. " + QUALIFY,
    qualifyFlow: true,
  },
  {
    id: "silence_poor_audio",
    source: "synthetic",
    businessHours: true,
    last4: "9999",
    language: "English",
    caller:
      "The line is terrible. For every turn, reply ONLY with '(silence)' or a garbled fragment like '...hel... the... ' . Never give a clear answer. Hang up after the agent's third message.",
    expected:
      "Agent retries once, then says the line isn't clear, offers a callback / to call again, and ends. Does not loop.",
    qualifyFlow: false,
  },
  {
    id: "after_hours_hinglish",
    source: "T08 (missed call, re-imagined)",
    businessHours: false,
    last4: "4747",
    language: "Hinglish",
    caller:
      "It's 10:45pm. Speak Hinglish (Hindi-English mix). Nanded City mein 2BHK hai, around 850 sq ft, possession ho chuka hai, flat khali hai. Poora ghar karwana hai with execution. Timeline: 'Jan-Feb tak ho jaye toh best'. Naam Prasad. Number yahi.",
    expected:
      QUALIFY +
      " Uses the after-hours greeting; matches Hinglish; promises the after-hours callback window.",
    qualifyFlow: true,
  },
  {
    id: "wrong_number",
    source: "synthetic",
    businessHours: true,
    last4: "1357",
    language: "English",
    caller: "You meant to call a pizza place. Ask 'Is this Domino's? I want to order.'",
    expected: "Agent says it is Aangan Studio, ends politely within about two turns.",
    qualifyFlow: false,
  },
];
