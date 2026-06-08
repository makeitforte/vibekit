# Project Timeline & Capacity Planner — notes for Claude

## ⚠️ Cascade logic — handle with care

`runCascadeRecalculate` in [utils.ts](utils.ts) (the "fill-from-top cascade
algorithm" — auto-shifts mandays across weeks when capacity/buffer threshold
is exceeded, triggered from `handleRunCascade` in [planner-shell.tsx](planner-shell.tsx))
is **the most fragile, business-critical piece of this app**. It's already
been rewritten at least once (see commit `b9f5de1` and observation #224 —
"position-based overflow logic").

**Before touching anything that touches or could touch this logic — even
indirectly (effort maps, capacity maps, week ranges, buffer-threshold fields,
history logging tied to `cascade_push`) — STOP and explicitly flag it to the
user first.** Don't silently fold cascade-adjacent changes into an unrelated
feature/fix. The user has asked to be made aware proactively whenever an
enhancement somehow touches or potentially touches this area.

## Data-safety constraint (still applies)

User has explicitly emphasized: existing project/task/effort data must NEVER
be lost or destructively altered. All DB migrations in `supabase/*.sql` must
remain purely additive (new tables/columns/policies, non-destructive backfills).
This has been the standing rule for the board-sharing work and should continue
for any future schema change.

## Recent feature work (for context — see git log for exact commits)

- **Board sharing (share-link model)**: `board_shares` / `board_members`
  tables, `redeem_board_share` / `has_board_access` RPC+helper, `/shared/[token]`
  redemption route, `ShareDialog`, `boardOwnerId` threading through
  `PlannerShell` (separates `boardId` = whose data, from `userId` = actor).
  Migration: `supabase/board-sharing.sql`.
- **History attribution for collaborators**: added `owner_id` column to
  `planner_change_history` (board scope, independent of `user_id` = actor),
  rewritten RLS so collaborators' entries show up in the board owner's history
  too. `fetchHistory(ownerId)` / `addHistory(actorId, ownerId, entry)`.
- **Delete tracking**: `project_deleted` / `task_deleted` change types added
  (previously deletes were silent in history).
- **Manual ETA override**: double-click the ETA cell in the grid to set/clear
  a manual ETA (falls back to auto-derived "last effort week's Friday" via
  `deriveTaskEta` when cleared). Logged as `eta_change`.
- **Migration**: `supabase/history-delete-tracking.sql` widens the
  `change_type` check constraint for `project_deleted`/`task_deleted`/`eta_change`
  — must be run by the user in Supabase SQL Editor (after `board-sharing.sql`).
- **Grid week header**: now shows only the week's end date (`formatWeekEnd`),
  Timeline view still uses the full range (`formatWeekRange`).
- **Timeline view**: temporarily disabled/locked in the view switcher
  (`disabled: true` on the SegmentedControl option in `planner-shell.tsx`) —
  being reworked, re-enable when ready.
