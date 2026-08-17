import React, { useState, useEffect } from 'react';
import { 
  Send, User, Users, Calendar, 
  BookOpen, Target, Home, StickyNote,
  AlertCircle, X, Save, Plus, CheckCircle2, ChevronRight,
  Lock, KeyRound, Eye, EyeOff, ShieldCheck
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const DAYS = [
  { id: 'sun', name: 'الأحد' },
  { id: 'mon', name: 'الاثنين' },
  { id: 'tue', name: 'الثلاثاء' },
  { id: 'wed', name: 'الأربعاء' },
  { id: 'thu', name: 'الخميس' },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function TeacherView() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [teacherPasswords, setTeacherPasswords] = useState({});
  const [enteredPassword, setEnteredPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [planData, setPlanData] = useState({});
  const [activeCell, setActiveCell] = useState(null); // { day, period, slotInfo }
  const [selectedCells, setSelectedCells] = useState([]); // Array of { day, period, slotInfo }
  const [saveStatus, setSaveStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load metadata from Supabase
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: clsData } = await supabase.from('classes').select('*');
      const { data: tchData } = await supabase.from('teachers').select('*');
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
      setTeacherPasswords(passwordsObj || {});
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get teacher's schedule slot
  const getTeacherSlotInfo = (dayId, period) => {
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return null;

    // Check all assigned classes
    const assignments = teacher.assignments || {};
    for (const classId of Object.keys(assignments)) {
      const cls = classes.find(c => c.id === classId);
      if (!cls) continue;

      const subjectAtSlot = cls.schedule?.[`${dayId}_${period}`];
      const teacherSubjectsForThisClass = assignments[classId] || [];

      if (subjectAtSlot && teacherSubjectsForThisClass.includes(subjectAtSlot)) {
        return {
          classId,
          className: cls.name,
          subject: subjectAtSlot
        };
      }
    }
    return null;
  };

  // Toggle selection
  const toggleCellSelection = (day, period, slotInfo) => {
    const isSelected = selectedCells.some(c => c.day === day && c.period === period);
    if (isSelected) {
      setSelectedCells(selectedCells.filter(c => !(c.day === day && c.period === period)));
    } else {
      setSelectedCells([...selectedCells, { day, period, slotInfo }]);
    }
  };

  // Load plans for this teacher from Supabase
  useEffect(() => {
    if (selectedTeacherId && isAuthenticated) {
      fetchTeacherPlans();
    }
  }, [selectedTeacherId, isAuthenticated]);

  const fetchTeacherPlans = async () => {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('teacher_id', selectedTeacherId);
    
    if (!error && data) {
      const formattedPlans = {};
      data.forEach(plan => {
        formattedPlans[plan.class_id] = plan.week_data;
      });
      setPlanData(formattedPlans);
    }
  };

  const saveCellData = async (cells, data) => {
    const updatedDrafts = { ...planData };
    
    // Group cells by classId for efficient saving
    const classGroups = {};
    cells.forEach(cell => {
      const { classId } = cell.slotInfo;
      if (!classGroups[classId]) classGroups[classId] = [];
      classGroups[classId].push(cell);
    });

    try {
      for (const classId of Object.keys(classGroups)) {
        if (!updatedDrafts[classId]) updatedDrafts[classId] = {};
        
        classGroups[classId].forEach(cell => {
          const { day, period } = cell;
          if (!updatedDrafts[classId][day]) updatedDrafts[classId][day] = {};
          updatedDrafts[classId][day][period] = data;
        });

        // Upsert to Supabase
        await supabase.from('weekly_plans').upsert({
          teacher_id: selectedTeacherId,
          class_id: classId,
          week_data: updatedDrafts[classId]
        }, { onConflict: 'teacher_id, class_id' });
      }

      setPlanData(updatedDrafts);
      setSaveStatus('تم الحفظ في السحابة');
      setTimeout(() => setSaveStatus(''), 2000);
      setActiveCell(null);
      setSelectedCells([]);
    } catch (err) {
      alert('خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const [formData, setFormData] = useState({ title: '', objective: '', homework: '' });
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [warnedFields, setWarnedFields] = useState({ title: false, objective: false, homework: false });

  const LIMITS = {
    title: 42,
    objective: 52,
    homework: 16
  };

  // Update formData when activeCell changes
  useEffect(() => {
    if (activeCell) {
      if (selectedCells.length === 1 && activeCell.slotInfo) {
        const existing = planData[activeCell.slotInfo.classId]?.[activeCell.day]?.[activeCell.period] || {};
        setFormData({
          title: existing.title || '',
          objective: existing.objective || '',
          homework: existing.homework || ''
        });
      } else {
        setFormData({ title: '', objective: '', homework: '' });
      }
      setWarnedFields({ title: false, objective: false, homework: false });
      setShowLimitWarning(false);
    }
  }, [activeCell, selectedCells, planData]);

  const handleFieldChange = (field, value) => {
    const limit = LIMITS[field];
    if (value.length > limit && !warnedFields[field]) {
      setShowLimitWarning(true);
      setWarnedFields(prev => ({ ...prev, [field]: true }));
    } else if (value.length <= limit && warnedFields[field]) {
      setWarnedFields(prev => ({ ...prev, [field]: false }));
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSetNewPassword = async (e) => {
    if (e) e.preventDefault();
    if (!newPassword.trim()) {
      setLoginError('يرجى كتابة كلمة المرور (حرف أو رقم على الأقل)');
      return;
    }
    setIsLoading(true);
    setLoginError('');
    try {
      const updatedPasswords = { ...teacherPasswords, [selectedTeacherId]: newPassword.trim() };
      await supabase.from('settings').upsert({
        key: 'teacher_passwords',
        value: JSON.stringify(updatedPasswords)
      });

      // Update local state
      setTeacherPasswords(updatedPasswords);
      setIsAuthenticated(true);
      setNewPassword('');
    } catch (err) {
      console.error('Error setting password:', err);
      setLoginError('حدث خطأ أثناء حفظ كلمة المرور، يرجى المحاولة لاحقاً');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = (e) => {
    if (e) e.preventDefault();
    const currentPass = teacherPasswords[selectedTeacherId] || teachers.find(t => t.id === selectedTeacherId)?.assignments?._password;
    if (enteredPassword.trim() === String(currentPass).trim()) {
      setIsAuthenticated(true);
      setLoginError('');
      setEnteredPassword('');
    } else {
      setLoginError('كلمة المرور غير صحيحة، يرجى المحاولة مجدداً');
    }
  };

  const handleLogoutTeacher = () => {
    setSelectedTeacherId('');
    setIsAuthenticated(false);
    setEnteredPassword('');
    setNewPassword('');
    setLoginError('');
  };

  // Check if current selected teacher has a password
  const currentSelectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const teacherStoredPassword = selectedTeacherId ? (teacherPasswords[selectedTeacherId] || currentSelectedTeacher?.assignments?._password) : null;
  const isFirstTimeTeacher = selectedTeacherId && !teacherStoredPassword;

  if (!selectedTeacherId || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl w-full border border-slate-100 space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Lock size={28} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">بوابة المعلم</h1>
              <p className="text-xs text-slate-400 font-medium">تسجيل الدخول والتحضير الأسبوعي</p>
            </div>

            {!selectedTeacherId ? (
              /* Step 1: Select Teacher Name */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">اختر اسمك من القائمة</label>
                  <select 
                    value={selectedTeacherId}
                    onChange={(e) => {
                      setSelectedTeacherId(e.target.value);
                      setLoginError('');
                      setEnteredPassword('');
                      setNewPassword('');
                    }}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 outline-none transition-all"
                  >
                    <option value="">-- اختر المعلم --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            ) : isFirstTimeTeacher ? (
              /* Step 2: First Time -> Set Password */
              <form onSubmit={handleSetNewPassword} className="space-y-4 animate-in fade-in">
                <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-900">مرحباً بك أ. {currentSelectedTeacher?.name}</p>
                  <p className="text-[11px] text-indigo-600 mt-1 leading-relaxed">
                    هذه المرة الأولى لدخولك. يرجى ضبط كلمة سر خاصة بحسابك (يمكن أن تكون حرفاً أو رقماً أو كلمة):
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 mr-1">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="أدخل كلمة السر الجديدة..."
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 outline-none transition-all pl-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <KeyRound size={18} /> تعيين كلمة المرور والمتابعة
                </button>

                <button
                  type="button"
                  onClick={handleLogoutTeacher}
                  className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all text-center"
                >
                  ← اختيار معلم آخر
                </button>
              </form>
            ) : (
              /* Step 3: Existing Password -> Enter Password */
              <form onSubmit={handleVerifyPassword} className="space-y-4 animate-in fade-in">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">المعلم المختار</span>
                    <span className="font-bold text-slate-800 text-sm">أ. {currentSelectedTeacher?.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogoutTeacher}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    تغيير
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 mr-1">كلمة المرور</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      value={enteredPassword}
                      onChange={(e) => {
                        setEnteredPassword(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="أدخل كلمة المرور..."
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 outline-none transition-all pl-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Lock size={18} /> دخول إلى الجدول
                </button>

                <button
                  type="button"
                  onClick={handleLogoutTeacher}
                  className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all text-center"
                >
                  ← اختيار معلم آخر
                </button>
              </form>
            )}
          </div>
          <div className="text-center mt-6 text-slate-500 opacity-80">
            <p className="text-sm font-light mb-1">تقبلو تحياتي</p>
            <p className="text-sm font-bold tracking-wide text-indigo-600">برنامج نصابي</p>
          </div>
        </div>
      </div>
    );
  }

  const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

  // Modal / Popup
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
            <Calendar size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{currentTeacher?.name}</h1>
            <p className="text-sm text-slate-500">الجدول الدراسي الأسبوعي الموحد</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">{saveStatus}</span>
          <button 
            onClick={handleLogoutTeacher}
            className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-all flex items-center gap-1"
          >
            ← تغيير المعلم
          </button>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="max-w-7xl mx-auto bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-6 border-b border-slate-100 text-slate-400 font-bold text-xs w-32 text-right">اليوم \ الحصة</th>
                {PERIODS.map(period => (
                  <th key={period} className="p-6 border-b border-slate-100 text-slate-900 font-bold text-center">
                    الحصة {period}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="p-4 border-b border-l border-slate-50 text-right font-bold text-indigo-600 bg-slate-50/20">
                    {day.name}
                  </td>
                  {PERIODS.map(period => {
                    const slotInfo = getTeacherSlotInfo(day.id, period);
                    const cellData = slotInfo ? planData[slotInfo.classId]?.[day.id]?.[period] : null;
                    const isSelected = selectedCells.some(c => c.day === day.id && c.period === period);
                    
                    return (
                      <td 
                        key={period} 
                        onClick={() => slotInfo && toggleCellSelection(day.id, period, slotInfo)}
                        className={`p-2 border-b border-slate-50 transition-all relative h-28 ${
                          slotInfo 
                          ? `cursor-pointer ${isSelected ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500 z-10' : 'hover:bg-indigo-50/50'}` 
                          : 'bg-gray-50/30 opacity-20 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex flex-col h-full">
                          {isSelected && (
                            <div className="absolute top-1 left-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                              <CheckCircle2 size={10} />
                            </div>
                          )}
                          {slotInfo && (
                            <div className="text-[9px] font-black text-indigo-500 mb-1 px-1 flex flex-col items-end leading-tight">
                              <span>{slotInfo.subject}</span>
                              <span className="text-[8px] opacity-60">{slotInfo.className}</span>
                            </div>
                          )}
                          
                          {cellData?.title ? (
                            <div className="flex-1 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100 text-right space-y-0.5">
                              <p className="font-bold text-indigo-900 text-[10px] line-clamp-1">{cellData.title}</p>
                              <p className="text-[8px] text-indigo-400 line-clamp-1">{cellData.objective}</p>
                            </div>
                          ) : slotInfo ? (
                            <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                               <div className="p-2 bg-slate-100 rounded-full text-slate-400">
                                 <Plus size={16} />
                               </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Button for Selection */}
      {selectedCells.length > 0 && (
        <div className="fixed bottom-8 right-8 left-8 md:left-auto md:w-80 z-40 animate-in slide-in-from-bottom-10">
          <button 
            onClick={() => setActiveCell({
              isBulk: true,
              day: selectedCells[0].day,
              period: selectedCells[0].period,
              slotInfo: selectedCells[0].slotInfo
            })}
            className="w-full bg-indigo-600 text-white p-5 rounded-3xl shadow-2xl flex items-center justify-between group hover:bg-indigo-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl text-white">
                <Send size={20} />
              </div>
              <div className="text-right">
                <p className="font-bold">تحضير الدروس المختارة</p>
                <p className="text-xs opacity-70">تم تحديد {selectedCells.length} حصص</p>
              </div>
            </div>
            <ChevronRight className="group-hover:translate-x-[-4px] transition-all" />
          </button>
        </div>
      )}

      {/* Modal / Popup */}
      {activeCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedCells.length > 1 ? 'تحضير جماعي للدروس' : `تحضير الحصة ${activeCell.period}`}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {selectedCells.length > 1 ? `سيتم تطبيق التحضير على ${selectedCells.length} حصص` : activeCell.dayName}
                </p>
              </div>
              <button 
                onClick={() => setActiveCell(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* موضوع الدرس */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <BookOpen size={14} /> موضوع الدرس
                  </label>
                  <span className={`text-[11px] font-bold ${
                    LIMITS.title - formData.title.length < 0 ? 'text-red-500 font-black' : 'text-slate-400'
                  }`}>
                    {LIMITS.title - formData.title.length < 0 
                      ? `تجاوزت بـ ${Math.abs(LIMITS.title - formData.title.length)} حرف` 
                      : `المتبقي: ${LIMITS.title - formData.title.length} حرف`}
                  </span>
                </div>
                <input 
                  type="text"
                  autoFocus
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className={`w-full p-4 bg-slate-50 rounded-2xl border-2 transition-all font-bold text-slate-700 outline-none ${
                    LIMITS.title - formData.title.length < 0 
                      ? 'border-red-300 focus:border-red-500 focus:bg-white' 
                      : 'border-transparent focus:bg-white focus:border-indigo-300'
                  }`}
                  placeholder="مثال: الكسور الاعتيادية"
                />
              </div>

              {/* الأهداف */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <Target size={14} /> الأهداف
                  </label>
                  <span className={`text-[11px] font-bold ${
                    LIMITS.objective - formData.objective.length < 0 ? 'text-red-500 font-black' : 'text-slate-400'
                  }`}>
                    {LIMITS.objective - formData.objective.length < 0 
                      ? `تجاوزت بـ ${Math.abs(LIMITS.objective - formData.objective.length)} حرف` 
                      : `المتبقي: ${LIMITS.objective - formData.objective.length} حرف`}
                  </span>
                </div>
                <textarea 
                  value={formData.objective}
                  onChange={(e) => handleFieldChange('objective', e.target.value)}
                  className={`w-full p-4 bg-slate-50 rounded-2xl border-2 transition-all text-sm min-h-[100px] outline-none ${
                    LIMITS.objective - formData.objective.length < 0 
                      ? 'border-red-300 focus:border-red-500 focus:bg-white' 
                      : 'border-transparent focus:bg-white focus:border-indigo-300'
                  }`}
                  placeholder="ماذا يتوقع من الطالب تحقيقه؟"
                />
              </div>

              {/* الواجب */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <Home size={14} /> الواجب
                  </label>
                  <span className={`text-[11px] font-bold ${
                    LIMITS.homework - formData.homework.length < 0 ? 'text-red-500 font-black' : 'text-slate-400'
                  }`}>
                    {LIMITS.homework - formData.homework.length < 0 
                      ? `تجاوزت بـ ${Math.abs(LIMITS.homework - formData.homework.length)} حرف` 
                      : `المتبقي: ${LIMITS.homework - formData.homework.length} حرف`}
                  </span>
                </div>
                <input 
                  type="text"
                  value={formData.homework}
                  onChange={(e) => handleFieldChange('homework', e.target.value)}
                  className={`w-full p-4 bg-slate-50 rounded-2xl border-2 transition-all text-sm outline-none ${
                    LIMITS.homework - formData.homework.length < 0 
                      ? 'border-red-300 focus:border-red-500 focus:bg-white' 
                      : 'border-transparent focus:bg-white focus:border-indigo-300'
                  }`}
                  placeholder="رقم الصفحة أو السؤال"
                />
              </div>

              <button 
                onClick={() => {
                  saveCellData(selectedCells, formData);
                }}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 mt-4"
              >
                <Save size={20} /> حفظ للكل ({selectedCells.length} حصص)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Limit Warning Popup */}
      {showLimitWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white max-w-md w-full p-6 rounded-3xl shadow-2xl text-center space-y-4 border border-amber-200 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-gray-900">تنبيه لطباعة الخطة</h3>
            <p className="text-sm font-bold text-amber-800 bg-amber-50 p-4 rounded-2xl border border-amber-200 leading-relaxed">
              تراك تبي تحوس الخطه عند الطباعه اذا كثرت حروف
            </p>
            <button
              type="button"
              onClick={() => setShowLimitWarning(false)}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95"
            >
              موافق
            </button>
          </div>
        </div>
      )}

      {/* Instructions for small screens */}
      <div className="md:hidden mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
        <AlertCircle className="text-amber-500 shrink-0" size={20} />
        <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
          اقلب الجوال جنب علشان تشوف زين 😊
        </p>
      </div>
    </div>
  );
}

export default TeacherView;
