/**
 * Sanitised logger. Production builds only emit warnings/errors, and context
 * objects are scrubbed of anything that could carry game secrets.
 * Never pass words, roles or game state to the logger.
 */
const SECRET_KEYS = /word|role|secret|setup|guess|intel|alt|state|round/i;

function scrub(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] = SECRET_KEYS.test(k) ? '[redacted]' : typeof v === 'string' ? v.slice(0, 200) : v;
  }
  return out;
}

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (isDev) console.log(`[imposter] ${message}`, scrub(context) ?? '');
  },
  warn(message: string, context?: Record<string, unknown>) {
    if (isDev) console.warn(`[imposter] ${message}`, scrub(context) ?? '');
  },
  error(message: string, context?: Record<string, unknown>) {
    console.error(`[imposter] ${message}`, scrub(context) ?? '');
  },
};

export const __testing = { scrub };
