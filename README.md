# BotanyBuddy 🌿

A personal plant care assistant. Add your houseplants, take photos, and get
specific advice from **Grok** (xAI) that knows each plant's species, pot,
drainage, and full care history. Built as an installable PWA you can keep on
your phone's home screen.

```
React 19 + Vite + TypeScript + Tailwind + shadcn/ui  ─►  Frontend
Supabase (Auth, Postgres, Storage, Edge Functions)   ─►  Backend
xAI Grok (vision + reasoning)                         ─►  AI brain
```

---

## Features

- **Auth** – email/password or Google OAuth via Supabase Auth
- **Dashboard** – every plant with a live status (`Healthy`, `Needs water soon`, …)
- **Add plant** – name, species, pot type, drainage, light, location, notes
- **Plant page** – hero photo, status, full care log, photo history, tabs
- **Camera/upload → Grok** – sends the new photo *with full plant history*
  to the Grok API and gets structured advice (watering, light, humidity,
  problems, repotting, next action)
- **Care log** – water, fertilize, repot, prune, mist, rotate, observation, other
- **Reminders** – browser notifications scheduled for Grok's recommended
  next-action time (in-app while open; works after install)
- **PWA** – installable, offline viewing of plants & cached photos
- **Mobile-first**, plant-lover aesthetic with dark mode

---

## Folder structure

```
.
├── public/                    # PWA icons, robots.txt
├── supabase/
│   ├── schema.sql             # tables, RLS, storage bucket, view
│   └── functions/
│       └── analyze-plant/     # Edge Function that calls Grok
├── src/
│   ├── lib/                   # supabase client, types, utils, reminders
│   ├── hooks/                 # useAuth, usePlants
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   ├── layout/            # AppShell, BottomNav
│   │   ├── plants/            # PlantCard, AddPlantDialog, PhotoUploader,
│   │   │                      # CareLogList, GrokAdvicePanel, …
│   │   └── pwa/               # InstallPrompt
│   ├── pages/                 # Auth, Dashboard, PlantDetail, Settings
│   ├── App.tsx                # router + providers
│   ├── main.tsx               # entry, registers SW
│   └── index.css              # Tailwind + shadcn tokens
├── index.html
├── vite.config.ts             # Vite + vite-plugin-pwa
├── tailwind.config.js
├── tsconfig.json
├── components.json            # shadcn config
└── package.json
```

---

## Quick start (local)

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to https://supabase.com and create a new project (free tier is enough).
2. In the dashboard, open **SQL Editor → New query** and paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql). Run it. This creates all
   tables, enums, RLS policies, the `plant-photos` storage bucket, and a
   `plants_with_status` view.
3. (Optional) **Authentication → Providers → Google** to enable Google login.
   Set the redirect URL to `http://localhost:5173` for dev and your prod URL
   for production.

### 3. Configure env vars

Copy `.env.example` → `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_ANALYZE_FUNCTION_URL=https://YOUR-PROJECT.supabase.co/functions/v1/analyze-plant
```

> The anon key is safe to ship to the browser — Row Level Security policies
> guarantee a user can only read/write their own data.

### 4. Deploy the Grok edge function

The function lives at [`supabase/functions/analyze-plant/index.ts`](./supabase/functions/analyze-plant/index.ts).
It loads the plant + history with the *caller's* JWT (RLS applies), builds a
structured prompt, and calls the Grok API. **Your xAI key never touches the
browser.**

```bash
# Install the Supabase CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# Tell the function which Grok model + key to use
supabase secrets set XAI_API_KEY=xai-XXXXXXXX
supabase secrets set XAI_MODEL=grok-4-fast      # or grok-4

# Deploy
supabase functions deploy analyze-plant
```

> Need a different model? `grok-4-fast` is fast/cheap and supports vision +
> JSON mode. Use `grok-4` for the highest quality. Set the env var before
> redeploying.

### 5. Run the app

```bash
npm run dev      # http://localhost:5173
```

Sign up, add a plant, snap a photo. You should see Grok's structured advice
populate within a few seconds.

---

## How the Grok integration works

When you upload a photo from a plant page, the client:

1. Uploads the file to Supabase Storage (bucket `plant-photos`, path
   `<user_id>/<plant_id>/<timestamp>.<ext>`).
2. Inserts a row into `plant_photos` with the public URL.
3. POSTs to the `analyze-plant` Edge Function with the user's JWT and
   `{ plantId, photoId, photoUrl }`.

The Edge Function:

1. Verifies the JWT with `supabase.auth.getUser()`.
2. Queries `plants`, `care_logs`, `plant_photos`, and `grok_advice` for that
   plant. RLS ensures the caller can only see their own data — **a malicious
   client cannot ask about someone else's plant.**
3. Builds a system prompt + user prompt that includes:
   - plant profile (name, species, pot, drainage, light, location, notes,
     user-set intervals, age in days)
   - the last 25 care log entries
   - the last 6 photo timestamps + captions
   - the last 5 prior Grok assessments
4. Calls `POST https://api.x.ai/v1/chat/completions` with the new image URL
   and `response_format: { type: "json_object" }` to get strict JSON.
5. Persists the result to `grok_advice` and returns it.

The frontend then renders the JSON into a clean panel and schedules a local
browser notification for `next_action_in_days` from now.

---

## Production deploy

### Frontend

Any static host works. Recommended: **Vercel** or **Netlify**.

- Set env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_ANALYZE_FUNCTION_URL`.
- Build command: `npm run build`
- Output: `dist`
- Add your production URL to Supabase **Auth → URL Configuration** and to
  Google OAuth's authorized redirect URIs.

### Backend

The backend is the Supabase project + edge function — no separate server.
Re-run `supabase functions deploy analyze-plant` whenever you change it.

---

## Push notifications (optional but recommended)

Web Push reminders fire even when the app is closed. Setup is one-time.

### 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Copy the **public** key into both `.env` (`VITE_VAPID_PUBLIC_KEY`) and the
Supabase function secret `VAPID_PUBLIC_KEY`. Copy the **private** key into the
Supabase secret `VAPID_PRIVATE_KEY` only.

### 2. Set Supabase secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BJ... \
  VAPID_PRIVATE_KEY=k... \
  VAPID_SUBJECT=mailto:you@example.com \
  SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref YOUR-REF | grep service_role | awk '{print $2}') \
  CRON_SHARED_SECRET=$(openssl rand -hex 32)
```

### 3. Deploy the reminder + chat functions

```bash
supabase functions deploy send-due-reminders --no-verify-jwt
supabase functions deploy chat
```

### 4. Schedule the reminder cron (Supabase SQL editor)

```sql
-- Enable extensions if not already on (Supabase has them, just need to enable)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Run every 15 minutes
select cron.schedule(
  'grok-garden-send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', 'PASTE-YOUR-CRON_SHARED_SECRET-HERE'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

### 5. Turn on push from the app

Settings → **Push notifications → Enable**. The browser will prompt for
permission; on iOS install the PWA to the home screen first (Share → Add to
Home Screen). Each device you enable shows up as its own subscription so you
can have e.g. phone + laptop both notified.

> **Tip:** the cron also handles the "watering past due" case automatically
> based on each plant's `watering_interval_days`. You don't need to ask Grok
> for advice to get watering reminders.

## Extending

A few places designed to be easy to grow into:

- **More care actions** – add to the `care_action` enum in
  `supabase/schema.sql` and the meta map in `CareLogList.tsx`.
- **Per-species defaults** – tune `SPECIES_DEFAULTS` in
  `src/lib/reminders.ts` (Snake Plant / Maranta / Pothos no-drainage etc.
  are already pre-tuned).
- **Server-side reminders** – the current reminder is a local
  `setTimeout` + service-worker `showNotification`. For true push notifications
  while the app is closed, add a Postgres `cron` job (Supabase **Database →
  Cron**) that scans `grok_advice.next_action_at`/`care_logs` and uses Web
  Push.
- **Sharing plants** – the schema already has `user_id` everywhere; add a
  `plant_collaborators` table and broaden the RLS policies.
- **Full-text plant ID** – Grok already infers species from the photo if
  unset; persist it back to `plants.species` from the edge function.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | TypeScript check (no emit) |
| `npm run supabase:deploy:fn` | Deploy the `analyze-plant` edge function |
| `supabase functions deploy chat` | Deploy the per-plant chat function |
| `supabase functions deploy send-due-reminders --no-verify-jwt` | Deploy the cron-callable reminder function |

---

## License

MIT — go make your plants happy.
