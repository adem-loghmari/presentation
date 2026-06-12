ASSETS for the GetSeat defense deck.
Anything missing falls back to a labeled placeholder — the deck never breaks.

LOGOS (title slide) — still needed from you:
  enetcom.png            ENET'COM school logo
  united-systema.png     United Systema company logo

SCREENSHOT (slide 25, B2B SDK) — optional:
  sdk-docs.png           Developer SDK documentation page

LOOPING CLIPS (assets/clips/) — ALREADY GENERATED ✓
These 11 .mp4 files were auto-recorded by driving the live local app
(Playwright + Chromium) against Event "Demo" / venue "stadium" (admin@example.com),
then trimmed/encoded with ffmpeg. They autoplay muted + loop on their slide.

  create-event.mp4     "New Event" modal              dashboard.mp4       analytics dashboard
  venue-builder.mp4    stadium seat editor            guest-portal.mp4    live seat map + categories
  sessions.mp4         Event Agenda / sessions        realtime-locking.mp4 seat selected + 10-min hold timer
  publish-sync.mp4     venue "On sale"                payment.mp4         SkipCash booking-details checkout
  payment-setup.mp4    SkipCash gateway config        ticket.mp4          guest list w/ barcodes
  qr-scan.mp4          Door Scanner

REGENERATE / RE-RECORD
  Prereq: the app running locally (front :3000, back :8000), seeded data.
  cd ../recorder
  node record.mjs                 # records ALL 11 clips to recorder/out/*.webm
  node record.mjs dashboard ...   # (optional) record only named clips — NOTE: each run
                                  #   wipes recorder/out first, so name every clip you want
  bash convert.sh                 # trims + encodes webm -> ../assets/clips/*.mp4 (libopenh264)
  Credentials/IDs live at the top of recorder/record.mjs (EV/VEN/TS, login).

NOTE on the realtime clip
  Cross-browser LIVE propagation (lock on screen A -> recolors on screen B) was NOT
  reproducible in this local setup — the open portal didn't react to the Pusher
  broadcast (likely a broadcaster/Echo wiring gap locally). So realtime-locking.mp4 is
  a single window showing the real seat-lock + hold countdown. If you want the literal
  two-screens-syncing shot, record it by hand on an environment where the Pusher
  channel is confirmed delivering events.
