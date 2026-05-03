# CLAUDE.md

Quick orientation for any future Claude Code session (web or terminal) opened
on this repo. Read this first.

---

## What this is

**Grok Garden** — a personal plant care PWA. The user adds their houseplants,
takes photos, and gets specific care advice from xAI Grok that knows each
plant's species, pot, drainage, and full history. Mobile-first, installable,
works offline for viewing.

The user is the primary user of the app (recreational plant owner — not a
gardening company). Aesthetic and quality matter; bloat does not. The app
should feel polished, professional, and useful for daily use.

## Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- **Routing**: react-router-dom v6
- **Backend**: Supabase (Auth, Postgres + RLS, Storage, Edge Functions)
- **AI**: xAI Grok (vision + chat) — called only from edge functions; the
  API key never reaches the browser
- **PWA**: `vite-plugin-pwa` in `injectManifest` mode → custom service worker
  in `src/sw.ts` (precache + photo cache + web push handlers)
- **Notifications**: Web Push, with a Supabase pg_cron + edge function fan-out

## Working branch

```
claude/grok-garden-pwa-cjYX6
```

All work goes here. PR #1 is open against `main`. There is no other branch.

## What's built (commits f193929 → 761fd7c)

- Auth (email/password + Google)
- Dashboard: today digest with one-tap water buttons, smart sort, group by
  location, search, polished first-run empty state
- Plant detail: hero photo, status pill, photo upload → Grok analysis, edit
  plant, delete plant, photo lightbox with Grok verdict overlay, care stats
  (waterings, fertilizings, avg interval, healthy streak), health trend
  sparkline, tabs for Advice / Chat / Journal / Care log / Photos
- Per-plant Grok chat (multi-turn, optional photo attach, optimistic UI,
  realtime sync)
- Journal (free-form notes stored as `observation` care_logs)
- Care log timeline + add-entry dialog
- Settings: profile, theme toggle (light/dark/system, FOUC-safe), push
  notification enable/disable per device
- PWA install prompt
- Local + web push reminders

## What the human still needs to do (one-time setup)

The code is complete; the Supabase backend hasn't been provisioned yet on a
real project. Walk through `README.md` "Quick start" + "Push notifications"
sections to:

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor
   (idempotent — safe to re-run; required after any schema change in this
   repo).
2. Copy `.env.example` → `.env` and fill in `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`.
3. `supabase secrets set XAI_API_KEY=… XAI_MODEL=grok-4-fast`
4. `supabase functions deploy analyze-plant`
5. `supabase functions deploy chat`
6. (For push reminders) `npx web-push generate-vapid-keys`, set the secrets
   listed in the README, deploy `send-due-reminders --no-verify-jwt`, then
   schedule the `pg_cron` job from the README snippet.

If the user reports a bug, first ask which of these steps they've completed
— most "doesn't work" reports at this stage are missing setup, not code bugs.

## Repo layout

```
src/
  App.tsx                     router + ThemeProvider + AuthProvider
  main.tsx                    entry, registers SW
  sw.ts                       custom service worker (precache, photo cache,
                              push, notificationclick)
  index.css                   Tailwind + shadcn tokens + utilities
  index.html (root)           inline theme script to prevent FOUC
  lib/
    supabase.ts               client + bucket + function URLs
    types.ts                  Plant, CareLog, ChatMessage, etc.
    utils.ts                  cn, timeAgo, timeUntil, fmtDate
    reminders.ts              status derivation + species defaults +
                              local notification scheduling
    stats.ts                  computeCareStats (streaks, intervals)
    haptics.ts                vibration helper
    push.ts                   subscribe / unsubscribe Web Push
  hooks/
    useAuth.tsx               session, sign in/up/out
    usePlants.ts              list + detail + quickLog + addLog +
                              uploadPhoto + analyzeWithGrok
    useChat.ts                per-plant chat thread, realtime
    useTheme.tsx              light/dark/system + FOUC-safe
    useUiPrefs.ts             dashboard sort/group, persisted
  components/
    ui/                       shadcn primitives (button, card, dialog,
                              select, tabs, badge, skeleton, etc.)
    layout/                   AppShell, BottomNav
    plants/                   PlantCard, AddPlantDialog, EditPlantDialog,
                              PhotoUploader, PhotoHistory, PhotoLightbox,
                              CareLogList, LogActionDialog, GrokAdvicePanel,
                              StatusPill, TodayDigest, SortControl,
                              CareStats, HealthTrend, JournalTab, ChatPanel
    pwa/                      InstallPrompt
  pages/
    Auth.tsx                  sign-in / sign-up
    Dashboard.tsx             today digest, search, sort, plant grid
    PlantDetail.tsx           hero, stats, trend, tabs
    Settings.tsx              profile, appearance, push, sign out

supabase/
  schema.sql                  full schema, RLS, storage, views (idempotent)
  functions/
    analyze-plant/            one-shot Grok read on a new photo
    chat/                     multi-turn chat per plant
    send-due-reminders/       cron-callable web-push fan-out

public/                       PWA icons + robots.txt
```

## Conventions

- **TypeScript everywhere**, strict. No `any` outside of edge functions
  where it's hard to avoid.
- **Tailwind only** for styling. No CSS modules, no styled-components.
  Theme tokens live in `src/index.css`.
- **shadcn/ui** primitives go in `src/components/ui/`. Don't pull in heavy
  component libraries.
- **No comments unless WHY is non-obvious.** Don't narrate what code does.
- **Mobile-first.** Test layouts at iPhone widths first; widescreen comes
  for free with `container max-w-2xl`.
- **No emojis in code or commits.** README is fine.
- **Git**: keep all commits on `claude/grok-garden-pwa-cjYX6`. Push there.
  Open PRs against `main`. Don't force-push.
- **Schema changes** must stay idempotent (`if not exists`, `do $$ begin
  create type … exception when duplicate_object then null; end $$`, etc.)
  so re-running `schema.sql` is safe.
- **Edge functions** must verify the caller's JWT (or use a shared secret
  for cron). Never trust client input for ownership; let RLS enforce it by
  passing the user's JWT into the Supabase client.

## Verifying changes

Always run before declaring done:

```bash
npx tsc -b           # type-check
npx vite build       # full prod build incl. SW
```

The build produces `dist/` with `sw.js` + `manifest.webmanifest`. Both must
be present.

For UI changes: `npm run dev` then check on a phone (or Chrome DevTools
device emulation at iPhone 12 Pro size). The bottom nav shouldn't overlap
content; safe-area utilities (`safe-bottom`, `safe-top`) handle notches.

## Roadmap (what's been considered, what's intentionally skipped)

**Done:**
- Tier 1: today digest, edit plant, photo lightbox, sort/group, polished
  empty states
- Tier 2: theme toggle, care stats, multi-turn chat (replaced Ask Grok),
  health trend, journal
- Push notifications (server-side via cron + web-push)

**Skipped intentionally:**
- Avatar upload — single-user app, zero functional value, user agreed.
- CSV export — recreational user audience, not a gardening company. User
  agreed to skip.

**Possible future work (only if user asks):**
- Email digest as fallback when web push isn't viable (e.g. user uses
  Safari on a non-installed iOS device).
- Multi-plant batch photo (snap a windowsill, identify each plant).
- Tagging / filtering beyond location.
- Sharing a plant read-only with another person.
- Per-plant GitHub-style activity heatmap.

## Quick reference

| What | Where |
|------|-------|
| Add a new edge function | `supabase/functions/<name>/index.ts` then `supabase functions deploy <name>` |
| Change the schema | edit `supabase/schema.sql`, re-run in Supabase SQL editor |
| Add a new shadcn primitive | hand-write in `src/components/ui/`, follow the existing pattern (cva + forwardRef) |
| Add a new page | new file in `src/pages/`, lazy-import + register a `<Route>` in `src/App.tsx` |
| Tweak the Grok prompt | `supabase/functions/analyze-plant/index.ts` (`SYSTEM_PROMPT`) for one-shot reads, `supabase/functions/chat/index.ts` for chat |
| Tweak species defaults | `SPECIES_DEFAULTS` in `src/lib/reminders.ts` |

---

When in doubt: read the README first, then `git log --oneline` for recent
context, then ask the user. Don't refactor preemptively. Don't add features
that weren't asked for.
