import React, { useState, useMemo } from 'react';
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
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: string;
}

export const DatetimePicker24h: React.FC<DatetimePicker24hProps> = ({
  value,
  onChange,
  showTime = true,
  placeholder,
  style,
  width,
}) => {
  const [open, setOpen] = useState(false);

  // 快取 dayjs 物件 reference，避免每次 re-render 產生新物件實體
  const dayjsValue = useMemo<Dayjs | null>(() => {
    if (!value || !value.trim()) return null;
    const clean = value.trim().replace(/\//g, '-').replace('T', ' ');
    const d = dayjs(clean);
    return d.isValid() ? d : null;
  }, [value]);

  const dateFormat = showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  const defaultPlaceholder = placeholder || dateFormat;
  const defaultWidth = width || (showTime ? '145px' : '120px');

  const handleChange = (newValue: Dayjs | null) => {
    if (!newValue || !newValue.isValid()) {
      onChange('');
    } else {
      onChange(newValue.format(dateFormat));
    }
  };

  const actionBarActions: PickersActionBarAction[] = ['today', 'clear'];

  const commonSlotProps = {
    textField: {
      size: 'small' as const,
      variant: 'outlined' as const,
      inputProps: {
        placeholder: defaultPlaceholder,
      },
      onClick: () => setOpen(true),
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
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {showTime ? (
        <DateTimePicker
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          closeOnSelect={true}
          value={dayjsValue}
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
          value={dayjsValue}
          onChange={handleChange}
          views={['year', 'month', 'day']}
          format={dateFormat}
          slotProps={commonSlotProps}
        />
      )}
    </LocalizationProvider>
  );
};
