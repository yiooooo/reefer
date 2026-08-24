import React, { useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

export interface DatetimePicker24hProps {
  value: string; // "YYYY-MM-DD HH:mm" 或 "YYYY-MM-DD" 或 ISO 字串
  onChange: (val: string) => void;
  showTime?: boolean; // 預設 true (顯示日期與時間: YYYY-MM-DD HH:mm)，若為 false 則為純日期 (YYYY-MM-DD)
  baseDate?: string;  // 用於跨年推算年份的基準日期 (如裝船日期)
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: string;
  dataRow?: number;
  dataCol?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * 跨年度航程年份推算
 * 比對輸入月份與基準日期月份，決定應使用 baseYear, baseYear+1 或 baseYear-1
 */
function inferYearFromBase(inputMonth: number, baseDateStr: string): number {
  const base = dayjs(baseDateStr);
  if (!base.isValid()) return dayjs().year();
  const baseYear = base.year();
  const baseMonth = base.month() + 1; // dayjs month is 0-indexed

  // 裝船在 11-12 月，輸入在 1-2 月 → 跨年，+1
  if (baseMonth >= 11 && inputMonth <= 2) return baseYear + 1;
  // 裝船在 1-2 月，輸入在 11-12 月 → 可能是前一年的資料，-1
  if (baseMonth <= 2 && inputMonth >= 11) return baseYear - 1;
  return baseYear;
}

/**
 * 智慧日期解析
 * 支援以下輸入格式（month、day 為必填，year 自動推算）：
 *
 *  digits only:
 *    "0822"          → YYYY-08-22 00:00
 *    "082216"        → YYYY-08-22 16:00
 *    "08221600"      → YYYY-08-22 16:00
 *
 *  digits with space (time):
 *    "0822 1600"     → YYYY-08-22 16:00
 *    "0822 16:00"    → YYYY-08-22 16:00
 *
 *  with separator (/ - .):
 *    "8/22"          → YYYY-08-22 00:00
 *    "8/22 16:00"    → YYYY-08-22 16:00
 *    "08-22 16:00"   → YYYY-08-22 16:00
 *
 *  with year prefix (auto-extracted):
 *    "2026-08-22 16:00"  → 2026-08-22 16:00
 *    "2026-0822 1600"    → 2026-08-22 16:00
 *    "2026-0822"         → 2026-08-22 00:00
 */
function parseSmartDate(raw: string, showTime: boolean, baseDate?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const getYear = (month: number): number => {
    if (baseDate && baseDate.trim()) {
      return inferYearFromBase(month, baseDate);
    }
    return dayjs().year();
  };

  let inputYear: number | null = null;
  let rest = trimmed;

  // 嘗試從開頭提取 4 位年份 (2000~2100)
  const yearPrefixMatch = rest.match(/^(\d{4})[-/.\s]?(.*)/s);
  if (yearPrefixMatch) {
    const potentialYear = parseInt(yearPrefixMatch[1]);
    if (potentialYear >= 2000 && potentialYear <= 2100) {
      // 確認後面不只是 MMDD 等純數字導致誤判為年份+月日
      // 若整體是 8 位純數字，前 4 位不一定是年份 (e.g. "08221600")
      const isFullDigits8 = /^\d{8}$/.test(trimmed);
      if (!isFullDigits8) {
        inputYear = potentialYear;
        rest = yearPrefixMatch[2].trim();
      }
    }
  }

  let month: number | null = null;
  let day: number | null = null;
  let hour = 0;
  let minute = 0;

  // Pattern A: 8 位純數字 MMDDHHmm
  if (/^\d{8}$/.test(rest)) {
    month = parseInt(rest.slice(0, 2));
    day   = parseInt(rest.slice(2, 4));
    hour  = parseInt(rest.slice(4, 6));
    minute = parseInt(rest.slice(6, 8));
  }
  // Pattern B: 6 位純數字 MMDDHh
  else if (/^\d{6}$/.test(rest)) {
    month = parseInt(rest.slice(0, 2));
    day   = parseInt(rest.slice(2, 4));
    hour  = parseInt(rest.slice(4, 6));
  }
  // Pattern C: 4 位純數字 MMDD
  else if (/^\d{4}$/.test(rest)) {
    month = parseInt(rest.slice(0, 2));
    day   = parseInt(rest.slice(2, 4));
  }
  // Pattern D: MMDD HHmm (8 digits, space-separated 4+4)
  else if (/^\d{4}\s+\d{4}$/.test(rest)) {
    const parts = rest.split(/\s+/);
    month  = parseInt(parts[0].slice(0, 2));
    day    = parseInt(parts[0].slice(2, 4));
    hour   = parseInt(parts[1].slice(0, 2));
    minute = parseInt(parts[1].slice(2, 4));
  }
  // Pattern E: MMDD HH:mm
  else if (/^\d{4}\s+\d{1,2}:\d{2}$/.test(rest)) {
    const [datePart, timePart] = rest.split(/\s+/);
    month = parseInt(datePart.slice(0, 2));
    day   = parseInt(datePart.slice(2, 4));
    const [h, m] = timePart.split(':');
    hour = parseInt(h); minute = parseInt(m);
  }
  // Pattern F: M/D, M-D, M.D (with optional space+time)
  else {
    const sepMatch = rest.match(/^(\d{1,2})[/\-.](\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?)?$/);
    if (sepMatch) {
      month  = parseInt(sepMatch[1]);
      day    = parseInt(sepMatch[2]);
      if (sepMatch[3] !== undefined) hour   = parseInt(sepMatch[3]);
      if (sepMatch[4] !== undefined) minute = parseInt(sepMatch[4]);
    }
  }

  if (month === null || day === null) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';

  const year = inputYear ?? getYear(month);

  const dt = dayjs(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  );
  if (!dt.isValid()) return '';
  return showTime ? dt.format('YYYY-MM-DD HH:mm') : dt.format('YYYY-MM-DD');
}

export const DatetimePicker24h: React.FC<DatetimePicker24hProps> = ({
  value,
  onChange,
  showTime = true,
  baseDate,
  placeholder,
  className,
  style,
  width,
  dataRow,
  dataCol,
  onKeyDown,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultWidth = width || (showTime ? '155px' : '118px');
  const defaultPlaceholder = placeholder || (showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');

  // 推算本次應使用的年份 (顯示於 focus 預填)
  const inferredYear = useMemo(() => {
    if (baseDate && baseDate.trim()) {
      const base = dayjs(baseDate);
      if (base.isValid()) return base.year();
    }
    return dayjs().year();
  }, [baseDate]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const currentVal = value ? value.trim() : '';
    if (currentVal) {
      // 有現有值：全選方便重新輸入
      setEditValue(currentVal);
      setTimeout(() => e.target.select(), 0);
    } else {
      // 空值：預填年份前綴，提示使用者從月日開始輸入
      const yearPrefix = `${inferredYear}-`;
      setEditValue(yearPrefix);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(yearPrefix.length, yearPrefix.length);
        }
      }, 0);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // 若只剩下年份前綴 (e.g. "2026-") 沒有繼續輸入，視為空值
    const yearOnlyRegex = /^\d{4}-?$/;
    if (yearOnlyRegex.test(editValue.trim())) {
      onChange('');
    } else {
      const parsed = parseSmartDate(editValue, showTime, baseDate);
      onChange(parsed);
    }
    setEditValue('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  // onKeyDown forwarding: 外層 div 的 onKeyDownCapture 讓 Tab/Arrow 導航正常運作
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter 鍵：觸發 blur 解析
    if (e.key === 'Enter' && isFocused) {
      inputRef.current?.blur();
    }
    onKeyDown?.(e);
  };

  const displayValue = isFocused ? editValue : (value ?? '');

  return (
    <div
      data-row={dataRow}
      data-col={dataCol}
      onKeyDownCapture={handleKeyDown}
      style={{ display: 'inline-block', verticalAlign: 'middle', width: defaultWidth, ...style }}
    >
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={defaultPlaceholder}
        style={{ width: '100%' }}
        className={cn(
          // 與 Input 元件一致的樣式（h-8 / text-sm，符合目前 Input 設定）
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-ring/50",
          "flex h-8 w-full min-w-0 rounded-md border px-2 py-1 text-sm",
          "shadow-xs transition-[color,box-shadow] outline-none",
          "focus:ring-2 focus:ring-ring/30 focus:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "font-mono tabular-nums",
          className
        )}
      />
    </div>
  );
};
