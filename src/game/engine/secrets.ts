import { MODES } from '../modes';
import type { GameState, PlayerId, SecretView } from '../types';

/**
 * Computes what ONE player may see on their private card. Call this only at
 * the moment the card is shown; never keep the result in long-lived state.
 */
export function getSecretView(state: GameState, playerId: PlayerId): SecretView | null {
  const round = state.round;
  if (!round) return null;
  const { setup } = round;
  const role = setup.roles[playerId];
  if (!role) return null;
  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? '?';
  const mode = MODES[state.config.mode];

  const view: SecretView = {
    playerId,
    shownRole: role,
    word: null,
    categoryHint: null,
    teammateNames: [],
    intel: null,
  };

  switch (role) {
    case 'imposter': {
      const seesCategory =
        state.config.imposterHint && (mode.imposterSeesCategory || setup.modifiers.includes('imposterCategory'));
      view.categoryHint = seesCategory ? setup.word.categoryName || null : null;
      if (state.config.impostersSeeTeammates) {
        view.teammateNames = Object.keys(setup.roles)
          .filter((id) => id !== playerId && setup.roles[id] === 'imposter')
          .map(nameOf);
      }
      break;
    }
    case 'undercover': {
      view.word = setup.altWord;
      // Undercover-mode players only learn their role if the group enabled it.
      // Chaos "two words" decoys never know.
      const aware = state.config.mode === 'undercover' && state.config.undercoverAware;
      if (!aware) view.shownRole = 'civilian';
      else if (state.config.impostersSeeTeammates) {
        view.teammateNames = Object.keys(setup.roles)
          .filter((id) => id !== playerId && setup.roles[id] === 'undercover')
          .map(nameOf);
      }
      break;
    }
    default: {
      view.word = setup.word.word;
      const intel = setup.intel[playerId];
      if (intel?.kind === 'innocent') view.intel = { kind: 'innocent', name: nameOf(intel.playerId) };
      if (intel?.kind === 'suspects') {
        view.intel = { kind: 'suspects', names: [nameOf(intel.playerIds[0]), nameOf(intel.playerIds[1])] };
      }
    }
  }
  return view;
}
