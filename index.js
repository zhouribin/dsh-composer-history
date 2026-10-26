/**
 * Composer History — Host half.
 *
 * The feature lives in the Client half; this half only publishes the row's
 * configuration to the page before the browser plugins activate, so the Client
 * does not have to re-read a file or guess defaults.
 */

/** Page global the Client half reads. */
const GLOBAL_NAME = '__DSH_COMPOSER_HISTORY__';

/** Default configuration; every field is overridable from the Loader row. */
const DEFAULTS = {
  enabled: true,
  /** How many sent messages to keep in the recall ring (1–200). */
  maxEntries: 50,
  /**
   * Only recall when the draft is empty. Turning this off lets ↑ overwrite a
   * draft, which also steals the caret's normal first-line movement.
   */
  requireEmptyDraft: true,
};

/** Clamp one integer option. */
function integer(value, fallback, min, max) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Publish the picker's bootstrap data.
 * @param ctx - Host plugin context.
 * @param config - the Loader row's config.
 */
export function apply(ctx, config) {
  const raw = config !== null && typeof config === 'object' ? config : {};
  const value = {
    enabled: raw.enabled !== false,
    maxEntries: integer(raw.maxEntries, DEFAULTS.maxEntries, 1, 200),
    requireEmptyDraft: raw.requireEmptyDraft !== false,
  };
  ctx.on('webserver/index-inject', (table) => {
    if (!Array.isArray(table)) return;
    table.push({ kind: 'global', name: GLOBAL_NAME, value });
  });
}
