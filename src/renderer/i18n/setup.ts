import { registerTranslations } from './index';
import en from './locales/en';
import fr from './locales/fr';
import es from './locales/es';
import de from './locales/de';
import ar from './locales/ar';

export function initI18n() {
  registerTranslations('en', en);
  registerTranslations('fr', fr);
  registerTranslations('es', es);
  registerTranslations('de', de);
  registerTranslations('ar', ar);
}
