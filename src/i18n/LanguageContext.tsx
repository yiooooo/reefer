import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, TranslationSchema, TranslationKey } from './types';
import { zhTW } from './locales/zh-TW';
import { en } from './locales/en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: TranslationKey, params?: Record<string, string | number>) => string;
  schema: TranslationSchema;
}

const STORAGE_LANG_KEY = 'reefer_app_lang';

const translations: Record<Language, TranslationSchema> = {
  'zh-TW': zhTW,
  en,
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY) as Language;
      if (saved === 'zh-TW' || saved === 'en') return saved;
      // 偵測瀏覽器語系預設值
      if (typeof navigator !== 'undefined' && navigator.language && !navigator.language.startsWith('zh')) {
        return 'en';
      }
    } catch {
      // ignore
    }
    return 'zh-TW';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch (err) {
      console.error('Failed to save language to localStorage:', err);
    }
  }, []);

  const currentSchema = useMemo(() => translations[language] || zhTW, [language]);

  const t = useCallback(
    (path: TranslationKey, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: any = currentSchema;
      let text = '';

      for (const k of keys) {
        if (!current || current[k] === undefined) {
          // Fallback to zh-TW
          let fallback: any = zhTW;
          for (const fbKey of keys) {
            if (!fallback || fallback[fbKey] === undefined) {
              text = path;
              break;
            }
            fallback = fallback[fbKey];
          }
          if (!text) {
            text = typeof fallback === 'string' ? fallback : path;
          }
          break;
        }
        current = current[k];
      }

      if (!text) {
        text = typeof current === 'string' ? current : path;
      }

      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        });
      }

      return text;
    },
    [currentSchema]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      schema: currentSchema,
    }),
    [language, setLanguage, t, currentSchema]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
