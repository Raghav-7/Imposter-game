/**
 * UX delays in one place. Tests set these to 0 so UI flows can be driven
 * synchronously; the delay logic itself is covered by hook tests.
 */
export const TIMING = {
  /** "Pass the phone" buttons ignore taps for this long (anti double-tap leak). */
  gateArmMs: 900,
  /** "Hide & pass" ignores taps right after the card appears. */
  hideArmMs: 700,
  /** "Vote locked 🔒" confirmation between voters. */
  voteLockedMs: 1100,
  /** Shuffle animation before the first reveal. */
  dealMs: 1700,
  /** How long "Hold to see the answer" must be held. */
  holdRevealMs: 1200,
};
