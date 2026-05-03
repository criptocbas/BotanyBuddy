# CLAUDE.md

Quick orientation for any future Claude Code session opened on this repo.
Read this first.

---

## What this is

**BotanyBuddy** — a personal plant care PWA. The user adds their houseplants,
takes (or picks) a photo, and gets specific care advice from xAI Grok that
knows each plant's species, pot, drainage, and full history. Mobile-first,
installable, works offline for viewing.

The user is the primary user (recreational plant owner — not a gardening
company). Aesthetic and quality matter; bloat does not. The app should feel
polished, professional, and useful for daily use.

## Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- **Routing**: react-router-dom v6
- **Backend**: Supabase (Auth, Postgres + RLS, Storage, Edge Functions)
- **AI**: xAI Grok (vision + chat) — called only from edge functions; the
  API key never reaches the browser
- **PWA**: `vite-plugin-pwa` in `injectManifest` mode → custom service worker
  in `src/sw.ts` (precache + photo cache + web push handlers)
- **Notifications**: Web Push, with a Supabase pg_cron + edge function fan-out

## Where it lives

- **Production**: <https://botany-buddy.vercel.app> (Vercel auto-deploys on
  push to `main`)
- **Supabase project ref**: `cbrtotchretpjrfpecdl`
- **GitHub**: `criptocbas/BotanyBuddy`
- **Working branch**: `main`. Push directly or open a PR — both fine; the
  repo is single-developer. Don't force-push.
- **Stable rollback tag**: `v0.1` exists as a known-good baseline.

## What's built

- **Auth** — email/password + Google OAuth.
- **Dashboard** — today digest with one-tap water buttons, smart sort
  (action-needed first), group by location, search, polished empty state,
  PWA install prompt.
- **Photo-first add-plant** — `+ Add` opens a dialog whose first action is
  a photo. The `identify-plant` edge function does a vision-only Grok call,
  returns species + confidence + a starter assessment. Client confirms with
  a pre-filled suggested name. Low-confidence first attempt → "try again";
  second low-confidence attempt → falls through to "Unknown plant" with the
  user's chosen name.
- **Plant detail** — editorial hero (`PlantHero.tsx`: large fluid Fraunces
  name, letterspaced "{species} · {N} months together" kicker, 4:5 photo
  treated as a print with timestamp + "latest" mark, status as a tone-dot
  prose line, NOT a chip). Below: quick water/remind, care stats, health
  trend sparkline, tabs for Advice / Chat / Journal / Log / Photos.
- **Per-plant Grok chat** — multi-turn, optional photo attach, optimistic UI,
  realtime sync.
- **Journal** — free-form notes stored as `observation` care_logs.
- **Care log timeline** + add-entry dialog.
- **Settings** — profile, theme toggle (light/dark/system, FOUC-safe via
  inline script in `index.html`), push notification enable/disable per device.
- **PWA** — installable, works offline for viewing, runtime cache for plant
  photos, theme-color meta varies by light/dark.
- **Push reminders** — server-side via pg_cron → `send-due-reminders` →
  web-push to all subscribed devices. Cron job named
  `grok-garden-send-reminders` runs every 15 min (legacy name from before
  the rename — leave it alone).

## Current state

The app is **live and in use**. Supabase project is provisioned, schema is
applied, all four edge functions are deployed
(`analyze-plant`, `chat`, `identify-plant`, `send-due-reminders`),
pg_cron schedule is running, Vercel deploy is wired to `main`, the user's
plants are real. Don't treat this as pre-launch.

If the user reports a bug, treat it as a real bug — not a setup issue.

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
    types.ts                  Plant, CareLog, ChatMessage, IdentifyResult, …
    utils.ts                  cn, timeAgo, timeUntil, fmtDate
    reminders.ts              status derivation + species defaults +
                              local notification scheduling
    stats.ts                  computeCareStats (streaks, intervals)
    haptics.ts                vibration helper
    push.ts                   subscribe / unsubscribe Web Push
  hooks/
    useAuth.tsx               session, sign in/up/out
    usePlants.ts              list/detail/quickLog/addLog/uploadPhoto/
                              analyzeWithGrok + identifyFromFile +
                              commitIdentifiedPlant (photo-first flow)
    useChat.ts                per-plant chat thread, realtime
    useTheme.tsx              light/dark/system + FOUC-safe
    useUiPrefs.ts             dashboard sort/group, persisted
  components/
    ui/                       shadcn primitives (button, card, dialog,
                              select, tabs, badge, skeleton, etc.)
    layout/                   AppShell, BottomNav
    plants/                   PlantCard, AddPlantPhotoFirst (primary add
                              flow), AddPlantDialog (legacy form-first,
                              unused — keep until manual-entry use case
                              comes back), EditPlantDialog, PlantHero,
                              PhotoUploader, PhotoHistory, PhotoLightbox,
                              CareLogList, LogActionDialog, GrokAdvicePanel,
                              StatusPill (still used by PlantCard, not by
                              PlantHero), TodayDigest, SortControl,
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
    analyze-plant/            Grok read on a new photo for an existing plant
                              (full history is included in the prompt)
    chat/                     multi-turn chat per plant
    identify-plant/           vision-only Grok call when the plant doesn't
                              exist yet — used by AddPlantPhotoFirst
    send-due-reminders/       cron-callable web-push fan-out

public/                       PWA icons + robots.txt
```

## Conventions

- **TypeScript everywhere**, strict. No `any` outside of edge functions
  where it's hard to avoid.
- **Tailwind only** for styling. No CSS modules, no styled-components.
  Theme tokens live in `src/index.css`. Both `--card` and `--popover` are
  defined for both themes.
- **shadcn/ui** primitives go in `src/components/ui/`. Don't pull in heavy
  component libraries.
- **No comments unless WHY is non-obvious.** Don't narrate what code does.
- **Mobile-first.** Test layouts at iPhone widths first; widescreen comes
  for free with `container max-w-2xl`. Inputs and textareas use
  `text-base sm:text-sm` to avoid iOS auto-zoom on focus.
- **No emojis in code or commits.** README is fine.
- **Git**: work directly on `main` for routine changes, or branch off and
  PR for anything risky. Never force-push.
- **Schema changes** must stay idempotent (`if not exists`, `do $$ begin
  create type … exception when duplicate_object then null; end $$`, etc.)
  so re-running `schema.sql` is safe.
- **Edge functions** must verify the caller's JWT (or use a shared secret
  for cron). Never trust client input for ownership; let RLS enforce it by
  passing the user's JWT into the Supabase client.
- **Service worker** is on `registerType: "autoUpdate"`. After a deploy the
  user must fully close the installed PWA (or hard-refresh in browser) to
  pick up the new SW. Worth flagging when telling them to test a fix.

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

## Roadmap

**Done:**
- Tier 1: today digest, edit plant, photo lightbox, sort/group, polished
  empty states.
- Tier 2: theme toggle, care stats, multi-turn chat (replaced Ask Grok),
  health trend, journal.
- Push notifications (server-side via cron + web-push).
- Photo-first add-plant flow with `identify-plant` edge function.
- PlantHero editorial redesign.
- Mobile/PWA polish pass: iOS input zoom prevented, dialog viewport guards,
  per-theme `theme-color`, larger tap targets, `touch-action: manipulation`,
  `dvh` for keyboard-aware heights, popover background tokens, etc.
- Renamed from "Grok Garden" to "BotanyBuddy" everywhere user-visible.
  Internal IDs left as-is (`grokgarden:*` localStorage keys, `grok-garden`
  sw notification tag, the pg_cron job name).

**Skipped intentionally:**
- Avatar upload — single-user app, zero functional value.
- CSV export — recreational user audience, not a gardening company.
- Splash screens for iOS PWA — would need ~10 generated assets; the
  manifest's `background_color` already prevents a white flash.

**Possible future work (only if user asks):**
- Pull-to-refresh on dashboard (real native pattern, non-trivial to do
  without fighting the OS).
- Empty states / onboarding warmth pass.
- Email digest as fallback when web push isn't viable (Safari on a
  non-installed iOS device).
- Multi-plant batch photo (snap a windowsill, identify each plant).
- Tagging / filtering beyond location.
- Sharing a plant read-only with another person.
- Per-plant GitHub-style activity heatmap.
- Delete the unused `AddPlantDialog` if a manual-entry path is never asked
  for.

## Quick reference

| What | Where |
|------|-------|
| Add a new edge function | `supabase/functions/<name>/index.ts` then `supabase functions deploy <name>` |
| Change the schema | edit `supabase/schema.sql`, re-run in Supabase SQL editor |
| Add a new shadcn primitive | hand-write in `src/components/ui/`, follow the existing pattern (cva + forwardRef) |
| Add a new page | new file in `src/pages/`, lazy-import + register a `<Route>` in `src/App.tsx` |
| Tweak a Grok prompt | `supabase/functions/<analyze-plant\|chat\|identify-plant>/index.ts` — each has its own `SYSTEM_PROMPT` |
| Tweak species defaults | `SPECIES_DEFAULTS` in `src/lib/reminders.ts` |
| Trigger a redeploy | push to `main` — Vercel rebuilds in ~60s |

---

When in doubt: read the README first, then `git log --oneline` for recent
context, then ask the user. Don't refactor preemptively. Don't add features
that weren't asked for.
