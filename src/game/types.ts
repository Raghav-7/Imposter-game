import type { Difficulty, WordEntry } from '../data/words/types';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export type GameModeId = 'classic' | 'undercover' | 'lost' | 'questions' | 'chaos';

export type RoleId = 'civilian' | 'imposter' | 'undercover' | 'detective' | 'jester' | 'agent';

export type Team = 'civilians' | 'imposters' | 'jester';

export type TieRule = 'revote' | 'random';

export type GuessStyle = 'choice' | 'type';

export type ModifierId =
  | 'shortClues'
  | 'firstOneWord'
  | 'noRepeat'
  | 'noPhysical'
  | 'lastRestriction'
  | 'speedRound'
  | 'randomOrder'
  | 'secretAgent'
  | 'imposterCategory'
  | 'twoWords';

export type PlayStyle = 'simple' | 'full';

export type Direction = 'clockwise' | 'anticlockwise';

export type ClueTimer = 0 | 15 | 30 | 45 | 60;
export type DiscussionTimer = 0 | 30 | 60 | 90 | 120;

export interface ScoringConfig {
  enabled: boolean;
  civilianCorrectVote: number;
  civilianWin: number;
  imposterSurvive: number;
  imposterGuess: number;
  jesterVotedOut: number;
}

export interface GameConfig {
  mode: GameModeId;
  imposterCount: number;
  /** Built-in category id, "random", "mixed" or a custom category id ("custom:…"). */
  categoryId: string;
  /** Built-in category ids that Random and Mixed skip. */
  excludedCategories: string[];
  /** Custom categories also take part in Random and Mixed. */
  customInRandom: boolean;
  difficulty: Difficulty;
  clueTimerSec: ClueTimer;
  /** 0 = unlimited */
  discussionTimerSec: DiscussionTimer;
  tieRule: TieRule;
  guessStyle: GuessStyle;
  /** Eliminated imposters get one last chance to guess the word. */
  finalGuess: boolean;
  /** With 2+ imposters, imposters see each other's names. */
  impostersSeeTeammates: boolean;
  /** Undercover mode: does the undercover player know they are undercover? */
  undercoverAware: boolean;
  roles: { detective: boolean; jester: boolean };
  /** Chaos mode: how many random modifiers per round (1 or 2). */
  chaosModifierCount: 1 | 2;
  scoring: ScoringConfig;
  /**
   * 'simple': the phone only deals the words, picks who starts and shows the answer;
   * clues, discussion and voting happen out loud. 'full': everything on the phone.
   */
  playStyle: PlayStyle;
  /** Imposters may see the category as a hint (Classic, and Chaos's category twist). Off = never. */
  imposterHint: boolean;
  /**
   * Secret voting on the phone, in either play style. Off = the group decides out loud and the
   * phone just shows the answer.
   */
  voting: boolean;
  /** Voters may abstain instead of naming a suspect. */
  allowAbstain: boolean;
}

/** A playable category (built-in or custom) handed to the engine. */
export interface CategorySource {
  id: string;
  name: string;
  custom: boolean;
  words: readonly WordEntry[];
}

export interface WordSource {
  /** Every category that can be selected, including custom ones. */
  categories: readonly CategorySource[];
}

export type Intel = { kind: 'innocent'; playerId: PlayerId } | { kind: 'suspects'; playerIds: [PlayerId, PlayerId] };

export interface SecretWord {
  key: string;
  word: string;
  categoryId: string;
  categoryName: string;
}

/** Everything decided randomly at the start of a round. Contains secrets — never log it. */
export interface RoundSetup {
  word: SecretWord;
  /** The undercover word (Undercover mode / chaos "two words"). */
  altWord: string | null;
  roles: Record<PlayerId, RoleId>;
  intel: Record<PlayerId, Intel>;
  modifiers: ModifierId[];
  /** Clue order for the first clue round. */
  clueOrder: PlayerId[];
  /** Shuffled options for the multiple-choice final guess (includes the secret word). */
  guessChoices: string[];
  /** Which way the talking goes around the circle (players are listed in clockwise seating order). */
  direction: Direction;
}

export interface VotingState {
  candidates: PlayerId[];
  voters: PlayerId[];
  /** Index into `voters` of the player currently voting; === voters.length once everyone voted. */
  voterIndex: number;
  /** voter → the players they named (exactly `picks`); an empty list means they abstained. */
  votes: Record<PlayerId, PlayerId[]>;
  isRevote: boolean;
  allowAbstain: boolean;
  /** How many players each voter names — and how many players this vote puts out. */
  picks: number;
  /** Put out before a tie revote; they leave together with the revote's winners. */
  alreadyOut: PlayerId[];
}

export interface Tally {
  counts: Record<PlayerId, number>;
  /** Everyone with the most votes. */
  leaders: PlayerId[];
  maxVotes: number;
  isTie: boolean;
  abstained: number;
}

export interface VoteOutcome {
  tally: Tally;
  votes: Record<PlayerId, PlayerId[]>;
  isRevote: boolean;
  /** Players this vote puts out (empty while a revote is needed, or when nobody got a vote). */
  eliminated: PlayerId[];
  /** Out for sure while the last place(s) go to a revote. */
  alreadyOut: PlayerId[];
  /** Tied for the last place(s): revoted, or picked at random. */
  tied: PlayerId[];
  needsRevote: boolean;
  /** How many places the revote fills. */
  revotePicks: number;
  tieBrokenRandomly: boolean;
  /** Places nobody got a vote for (abstentions). Each one is used up. */
  unfilled: number;
  /** Nobody got a single vote: nobody is out, and the vote is used up. */
  nobodyOut: boolean;
}

export interface Elimination {
  playerId: PlayerId;
  role: RoleId;
  /** The ballots of the vote that put them out ({} when the group decided out loud). */
  votes: Record<PlayerId, PlayerId[]>;
  tieBrokenRandomly: boolean;
  /** Which vote of the round put them out; players voted out together share it. */
  vote: number;
  /** The group decided out loud instead of voting on the phone. */
  outLoud: boolean;
}

export interface Guess {
  playerId: PlayerId;
  guess: string;
  correct: boolean;
  /** True when the group overrode an automatic "wrong" verdict. */
  acceptedByGroup: boolean;
}

export type ResultReason = 'allCaught' | 'imposterSurvived' | 'imposterGuessed' | 'jesterVotedOut';

export interface ScoreLine {
  playerId: PlayerId;
  reason: 'correctVote' | 'teamWin' | 'survived' | 'guessedWord' | 'jesterOut';
  points: number;
}

export interface RoundResult {
  winners: Team[];
  reason: ResultReason;
  scoreDeltas: Record<PlayerId, number>;
  breakdown: ScoreLine[];
}

export interface RoundState {
  id: string;
  number: number;
  setup: RoundSetup;
  revealIndex: number;
  clueOrder: PlayerId[];
  clueIndex: number;
  clueRound: number;
  alive: PlayerId[];
  eliminations: Elimination[];
  eliminationsAllowed: number;
  /** Votes that ended with nobody out (everyone abstained). Each one uses up a vote. */
  skippedVotes: number;
  voting: VotingState | null;
  lastVote: VoteOutcome | null;
  guesses: Guess[];
  pendingGuesser: PlayerId | null;
  result: RoundResult | null;
  /** Players who re-checked their secret mid-round (shown publicly to discourage cheating). */
  peeks: PlayerId[];
}

export type Phase =
  | 'IDLE'
  | 'PLAYER_SETUP'
  | 'CONFIGURATION'
  | 'WORD_GENERATED'
  | 'ROLE_REVEAL_INTRO'
  | 'ROLE_REVEAL'
  | 'REVEAL_COMPLETE'
  | 'CLUE_PHASE'
  | 'DISCUSSION'
  | 'VOTING'
  | 'VOTE_RESULT'
  | 'ELIMINATION'
  | 'IMPOSTER_GUESS'
  | 'ROUND_RESULT'
  | 'SCOREBOARD'
  | 'GAME_COMPLETE'
  /** Words-only style: the answer screen after the group has talked and voted out loud. */
  | 'ANSWER';

export interface RoundSummary {
  number: number;
  word: string;
  altWord: string | null;
  categoryName: string;
  winners: Team[];
  reason: ResultReason;
}

export interface GameState {
  phase: Phase;
  sessionId: string;
  players: Player[];
  config: GameConfig;
  round: RoundState | null;
  scores: Record<PlayerId, number>;
  roundsPlayed: number;
  history: RoundSummary[];
}

/** What a single player is allowed to see during their private reveal. */
export interface SecretView {
  playerId: PlayerId;
  /** A secret word, or (Questions mode) a question to answer. */
  contentKind: 'word' | 'question';
  /** The role card to show. An unaware undercover sees "civilian". */
  shownRole: RoleId;
  word: string | null;
  categoryHint: string | null;
  teammateNames: string[];
  intel: { kind: 'innocent'; name: string } | { kind: 'suspects'; names: [string, string] } | null;
}
