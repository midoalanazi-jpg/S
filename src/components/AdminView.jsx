import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Save, Download, 
  User, Users, ChevronRight, FileText, CheckCircle2,
  Calendar, X, Layout, KeyRound, Lock, Eye, EyeOff, ShieldCheck, Search, Edit2, RotateCcw,
  Star, Bookmark, Smartphone, Monitor, Check
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
  const [managementModalTab, setManagementModalTab] = useState(null); // 'classes' | 'teachers' | null

  // Passwords Management & PIN State
  const [showPinModal, setShowPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPasswordsModal, setShowPasswordsModal] = useState(false);
  const [teacherPasswords, setTeacherPasswords] = useState({});
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingPasswordVal, setEditingPasswordVal] = useState('');
  const [passwordSearchQuery, setPasswordSearchQuery] = useState('');

  // Bookmark Prompt State
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);
  const [bookmarkGuideStep, setBookmarkGuideStep] = useState('ask'); // 'ask' | 'guide'

  // Load data from Supabase
  useEffect(() => {
    fetchInitialData();

    // Check if user previously chose "لا تسألني مرة أخرى"
    const dontAsk = localStorage.getItem('admin_bookmark_dont_ask');
    if (dontAsk !== 'true') {
      const timer = setTimeout(() => {
        setShowBookmarkPrompt(true);
        setBookmarkGuideStep('ask');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: clsData } = await supabase.from('classes').select('*').order('created_at');
      const { data: tchData } = await supabase.from('teachers').select('*').order('created_at');
      const { data: plansData } = await supabase.from('weekly_plans').select('*');
      const { data: pwdSetting } = await supabase.from('settings').select('*').eq('key', 'teacher_passwords').maybeSingle();
      
      let passwordsObj = {};
      if (pwdSetting && pwdSetting.value) {
        try {
          passwordsObj = typeof pwdSetting.value === 'string' ? JSON.parse(pwdSetting.value) : pwdSetting.value;
        } catch (e) {
          console.error('Error parsing teacher passwords:', e);
        }
      }

      setClasses(clsData || []);
      setTeachers(tchData || []);
      setWeeklyPlans(plansData || []);
      setTeacherPasswords(passwordsObj || {});
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAdminPin = (e) => {
    if (e) e.preventDefault();
    if (adminPin.trim() === '1000') {
      setShowPinModal(false);
      setPinError('');
      setAdminPin('');
      setShowPasswordsModal(true);
    } else {
      setPinError('رمز الدخول غير صحيح!');
    }
  };

  const handleSaveTeacherPassword = async (teacherId, newPwd) => {
    if (!newPwd.trim()) {
      alert('يرجى إدخال كلمة مرور صالحة (حرف أو رقم على الأقل)');
      return;
    }
    try {
      const updated = { ...teacherPasswords, [teacherId]: newPwd.trim() };
      await supabase.from('settings').upsert({
        key: 'teacher_passwords',
        value: JSON.stringify(updated)
      });

      // Also update assignments._password as backup
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) {
        const updatedAssignments = { ...(teacher.assignments || {}), _password: newPwd.trim() };
        await supabase.from('teachers').update({ assignments: updatedAssignments }).eq('id', teacherId);
      }

      setTeacherPasswords(updated);
      setEditingTeacherId(null);
      setEditingPasswordVal('');
      alert('تم تحديث كلمة المرور بنجاح');
    } catch (err) {
      console.error('Error saving teacher password:', err);
      alert('حدث خطأ في حفظ كلمة المرور');
    }
  };

  const handleResetTeacherPassword = async (teacherId) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في مسح كلمة المرور لهذا المعلم؟ سيطلب منه النظام تعيين كلمة مرور جديدة عند دخوله القادم.')) return;
    try {
      const updated = { ...teacherPasswords };
      delete updated[teacherId];
      await supabase.from('settings').upsert({
        key: 'teacher_passwords',
        value: JSON.stringify(updated)
      });

      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher && teacher.assignments) {
        const updatedAssignments = { ...teacher.assignments };
        delete updatedAssignments._password;
        await supabase.from('teachers').update({ assignments: updatedAssignments }).eq('id', teacherId);
      }

      setTeacherPasswords(updated);
      alert('تم مسح كلمة المرور بنجاح.');
    } catch (err) {
      console.error('Error resetting password:', err);
      alert('حدث خطأ في مسح كلمة المرور');
    }
  };

  const addClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert([{ name: newClassName, schedule: {} }])
        .select();
      
      if (error) {
        console.error('Add class error:', error);
        alert(`خطأ في إضافة الفصل: ${error.message || JSON.stringify(error)}`);
      } else {
        setClasses([...classes, data[0]]);
        setNewClassName('');
        alert('تم إضافة الفصل بنجاح');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert(`خطأ غير متوقع: ${err.message || err}`);
    }
  };

  const addTeacher = async () => {
    if (!newTeacherName.trim()) return;
    const assignedClassIds = Object.keys(teacherAssignments).filter(id => teacherAssignments[id].length > 0);
    
    if (assignedClassIds.length === 0) {
      alert('الرجاء اختيار فصل واحد ومادة واحدة على الأقل');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert([{ 
          name: newTeacherName, 
          assignments: teacherAssignments,
          leader_of: teacherLeaderships
        }])
        .select();
      
      if (error) {
        console.error('Add teacher error:', error);
        alert(`خطأ في إضافة المعلم: ${error.message || JSON.stringify(error)}`);
      } else {
        setTeachers([...teachers, data[0]]);
        setNewTeacherName('');
        setTeacherAssignments({});
        setTeacherLeaderships([]);
        setShowTeacherModal(false);
        alert('تم إضافة المعلم بنجاح');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert(`خطأ غير متوقع: ${err.message || err}`);
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
    } else {
      alert(`خطأ في حذف الفصل: ${error.message || JSON.stringify(error)}`);
    }
  };

  const deleteTeacher = async (id) => {
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (!error) {
      setTeachers(teachers.filter(t => t.id !== id));
    } else {
      alert(`خطأ في حذف المعلم: ${error.message || JSON.stringify(error)}`);
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
      alert(`خطأ في حفظ الجدول: ${error.message || JSON.stringify(error)}`);
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

  const getTodayHijriFormatted = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      }).formatToParts(new Date());

      const day = parts.find(p => p.type === 'day')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const year = parts.find(p => p.type === 'year')?.value;
      
      const pad = (n) => String(n).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
    } catch (e) {
      return '1447-08-11';
    }
  };

  // Export Logic with localStorage persistence
  const [exportConfig, setExportConfig] = useState(() => {
    const todayHijri = getTodayHijriFormatted();
    try {
      const saved = localStorage.getItem('admin_export_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          classId: parsed.classId || '',
          weekNumber: parsed.weekNumber !== undefined ? parsed.weekNumber : '11',
          semester: parsed.semester || 'الثاني',
          year: parsed.year || '1447 هـ',
          hijriDate: parsed.hijriDate || todayHijri
        };
      }
    } catch (e) {
      console.error('Error loading export config:', e);
    }
    return {
      classId: '',
      weekNumber: '11',
      semester: 'الثاني',
      year: '1447 هـ',
      hijriDate: todayHijri
    };
  });

  // Auto-save exportConfig changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('admin_export_config', JSON.stringify(exportConfig));
    } catch (e) {
      console.error('Error saving export config:', e);
    }
  }, [exportConfig]);

  const formatHijriDate = (dateStr) => {
    if (!dateStr) return '';
    // If it's YYYY-MM-DD from the picker
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[2], 10)} / ${parseInt(parts[1], 10)} / ${parts[0]} هـ`;
    }
    // If it's already formatted with slashes
    if (dateStr.includes('/')) return dateStr.includes('هـ') ? dateStr : `${dateStr} هـ`;
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
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setAdminPin('');
              setPinError('');
              setShowPinModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-2xl font-bold text-xs border border-amber-200 shadow-sm transition-all active:scale-95"
            title="كلمات سر المعلمين"
          >
            <KeyRound size={16} className="text-amber-600" />
            <span>كلمات سر المعلمين</span>
          </button>

          <button 
            onClick={() => window.print()}
            className="p-3 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all shadow-sm"
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
                onChange={(v) => setExportConfig(prev => ({...prev, hijriDate: v}))}
                locale="ar"
                showTodayButton={true}
                className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center cursor-pointer"
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
                cursor: pointer !important;
              }
              .hijri-picker-container input::placeholder { color: rgba(255, 255, 255, 0.5); }
              /* Calendar popup styling */
              .rhdp-container { 
                color: #1e293b !important; 
                font-family: inherit !important; 
                direction: rtl !important; 
                z-index: 100 !important;
                border-radius: 1.25rem !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2) !important;
              }
            `}</style>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold opacity-80 mr-1">الفصل الدراسي</label>
            <input 
              type="text" 
              list="semesters-list"
              value={exportConfig.semester}
              onChange={(e) => setExportConfig(prev => ({...prev, semester: e.target.value}))}
              className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center"
              placeholder="مثال: الثاني"
            />
            <datalist id="semesters-list">
              <option value="الأول" />
              <option value="الثاني" />
              <option value="الثالث" />
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold opacity-80 mr-1">العام الدراسي</label>
            <input 
              type="text" 
              value={exportConfig.year}
              onChange={(e) => setExportConfig(prev => ({...prev, year: e.target.value}))}
              className="w-full p-3 bg-white/10 border-none rounded-xl font-bold focus:ring-2 focus:ring-white outline-none text-center"
              placeholder="1447 هـ"
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


      {/* Management Modal (Classes & Teachers) */}
      {managementModalTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-200/70 p-1 rounded-2xl">
                  <button
                    onClick={() => setManagementModalTab('classes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      managementModalTab === 'classes'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Users size={16} /> إدارة الفصول ({classes.length})
                  </button>
                  <button
                    onClick={() => setManagementModalTab('teachers')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      managementModalTab === 'teachers'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <User size={16} /> إدارة المعلمين ({teachers.length})
                  </button>
                </div>
              </div>

              <button
                onClick={() => setManagementModalTab(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-slate-700"
                title="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 md:p-8">
              {managementModalTab === 'classes' ? (
                /* Manage Classes Content */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">قائمة الفصول الدراسية</h3>
                      <p className="text-xs text-gray-500">يمكنك إضافة فصول جديدة أو ضبط الجدول الأسبوعي لكل فصل</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="اسم الفصل الجديد (مثال: أول ابتدائي / أ)..."
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addClass()}
                      className="flex-1 p-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:bg-white focus:border-blue-400 focus:ring-0 transition-all outline-none font-bold"
                    />
                    <button 
                      onClick={addClass}
                      className="bg-blue-600 text-white px-6 rounded-2xl hover:bg-blue-700 font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-100 active:scale-95"
                    >
                      <Plus size={20} /> إضافة
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {classes.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-md border border-gray-100 hover:border-blue-100 transition-all">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-base">{c.name}</span>
                          <span className="text-[10px] text-gray-400">المعرف: {c.id.slice(-5)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openScheduleEditor(c)}
                            className="flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-600 px-3.5 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          >
                            <Calendar size={14} /> إعداد الجدول
                          </button>
                          <button 
                            onClick={() => deleteClass(c.id)} 
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                            title="حذف الفصل"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {classes.length === 0 && (
                      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Users size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500 font-bold text-sm">لا يوجد فصول دراسية مضافة بعد</p>
                        <p className="text-gray-400 text-xs mt-1">أدخل اسم الفصل في الحقل أعلاه واضغط إضافة</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Manage Teachers Content */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">قائمة المعلمين</h3>
                      <p className="text-xs text-gray-500">إدارة حسابات المعلمين، إسناد المواد، وتحديد رواد الفصول</p>
                    </div>
                    <button 
                      disabled={classes.length === 0}
                      onClick={() => {
                        setNewTeacherName('');
                        setTeacherAssignments({});
                        setShowTeacherModal(true);
                      }}
                      className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
                    >
                      <Plus size={18} /> إضافة معلم جديد
                    </button>
                  </div>

                  {classes.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      ⚠️ يرجى إضافة فصول دراسية أولاً قبل التمكن من إضافة معلمين وإسناد المواد إليهم.
                    </p>
                  )}

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {teachers.map(t => (
                      <div key={t.id} className="p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-md border border-gray-100 hover:border-indigo-100 transition-all">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-base">{t.name}</span>
                            {t.leader_of && t.leader_of.length > 0 && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-lg border border-amber-200">
                                رائد فصل ({classes.find(c => c.id === t.leader_of[0])?.name || 'فصل'})
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => deleteTeacher(t.id)} 
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                            title="حذف المعلم"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
                          {Object.keys(t.assignments || {}).map(cid => {
                            const cls = classes.find(c => c.id === cid);
                            const assignedSubjects = t.assignments[cid] || [];
                            if (!cls || assignedSubjects.length === 0) return null;
                            return (
                              <div key={cid} className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg font-bold border border-indigo-100">{cls.name}:</span>
                                {assignedSubjects.map(s => (
                                  <span key={s} className="text-[10px] bg-white text-gray-600 px-2 py-0.5 rounded-md border border-gray-200 font-medium">#{s}</span>
                                ))}
                              </div>
                            );
                          })}
                          {t.classIds && t.classIds.map(cid => {
                            const cls = classes.find(c => c.id === cid);
                            return cls ? (
                              <span key={cid} className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold">{cls.name}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                    {teachers.length === 0 && (
                      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <User size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500 font-bold text-sm">لا يوجد معلمين مضافين بعد</p>
                        <p className="text-gray-400 text-xs mt-1">اضغط على زر "إضافة معلم جديد" لإضافة معلم</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setManagementModalTab(null)}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-all text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal (1000) */}
      {showPinModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-7 space-y-6 animate-in zoom-in-95 border border-slate-100">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Lock size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">الرمز السري</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                أدخل الرمز السري لعرض كلمات سر المعلمين
              </p>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="space-y-4">
              <div>
                <input 
                  type="password"
                  autoFocus
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder="أدخل الرمز السري..."
                  className="w-full p-4 bg-slate-50 text-center text-xl tracking-widest font-black rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                {pinError && (
                  <p className="text-xs font-bold text-red-500 text-center mt-2.5 bg-red-50 p-2.5 rounded-xl border border-red-100">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setAdminPin('');
                    setPinError('');
                  }}
                  className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <KeyRound size={16} /> فتح اللوحة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Passwords Management Modal */}
      {showPasswordsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 bg-amber-50/80 border-b border-amber-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-sm">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-amber-950">كلمات سر المعلمين</h3>
                  <p className="text-xs text-amber-700 font-medium">عرض، تعديل، وإعادة تعيين كلمات مرور المعلمين</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  setShowPasswordsModal(false);
                  setEditingTeacherId(null);
                }}
                className="p-2 hover:bg-amber-200/60 rounded-full transition-all text-amber-700 hover:text-amber-950"
                title="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search & Stats */}
            <div className="p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative w-full sm:w-80">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={passwordSearchQuery}
                  onChange={(e) => setPasswordSearchQuery(e.target.value)}
                  placeholder="بحث باسم المعلم..."
                  className="w-full pr-11 pl-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 focus:bg-white focus:border-amber-400 outline-none text-xs font-bold"
                />
              </div>
              <div className="text-xs font-bold text-slate-500">
                إجمالي المعلمين: <span className="text-amber-600 font-black text-sm">{teachers.length}</span>
              </div>
            </div>

            {/* Teachers List */}
            <div className="flex-1 overflow-auto p-6 md:p-8 space-y-3">
              {teachers
                .filter(t => t.name.toLowerCase().includes(passwordSearchQuery.toLowerCase()))
                .map(teacher => {
                  const pwd = teacherPasswords[teacher.id] || teacher.assignments?._password || '';
                  const isRevealed = revealedPasswords[teacher.id];
                  const isEditing = editingTeacherId === teacher.id;

                  return (
                    <div 
                      key={teacher.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm font-bold text-sm shrink-0">
                          <User size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{teacher.name}</h4>
                          <p className="text-[10px] text-slate-400">المعرف: {teacher.id.slice(-6)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {isEditing ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input 
                              type="text"
                              autoFocus
                              value={editingPasswordVal}
                              onChange={(e) => setEditingPasswordVal(e.target.value)}
                              placeholder="كلمة السر الجديدة..."
                              className="px-3.5 py-2 bg-white border-2 border-amber-400 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 w-40 font-mono"
                            />
                            <button
                              onClick={() => handleSaveTeacherPassword(teacher.id, editingPasswordVal)}
                              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 shadow-sm transition-all active:scale-95"
                            >
                              حفظ
                            </button>
                            <button
                              onClick={() => {
                                setEditingTeacherId(null);
                                setEditingPasswordVal('');
                              }}
                              className="px-2.5 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm">
                              <KeyRound size={15} className="text-amber-500" />
                              {pwd ? (
                                <span className="font-mono font-bold text-xs text-slate-800 tracking-wider">
                                  {isRevealed ? pwd : '••••••••'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-600 font-bold italic">
                                  لم تُضبط بعد
                                </span>
                              )}
                              {pwd && (
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswords(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                                  className="text-slate-400 hover:text-slate-700 p-0.5"
                                  title={isRevealed ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
                                >
                                  {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingTeacherId(teacher.id);
                                setEditingPasswordVal(pwd);
                              }}
                              className="p-2.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded-xl transition-all border border-transparent hover:border-amber-200"
                              title="تعديل أو تعيين كلمة المرور"
                            >
                              <Edit2 size={16} />
                            </button>

                            {pwd && (
                              <button
                                type="button"
                                onClick={() => handleResetTeacherPassword(teacher.id)}
                                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-200"
                                title="مسح كلمة المرور (إعادة تعيين)"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {teachers.length === 0 && (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">
                  لا يوجد معلمين مسجلين حالياً
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setShowPasswordsModal(false);
                  setEditingTeacherId(null);
                }}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Prompt Modal */}
      {showBookmarkPrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-7 space-y-6 animate-in zoom-in-95 border border-slate-100">
            {bookmarkGuideStep === 'ask' ? (
              /* Step 1: Ask user */
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-amber-100 animate-bounce">
                  <Star size={32} className="fill-amber-400 text-amber-500" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">إضافة لوحة الإدارة للمفضلة ⭐</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    هل ترغب في حفظ لوحة تحكم الإدارة في المفضلة بمتصفحك لسهولة وسرعة الوصول إليها دائماً؟
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={() => setBookmarkGuideStep('guide')}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                  >
                    <Bookmark size={18} /> نعم، إضافة للمفضلة
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowBookmarkPrompt(false)}
                      className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-all"
                    >
                      تذكيري لاحقاً
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem('admin_bookmark_dont_ask', 'true');
                        setShowBookmarkPrompt(false);
                      }}
                      className="w-1/2 py-3 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl font-bold text-xs transition-all border border-slate-100 hover:border-red-100"
                    >
                      لا تسألني مرة أخرى
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Visual Guide for Bookmarking */
              <div className="space-y-6 text-center">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Bookmark size={28} />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-slate-900">طريقة الحفظ بالمفضلة</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    اتبع الخطوات البسيطة حسب جهازك الحالي:
                  </p>
                </div>

                <div className="space-y-3 text-right">
                  {/* Computer Instructions */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Monitor size={16} className="text-indigo-600" />
                      <span>على الكمبيوتر / اللابتوب:</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      اضغط على المفاتيح: <kbd className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-indigo-600 font-bold font-mono shadow-sm">Ctrl + D</kbd> (أو <kbd className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-indigo-600 font-bold font-mono shadow-sm">⌘ Cmd + D</kbd> للماك) ثم اضغط <b>تم (Done)</b>.
                    </p>
                  </div>

                  {/* Mobile Instructions */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Smartphone size={16} className="text-amber-600" />
                      <span>على الجوال (Safari / Chrome):</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      اضغط على زر المشاركة (📤 أو ⋮) في متصفحك ثم اختر <b>«إضافة إشارة مرجعية»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    localStorage.setItem('admin_bookmark_dont_ask', 'true');
                    setShowBookmarkPrompt(false);
                  }}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <Check size={18} /> تم الحفظ في المفضلة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                      {(day.id === 'sun' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6]).map((period, idx, arr) => {
                        const subject = data.schedule[`${day.id}_${period}`];
                        const plan = data.plans[day.id]?.[period] || {};
                        const isLastRow = idx === arr.length - 1;
                        return (
                          <tr key={`${day.id}_${period}`} className={isLastRow ? 'border-b-4 border-[#2b4c7e]' : ''}>
                            {idx === 0 && (
                              <td rowSpan={arr.length} className="day-header p-0 text-center font-black text-[13px] bg-slate-50 border-l-2 w-5">
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
        <div 
          onClick={() => setManagementModalTab('teachers')}
          className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-3xl text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
          title="اضغط لفتح إدارة المعلمين"
        >
          <div className="flex justify-between items-center">
            <p className="opacity-80 text-sm font-medium">إجمالي المعلمين</p>
            <User size={20} className="opacity-80" />
          </div>
          <h3 className="text-3xl font-bold mt-2">{teachers.length}</h3>
          <p className="text-xs opacity-75 mt-2 flex items-center gap-1">اضغط للإدارة والتحكم ←</p>
        </div>
        <div 
          onClick={() => setManagementModalTab('classes')}
          className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-3xl text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
          title="اضغط لفتح إدارة الفصول"
        >
          <div className="flex justify-between items-center">
            <p className="opacity-80 text-sm font-medium">إجمالي الفصول</p>
            <Users size={20} className="opacity-80" />
          </div>
          <h3 className="text-3xl font-bold mt-2">{classes.length}</h3>
          <p className="text-xs opacity-75 mt-2 flex items-center gap-1">اضغط للإدارة والتحكم ←</p>
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

