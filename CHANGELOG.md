# CHANGELOG

## [Unreleased] — Production Readiness Pass

### Added
- **Vitest test suite** (`src/tests/game.test.ts`) — 35+ unit tests covering:
  - Building upgrade cost scaling (1.5× per level)
  - Building upgrade duration scaling (1.4× per level)
  - Production per hour calculations with level scaling
  - XP required per level (exponential curve)
  - `applyProductionBonus` helper
  - `computeResearchEffects` — stacking, empty, level-0 skip
  - `applyTrainingSpeed` — 50% reduction, 10-second minimum
  - VIP production bonus accumulation across levels
  - VIP daily diamond income stacking
  - Battle outcome simulation (victory / defeat / draw)
  - Chest rarity ordering helpers
  - Mission claim timer validation
- **`ErrorBoundary` component** (`src/components/shared/ErrorBoundary.tsx`) — React class component wrapping every route; shows retry button on crash instead of blank screen
- **Route-level lazy loading** — all secondary pages (`Shop`, `Map`, `Family`, `Enforcers`, `Research`, `Troops`, `Battle`, `Events`, `Leaderboard`, `DailyQuests`, `WeeklyQuests`, `BattlePass`) and all admin pages are now lazily loaded via `React.lazy` + `Suspense`
- **`test`, `test:watch`, `test:coverage` scripts** added to `package.json`
- **`VITE_STRIPE_PUBLIC_KEY`** and **`VITE_APP_ENV`** placeholders added to `.env.example`
- **`src/tests/setup.ts`** — Vitest setup file importing `@testing-library/jest-dom`

### Changed
- **`vite.config.ts`** — added `manualChunks` splitting vendor bundles into `vendor-react`, `vendor-supabase`, `vendor-ui`, `vendor-charts`, `vendor-radix`; `chunkSizeWarningLimit` raised to 600 KB; `test` config added
- **`App.tsx`** — replaced all static page imports with `React.lazy`; wrapped every route in `<ErrorBoundary>` and `<Suspense fallback={<PageLoader />}>`; `PageLoader` component added
- **`README.md`** — full rewrite: setup, migrations list, user creation, development commands, deployment, game system status table, architecture notes, security checklist, known limitations
- **`.env.example`** — added `VITE_STRIPE_PUBLIC_KEY` and `VITE_APP_ENV` with descriptive comments

### Performance
- Initial JS bundle split from one 935 KB chunk into multiple smaller vendor + page chunks
- Secondary pages no longer parsed at startup — loaded on first navigation

---

## UI/UX Overhaul — Premium Mobile Game Aesthetics

### Changed

#### Global Styles (`src/index.css`)
- Added utility classes: `.shimmer` (animated gold sweep), `.pulse-gold` (glow pulse), `.gradient-premium`, `.gradient-danger`, `.card-premium`, `.card-danger`, `.badge-hot`, `.badge-new`, `.badge-limited`, `.no-scrollbar`

#### ResourceBar (`src/components/shared/ResourceBar.tsx`)
- Diamonds always shown first in cyan highlight box
- Resources below 500 show red warning tint
- Separator dividers between resource groups
- Tooltip shows full unformatted number

#### GameLayout (`src/components/layout/GameLayout.tsx`)
- Bottom nav: gold active indicator top bar, notification dots on Shop and Events tabs
- Side quicklinks: added Calendar (daily quests) and Star (battle pass) shortcuts
- Notification bell: real unread count from `notificationStore`
- Notification panel: real data with `markRead` / `markAllRead`

#### BuildingCard (`src/components/city/BuildingCard.tsx`)
- Per-building-type `BUILDING_THEMES` gradient/glow/accent map
- Upgrade progress bar with gradient fill
- Shimmer effect when production is at capacity
- `pulse-gold` animation on at-capacity state
- HQ-blocked message in destructive styled box

#### CityPage (`src/pages/CityPage.tsx`)
- Hero header with gradient background and 4 stat tiles
- Quick action buttons with hover icon scale animation
- Production summary with rounded-full bonus badge
- Responsive grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`

#### MissionsPage (`src/pages/MissionsPage.tsx`)
- Category-colored cards (red/blue/purple/orange per type)
- Police heat bar with gradient fill, 70%/90% zone markers, danger animation
- Success-vs-risk gradient bar in mission dialog
- Energy dots colored per type (red, orange, blue)
- Responsive tab labels with active count badges

#### BattlePage (`src/pages/BattlePage.tsx`)
- `PvPTargetCard` with power comparison bar and stronger/weaker/equal indicator
- `AttackConfirmDialog` showing attacker vs defender power before committing
- Dramatic `BattleResultDialog` with hero victory/defeat icon section
- NPC cards with easy/medium/hard difficulty badges and color coding
- Empty states with retry buttons

#### FamilyPage (`src/pages/FamilyPage.tsx`)
- Premium family profile card with gradient header and contribution progress bar
- `RankBadge` component with tier-colored styling
- Member list sorted by rank descending
- Tech cards with gradient progress bars, `MAX` badge, lock icon for insufficient rank
- Donation cards showing current balance

#### ShopPage (`src/pages/ShopPage.tsx`)
- `PackageCard` with shimmer ribbon on limited packages, content icons row
- `DiamondCard` with hover scale and popular badge
- Diamond + VIP balance bar at top
- Purchase modal with content icons grid and success checkmark state
- Chest rarity-themed cards with gradient buy button

---

## Retention Systems — Daily Quests, Weekly Quests, Battle Pass, Events, Notifications

### Database

- 13 new tables: `daily_login_rewards`, `quest_definitions`, `user_quest_progress`, `quest_threshold_rewards`, `weekly_quest_definitions`, `user_weekly_quests`, `battle_pass_seasons`, `battle_pass_levels`, `user_battle_pass`, `battle_pass_claims`, `events`, `event_leaderboard`, `notifications`
- 15 new RPC functions: `get_daily_quests`, `claim_daily_login`, `claim_daily_threshold`, `get_weekly_quests`, `claim_weekly_quest`, `get_battle_pass`, `claim_bp_reward`, `unlock_premium_pass`, `get_active_events`, `get_notifications`, `mark_notification_read`, `mark_all_notifications_read`, internal `_add_bp_xp`, `increment_quest_progress`, `_send_notification`
- Quest hooks wired into: `claim_mission_reward`, `finish_building_upgrade`, `complete_troop_training`, `collect_building_production`

### Frontend

- `DailyQuestsPage` — 7-day login calendar, quest points progress, threshold chest buttons
- `WeeklyQuestsPage` — week stats, per-quest reward cards, claim buttons
- `BattlePassPage` — season header, XP bar, 50-level free/premium track
- `EventsPage` — real data from `get_active_events` RPC, guest fallback
- `notificationStore` — real notification data with `markRead` / `markAllRead`
- Routes added: `/daily-quests`, `/weekly-quests`, `/battle-pass`

---

## Admin Panel

### Added
- Admin panel at `/admin` (requires `is_admin = true` on player row)
- 7 admin pages: Dashboard, Players, Economy, Events, Families, Battles, Suspicious Activity
- All admin RPCs use `SECURITY DEFINER` and check `is_admin` before executing
- Every admin action logged to `admin_logs`

---

## Security Hardening

### Changed
- Column-level `REVOKE`/`GRANT` on `players` table — economy columns (cash, diamonds, etc.) cannot be set via direct SQL from the client role
- `suspicious_activity` table records anomalous patterns (negative resources, impossible timers, admin flag changes)
- `resource_transactions` audit log for all economy movements

---

## Production Schema v2

### Added
- `research_definitions` + `user_research` — 25-node research tree
- `troops` + `troop_training_queue` — army management
- `battle_reports` — post-battle logs
- `daily_reward_claims` — server-date-enforced daily login
- `event_progress` — per-player event tracking
- `chest_openings` — chest roll audit
- `vip_transactions` + `vip_definitions` — 15-level VIP system
- `player_boosts` — time-limited construction/training/resource buffs
- `admin_logs` — admin audit trail
- `public_player_leaderboard` + `public_family_leaderboard` views

---

## Secure Game Economy

### Changed
- All economy mutations moved to SECURITY DEFINER RPCs
- `addResources` / `spendResources` removed from `gameStore` (kept in `guestStore` for guest simulation)
- `update_own_player` RLS policy restricted to profile fields only
