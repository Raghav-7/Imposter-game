import type { RoundSetupError } from '../game/engine/setup';
import type { SetupIssue } from '../game/engine/validation';
import type { TFunction } from '../localization';

/** Friendly, localised message for a setup validation problem. */
export function setupIssueMessage(issue: SetupIssue | RoundSetupError, t: TFunction, playerCount: number): string {
  switch (issue) {
    case 'tooManyImposters':
      return t('config.error.tooManyImposters', { players: t('common.players_other', { count: playerCount }) });
    case 'categoryEmpty':
      return t('config.error.categoryEmpty');
    case 'categoryMissing':
      return t('config.error.categoryMissing');
    case 'noCategoriesEnabled':
      return t('config.error.noCategories');
    case 'needsTwoWords':
      return t('config.error.needsTwoWords');
    default:
      return t('config.error.players');
  }
}
