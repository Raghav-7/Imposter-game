# Architecture

Imposter Party is an Expo (SDK 57, React Native 0.86, New Architecture) app written in strict TypeScript. The design goal is a **pure, deterministic game engine** wrapped by thin React screens, so every rule can be tested — and simulated thousands of times — without a device.

```
┌──────────── UI (src/app, src/screens, src/components) ────────────┐
│ screens read state via hooks, dispatch actions, never mutate      │
└──────────────┬───────────────────────────────▲────────────────────┘
               │ dispatch / commands           │ useGameState()
┌──────────────▼───────────────────────────────┴────────────────────┐
│ state/gameStore.ts  — holds GameState, adds randomness (seeds),   │
│ persists after every transition, records stats once per round     │
└──────────────┬────────────────────────────────────────────────────┘
               │ pure calls
┌──────────────▼────────────────────────────────────────────────────┐
│ game/ — engine: reducer + state machine, setup, secrets, voting,  │
│ outcome, scoring, persist (no React, no I/O, no Math.random)      │
└───────────────────────────────────────────────────────────────────┘
```

## Game engine (`src/game`)

### Randomness

The reducer is pure. Every random decision is made from a `Seed` (4 × uint32) carried in the action. `state/gameStore.ts` creates seeds from the platform CSPRNG (`expo-crypto`), tests pass fixed seeds. `engine/rng.ts` implements sfc32 with rejection sampling (unbiased `int(n)`) and Fisher–Yates `shuffle`.

### Round setup — how role assignment works (`engine/setup.ts`)

`createRoundSetup(players, config, wordSource, seed, recentKeys)`:

1. **Validates** (`engine/validation.ts`): 3–20 players, unique non-blank names (case/accents/spacing-insensitive), unique ids, `1 ≤ imposters ≤ maxImposters(n)`, category exists and has words, Undercover needs 2+ words or related words.
   `maxImposters(n) = min(3, floor((n − jester − 1) / 2))` — the non-hidden side always strictly outnumbers the hidden side, and imposters can never reach `players − 1`.
2. **Rolls chaos modifiers** (Chaos mode only): weighted sampling without replacement, respecting `conflicts`; structural modifiers only when they fit (e.g. *two words* needs enough players and an alt word).
3. **Picks the word** (`engine/words.ts`): resolve category (`random` → one random built-in category, `mixed` → all built-in words, `custom:*` → that list), prefer the chosen difficulty, avoid the last 60 used words, choose uniformly. Undercover's alt word comes from the word's `related` list, else another word from the same category. Builds 6 shuffled final-guess choices (secret + decoys, never the alt word).
4. **Assigns roles**: shuffle all player ids once, then take the first *I* as the mode's hunted role (`imposter` or `undercover`), then optional `undercover` (chaos two-words), `jester`, `detective`, `agent`; everyone else is `civilian`. Because a single uniform shuffle is used, every subset of players is equally likely and no player can receive two roles.
5. **Builds intel**: Detective → one random non-hunted player; Secret Agent → a shuffled pair of one hunted + one other civilian-team player.
6. **Clue order**: rotate seating order from a random start (or full shuffle with the *random order* twist).

### Secrets (`engine/secrets.ts`)

`getSecretView(state, playerId)` returns only what that player may see (role card, word or none, category hint, teammates, intel). An unaware undercover gets `shownRole: 'civilian'` and a card **identical** to a civilian's. Screens call it at render time while the card is visible and never store the result; hiding unmounts the card.

### State machine (`engine/stateMachine.ts`, `engine/reducer.ts`)

| Phase | Meaning | Next |
| --- | --- | --- |
| `IDLE` | no game | `PLAYER_SETUP`, `CONFIGURATION`, `WORD_GENERATED` |
| `PLAYER_SETUP` | player screen open | `CONFIGURATION`, `WORD_GENERATED`, `IDLE` |
| `CONFIGURATION` | settings screen open | `PLAYER_SETUP`, `WORD_GENERATED`, `IDLE` |
| `WORD_GENERATED` | roles dealt, shuffle animation | `ROLE_REVEAL_INTRO` |
| `ROLE_REVEAL_INTRO` | "pass the phone to X" (no secret on screen) | `ROLE_REVEAL` |
| `ROLE_REVEAL` | X's card visible | `ROLE_REVEAL_INTRO` (next player, or hide on background/back), `REVEAL_COMPLETE` |
| `REVEAL_COMPLETE` | everyone has seen their card | `CLUE_PHASE` |
| `CLUE_PHASE` | one clue each (`clueIndex`), laps allowed | `CLUE_PHASE`, `DISCUSSION` |
| `DISCUSSION` | timer | `VOTING` |
| `VOTING` | secret ballot, `voterIndex` | `VOTING`, `VOTE_RESULT` |
| `VOTE_RESULT` | tally; tie → revote | `VOTING` (revote), `ELIMINATION` |
| `ELIMINATION` | voted-out player's role revealed | `IMPOSTER_GUESS`, `ROUND_RESULT`, `CLUE_PHASE` / `DISCUSSION` (hunt continues) |
| `IMPOSTER_GUESS` | caught imposter guesses | `IMPOSTER_GUESS`, `ROUND_RESULT`, `CLUE_PHASE` / `DISCUSSION` |
| `ROUND_RESULT` | winner + roles + points | `SCOREBOARD` |
| `SCOREBOARD` | running totals | `WORD_GENERATED` (next round), `GAME_COMPLETE` |
| `GAME_COMPLETE` | final standings (round secrets dropped) | `IDLE`, `WORD_GENERATED` (play again) |

Every in-game phase may exit to `IDLE`. `go()` refuses any transition not in the table, and each action also checks its own preconditions (correct reveal index, current voter, valid target, all votes in, …). Rejected actions return the **same object**, which makes rapid double taps harmless: duplicate votes, double "next", double scoring and double start are all no-ops.

### Voting & ties (`voting/`)

Voters = alive players; you can't vote for yourself. `resolveVote` eliminates the unique leader; on a tie it requests a revote among the tied players (`tieRule: 'revote'`) or picks randomly (`'random'`). A tie during a revote is always broken randomly, so voting terminates.

### Win rules (`engine/outcome.ts`)

`eliminationsAllowed` = number of hidden players. After each elimination:

- Jester out → round ends, winners `jester` + `imposters`.
- Hidden player out and final guess enabled → `IMPOSTER_GUESS`; a correct guess wins for the hidden team.
- No hidden players left → civilians win.
- Votes left < hidden players left → hidden team wins (it can no longer be caught).
- Otherwise the hunt continues (another clue lap or straight to discussion).

### Scoring (`scoring/`)

Defaults (editable 0–10 in Game settings → More rules): civilian +2 per decisive vote on a hidden player, +1 each when civilians win; hidden player +3 for surviving when their team wins, +5 for a correct guess; Jester +5 when voted out. Totals are summed into `GameState.scores` exactly once, inside the `FINISH_ROUND` reducer step.

## Word engine (`src/data/words`)

One file per category (`categories/*.ts`) exporting `WordSeed[]` (`word`, `difficulty`, `related`, optional `tags`). `index.ts` turns them into `WordEntry`s with stable keys (`food:pizza`). `validate.ts` is run by the test suite. Custom categories are converted to the same shape at runtime (`state/wordSource.ts`); they have no difficulty or related words, so Undercover uses another word from the list.

## Persistence (`src/storage`, `src/state`)

| Key | Contents | Sanitiser |
| --- | --- | --- |
| `ip.settings.v1` | theme, motion, language, sound/music/haptics, reveal style, peek, keep-awake, onboarding | `sanitizeSettings` |
| `ip.roster.v1` | saved player list | `sanitizeRoster` |
| `ip.config.v1` | last game configuration | `sanitizeConfig` |
| `ip.customCategories.v1` | custom word lists | `sanitizeCustomCategories` |
| `ip.stats.v1` | lifetime stats + ids of recorded rounds | `sanitizeStats` |
| `ip.recentWords.v1` | last 60 word keys | `sanitizeRecent` |
| `ip.activeGame.v1` | interrupted game, XOR-masked + base64 | `decodeSave` → `validateGameState` |
| `ip.saveKey.v1` | random per-install mask key | — |

All reads go through sanitisers: corrupted or partial data falls back to defaults field by field, never crashes. Storage failures surface as a friendly toast. A restored game never lands on a visible secret (`ROLE_REVEAL` → `ROLE_REVEAL_INTRO`); in-progress ballots and guesses restart at their pass-the-phone gate because that UI state is local and not persisted. Setup screens never touch the save, so browsing settings can't destroy an interrupted game.

Stats are recorded by `gameStore` on entering `ROUND_RESULT`; `recordRound` is idempotent by round id, so a crash/restart can't double count.

## Information-hiding measures

- Cards for all roles share the same colours, emoji, sound, haptic and layout (imposters get a big "? ? ?" in the word slot).
- Pass-the-phone gates contain no secret; their button is disabled for 900 ms so a double tap on "Hide & pass" can't reveal the next player's card. The hide button is likewise armed after 700 ms. All such delays live in `src/utils/timing.ts`.
- App backgrounded/inactive → `APP_BACKGROUNDED` hides any card, ballots and peeks close, dialogs dismiss, timers pause.
- Hardware back during a reveal hides the card first; otherwise it asks before leaving. iOS swipe-back is disabled on the game route.
- Phases are not URLs: the whole game is one route rendered from the state machine, so navigation can't revisit a previous player's card.
- `FLAG_SECURE` (expo-screen-capture) during reveal, voting, guessing and peeks.
- "Forgot your word?" re-checks are logged publicly on the discussion screen.

## Navigation

Expo Router file routes. Every header back button uses `safeBack()` (`utils/navigation.ts`), which falls back to a parent route when a screen was opened by deep link with no history. The `/game` route renders a safe "No game in progress" screen when opened without an active game.

## Timers (`hooks/useCountdown.ts`)

Wall-clock based (immune to dropped frames), exactly one `setInterval` that only exists while running and is cleared on unmount, auto-pause on background with an explicit resume. Tested with fake timers for leaks.

## Adding a new role

1. Add the id to `RoleId` in `src/game/types.ts`.
2. Register it in `src/game/roles/index.ts` (`team`, which word it `receives`, whether it is `hunted`, emoji).
3. Assign it in `assignRoles` (`engine/setup.ts`) — usually behind a `config.roles.<flag>` toggle — and update `maxImposters` if it takes a non-civilian slot.
4. If it gets extra knowledge, extend `Intel` (`types.ts`), `buildIntel` (`setup.ts`) and `getSecretView` (`secrets.ts`); show it in `RoleCard.tsx`.
5. If it changes who wins, extend `getNextStep` (`engine/outcome.ts`) and `scoreRound` (`scoring/`).
6. Add strings (`role.<id>`, `role.<id>.card`, `role.<id>.tip`, `elim.<id>`), a Rules entry, a Game-settings toggle, and tests.

## Adding a new game mode

See the README section; modes are data (`ModeDefinition`) consumed by setup and secrets, so most modes need no engine changes.

## Testing

| Suite | What it covers |
| --- | --- |
| `tests/data` | word-bank validator (real data + synthetic bad data) |
| `tests/engine/setup.test.ts` | player validation, imposter limits, role assignment, word selection, all modes, intel, chaos |
| `tests/engine/flow.test.ts` | state machine guards, reveal, full rounds incl. ties/revotes, multi-imposter hunts, jester, scoring over rounds, reset |
| `tests/engine/properties.test.ts` | fast-check invariants, 1,500 random full games, randomness distribution (χ²) |
| `tests/engine/persistAndText.test.ts` | save/load, corruption, restore safety, sanitising, guess matching |
| `tests/state` | stats, sanitisers, backup import/export, persistent store failure recovery, kill-and-resume, logger redaction |
| `tests/ui/app.test.tsx` | renders the real router and plays through the UI: full game, config → game navigation, background hide, back button, timer pause on background, player validation, custom category, rules/stats/settings, safe `/game` fallback |
| `tests/ui/hooks.test.tsx` | countdown (finish, pause/resume/+time, background pause, single interval, no leaks, stopwatch), anti double-tap arming |

On-device checks (release APK on an Android 15 emulator) are scripted with adb/UIAutomator; see the README "Testing" section.
