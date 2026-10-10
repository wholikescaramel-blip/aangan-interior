-- Aangan intake: initial schema. Channel-agnostic: a "call" row is one enquiry from any channel
-- (only 'phone' via Vaani is built in this phase).

CREATE TABLE IF NOT EXISTS calls (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel                text NOT NULL DEFAULT 'phone',
  external_id            text NOT NULL,                 -- Vaani call id
  caller_number_e164     text,
  started_at             timestamptz,                   -- ring start
  answered_at            timestamptz,
  ended_at               timestamptz,
  duration_seconds       integer,
  response_time_seconds  numeric,                       -- answered_at - started_at, if provided
  after_hours            boolean NOT NULL DEFAULT false,
  transcript             text,
  recording_url          text,
  structured             jsonb,                         -- structured fields from the provider
  provider_cost_inr      numeric,                       -- Vaani cost if provided
  raw_payload            jsonb NOT NULL,
  processing_status      text NOT NULL DEFAULT 'received', -- received | processing | done | failed
  received_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_id)                         -- idempotency key
);
CREATE INDEX IF NOT EXISTS calls_started_at_idx ON calls (started_at);
CREATE INDEX IF NOT EXISTS calls_caller_idx ON calls (caller_number_e164);

CREATE TABLE IF NOT EXISTS qualifications (
  call_id              uuid PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  status               text NOT NULL CHECK (status IN ('qualified','needs_review','not_qualified','not_a_lead')),
  reasons              jsonb NOT NULL DEFAULT '[]',
  collected            jsonb NOT NULL DEFAULT '{}',
  missing_info         jsonb NOT NULL DEFAULT '[]',
  summary              text,
  suggested_next_step  text,
  not_a_lead_tag       text,
  model                text,
  input_tokens         integer NOT NULL DEFAULT 0,
  output_tokens        integer NOT NULL DEFAULT 0,
  attempts             integer NOT NULL DEFAULT 1,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hubspot_sync (
  call_id             uuid PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  contact_id          text,
  call_engagement_id  text,
  deal_id             text,
  deal_stage          text,                 -- last known stage id (synced from HubSpot)
  deal_amount         numeric,
  deal_is_won         boolean,
  deal_is_closed      boolean,
  stage_synced_at     timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hubspot_sync_deal_idx ON hubspot_sync (deal_id);
CREATE INDEX IF NOT EXISTS hubspot_sync_contact_idx ON hubspot_sync (contact_id);

CREATE TABLE IF NOT EXISTS handoffs (
  call_id              uuid PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  telegram_chat_id     text NOT NULL,
  telegram_message_id  bigint,
  posted_at            timestamptz,
  claimed_by           text,               -- Telegram display name
  claimed_by_tg_id     bigint,
  claimed_at           timestamptz
);

CREATE TABLE IF NOT EXISTS bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_invitee_uri  text NOT NULL UNIQUE,
  calendly_event_uri    text,
  call_id               uuid REFERENCES calls(id) ON DELETE SET NULL,
  deal_id               text,
  invitee_name          text,
  invitee_email         text,
  invitee_phone_e164    text,
  status                text NOT NULL DEFAULT 'active',  -- active | canceled
  booked_at             timestamptz,
  event_start_at        timestamptz,
  canceled_at           timestamptz,
  raw                   jsonb
);

CREATE TABLE IF NOT EXISTS errors (
  id          bigserial PRIMARY KEY,
  call_id     uuid REFERENCES calls(id) ON DELETE SET NULL,
  stage       text NOT NULL,     -- webhook | qualify | hubspot | telegram | calendly | cron
  message     text NOT NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS errors_created_idx ON errors (created_at);
