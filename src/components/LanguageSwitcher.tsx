import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { Language } from '../i18n/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="inline-flex items-center gap-1">
      <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
        <SelectTrigger
          className="h-8 bg-white/10 hover:bg-white/15 border-white/20 text-white text-xs font-semibold rounded-md px-2.5 gap-1.5 focus:ring-1 focus:ring-sky-400 cursor-pointer shadow-xs min-w-[105px]"
          aria-label="Language Selector"
          title="Language / 語言切換"
        >
          <Globe className="w-3.5 h-3.5 shrink-0 text-sky-400" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="text-xs bg-slate-900 text-slate-100 border-slate-700">
          <SelectItem value="zh-TW" className="cursor-pointer focus:bg-sky-900/60 focus:text-white">
            繁中 (ZH)
          </SelectItem>
          <SelectItem value="en" className="cursor-pointer focus:bg-sky-900/60 focus:text-white">
            English (EN)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
