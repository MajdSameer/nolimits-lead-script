# No Limits — Lead → Script

A standalone web app that turns a raw removalist lead into a tailored call
script, then lets reps practise the call against an AI customer and get scored.
Sales reps use it with **no Claude account** — the Anthropic key lives only in
server env vars, and every model call goes through a Next.js API route.

Ported from the approved `lead-to-script.jsx` artifact. The script copy (every
"Say this" line, objection step, LAERC badge, mindset strip, Feel-Felt-Found
card) is verbatim from the artifact.

## Stack

- Next.js (App Router) + React, deployed on Vercel.
- Anthropic called server-side (`api.anthropic.com/v1/messages`, `max_tokens: 1000`).
- No database — logging goes to Google Sheets via an Apps Script Web App.

## Architecture

```
Client (ported artifact UI)
  ├── POST /api/parse     → server → Anthropic (claude-sonnet-4-6)
  ├── POST /api/customer  → server → Anthropic (claude-haiku-4-5-20251001)
  ├── POST /api/grade     → server → Anthropic (claude-sonnet-4-6)
  └── POST /api/log       → server → Apps Script Web App (fire-and-forget)
```

The prompts live in `src/lib/prompts.ts`, lifted from the artifact unchanged.
The client sends **raw inputs only** (lead text / transcript / difficulty); the
server builds every prompt. A fully-formed prompt is never accepted from the
client.

### Model routing

| Route      | Model                        | Why |
|------------|------------------------------|-----|
| `/api/parse`    | `claude-sonnet-4-6`          | extraction accuracy |
| `/api/customer` | `claude-haiku-4-5-20251001`  | short roleplay turn, ~5× cheaper/faster |
| `/api/grade`    | `claude-sonnet-4-6`          | coaching quality |

If the customer feels flat or breaks character on hard mode, bump `/api/customer`
to `claude-sonnet-4-6` in `src/app/api/customer/route.ts` — the cost difference
is cents.

## Access control (v1)

- Single shared team passcode (`TEAM_PASSCODE`). Reps enter it once on the gate
  screen; on success the server sets an httpOnly session cookie.
- Every API route rejects requests without a valid session.
- The rep-name field (top-right) is required before parse or practice — it feeds
  the log.
- This is deliberately not real auth. It stops the open internet from burning
  the API key, which is the v1 threat model.

## Bill & abuse protection

- Per-IP rate limit on every API route: 30 requests/minute.
- Server-side input caps: lead text ≤ 4,000 chars; practice line ≤ 1,000 chars;
  transcript ≤ 40 turns (beyond that the customer route returns a friendly
  "end the call and get scored" message).
- All errors return clean JSON; the client shows the existing yellow error card.

## Logging → Google Sheets

`POST /api/log` forwards two event types to the Apps Script Web App
(fire-and-forget — a logging failure never breaks the rep's flow, and the app
works fully with `LOG_WEBAPP_URL` unset):

1. `script_generated` — timestamp, rep, customer first name, route (suburb →
   suburb), distance category, levers fired (comma-joined IDs), flexible-window
   flag, quoted price.
2. `practice_scored` — timestamp, rep, difficulty, overall /10, five stage
   scores, five LAERC booleans, turns count.

**Never logged:** full lead text, phone numbers, emails, street addresses,
transcripts. The client only ever sends the whitelisted fields above, and
`/api/log` re-whitelists them server-side.

### Setting up the sheet

1. Create a Google Sheet.
2. Extensions → Apps Script; paste `apps-script/Code.gs`.
3. Project Settings → Script Properties → add `LOG_SHARED_SECRET` (match the
   app's env var).
4. Deploy → New deployment → Web app → Execute as **Me**, Access **Anyone**.
5. Copy the `/exec` URL into the app's `LOG_WEBAPP_URL` env var.

## Environment variables

Server-only — never prefix with `NEXT_PUBLIC_`. See `.env.example`.

```
ANTHROPIC_API_KEY    # server only
TEAM_PASSCODE
LOG_SHARED_SECRET    # matches the Apps Script property
LOG_WEBAPP_URL       # Apps Script /exec URL (optional — unset disables logging)
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3000
```

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Add the four env vars in Project → Settings → Environment Variables.
3. Deploy. Confirm the key is absent from the client bundle:
   ```bash
   npm run build
   grep -r "sk-ant" .next/static || echo "key absent from client bundle ✓"
   ```

## Verifying the key never ships to the client

`ANTHROPIC_API_KEY` is read via `process.env` only inside files under
`src/app/api/**` and `src/lib/anthropic.ts`, all of which run server-side. No
client component imports them, and the variable is not `NEXT_PUBLIC_`, so it is
never inlined into a browser bundle.
