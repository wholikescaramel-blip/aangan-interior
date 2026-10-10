-- Vaani sends call lifecycle events per room: call_started (with phone_number), user_picked_up_at, call_ended,
-- and finally call_postprocessing (transcript, summary, entities, recording) without the phone number.
-- This table joins them so the final enquiry has the caller number and response time.
CREATE TABLE IF NOT EXISTS vaani_rooms (
  room_name      text PRIMARY KEY,
  phone_number   text,
  started_at     timestamptz,
  picked_up_at   timestamptz,
  ended_at       timestamptz,
  end_reason     text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
