export type Locale = 'en' | 'fr' | 'es' | 'de' | 'ar';

// Flat key-value translation map
export type TranslationMap = Record<string, string>;

const translations: Record<Locale, TranslationMap> = {
  en: {},
  fr: {},
  es: {},
  de: {},
  ar: {},
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale) {
  currentLocale = locale;
  // Set dir attribute for RTL languages
  if (typeof document !== 'undefined') {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function registerTranslations(locale: Locale, map: TranslationMap) {
  translations[locale] = { ...translations[locale], ...map };
}

/**
 * Translate a key. Supports simple interpolation: t('hello', { name: 'World' })
 * looks up "hello" key and replaces {{name}} with 'World'.
 * Falls back to English, then to the key itself.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let value = translations[currentLocale]?.[key]
    ?? translations['en']?.[key]
    ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return value;
}
