/**
 * HubSpot setup: checks the private-app token's scopes, lists deal pipelines/stages (and suggests the
 * HUBSPOT_* env values), and creates the custom deal properties if missing.
 *   npm run hubspot-setup
 */
import { DEAL_PROPERTIES, makeHubspotFetch } from "../lib/hubspot";

const REQUIRED_SCOPES = [
  "crm.objects.contacts.read", "crm.objects.contacts.write",
  "crm.objects.deals.read", "crm.objects.deals.write",
  "crm.schemas.deals.read", "crm.schemas.deals.write",
];
const STAGE_HINTS: Record<string, RegExp> = {
  HUBSPOT_STAGE_QUALIFIED: /qualified \(ai\)|^qualified/i,
  HUBSPOT_STAGE_NEEDS_REVIEW: /needs review/i,
  HUBSPOT_STAGE_DESIGNER_CONTACTED: /designer contacted/i,
  HUBSPOT_STAGE_CONSULT_BOOKED: /consult.*booked/i,
};

async function main() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error("Put HUBSPOT_TOKEN in .env first");
  const hs = makeHubspotFetch(token);

  // Works for private-app tokens; HubSpot service keys may not support this lookup, so it is optional.
  const info = await hs("/oauth/v2/private-apps/get/access-token-info", { method: "POST", body: { tokenKey: token } }).catch(() => null);
  if (!info) console.log("(Scope check not available for this key type; continuing. Missing scopes will show up as 403 errors below.)");
  const scopes: string[] = info?.scopes ?? [];
  const hubId = info?.hubId ?? (await hs("/account-info/v3/details").catch(() => null))?.portalId;
  console.log(`Hub ID (HUBSPOT_PORTAL_ID): ${hubId ?? "unknown: copy the number from any HubSpot URL"}`);
  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  if (info) console.log(missing.length ? `❌ Missing scopes: ${missing.join(", ")}` : "✅ Token has all required scopes");

  const pipelines = (await hs("/crm/v3/pipelines/deals"))?.results ?? [];
  const suggestions: Record<string, string> = hubId ? { HUBSPOT_PORTAL_ID: String(hubId) } : {};
  for (const p of pipelines) {
    console.log(`\nPipeline "${p.label}"  id=${p.id}`);
    for (const s of [...p.stages].sort((a: any, b: any) => a.displayOrder - b.displayOrder)) {
      console.log(`  ${String(s.displayOrder).padStart(2)}. ${s.label.padEnd(28)} id=${s.id}`);
      for (const [env, re] of Object.entries(STAGE_HINTS))
        if (re.test(s.label) && !suggestions[env]) { suggestions[env] = s.id; suggestions.HUBSPOT_PIPELINE_ID = p.id; }
    }
  }

  for (const prop of DEAL_PROPERTIES) {
    try {
      await hs(`/crm/v3/properties/deals/${prop.name}`);
      console.log(`✅ deal property ${prop.name} exists`);
    } catch {
      await hs("/crm/v3/properties/deals", {
        method: "POST",
        body: { groupName: "dealinformation", ...prop },
      });
      console.log(`➕ created deal property ${prop.name}`);
    }
  }

  console.log("\nSuggested .env values:");
  for (const k of ["HUBSPOT_PORTAL_ID", "HUBSPOT_PIPELINE_ID", ...Object.keys(STAGE_HINTS)])
    console.log(`${k}=${suggestions[k] ?? "  <- not found: add this stage in HubSpot (Sales > Deals > Edit pipeline)"}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
