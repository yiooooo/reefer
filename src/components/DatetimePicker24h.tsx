import React, { useState, useMemo, useRef } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PickersActionBarAction } from '@mui/x-date-pickers/PickersActionBar';
import dayjs, { Dayjs } from 'dayjs';

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
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
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

export const DatetimePicker24h: React.FC<DatetimePicker24hProps> = ({
  value,
  onChange,
  showTime = true,
  baseDate,
  placeholder,
  style,
  width,
  dataRow,
  dataCol,
  onKeyDown,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 快取 dayjs 物件 reference，避免每次 re-render 產生新物件實體
  const dayjsValue = useMemo<Dayjs | null>(() => {
    if (!value || !value.trim()) return null;
    const clean = value.trim().replace(/\//g, '-').replace('T', ' ');
    const d = dayjs(clean);
    return d.isValid() ? d : null;
  }, [value]);

  // 內部「編輯中」暫存值：當空欄位被 focus 時，預填當年 1/1 00:00
  // 讓 MUI 顯示 "2026-01-01 00:00"，用戶可直接從月份開始改寫
  // 離開欄位未完成輸入時清除
  const [editingValue, setEditingValue] = useState<Dayjs | null>(null);

  // MUI 實際使用的值：外部值 > 內部暫存值 > null
  const effectiveValue = dayjsValue ?? editingValue;

  const dateFormat = showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  const defaultPlaceholder = placeholder || dateFormat;
  const defaultWidth = width || (showTime ? '155px' : '120px');

  // 推算本次應使用的年份 (for referenceDate 與 auto-fill)
  // 若有 baseDate，以 baseDate 月份做跨年推算；否則用當年年份
  const inferredYear = useMemo(() => {
    if (baseDate && baseDate.trim()) {
      const base = dayjs(baseDate);
      if (base.isValid()) {
        return inferYearFromBase(base.month() + 1, baseDate);
      }
    }
    return dayjs().year();
  }, [baseDate]);

  // referenceDate: 空欄位時 MUI 使用此日期補全缺漏的欄位 (尤其是年份)
  const referenceDate = useMemo(
    () => dayjs().year(inferredYear).month(0).date(1).hour(0).minute(0).second(0),
    [inferredYear]
  );

  const handleChange = (newValue: Dayjs | null) => {
    if (!newValue || !newValue.isValid()) {
      setEditingValue(null);
      onChange('');
    } else {
      setEditingValue(null); // 清除暫存，改用外部值
      onChange(newValue.format(dateFormat));
    }
  };

  /**
   * 當外層 div 接收到 focus (從外部進入)：
   * 若欄位值為空，預填「當年 1/1 00:00」讓年份顯示出來，再跳到月份 section
   */
  const handleContainerFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (dayjsValue) return; // 已有值，不干涉

    // 若 focus 從容器內部移來 (MUI section 間跳轉)，不干涉
    const relatedTarget = e.relatedTarget as Node | null;
    const container = containerRef.current;
    if (container && relatedTarget && container.contains(relatedTarget)) {
      return;
    }

    // 預填當年 1/1 00:00 讓年份顯示，並跳到月份 section
    const defaultDate = dayjs().year(inferredYear).month(0).date(1).hour(0).minute(0).second(0);
    setEditingValue(defaultDate);

    setTimeout(() => {
      if (!containerRef.current) return;
      const monthSection = containerRef.current.querySelector<HTMLElement>('[data-sectionindex="1"]');
      monthSection?.click();
    }, 0);
  };

  /**
   * 當 focus 離開容器且外部值仍為空時，清除暫存的 editingValue
   */
  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (dayjsValue) return; // 外部有值，不用清
    const relatedTarget = e.relatedTarget as Node | null;
    const container = containerRef.current;
    if (!container?.contains(relatedTarget ?? null)) {
      setEditingValue(null); // 離開欄位且未完成輸入，清除暫存
    }
  };

  const actionBarActions: PickersActionBarAction[] = ['today', 'clear'];

  const commonSlotProps = {
    textField: {
      size: 'small' as const,
      variant: 'outlined' as const,
      inputProps: {
        placeholder: defaultPlaceholder,
        'data-row': dataRow,
        'data-col': dataCol,
      },
      sx: {
        width: defaultWidth,
        minWidth: defaultWidth,
        height: '28px !important',
        minHeight: '28px !important',
        maxHeight: '28px !important',
        display: 'inline-block',
        verticalAlign: 'middle',
        margin: '0 !important',
        boxSizing: 'border-box !important',

        // 1. MuiPickersInputBase 容器 (div) 高度固定 28px、flex 垂直置中
        '& .MuiPickersInputBase-root, & .MuiInputBase-root': {
          height: '28px !important',
          minHeight: '28px !important',
          maxHeight: '28px !important',
          fontSize: '12px !important',
          backgroundColor: '#ffffff !important',
          borderRadius: '6px !important',
          paddingLeft: '6px !important',
          paddingRight: '2px !important',
          boxSizing: 'border-box !important',
          display: 'flex !important',
          alignItems: 'center !important',
          position: 'relative !important',
          cursor: 'pointer !important',
        },

        // 2. MUI X v7 內部 section list 元素全盤覆寫為 12px 與垂直置中
        '& .MuiPickersSectionList-root, & .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersSection-root, & .MuiPickersInputBase-input, & .MuiInputBase-input': {
          display: 'inline-flex !important',
          alignItems: 'center !important',
          fontSize: '12px !important',
          height: '26px !important',
          lineHeight: '26px !important',
          padding: '0 !important',
          margin: '0 !important',
          boxSizing: 'border-box !important',
          color: '#0f172a !important',
          letterSpacing: '-0.2px !important',
          fontFamily: 'inherit !important',
          cursor: 'pointer !important',
        },
        // 3. 邊框 notchedOutline：固定高度 28px
        '& .MuiPickersOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline': {
          borderColor: '#cbd5e1 !important',
          borderStyle: 'solid !important',
          borderWidth: '1px !important',
          borderRadius: '6px !important',
          position: 'absolute !important',
          top: '0 !important',
          bottom: '0 !important',
          left: '0 !important',
          right: '0 !important',
          height: '28px !important',
          boxSizing: 'border-box !important',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease !important',
          '& legend': {
            display: 'none !important',
            width: '0 !important',
          },
        },

        // 4. Hover 邊框顏色改為主題藍 #0284c7
        '&:hover .MuiPickersOutlinedInput-notchedOutline, & .MuiPickersInputBase-root:hover .MuiPickersOutlinedInput-notchedOutline, &:hover .MuiOutlinedInput-notchedOutline, & .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: '#0284c7 !important',
          borderWidth: '1px !important',
        },

        // 5. Focus 藍光
        '&.Mui-focused .MuiPickersOutlinedInput-notchedOutline, & .MuiPickersInputBase-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#0284c7 !important',
          borderWidth: '1px !important',
          boxShadow: '0 0 0 3px rgba(56, 189, 248, 0.2) !important',
        },

        '& .MuiInputAdornment-root': {
          marginLeft: '0 !important',
          height: '28px !important',
          display: 'flex !important',
          alignItems: 'center !important',
        },

        '& .MuiIconButton-root': {
          padding: '2px !important',
          marginRight: '-1px !important',
          color: '#0284c7 !important',
          '&:hover': {
            backgroundColor: 'rgba(2, 132, 199, 0.08) !important',
          },
          '& svg': {
            fontSize: '16px !important',
            width: '16px !important',
            height: '16px !important',
          },
        },
        ...style,
      },
    },
    popper: {
      sx: {
        '& .MuiPaper-root': {
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.18)',
          border: '1px solid #bae6fd',
        },
      },
    },
    // 底部動作列：今天、清除按鈕
    actionBar: {
      actions: actionBarActions,
    },
  };

  return (
    <div
      ref={containerRef}
      data-row={dataRow}
      data-col={dataCol}
      onFocus={handleContainerFocus}
      onBlur={handleContainerBlur}
      onKeyDownCapture={onKeyDown}
      style={{ display: 'inline-block', verticalAlign: 'middle', width: defaultWidth }}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {showTime ? (
          <DateTimePicker
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            closeOnSelect={true}
            value={effectiveValue}
            referenceDate={referenceDate}
            onChange={handleChange}
            ampm={false} // 24 小時制
            timeSteps={{ hours: 1, minutes: 1 }} // 包含 0~59 分鐘
            views={['year', 'month', 'day', 'hours', 'minutes']}
            format={dateFormat}
            slotProps={commonSlotProps}
          />
        ) : (
          <DatePicker
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            closeOnSelect={true}
            value={effectiveValue}
            referenceDate={referenceDate}
            onChange={handleChange}
            views={['year', 'month', 'day']}
            format={dateFormat}
            slotProps={commonSlotProps}
          />
        )}
      </LocalizationProvider>
    </div>
  );
};

