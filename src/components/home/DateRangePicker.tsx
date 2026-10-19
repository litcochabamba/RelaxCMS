import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

export interface DateRangeValue {
  checkIn: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm
  checkOut: string; // YYYY-MM-DD
  checkOutTime: string; // HH:mm
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function toDate(value: string): Date {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDay(value: string) {
  return format(toDate(value), 'dd/MM/yy');
}

function startOfCalendarMonth(value: string) {
  return startOfMonth(toDate(value));
}

interface CalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: string;
  minDate: string;
  onSelect: (date: string) => void;
  label: string;
}

function Calendar({ month, onMonthChange, selected, minDate, onSelect, label }: CalendarProps) {
  const selectedDate = toDate(selected);
  const min = toDate(minDate);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label={`Mes anterior de ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700/80">{label}</p>
          <p className="text-sm font-medium capitalize text-gray-900">
            {format(month, 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label={`Mes siguiente de ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            {day}
          </span>
        ))}
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const isDisabled = isBefore(day, min);
          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(iso)}
              aria-label={formatDay(iso)}
              aria-pressed={isSelected}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                isSelected
                  ? 'bg-gray-900 font-semibold text-white'
                  : isDisabled
                    ? 'cursor-not-allowed text-gray-300'
                    : 'text-gray-700 hover:bg-gray-100'
              } ${
                !isSelected && !isDisabled && isToday(day) ? 'ring-1 ring-inset ring-amber-600/50' : ''
              } ${!isSameMonth(day, month) ? 'opacity-40' : ''}`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [checkInMonth, setCheckInMonth] = useState(() => startOfCalendarMonth(value.checkIn));
  const [checkOutMonth, setCheckOutMonth] = useState(() => startOfCalendarMonth(value.checkOut));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Al reabrir, los calendarios vuelven al mes de las fechas elegidas.
  useEffect(() => {
    if (!open) return;
    setCheckInMonth(startOfCalendarMonth(value.checkIn));
    setCheckOutMonth(startOfCalendarMonth(value.checkOut));
  }, [open, value.checkIn, value.checkOut]);

  const handleCheckIn = (date: string) => {
    const next: DateRangeValue = { ...value, checkIn: date };
    if (isBefore(toDate(value.checkOut), toDate(date)) || isSameDay(toDate(value.checkOut), toDate(date))) {
      next.checkOut = format(addDays(toDate(date), 1), 'yyyy-MM-dd');
      setCheckOutMonth(startOfCalendarMonth(next.checkOut));
    }
    onChange(next);
  };

  const handleCheckOut = (date: string) => {
    onChange({ ...value, checkOut: date });
  };

  const summary = `E: ${formatDay(value.checkIn)} ${value.checkInTime}, S: ${formatDay(value.checkOut)} ${value.checkOutTime}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Fecha de entrada y salida"
        className="flex h-[52px] w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 text-left font-serif text-base text-gray-900 transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        <span className="truncate tabular-nums">{summary}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Elegir entrada y salida"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-40 mt-2 w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-xl sm:w-[34rem] sm:p-5"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
              <Calendar
                month={checkInMonth}
                onMonthChange={setCheckInMonth}
                selected={value.checkIn}
                minDate={format(new Date(), 'yyyy-MM-dd')}
                onSelect={handleCheckIn}
                label="Entrada"
              />
              <div className="hidden w-px bg-gray-100 sm:block" />
              <Calendar
                month={checkOutMonth}
                onMonthChange={setCheckOutMonth}
                selected={value.checkOut}
                minDate={value.checkIn}
                onSelect={handleCheckOut}
                label="Salida"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
              <label className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  Hora entrada
                </span>
                <input
                  type="time"
                  step={60}
                  value={value.checkInTime}
                  onChange={(event) => onChange({ ...value, checkInTime: event.target.value })}
                  className="ml-auto h-9 w-28 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </label>
              <label className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  Hora salida
                </span>
                <input
                  type="time"
                  step={60}
                  value={value.checkOutTime}
                  onChange={(event) => onChange({ ...value, checkOutTime: event.target.value })}
                  className="ml-auto h-9 w-28 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                Listo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
