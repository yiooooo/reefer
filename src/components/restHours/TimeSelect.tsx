import React from 'react';
import { cn } from '@/lib/utils';
import { HOURS, MINUTES } from '../../utils/restHoursData';

interface TimeSelectProps {
  val: string;
  type: 'hour' | 'min';
  onChange: (v: string) => void;
  disabled?: boolean;
  theme?: string | null;
}

const THEME_CLASS: Record<string, string> = {
  orange: 'bg-orange-100 text-orange-950 border-orange-400 font-bold',
  yellow: 'bg-amber-100 text-amber-950 border-amber-400 font-bold',
  green: 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold',
  blue: 'bg-sky-100 text-sky-950 border-sky-400 font-bold',
};

export const TimeSelect: React.FC<TimeSelectProps> = ({
  val,
  type,
  onChange,
  disabled = false,
  theme = null,
}) => {
  const themed = theme ? THEME_CLASS[theme] : null;
  const cls = cn(
    'border rounded px-0.5 py-0 h-5 text-xs leading-tight',
    disabled
      ? 'bg-slate-100 text-slate-400 border-slate-200'
      : themed ??
          (type === 'min' && val === '30'
            ? 'bg-purple-100 text-purple-950 border-purple-400 font-bold'
            : 'bg-white border-slate-300 text-slate-800 font-medium'),
  );

  const options = type === 'hour' ? HOURS : MINUTES;
  return (
    <select
      value={val}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className={cls}
    >
      {options.map(o => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
};
