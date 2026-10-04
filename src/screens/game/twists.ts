import { SPEED_ROUND_SECONDS } from '../../game/modes';
import type { GameState, ModifierId } from '../../game/types';
import type { TFunction } from '../../localization';

export function twistText(mod: ModifierId, state: GameState, t: TFunction): string {
  const round = state.round;
  switch (mod) {
    case 'lastRestriction': {
      const lastId = round?.clueOrder[round.clueOrder.length - 1];
      const name = state.players.find((p) => p.id === lastId)?.name ?? '?';
      return t('twist.lastRestriction', { name });
    }
    case 'speedRound':
      return t('twist.speedRound', { count: SPEED_ROUND_SECONDS });
    default:
      return t(`twist.${mod}`);
  }
}

/** Seconds per clue for this round (speed round overrides the setting). */
export function clueSeconds(state: GameState): number {
  if (state.round?.setup.modifiers.includes('speedRound')) return SPEED_ROUND_SECONDS;
  return state.config.clueTimerSec;
}
