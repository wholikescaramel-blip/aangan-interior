-- Bookings come from Cal.com (free plan supports webhooks), not Calendly: make column names provider-neutral.
ALTER TABLE bookings RENAME COLUMN calendly_invitee_uri TO booking_uid;
ALTER TABLE bookings RENAME COLUMN calendly_event_uri TO event_title;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'calcom';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS matched_by text;
