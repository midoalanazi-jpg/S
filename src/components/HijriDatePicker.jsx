import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronRight, ChevronLeft, X } from 'lucide-react';

const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
];

const WEEKDAYS = [
  { id: 0, short: 'ح', name: 'الأحد' },
  { id: 1, short: 'ن', name: 'الإثنين' },
  { id: 2, short: 'ث', name: 'الثلاثاء' },
  { id: 3, short: 'ر', name: 'الأربعاء' },
  { id: 4, short: 'خ', name: 'الخميس' },
  { id: 5, short: 'ج', name: 'الجمعة' },
  { id: 6, short: 'س', name: 'السبت' }
];

// دالة تحويل التاريخ الهجري إلى ميلادي بدقة تقويم أم القرى
function hijriToGregorian(hy, hm, hd) {
  const approxGYear = Math.round(hy * 0.970229 + 621.57);
  let d = new Date(approxGYear, 0, 1, 12, 0, 0);

  const getH = (date) => {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(date);
    return {
      year: parseInt(parts.find(p => p.type === 'year')?.value, 10),
      month: parseInt(parts.find(p => p.type === 'month')?.value, 10),
      day: parseInt(parts.find(p => p.type === 'day')?.value, 10)
    };
  };

  let currentH = getH(d);
  let diffDays = (hy - currentH.year) * 354 + (hm - currentH.month) * 29.5 + (hd - currentH.day);
  d.setDate(d.getDate() + Math.round(diffDays));

  for (let i = 0; i < 30; i++) {
    currentH = getH(d);
    if (currentH.year === hy && currentH.month === hm && currentH.day === hd) {
      return d;
    }
    const dayDelta = (hy - currentH.year) * 354 + (hm - currentH.month) * 30 + (hd - currentH.day);
    d.setDate(d.getDate() + (dayDelta === 0 ? (hd > currentH.day ? 1 : -1) : dayDelta));
  }
  return d;
}

// تفاصيل الشهر الهجري (يوم البداية وعدد الأيام 29 أو 30) حسب تقويم أم القرى
function getMonthDetails(hy, hm) {
  try {
    const gDate1 = hijriToGregorian(hy, hm, 1);
    const firstDayOfWeek = gDate1.getDay(); // 0 = الأحد, 1 = الإثنين, ..., 6 = السبت

    // فحص إذا كان اليوم الـ 30 ينتمي لنفس الشهر
    const gDate30 = new Date(gDate1.getTime() + 29 * 86400000);
    const parts30 = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric'
    }).formatToParts(gDate30);
    const d30 = parseInt(parts30.find(p => p.type === 'day')?.value, 10);
    const m30 = parseInt(parts30.find(p => p.type === 'month')?.value, 10);

    const totalDays = (m30 === hm && d30 === 30) ? 30 : 29;
    return { firstDayOfWeek, totalDays };
  } catch (e) {
    return { firstDayOfWeek: 0, totalDays: 30 };
  }
}

// استخراج تاريخ اليوم الهجري الحالي
function getTodayHijri() {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(new Date());
    return {
      hy: parseInt(parts.find(p => p.type === 'year')?.value, 10),
      hm: parseInt(parts.find(p => p.type === 'month')?.value, 10),
      hd: parseInt(parts.find(p => p.type === 'day')?.value, 10)
    };
  } catch (e) {
    return { hy: 1448, hm: 5, hd: 28 };
  }
}

export default function HijriDatePicker({
  value,
  onChange,
  placeholder = 'اختر التاريخ',
  className = '',
  showTodayButton = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // تحليل التاريخ المدخل
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const parts = String(value).split('-').map(p => parseInt(p, 10));
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      return { hy: parts[0], hm: parts[1], hd: parts[2] };
    }
    return null;
  }, [value]);

  const today = useMemo(() => getTodayHijri(), []);

  // الشهر والسنة المعروضين حالياً في التقويم
  const [displayYear, setDisplayYear] = useState(() => parsedValue?.hy || today.hy);
  const [displayMonth, setDisplayMonth] = useState(() => parsedValue?.hm || today.hm);

  // تحديث العرض عند تغير القيمة من الخارج
  useEffect(() => {
    if (parsedValue) {
      setDisplayYear(parsedValue.hy);
      setDisplayMonth(parsedValue.hm);
    }
  }, [parsedValue]);

  // إغلاق التقويم عند النقر في الخارج
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // حساب تفاصيل الشهر المعروض
  const { firstDayOfWeek, totalDays } = useMemo(() => {
    return getMonthDetails(displayYear, displayMonth);
  }, [displayYear, displayMonth]);

  const pad = (n) => String(n).padStart(2, '0');

  const handleSelectDay = (day) => {
    const dateStr = `${displayYear}-${pad(displayMonth)}-${pad(day)}`;
    onChange?.(dateStr);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (displayMonth === 1) {
      setDisplayMonth(12);
      setDisplayYear(prev => prev - 1);
    } else {
      setDisplayMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 12) {
      setDisplayMonth(1);
      setDisplayYear(prev => prev + 1);
    } else {
      setDisplayMonth(prev => prev + 1);
    }
  };

  const handleSelectToday = () => {
    const dateStr = `${today.hy}-${pad(today.hm)}-${pad(today.hd)}`;
    setDisplayYear(today.hy);
    setDisplayMonth(today.hm);
    onChange?.(dateStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange?.('');
    setIsOpen(false);
  };

  // نص العرض في حقل الإدخال: اليوم / الشهر / السنة هـ
  const displayInputText = parsedValue 
    ? `${parsedValue.hd} / ${parsedValue.hm} / ${parsedValue.hy} هـ` 
    : '';

  // توليد قائمة السنوات المتاحة
  const yearsList = useMemo(() => {
    const currentY = today.hy || 1448;
    const start = currentY - 5;
    const end = currentY + 10;
    const list = [];
    for (let y = start; y <= end; y++) {
      list.push(y);
    }
    return list;
  }, [today.hy]);

  return (
    <div className="relative w-full" ref={containerRef} dir="rtl">
      {/* حقل العرض الذي يتم النقر عليه */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer relative"
      >
        <input
          type="text"
          readOnly
          value={displayInputText}
          placeholder={placeholder}
          className={className}
        />
      </div>

      {/* نافذة التقويم المنبثقة */}
      {isOpen && (
        <div 
          className="absolute z-50 top-full mt-2 right-1/2 translate-x-1/2 md:translate-x-0 md:right-0 w-[300px] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-3.5 select-none animate-in fade-in zoom-in-95 duration-150"
          dir="rtl"
        >
          {/* رأس التقويم: اختيار الشهر والسنة وأسهم التنقل */}
          <div className="flex items-center justify-between gap-1 pb-3 mb-2 border-b border-slate-100">
            {/* زر الشهر السابق */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* قوائم الاختيار المباشر للشهر والسنة */}
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <select
                value={displayMonth}
                onChange={(e) => setDisplayMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                {HIJRI_MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={displayYear}
                onChange={(e) => setDisplayYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* زر الشهر القادم */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="الشهر القادم"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* أسماء أيام الأسبوع */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((w) => (
              <div 
                key={w.id} 
                className="text-[11px] font-bold text-slate-400 py-1"
                title={w.name}
              >
                {w.short}
              </div>
            ))}
          </div>

          {/* شبكة الأيام */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* خانات فارغة قبل اليوم الأول من الشهر */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* أيام الشهر */}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
              const isSelected = parsedValue && 
                parsedValue.hd === day && 
                parsedValue.hm === displayMonth && 
                parsedValue.hy === displayYear;

              const isToday = today.hd === day && 
                today.hm === displayMonth && 
                today.hy === displayYear;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105' 
                      : isToday
                      ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* أزرار اليوم ومسح */}
          <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
            {showTodayButton && (
              <button
                type="button"
                onClick={handleSelectToday}
                className="flex-1 py-1 px-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                اليوم
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-1 px-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              مسح
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
