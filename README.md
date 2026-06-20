# Dark City — Mafia Strategy Game

A browser-based P2W mafia strategy game built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4**, and **Supabase**.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 3. Apply database migrations (Supabase MCP / dashboard)

# 4. Start development server
npm run dev
```

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key (required for real payments) |
| `VITE_APP_ENV` | `development` / `staging` / `production` |

> **Never commit `.env` to source control.** Only `.env.example` belongs in git.

---

## Database Setup

### Applying Migrations

Run all migrations **in chronological order**. Each depends on the previous.

Using Supabase dashboard SQL editor, apply each file from `supabase/migrations/` in order:

```
20260618174039_create_game_schema.sql
20260619135355_secure_game_economy.sql
20260619140609_production_schema_v2.sql
20260619140803_seed_game_data.sql
20260619141948_city_building_system.sql
20260619143559_missions_energy_police_system.sql
20260619144653_troops_research_enforcer_upgrade.sql
20260619150521_pvp_battle_system.sql
20260619151948_family_clan_system_tables.sql
20260619152127_family_clan_system_rpcs.sql
20260619154049_shop_vip_p2w_tables.sql
20260619154159_shop_vip_p2w_rpcs.sql
20260619170407_energy_regen_system.sql
20260619170703_enforcer_battle_bonuses.sql
20260619171916_production_security_hardening.sql
20260619180904_admin_system.sql
20260619185617_retention_systems_tables.sql
20260619185731_retention_systems_rpcs.sql
20260619185808_retention_systems_seed.sql
20260619190412_hook_quest_progress_missions.sql
20260619190426_hook_quest_progress_buildings.sql
20260619190438_hook_quest_progress_troops.sql
20260619190453_hook_quest_progress_production.sql
20260619213701_achievements_system.sql
20260620134544_achievement_progress_hooks.sql
20260620140827_referral_invite_system.sql
20260620141222_player_mail_system.sql
20260620141814_lucky_wheel_system.sql
20260620155757_get_or_create_player_rpc.sql
20260620155808_lock_players_insert.sql
```

### Seed Data

Seed data is included in `seed_game_data.sql` and `retention_systems_seed.sql`. After applying migrations you get:

- 8 shop products (starter, power, boss packs, diamond tiers)
- 25 missions (dark jobs + daily)
- 12 enforcer definitions
- 5 territories
- 25 research nodes across 5 categories
- 15 VIP level definitions
- 7 daily login rewards
- 5 quest threshold chests
- 5 daily quests + 6 weekly quests
- 50-level Battle Pass (Season 1)
- 7 event definitions

---

## Creating Users

### Demo Player

Register via the in-game login screen (email/password). A `players` row is created automatically by a database trigger.

### Admin User

1. Create a regular account via the login screen.
2. In the Supabase SQL editor, run:

```sql
UPDATE players
SET role = 'admin'
WHERE id = auth.uid();
-- or by email:
UPDATE players
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@example.com'
);
```

3. Navigate to `/admin` in the app.

---

## Development

```bash
npm run dev       # Start dev server (Vite HMR)
npm run typecheck # TypeScript check without build
npm run test      # Run unit tests (Vitest)
npm run test:watch # Watch mode
npm run test:coverage # Coverage report
```

---

## Build

```bash
npm run build     # TypeScript + Vite production build
npm run preview   # Preview production build locally
```

The build produces chunked output in `dist/`:
- `vendor-react` — React + Router
- `vendor-supabase` — Supabase client
- `vendor-ui` — Lucide icons + UI utilities
- `vendor-charts` — Recharts
- Per-page lazy chunks for Shop, Battle, Events, Admin, etc.

---

## Deployment

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

**Required:** Set the same environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your host's environment settings.

**SPA routing:** Configure your host to redirect all `404` requests to `index.html`.

---

## Game Systems

| System | Status | Notes |
|---|---|---|
| City / Buildings | Production | 12 building types, upgrade timers, production collect |
| Missions | Production | Dark jobs, daily, raid categories; energy system |
| PvP Battle | Production | Scout, attack confirm, battle reports |
| Troops | Production | 4 tiers, training queue |
| Research | Production | 25 nodes, 5 categories |
| Enforcers | Production | 8 presets, chest roll |
| Family / Clan | Production | Create, join, donate, tech, help, chat |
| Shop | Production | Packages, diamonds, VIP, chests |
| VIP | Production | 15 levels, construction/production bonuses |
| Daily Login | Production | 7-day rotating reward calendar |
| Daily Quests | Production | 5 quest types, point thresholds |
| Weekly Quests | Production | 6 quest types, per-quest rewards |
| Battle Pass | Production | 50-level free + premium track |
| Events | Production | 7 event types, live scoring |
| Leaderboard | Production | Players + families |
| Admin Panel | Production | Players, economy, events, families, battles, suspicious |
| Map / Territories | Stub | Territory display only; conquest not implemented |
| Social / Friends | Not started | — |
| Push Notifications | Not started | Web push not configured |

---

## Architecture

### Security Model

- **RLS on every table.** Players can only `SELECT` their own rows.
- `INSERT`, `UPDATE`, `DELETE` on economy tables blocked with `USING (false)` / `WITH CHECK (false)`.
- All writes go through `SECURITY DEFINER` RPCs — clients cannot directly set resource values.
- Admin actions logged to `admin_logs` (invisible to clients).
- Suspicious activity tracked in `suspicious_activity`.

### Guest Mode

Guest users run entirely in-memory (Zustand + localStorage). No Supabase connection required for guest play. Guest data is ephemeral — not persisted to any server.

### Auth

Supabase email/password. A `players` row is created by a `CREATE OR REPLACE FUNCTION` trigger on `auth.users` insert. Email confirmation is **off** (enabled at Supabase project level).

### Code Splitting

All pages except City, Missions, and Profile are lazy-loaded. Admin pages are in a separate async chunk. Vendor libraries are split into named chunks for optimal cache reuse.

### Error Handling

`ErrorBoundary` wraps every route. A crash in one page shows a retry button without losing the rest of the app. All RPCs return `{ ok: boolean, error?: string }` and failures surface as toast notifications.

---

## Security Notes (Production Checklist)

- **Client cannot forge resource changes** — all economy is server-validated through SECURITY DEFINER RPCs.
- **Demo purchases** (`buy_demo_product`) do not charge real money. Disable or replace with a real Stripe webhook before going live.
- **Stripe webhook required** for real payments — the client publishes a checkout intent; fulfillment must happen server-side via webhook, never client confirmation.
- **Admin actions are logged** — every admin panel operation writes to `admin_logs` with `performed_by`, action, and timestamp.
- **Supabase RLS** — every table has `ENABLE ROW LEVEL SECURITY` and explicit policies. There is no table with RLS disabled.
- **`VITE_` variables are public** — never put secret keys in `VITE_*` env vars. Only use Supabase anon key (it's safe by design) and Stripe publishable key.

---

## Known Limitations

- Map page shows territory names only; actual PvP territory capture is not implemented.
- Social features (friend list, direct messages) are not implemented.
- Web push notifications are not configured.
- `buy_demo_product` is for demo only — wire up a real Stripe webhook for production payments.
- Battle Pass premium track unlock uses `buy_demo_product` — same as above.
