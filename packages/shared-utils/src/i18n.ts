/** Minimal ICU-flavoured string catalog. Full-blown i18n (message bundles,
 * pluralization, gender) lands as a plugin — this stays lightweight for
 * shared UI copy. Apps ship their own catalog; this exports the loader. */

export type LocaleTable = Record<string, string>;

export interface I18n {
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const interpolate = (template: string, params?: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k) =>
    params && k in params ? String(params[k]) : `{${k}}`,
  );

export function createI18n(locale: string, table: LocaleTable): I18n {
  return {
    locale,
    t: (key, params) => interpolate(table[key] ?? key, params),
  };
}
