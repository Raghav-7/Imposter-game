import { router } from 'expo-router';

type Fallback = '/' | '/categories' | '/setup/players' | '/setup/config';

/** Go back if there is history (e.g. opened via deep link), otherwise replace with a sensible parent. */
export function safeBack(fallback: Fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
