# Condo Booking Bot

Automatically books Indoor Badminton Courts 1, 2, and 3, every Monday
8pm-10pm, the instant the slots roll into the 14-day advance booking window.

## How it works

- The condo app's booking window is a rolling 14-day window. Each night at
  midnight (Malaysia time), a new date becomes bookable.
- This script runs nightly. If `today + 14 days` is a Monday, it logs in,
  waits until the precise midnight moment, and fires a booking request for
  each configured court (5, 6, 7 by default) independently and in
  parallel, for that Monday, 20:00-22:00 (8pm-10pm).
- If a court's slot isn't open yet (a few hundred ms of timing slop), that
  court falls back to firing repeated attempts for a few seconds until it
  either succeeds or finds the slot already taken. Each court retries
  independently, so one court being slow to open doesn't hold up the
  others.
- You get a single Telegram message summarizing which courts succeeded and
  which failed.

**Note:** by default the condo app's UI blocks booking more than one court
per unit per day. This script bypasses that UI-only restriction via the
API directly, which was done with the property management's knowledge -
they've confirmed the restriction will be lifted in an upcoming app
update. If your situation is different, don't rely on this behavior
without checking with your management first.

## 1. Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and fill in:
- `LOGIN_EMAIL` / `LOGIN_PASSWORD` - your condo app login
- `WY_USER_AGENT` - the device ID header captured from your app traffic
  (e.g. `WY_APP_XXXXXXXXXXXXXXXXXXXX`) - this is stable across app launches
  so you only need to capture it once
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` - from your Telegram bot setup

Leave the other values (`BOOKING_TYPE_IDS`, `ADVANCE_DAYS`, `TARGET_WEEKDAY`,
`BOOKED_FROM_HOUR`, `BOOKED_TO_HOUR`) as-is unless you want to target
different courts, a different day, or a different time. `BOOKING_TYPE_IDS`
is a comma-separated list - each ID is booked independently.

## 2. Test each piece before trusting the full run

**Test Telegram notifications:**
```bash
npm run test-notify
```
You should get a message on Telegram within a few seconds.

**Test login:**
```bash
npm run test-login
```
Should print a truncated token. If it fails, double check
`LOGIN_EMAIL`/`LOGIN_PASSWORD` and `WY_USER_AGENT` in `.env`.

**Test the full flow without waiting for real midnight:**

Temporarily set `TARGET_WEEKDAY` in `.env` to match whatever today's weekday
is (Luxon numbering: 1=Monday ... 7=Sunday), and set `ADVANCE_DAYS=0`, then
run:
```bash
npm start
```
This will attempt to book *today* at 8-10pm, immediately, without waiting
for midnight - which will hit the "slot already taken" or a real booking
depending on current availability. This proves out login, the request
shape, response classification, and Telegram notification end-to-end.
**Revert `.env` back to real values afterwards.**

## 3. Schedule it nightly (Windows Task Scheduler)

1. Open **Task Scheduler** (search in Start menu).
2. **Create Task** (not "Basic Task" - you want the full dialog for more control).
3. **General tab**: name it e.g. "Condo Booking Bot". Under Security options,
   select "Run whether user is logged on or not" if you want it to work even
   if you're not actively logged in (may prompt for your Windows password
   to save).
4. **Triggers tab** → New → Daily, start time **23:58:00**, recur every 1 day.
5. **Actions tab** → New → Action: "Start a program".
   - Program/script: path to `node.exe` (find via `where node` in a terminal)
   - Add arguments: `index.js`
   - Start in: the full path to this `booking-bot` folder
6. **Conditions tab**: uncheck "Start the task only if the computer is on AC
   power" if on a laptop. Also make sure "Stop if the computer switches to
   battery power" is unchecked.
7. **Settings tab**: check "Run task as soon as possible after a scheduled
   start is missed" as a safety net.
8. Also go into **Windows Settings → System → Power & sleep** and make sure
   your PC won't sleep automatically, especially not right around midnight.

## 4. Check logs

Every run writes to `logs/YYYY-MM-DD.log` regardless of whether a booking
was attempted, so you can check in the morning what happened even without
opening Telegram.

## Known limitations / things worth knowing

- **Clock precision**: the script self-checks for gross clock drift against
  the server, but the HTTP `Date` header only has 1-second resolution, so
  this is a safety net for catching major drift, not a sub-second sync
  mechanism. The actual precision comes from your PC's own NTP-synced
  clock. Make sure Windows time sync is enabled and has synced recently
  (Settings → Time & Language → Date & time → "Sync now").
- **Single booking per day**: the API enforces `maxBookPerDay: 1`, so if
  this script's attempt fails (e.g. slot taken), there's no fallback slot
  to try that same night - it just reports the failure.
- **Token freshness**: the script logs in fresh before every run rather
  than reusing a saved token, to avoid relying on an assumption about
  exact token lifetime.
- **PC must be on and awake** at midnight for this to work when running
  locally. Moving to a cloud VPS later removes this dependency entirely.
