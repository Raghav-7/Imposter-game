# Imposter Party 🎭

**One phone. One secret. One liar.** An offline, pass-the-phone social-deduction party game for 3–20 friends in the same room.

Everyone secretly gets the same word — except the Imposter. Pass the phone, peek at your card, give one clue each, argue, vote, and unmask the liar. If the Imposter is caught they get one last chance to guess the word.

- 100% offline — no account, no internet, no ads, no tracking, **no permissions**
- Android first (also runs on iOS and web via Expo)
- 1,246 hand-checked words in 23 categories (incl. Indian Food, Bollywood, Cricket, Indian Cities), every word with Undercover pairs
- English + Hindi UI

---

## Features

| Area | What you get |
| --- | --- |
| **Modes** | **Classic** (imposter sees only the category) · **Undercover** (odd one out gets a similar word — Pizza vs Burger) · **Blind** (imposter gets nothing) · **Chaos** (1–2 random twists per round) |
| **Multiple imposters** | 1–3 in any mode, auto-limited by player count (5+ players → 2, 7+ → 3). Optional "imposters know each other". |
| **Special roles** | Optional **Detective** (learns one innocent player) and **Jester** (wins if voted out). Chaos can add a **Secret Agent** (knows one of two suspects is guilty) and a second secret word. |
| **Chaos twists** | Short clues · first clue one word · no repeating ideas · no physical descriptions · last player sound/gesture only · 10-second speed round · scrambled order · secret agent · imposter gets the category · two words in play |
| **Players** | Add / rename / remove / reorder / shuffle / quick-add, duplicate & blank name validation, emoji & Unicode names, saved between games |
| **Words** | 23 built-in categories + Random + Mixed, Easy/Medium/Hard, recently-used words avoided, custom categories (create, rename, delete, paste many words at once, import/export as text) |
| **Private reveal** | Pass-the-phone gate per player, tap *or* hold-to-reveal, identical-looking cards for every role, armed buttons so a double tap can't reveal the next card, screenshot/recents blocking, auto-hide when the app is backgrounded |
| **Round flow** | Clue phase (optional 15–60 s per clue, re-run laps) → discussion timer (30 s–2 min or unlimited, pause/resume/+30 s) → secret ballot (pass the phone, change pick, lock in, progress dots, no early results) → dramatic tally → role reveal → final guess (multiple choice or typed with typo tolerance + "close enough" override) → winner → scoreboard → next round |
| **Ties** | Revote between tied players (default) or random pick; a tied revote is broken randomly so games never loop |
| **Scoring & stats** | Configurable points; per-player lifetime stats (games, wins, losses, win rate, imposter games/wins, times caught, successful guesses, streaks, points) — only real results, idempotent recording |
| **Resilience** | Auto-save after every step (obfuscated), resume/abandon prompt after a crash or kill, corrupted data falls back to defaults, back button never leaks secrets |
| **Feel** | Original dark "midnight masquerade" theme + light + system, custom display font, animations that respect reduced motion, synthesized sound effects + optional music, haptics — all toggleable |
| **Accessibility** | 48 dp touch targets, screen-reader labels/roles, dynamic type with capped display sizes, colour never the only signal, reduced-motion support |

## Quick start

```bash
npm install
npm start            # Expo dev server (press a for Android, w for web)
npm run web          # run in a browser
```

Requirements: Node 20+ (tested with Node 24), and for native builds JDK 17+ and the Android SDK.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` | Debug build + install on a connected device/emulator (`expo run:android`) |
| `npm test` | All Jest suites (engine, property-based, simulations, state, UI) |
| `npm run validate:words` | Word-bank validator only (duplicates, empties, bad metadata, missing Undercover pairs) |
| `npm run typecheck` | TypeScript (strict, `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint (expo config incl. React Compiler rules) |
| `npm run format` / `format:check` | Prettier |
| `npm run verify` | typecheck + lint + format check + tests |
| `npm run build:android` | **Signed release APK** → `dist/ImposterParty-<version>.apk` |
| `npm run build:android -- --aab` | Also an `.aab` for Google Play |
| `npm run build:web` | Static web export to `dist/` |

### Release build (exact command)

```bash
CMAKE_DIR=C:/ImposterGame/.tools/cmake npm run build:android
```

`scripts/build-android.js` runs `expo prebuild --platform android --clean`, writes `android/local.properties`, loads signing values from `credentials/signing.properties`, and runs `gradlew assembleRelease` (R8 minify + resource shrinking on, ABIs arm64-v8a / armeabi-v7a / x86_64).

**Windows note:** the Android SDK's CMake 3.22 ships a Ninja that is not long-path aware, and React Native's New Architecture codegen produces object paths > 260 characters. Point `CMAKE_DIR` at CMake ≥ 3.31 with Ninja ≥ 1.12 (official zips from Kitware / ninja-build) and enable Windows long paths. Not needed on macOS/Linux.

### Release signing

Release builds are signed by `plugins/withReleaseSigning.js` using these variables (Gradle properties or environment):

```
IMPOSTER_STORE_FILE=/abs/path/imposter-release.jks
IMPOSTER_STORE_PASSWORD=…
IMPOSTER_KEY_ALIAS=imposter
IMPOSTER_KEY_PASSWORD=…
```

`npm run build:android` reads them from `credentials/signing.properties` (git-ignored). **Back up the keystore** — Play Store updates must be signed with the same key. Without it the build falls back to the debug key and prints a warning.

## Testing

```bash
npm test          # 131 tests across 9 suites
npm run verify    # typecheck + lint + format check + tests
```

| Layer | How it is tested |
| --- | --- |
| Word bank | `tests/data` — validator over all 1,246 words |
| Game engine | `tests/engine` — unit tests for every rule, end-to-end rounds (3p/1i, imposter survives, caught + correct/incorrect guess, 10p/2i, 15p/3i, undercover, tie, revote, custom category, jester), fast-check property tests, **1,500 random full-game simulations**, 2,000-round randomness/χ² checks |
| State & persistence | `tests/state` — stats correctness and idempotency, corrupted-data recovery, storage failures, kill-and-resume, backup import/export, log redaction |
| UI | `tests/ui` — the real Expo Router app rendered with Testing Library: full game by button presses, background/back-button secret hiding, timer behaviour, validation, custom categories |

QA drivers (dev tools, see headers for usage): `scripts/qa/web-walkthrough.js` (headless Chrome, any viewport, reports console errors and off-screen elements) and `scripts/qa/device-e2e.js` (adb + UIAutomator against an installed APK).

Device testing: the release APK was installed on an Android 15 (API 35) emulator and driven with adb + UIAutomator (fresh install → onboarding → quick play → reveal → background → kill → resume → back button → clues → discussion → secret ballot → reveal → final guess → results → scoreboard → next round → leave → stats), plus large-font, light-theme and airplane-mode passes. Visual QA of every screen was done in a headless browser at 360×640, 393×852 and 430×932 in dark and light themes, including a 20-player Chaos game and Unicode/emoji/very long names.

## Project structure

```
app.json                 Expo config (name, package id, icons, splash, blocked permissions, plugins)
plugins/                 Config plugins (release signing)
scripts/                 build-android.js, generate-sounds.js (synth SFX), icon/make-icons.js, qa/ (web + device E2E drivers)
assets/                  icon set, splash, fonts (Bricolage Grotesque, OFL), sounds (generated)
src/
  app/                   Expo Router routes (screens): index (home), onboarding, setup/*, game, rules,
                         stats, settings, categories/*
  screens/game/          In-game phase views (reveal, clues, discussion, voting, results…)
  components/            Design-system components (Button, Screen, controls, dialogs/toasts, animations)
  game/                  Pure TypeScript game engine — no React, no I/O
    engine/              reducer + state machine, setup (roles/words), secrets, outcome, persist, rng, text
    roles/               role registry
    modes/               mode + chaos-modifier registry, limits
    voting/              ballots, tallies, ties
    scoring/             points
  data/words/            word bank (one file per category), category metadata, validator
  state/                 stores: settings, roster/config/custom categories, stats, active game, backup
  storage/               AsyncStorage wrapper with failure handling
  audio/ haptics/        optional feedback, failure tolerant
  theme/                 palettes (dark/light), fonts, spacing, reduced motion
  localization/          en (source of truth) + hi, `useT()`
  hooks/ utils/          countdown timer, guarded taps, sanitized logger, messages
tests/                   engine, properties/simulations, state, ui (Jest)
docs/ARCHITECTURE.md     Developer documentation
```

## Game rules (short)

1. Everyone privately views their card. Civilians see the secret word; the Imposter sees "YOU'RE THE IMPOSTER" (plus the category in Classic).
2. In clue order, each player says one clue about the word.
3. Discuss, then vote secretly. The player with the most votes is out and their role is revealed.
4. Civilians get **one vote per hidden player** and must eliminate every imposter/undercover. If the remaining votes can't catch them all, the hidden team wins.
5. A caught imposter may guess the word: correct → imposters win.
6. Voting out the Jester ends the round: the Jester and the still-hidden imposters win.

Full rules with examples are on the in-app **Rules** screen.

## Adding words

Edit `src/data/words/categories/<category>.ts`:

```ts
{ word: 'Pizza', difficulty: 'easy', related: ['Burger', 'Pasta'] },
```

`related` words power Undercover mode and the final-guess decoys. Then run `npm run validate:words` — it fails on duplicates (across all categories, case-insensitive), empty/untrimmed words, bad difficulty, missing/self/duplicate related words, and categories smaller than 40 words or 8 per difficulty.

## Adding a category

1. Create `src/data/words/categories/my_category.ts` exporting `words: WordSeed[]`.
2. Add the id to `BuiltInCategoryId` (`src/data/words/types.ts`), to `BUILT_IN_CATEGORIES` (`categories.ts`, with an emoji), and import it in `src/data/words/index.ts`.
3. Add `category.my_category` to `src/localization/en.ts` (and `hi.ts`).
4. `npm run validate:words`.

Players can also create categories in-app (Categories → New category).

## Adding a game mode

1. Add the id to `GameModeId` (`src/game/types.ts`) and a `ModeDefinition` in `src/game/modes/index.ts` (hunted role, whether imposters see the category, whether an alt word is needed, whether chaos modifiers roll).
2. If it needs new behaviour, extend `createRoundSetup` (`src/game/engine/setup.ts`) and/or `getSecretView` (`engine/secrets.ts`) — driven by the mode flags.
3. Add `mode.<id>.name/desc` strings and a Rules section; add it to `MODE_ORDER`.
4. Add engine tests (the property tests in `tests/engine/properties.test.ts` automatically cover every mode in `MODE_ORDER`).

## Adding a role

See `src/game/roles/index.ts` and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-a-new-role).

## Privacy

- No accounts, analytics, ads, network calls or permissions. `android.blockedPermissions` strips permissions that libraries would otherwise add (microphone, storage, notifications…).
- Secrets are computed only at the moment a card is shown, never logged (the logger redacts secret-looking keys and is silent in production), and saved games are XOR-masked with a per-install key (anti-peek obfuscation, not cryptography).
- `FLAG_SECURE` is set while secrets can be on screen (no screenshots, blank recents thumbnail). Android Auto Backup is disabled.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Filename longer than 260 characters` during `buildCMake…` on Windows | Use CMake ≥ 3.31 + Ninja ≥ 1.12 via `CMAKE_DIR`, and keep the project in a short path (e.g. `C:\ImposterGame\imposter-party`). |
| `'gradlew.bat' is not recognized` | Run through `npm run build:android` (it calls the wrapper with an absolute path). |
| Release APK signed with debug key | `credentials/signing.properties` missing — see *Release signing*. |
| "Resume game?" keeps appearing | Choose **Abandon game** — the save is deleted. |
| No sound | Sound effects/music are toggles in Settings; iOS respects the silent switch. |
| Text looks clipped with huge system fonts | Display text is capped deliberately; body text scales fully. Report the screen if anything overlaps. |

## License & credits

Code: MIT (see `LICENSE`). Font: Bricolage Grotesque, SIL Open Font License 1.1. Sounds and icon: generated from scratch by the scripts in `scripts/`. Word lists: written for this project.
