# Plan: Travel Challenges / Group Goals

## Overview
Friends can create shared challenges (e.g., "Visit all Nordic countries") and track collective or competitive progress. Challenges have a title, a set of target regions, and participants.

## UX Design

### Challenge Types
1. **Collaborative** — Group progress bar (e.g., "Together, visit all 50 US states" — anyone's visit counts)
2. **Competitive / Race** — Each participant's individual progress shown as a leaderboard

### User Flow
1. User clicks "Create Challenge" in `FriendsPanel` or a new "Challenges" tab
2. Fills in: title, tracker (e.g., "world", "us"), target regions (all or custom subset), type (collab/race), invite friends
3. Challenge appears in all participants' dashboards
4. Progress updates automatically as people mark regions visited

### UI Components
- Challenge card with progress bar + participant avatars
- Challenge detail view with map highlighting target regions + who visited what

## Files to Create

### `src/components/ChallengesPanel.jsx`
- List of active challenges (joined + created)
- "Create Challenge" button
- Each challenge card shows: title, progress %, participant avatars, tracker icon

### `src/components/ChallengeCreateModal.jsx`
- Form: title, description, tracker selector, region picker (multi-select or "all"), type toggle, friend invite list
- Submit → POST to backend

### `src/components/ChallengeDetailModal.jsx`
- Full view of a challenge
- Mini-map showing target regions colored by who visited them
- Leaderboard (for race type) or merged progress bar (for collab)
- Leave challenge / delete challenge (if creator)

### `src/hooks/useChallenges.js`
- `fetchChallenges()` — get all challenges for current user
- `createChallenge(data)` — POST new challenge
- `joinChallenge(challengeId)` — accept invite
- `leaveChallenge(challengeId)`

## Backend Changes

### New Database Tables

```sql
CREATE TABLE challenges (
    id TEXT PRIMARY KEY,           -- UUID
    creator_id TEXT NOT NULL,      -- user who created it
    title TEXT NOT NULL,
    description TEXT,
    tracker_id TEXT NOT NULL,      -- e.g., 'world', 'us', 'ch'
    target_regions TEXT NOT NULL,  -- JSON array of region IDs, or '*' for all
    challenge_type TEXT NOT NULL,  -- 'collaborative' | 'race'
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE challenge_participants (
    challenge_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (challenge_id, user_id),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```
- Progress is computed dynamically by joining `challenge_participants` with `visited` table

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/challenges` | List user's challenges |
| `POST` | `/api/challenges` | Create a challenge |
| `GET` | `/api/challenges/{id}` | Get challenge detail + progress |
| `POST` | `/api/challenges/{id}/join` | Join a challenge |
| `DELETE` | `/api/challenges/{id}/leave` | Leave a challenge |
| `DELETE` | `/api/challenges/{id}` | Delete (creator only) |

### Progress Computation
- For **collaborative**: UNION of all participants' visited regions ∩ target_regions → count / total
- For **race**: per-participant count of visited ∩ target_regions → leaderboard sorted desc

## Files to Modify

### `src/components/FriendsPanel.jsx`
- Add "Challenges" tab alongside friends list
- Or add as a separate section below friends

### `src/components/Sidebar.jsx`
- Add challenge icon/button if challenges exist (badge with count)

### `src/utils/api.js`
- Add challenge API functions

### `src/components/ActivityFeed.jsx`
- New activity types: "X created a challenge", "X completed a challenge"

## Notifications
- When invited to a challenge → show in activity feed or notification badge
- When a challenge is completed → celebration animation (reuse confetti from achievements)

## Edge Cases
- User leaves → their visits still counted in collaborative? → No, recalculate
- User deletes account → remove from participants
- Challenge with 0 participants → auto-delete or keep for creator
- Limit: max 10 active challenges per user, max 20 participants per challenge

## Testing Checklist
- [ ] Create challenge with custom region selection
- [ ] Invite friends and they see the challenge
- [ ] Progress updates when any participant visits a target region
- [ ] Leaderboard sorts correctly for race type
- [ ] Collaborative progress merges correctly
- [ ] Leave/delete challenge works
- [ ] Works across different trackers
- [ ] Mobile layout is usable

## Estimated Effort
~12-16 hours (significant backend work)
