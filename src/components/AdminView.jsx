import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Download, 
  User, Users, ChevronRight, FileText, CheckCircle2,
  Calendar, X, Layout
} from 'lucide-react';
import HijriDatePicker from '@mk01/react-hijri-date-picker';

import { supabase } from '../supabaseClient';

const DAYS = [
  { id: 'sun', name: 'الأحد' },
  { id: 'mon', name: 'الاثنين' },
  { id: 'tue', name: 'الثلاثاء' },
  { id: 'wed', name: 'الأربعاء' },
  { id: 'thu', name: 'الخميس' },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const SUBJECTS = [
  'فنية', 'رقمية', 'بدنية', 'اجتماعيات', 'اسلامية', 
  'انجليزي', 'رياضيات', 'علوم', 'لغتي', 'حياتيه'
];

const AdminView = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherAssignments, setTeacherAssignments] = useState({}); // { classId: [subject1, subject2] }
  const [teacherLeaderships, setTeacherLeaderships] = useState([]); // Array of classIds
  const [editingScheduleClassId, setEditingScheduleClassId] = useState(null);
  const [tempSchedule, setTempSchedule] = useState({});
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [isBulkExport, setIsBulkExport] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from Supabase
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: clsData } = await supabase.from('classes').select('*').order('created_at');
      const { data: tchData } = await supabase.from('teachers').select('*').order('created_at');
      const { data: plansData } = await supabase.from('weekly_plans').select('*');
      
      setClasses(clsData || []);
      setTeachers(tchData || []);
      setWeeklyPlans(plansData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addClass = async () => {
    if (!newClassName.trim()) return;
    const { data, error } = await supabase
      .from('classes')
      .insert([{ name: newClassName, schedule: {} }])
      .select();
    
    if (error) {
      alert('خطأ في إضافة الفصل');
    } else {
      setClasses([...classes, data[0]]);
      setNewClassName('');
      alert('تم إضافة الفصل بنجاح');
    }
  };

  const addTeacher = async () => {
    if (!newTeacherName.trim()) return;
    const assignedClassIds = Object.keys(teacherAssignments).filter(id => teacherAssignments[id].length > 0);
    
    if (assignedClassIds.length === 0) {
      alert('الرجاء اختيار فصل واحد ومادة واحدة على الأقل');
      return;
    }

    const { data, error } = await supabase
      .from('teachers')
      .insert([{ 
        name: newTeacherName, 
        assignments: teacherAssignments,
        leader_of: teacherLeaderships
      }])
      .select();
    
    if (error) {
      alert('خطأ في إضافة المعلم');
    } else {
      setTeachers([...teachers, data[0]]);
      setNewTeacherName('');
      setTeacherAssignments({});
      setTeacherLeaderships([]);
      setShowTeacherModal(false);
      alert('تم إضافة المعلم بنجاح');
    }
  };

  const toggleSubjectInAssignment = (classId, subject) => {
    setTeacherAssignments(prev => {
      const currentSubjects = prev[classId] || [];
      const newSubjects = currentSubjects.includes(subject)
        ? currentSubjects.filter(s => s !== subject)
        : [...currentSubjects, subject];
      
      return { ...prev, [classId]: newSubjects };
    });
  };

  const deleteClass = async (id) => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) {
      setClasses(classes.filter(c => c.id !== id));
    }
  };

  const deleteTeacher = async (id) => {
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (!error) {
      setTeachers(teachers.filter(t => t.id !== id));
    }
  };

  const openScheduleEditor = (cls) => {
    setEditingScheduleClassId(cls.id);
    setTempSchedule(cls.schedule || {});
  };

  const saveSchedule = async () => {
    const { error } = await supabase
      .from('classes')
      .update({ schedule: tempSchedule })
      .eq('id', editingScheduleClassId);

    if (error) {
      alert('خطأ في حفظ الجدول');
    } else {
      setClasses(classes.map(c => 
        c.id === editingScheduleClassId ? { ...c, schedule: tempSchedule } : c
      ));
      setEditingScheduleClassId(null);
      alert('تم حفظ الجدول بنجاح');
    }
  };

  const updateTempSchedule = (dayId, period, subject) => {
    setTempSchedule(prev => ({
      ...prev,
      [`${dayId}_${period}`]: subject
    }));
  };

  const currentEditingClass = classes.find(c => c.id === editingScheduleClassId);

  // Export Logic
  const [exportConfig, setExportConfig] = useState({
    classId: '',
    weekNumber: '11',
    semester: 'الثاني',
    year: '1447 هـ',
    hijriDate: '11 / 8 / 1447 هـ'
  });

  const formatHijriDate = (dateStr) => {
    if (!dateStr) return '';
    // If it's already formatted with slashes and spaces, keep it
    if (dateStr.includes(' / ')) return dateStr;
    // If it's YYYY-MM-DD from the picker
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
    }
    return dateStr;
  };

  const getFullClassData = (classId = exportConfig.classId) => {
    if (!classId) return null;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return null;

    // Aggregate plans from all teachers linked to this class
    const aggregatedPlans = {};
    const relevantPlans = weeklyPlans.filter(p => p.class_id === cls.id);
    
    relevantPlans.forEach(plan => {
      const draftData = plan.week_data || {};
      Object.keys(draftData).forEach(day => {
        if (!aggregatedPlans[day]) aggregatedPlans[day] = {};
        Object.keys(draftData[day]).forEach(period => {
          if (!aggregatedPlans[day][period]) {
            aggregatedPlans[day][period] = draftData[day][period];
          }
        });
      });
    });

    // Find class leader
    const classLeader = teachers.find(t => t.leader_of && t.leader_of.includes(cls.id));

    return {
      ...cls,
      plans: aggregatedPlans,
      leaderName: classLeader ? classLeader.name : ''
    };
  };

  const printData = getFullClassData();
  const allPrintData = isBulkExport ? classes.map(c => getFullClassData(c.id)).filter(d => d !== null) : [];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم المدير</h1>
          <p className="text-sm text-gray-500 font-medium">إدارة الفصول والمعلمين والخطط</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()}
            className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
            title="تصدير"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Export Selection Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl space-y-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <FileText size={24} />
          </div>
          <h2 className="text-xl font-bold">تصدير الخطة الأسبوعية</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold opacity-80 mr-1">الفصل المستهدف</label>
            <select 
              value={exportConfig.classId}
              onChange={(e) => setExportConfig({...exportConfig, classId: e.target.value})}
              className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none"
            >
              <option value="" className="text-gray-900">-- اختر الفصل --</option>
              {classes.map(c => <option key={c.id} value={c.id} className="text-gray-900">{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold opacity-80 mr-1">رقم الأسبوع</label>
            <input 
              type="text" 
              value={exportConfig.weekNumber}
              onChange={(e) => setExportConfig({...exportConfig, weekNumber: e.target.value})}
              className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center"
            />
          </div>
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold opacity-80 mr-1">التاريخ الهجري</label>
            <div className="hijri-picker-container">
              <HijriDatePicker 
                value={exportConfig.hijriDate}
                onChange={(v) => setExportConfig({...exportConfig, hijriDate: v})}
                className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center"
                placeholder="اختر التاريخ"
              />
            </div>
            <style>{`
              .hijri-picker-container input {
                width: 100% !important;
                background: rgba(255, 255, 255, 0.1) !important;
                border: none !important;
                border-radius: 0.75rem !important;
                padding: 0.75rem !important;
                color: white !important;
                font-weight: bold !important;
                text-align: center !important;
              }
              .hijri-picker-container input::placeholder { color: rgba(255, 255, 255, 0.5); }
              /* Simple overrides for the calendar popup to look better */
              .rhdp-container { color: #333 !important; }
            `}</style>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold opacity-80 mr-1">الفصل الدراسي</label>
            <input 
              type="text" 
              value={exportConfig.semester}
              onChange={(e) => setExportConfig({...exportConfig, semester: e.target.value})}
              className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold opacity-80 mr-1">العام</label>
            <input 
              type="text" 
              value={exportConfig.year}
              onChange={(e) => setExportConfig({...exportConfig, year: e.target.value})}
              className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            disabled={!exportConfig.classId}
            onClick={() => {
              setIsBulkExport(false);
              setTimeout(() => window.print(), 100);
            }}
            className="bg-white text-blue-700 py-4 rounded-2xl font-black text-lg hover:bg-blue-50 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            توليد وطباعة الخطة الأسبوعية
          </button>
          <button 
            disabled={classes.length === 0}
            onClick={() => {
              setIsBulkExport(true);
              setTimeout(() => window.print(), 100);
            }}
            className="bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            تصدير جميع الفصول ({classes.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:hidden">
        {/* Manage Classes Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Users size={20} />
            </div>
            <h2 className="text-xl font-bold">إدارة الفصول</h2>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="اسم الفصل الجديد..."
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1 p-3 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:border-blue-300 focus:ring-0 transition-all outline-none font-bold"
            />
            <button 
              onClick={addClass}
              className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {classes.map(c => (
              <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 transition-all">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800">{c.name}</span>
                  <span className="text-[10px] text-gray-400">ID: {c.id.slice(-5)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openScheduleEditor(c)}
                    className="flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <Calendar size={14} /> إضافة جدول
                  </button>
                  <button onClick={() => deleteClass(c.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {classes.length === 0 && <p className="text-center text-gray-400 text-sm py-4 italic">لا يوجد فصول مضافة بعد</p>}
          </div>
        </div>

        {/* Manage Teachers Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <User size={20} />
            </div>
            <h2 className="text-xl font-bold">إدارة المعلمين</h2>
          </div>

          <button 
            disabled={classes.length === 0}
            onClick={() => {
              setNewTeacherName('');
              setTeacherAssignments({});
              setShowTeacherModal(true);
            }}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            <Plus size={20} /> إضافة معلم جديد
          </button>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {teachers.map(t => (
              <div key={t.id} className="p-3 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-gray-700">{t.name}</span>
                  <button onClick={() => deleteTeacher(t.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {Object.keys(t.assignments || {}).map(cid => {
                    const cls = classes.find(c => c.id === cid);
                    const assignedSubjects = t.assignments[cid] || [];
                    if (!cls || assignedSubjects.length === 0) return null;
                    return (
                      <div key={cid} className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold border border-indigo-100">{cls.name}:</span>
                        {assignedSubjects.map(s => (
                          <span key={s} className="text-[9px] text-gray-500 font-medium">#{s}</span>
                        ))}
                      </div>
                    );
                  })}
                  {/* Backward compatibility for old structure */}
                  {t.classIds && t.classIds.map(cid => {
                    const cls = classes.find(c => c.id === cid);
                    return cls ? (
                      <span key={cid} className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold">{cls.name}</span>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
            {teachers.length === 0 && <p className="text-center text-gray-400 text-sm py-4 italic">لا يوجد معلمين مضافين بعد</p>}
          </div>
        </div>
      </div>

      {/* Schedule Editor Overlay */}
      {editingScheduleClassId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">إعداد جدول المواد: {currentEditingClass?.name}</h3>
                <p className="text-sm text-slate-500 font-medium">حدد المادة لكل حصة في الأسبوع</p>
              </div>
              <button 
                onClick={() => setEditingScheduleClassId(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-4 border border-slate-200 text-slate-400 font-bold text-xs w-28 text-right">اليوم \ الحصة</th>
                    {PERIODS.map(period => (
                      <th key={period} className="p-4 border border-slate-200 text-slate-900 font-bold text-center">
                        {period}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day.id}>
                      <td className="p-4 border border-slate-200 text-right font-bold text-blue-600 bg-slate-50/50">
                        {day.name}
                      </td>
                      {PERIODS.map(period => (
                        <td key={period} className="p-2 border border-slate-200">
                          <select
                            value={tempSchedule[`${day.id}_${period}`] || ''}
                            onChange={(e) => updateTempSchedule(day.id, period, e.target.value)}
                            className="w-full p-2 bg-gray-50 border-none rounded-lg text-[10px] font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          >
                            <option value="">-- اختر --</option>
                            {SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setEditingScheduleClassId(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={saveSchedule}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                حفظ الجدول
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Print Template (Hidden unless printing) */}
      {(printData || isBulkExport) && (
        <div className="hidden print:block bg-white" dir="rtl">
          <style>{`
            @media print {
              @page { size: portrait; margin: 0.5cm; }
              body { background: white; }
            }
            .plan-table td, .plan-table th { border: 1.5px solid #2b4c7e; }
            .day-header { background-color: #f8fafc; writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); }
          `}</style>
          
          {(isBulkExport ? allPrintData : [printData]).map((data, pIdx) => (
            <div key={data.id} className={isBulkExport && pIdx < allPrintData.length - 1 ? 'break-after-page mb-8' : ''}>
              {/* Header */}
              <div className="flex justify-between items-center mb-4 border-2 border-[#2b4c7e] p-3 rounded-3xl">
                <div className="text-right leading-relaxed">
                  <p className="font-bold text-[11px]">ادارة التعليم بمحافظة حفر الباطن</p>
                  <p className="font-bold text-[11px]">مدرسة سمرة بن عمرو الابتدائية</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-[16px] text-[#2b4c7e] border-b-2 border-[#2b4c7e] mb-1 px-4">
                    الخطة التعليمية الأسبوعية - {exportConfig.semester} - {exportConfig.year}
                  </p>
                  <p className="text-[11px] font-bold">اسم الطالب: ................................................................</p>
                </div>
                <div className="text-left border-2 border-[#2b4c7e] p-1.5 rounded-2xl bg-slate-50 min-w-[125px] leading-tight">
                  <p className="font-bold text-[10px]">الأسبوع {exportConfig.weekNumber} [{data.name}]</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">تاريخ: {formatHijriDate(exportConfig.hijriDate)}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse plan-table text-[10.2px]">
                <thead>
                  <tr className="bg-[#2b4c7e] text-white">
                    <th className="p-1 w-5 text-[9px]">اليوم</th>
                    <th className="p-1.5 w-6 text-[10.5px]">م</th>
                    <th className="p-1.5 w-20 text-[10.5px]">المادة</th>
                    <th className="p-1.5 w-56 text-[10.5px]">الدرس</th>
                    <th className="p-1.5 text-[10.5px]">الأهداف</th>
                    <th className="p-1.5 w-28 text-[10.5px]">الواجب</th>
                    <th className="p-1.5 w-16 text-[10.5px]">الملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <React.Fragment key={day.id}>
                      {[1, 2, 3, 4, 5, 6].map((period, idx) => {
                        const subject = data.schedule[`${day.id}_${period}`];
                        const plan = data.plans[day.id]?.[period] || {};
                        const isLastRow = idx === 5;
                        return (
                          <tr key={`${day.id}_${period}`} className={isLastRow ? 'border-b-4 border-[#2b4c7e]' : ''}>
                            {idx === 0 && (
                              <td rowSpan={6} className="day-header p-0 text-center font-black text-[13px] bg-slate-50 border-l-2 w-5">
                                {day.name}
                              </td>
                            )}
                            <td className="py-1 px-1.5 text-center font-bold border-r-0">{period}</td>
                            <td className="py-1 px-1.5 text-center font-black text-blue-800">{subject || '-'}</td>
                            <td className="py-1 px-1.5 text-right font-bold">{plan.title || ''}</td>
                            <td className="py-1 px-1.5 text-right text-[9.2px] leading-relaxed">{plan.objective || ''}</td>
                            <td className="py-1 px-1.5 text-center">{plan.homework || ''}</td>
                            <td className="py-1 px-1.5 text-center"></td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div className="mt-2 border border-[#2b4c7e] p-2 rounded-xl">
                <p className="font-bold text-[10px]">ملاحظات: ....................................................................................................................................................................................................................................................</p>
              </div>

              <div className="mt-2 text-center text-[10px] font-bold text-slate-700 space-y-2">
                <p>جوال المدرسة: 0545779288</p>
                <div className="flex justify-between pt-2 px-4">
                  <p>رائد الفصل: {data.leaderName || '.........................'}</p>
                  <p>مدير المدرسة: فرحان ضحوي العنزي</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Teacher Modal Overlay */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-indigo-900">إضافة معلم جديد</h3>
                <p className="text-sm text-indigo-500 font-medium">أدخل الاسم وحدد المواد لكل فصل</p>
              </div>
              <button 
                onClick={() => setShowTeacherModal(false)}
                className="p-2 hover:bg-indigo-200 rounded-full transition-all text-indigo-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-8 space-y-8">
              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600">اسم المعلم</label>
                <input 
                  type="text" 
                  placeholder="مثال: أ. محمد علي..."
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-indigo-400 focus:bg-white transition-all outline-none font-bold text-lg"
                />
              </div>

              {/* Class Grid */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-600">إسناد المواد حسب الفصول:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map(cls => (
                    <div 
                      key={cls.id} 
                      className={`p-4 rounded-3xl border-2 transition-all ${
                        (teacherAssignments[cls.id]?.length > 0)
                        ? 'border-indigo-500 bg-indigo-50/30' 
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-xl ${teacherAssignments[cls.id]?.length > 0 ? 'bg-indigo-500 text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
                          <Layout size={18} />
                        </div>
                        <span className="font-bold text-gray-800">{cls.name}</span>
                        <div className="mr-auto flex items-center gap-2">
                          <label className="text-[10px] font-bold text-indigo-500 cursor-pointer flex items-center gap-1">
                            <input 
                              type="checkbox"
                              checked={teacherLeaderships.includes(cls.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTeacherLeaderships([...teacherLeaderships, cls.id]);
                                } else {
                                  setTeacherLeaderships(teacherLeaderships.filter(id => id !== cls.id));
                                }
                              }}
                              className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            ريادة الفصل
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {SUBJECTS.map(sub => {
                          const isSelected = teacherAssignments[cls.id]?.includes(sub);
                          return (
                            <button
                              key={sub}
                              onClick={() => toggleSubjectInAssignment(cls.id, sub)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'
                              }`}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowTeacherModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={addTeacher}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                إضافة المعلم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-3xl text-white shadow-xl">
          <p className="opacity-80 text-sm">إجمالي المعلمين</p>
          <h3 className="text-3xl font-bold">{teachers.length}</h3>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-3xl text-white shadow-xl">
          <p className="opacity-80 text-sm">إجمالي الفصول</p>
          <h3 className="text-3xl font-bold">{classes.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center">
          <div className="text-center">
             <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
             <p className="text-gray-500 text-xs font-bold">تم التحديث تلقائياً</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminView;

