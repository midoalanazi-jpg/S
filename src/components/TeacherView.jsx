import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, User, Users, Calendar, 
  BookOpen, Target, Home, StickyNote,
  AlertCircle, X, Save, Plus, CheckCircle2, ChevronRight,
  Lock, KeyRound, Eye, EyeOff, ShieldCheck, RotateCw, Smartphone, Maximize2, Minimize2,
  LayoutDashboard
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
  const navigate = useNavigate();
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
  const [isRotated, setIsRotated] = useState(true);

  // Admin PIN Protection State
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [storedAdminPin, setStoredAdminPin] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [failedAdminAttempts, setFailedAdminAttempts] = useState(0);
  const [isSettingNewAdminPin, setIsSettingNewAdminPin] = useState(false);
  const [newAdminPinVal, setNewAdminPinVal] = useState('');
  const [confirmAdminPinVal, setConfirmAdminPinVal] = useState('');
  const [showAdminPinText, setShowAdminPinText] = useState(false);

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
      const { data: pinSetting } = await supabase.from('settings').select('*').eq('key', 'admin_pin').maybeSingle();

      let passwordsObj = {};
      if (pwdSetting && pwdSetting.value) {
        try {
          passwordsObj = typeof pwdSetting.value === 'string' ? JSON.parse(pwdSetting.value) : pwdSetting.value;
        } catch (e) {
          console.error('Error parsing teacher passwords:', e);
        }
      }

      const savedPin = pinSetting?.value || localStorage.getItem('admin_master_pin') || '';
      setStoredAdminPin(savedPin);

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

  const handleOpenAdminModal = () => {
    setAdminPinInput('');
    setAdminPinError('');
    setNewAdminPinVal('');
    setConfirmAdminPinVal('');
    setShowAdminPinText(false);
    if (!storedAdminPin) {
      setIsSettingNewAdminPin(true);
    } else {
      setIsSettingNewAdminPin(false);
    }
    setShowAdminPinModal(true);
  };

  const handleVerifyAdminPin = async (e) => {
    if (e) e.preventDefault();
    const entered = adminPinInput.trim();

    if (!storedAdminPin) {
      setIsSettingNewAdminPin(true);
      return;
    }

    if (entered === storedAdminPin) {
      setFailedAdminAttempts(0);
      setShowAdminPinModal(false);
      setAdminPinError('');
      setAdminPinInput('');
      sessionStorage.setItem('admin_authenticated', 'true');
      navigate('/admin');
    } else {
      const nextAttempts = failedAdminAttempts + 1;
      setFailedAdminAttempts(nextAttempts);

      if (nextAttempts >= 10) {
        // مسح كلمة المرور بالكامل بعد 10 محاولات خاطئة
        try {
          await supabase.from('settings').upsert({
            key: 'admin_pin',
            value: ''
          });
        } catch (err) {
          console.error('Error resetting admin pin:', err);
        }
        localStorage.removeItem('admin_master_pin');
        setStoredAdminPin('');
        setFailedAdminAttempts(0);
        setIsSettingNewAdminPin(true);
        setAdminPinInput('');
        setNewAdminPinVal('');
        setConfirmAdminPinVal('');
        setAdminPinError('⚠️ تم إدخال كلمة المرور خطأ 10 مرات وتم مسحها تلقائياً. يرجى ضبط كلمة مرور جديدة الآن:');
      } else {
        const remaining = 10 - nextAttempts;
        setAdminPinError(`كلمة المرور غير صحيحة! المحاولة (${nextAttempts}/10) - متبقي ${remaining} محاولات قبل مسحها.`);
      }
    }
  };

  const handleSaveNewAdminPin = async (e) => {
    if (e) e.preventDefault();
    const pin = newAdminPinVal.trim();
    if (!pin) {
      setAdminPinError('يرجى إدخال كلمة مرور صالحة (حروف أو أرقام)');
      return;
    }
    if (pin.length < 2) {
      setAdminPinError('يجب أن تتكون كلمة المرور من خانتين على الأقل');
      return;
    }
    if (confirmAdminPinVal.trim() && pin !== confirmAdminPinVal.trim()) {
      setAdminPinError('كلمتا المرور غير متطابقتين!');
      return;
    }

    try {
      await supabase.from('settings').upsert({
        key: 'admin_pin',
        value: pin
      });
      localStorage.setItem('admin_master_pin', pin);
      setStoredAdminPin(pin);
      setFailedAdminAttempts(0);
      setIsSettingNewAdminPin(false);
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setNewAdminPinVal('');
      setConfirmAdminPinVal('');
      setAdminPinError('');
      sessionStorage.setItem('admin_authenticated', 'true');
      alert('✅ تم ضبط كلمة مرور الإدارة بنجاح والدخول للوحة الإدارة');
      navigate('/admin');
    } catch (err) {
      console.error('Error saving admin pin:', err);
      setAdminPinError('حدث خطأ أثناء حفظ كلمة المرور');
    }
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

          {/* زر لوحة تحكم الإدارة بتصميم مطابق لبطاقة بوابة المعلم */}
          <button
            type="button"
            onClick={handleOpenAdminModal}
            className="mt-4 block w-full bg-white hover:bg-slate-50/80 p-6 rounded-[2.5rem] shadow-xl border border-slate-100 hover:border-indigo-100 transition-all duration-300 transform hover:-translate-y-1 group active:scale-[0.98] text-right cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm shrink-0">
                  <LayoutDashboard size={26} />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      لوحة تحكم الإدارة
                    </h2>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                      خاص بالمدير
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    الإدارة والتصدير
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-2xl bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-all duration-300">
                <ChevronRight size={18} className="transform rotate-180" />
              </div>
            </div>
          </button>

          <div className="text-center mt-6 text-slate-500 opacity-80">
            <p className="text-xs font-bold tracking-wide text-indigo-600">برنامج نصابي</p>
          </div>
        </div>

        {/* Admin PIN Verification & Setup Modal Overlay */}
        {showAdminPinModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in" dir="rtl">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-7 space-y-6 animate-in zoom-in-95 border border-slate-100">
              {isSettingNewAdminPin ? (
                // شاشة تعيين / إعادة ضبط كلمة مرور الإدارة
                <>
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <KeyRound size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {storedAdminPin ? 'إعادة ضبط كلمة المرور' : 'تعيين كلمة مرور الإدارة'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      حدد كلمة مرور خاصة بالمدير لحماية لوحة الإدارة وإعدادات المدرسة
                    </p>
                  </div>

                  <form onSubmit={handleSaveNewAdminPin} className="space-y-3.5">
                    <div className="space-y-2.5">
                      <div className="relative">
                        <input 
                          type={showAdminPinText ? 'text' : 'password'}
                          autoFocus
                          value={newAdminPinVal}
                          onChange={(e) => {
                            setNewAdminPinVal(e.target.value);
                            if (adminPinError) setAdminPinError('');
                          }}
                          placeholder="كلمة المرور الجديدة..."
                          className="w-full p-3.5 bg-slate-50 text-center text-base font-bold rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPinText(!showAdminPinText)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showAdminPinText ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      <input 
                        type={showAdminPinText ? 'text' : 'password'}
                        value={confirmAdminPinVal}
                        onChange={(e) => {
                          setConfirmAdminPinVal(e.target.value);
                          if (adminPinError) setAdminPinError('');
                        }}
                        placeholder="تأكيد كلمة المرور..."
                        className="w-full p-3.5 bg-slate-50 text-center text-base font-bold rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />

                      {adminPinError && (
                        <p className="text-xs font-bold text-red-500 text-center bg-red-50 p-2.5 rounded-xl border border-red-100 leading-relaxed">
                          {adminPinError}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminPinModal(false);
                          setAdminPinError('');
                          setIsSettingNewAdminPin(false);
                        }}
                        className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-all"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Save size={16} />
                        <span>حفظ ومتابعة</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                // شاشة إدخال كلمة المرور للتحقق
                <>
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Lock size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">دخول لوحة الإدارة</h3>
                    <p className="text-xs text-slate-500 font-medium">أدخل كلمة المرور الخاصة بالمدير للمتابعة</p>
                  </div>

                  <form onSubmit={handleVerifyAdminPin} className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <input 
                          type={showAdminPinText ? 'text' : 'password'}
                          autoFocus
                          value={adminPinInput}
                          onChange={(e) => {
                            setAdminPinInput(e.target.value);
                            if (adminPinError) setAdminPinError('');
                          }}
                          placeholder="أدخل كلمة المرور..."
                          className="w-full p-4 bg-slate-50 text-center text-lg font-bold rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPinText(!showAdminPinText)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showAdminPinText ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>

                      {adminPinError && (
                        <div className="text-xs font-bold text-red-500 text-center bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">
                          {adminPinError}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminPinModal(false);
                          setAdminPinError('');
                          setAdminPinInput('');
                        }}
                        className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-all"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Lock size={16} />
                        <span>دخول للإدارة</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

  // Modal / Popup
  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-8 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-4 md:mb-6 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 sm:p-3 rounded-2xl text-white shadow-lg shrink-0">
                <Calendar size={22} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{currentTeacher?.name}</h1>
                <p className="text-xs text-slate-500">الجدول الدراسي والتحضير الأسبوعي</p>
              </div>
            </div>
            {saveStatus && (
              <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full md:hidden">
                {saveStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Flip / Rotate Button */}
            <button
              type="button"
              onClick={() => setIsRotated(!isRotated)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              title="قلب اتجاه الجدول"
            >
              <RotateCw size={15} />
              <span>{isRotated ? 'قلب الجدول (عادي)' : 'قلب الجدول (90°)'}</span>
            </button>

            {saveStatus && (
              <span className="hidden md:inline-block text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                {saveStatus}
              </span>
            )}

            <button 
              type="button"
              onClick={handleLogoutTeacher}
              className="text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-700 transition-all flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl"
            >
              ← تغيير المعلم
            </button>
          </div>
        </div>

        {/* Schedule Table Container - Unified Structure: Rows = Days, Columns = Periods */}
        <div className={`w-full max-w-7xl mx-auto transition-all duration-300 ${
          isRotated 
            ? 'py-4 flex items-center justify-center min-h-[740px] sm:min-h-[780px] md:min-h-0 md:py-0 overflow-hidden' 
            : 'overflow-x-auto'
        }`}>
          <div className={`bg-white shadow-sm border border-slate-200 md:border-slate-100 transition-all duration-300 ${
            isRotated 
              ? 'w-[730px] max-w-[86vh] h-[330px] max-h-[90vw] transform rotate-90 origin-center rounded-2xl shrink-0 my-auto md:transform-none md:w-full md:max-w-none md:h-auto md:max-h-none md:rounded-[2.5rem]' 
              : 'w-full min-w-[780px] rounded-2xl md:rounded-[2.5rem]'
          } overflow-hidden`}>
            <table className="w-full h-full border-collapse table-fixed text-center">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-2 md:p-5 border-b border-l border-slate-100 text-slate-400 font-bold text-[10px] md:text-xs w-24 md:w-32 text-right">
                    اليوم \ الحصة
                  </th>
                  {PERIODS.map(period => (
                    <th key={period} className="p-2 md:p-5 border-b border-l border-slate-100 last:border-l-0 text-slate-900 font-bold text-center text-[10px] md:text-sm">
                      الحصة {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day.id} className="hover:bg-slate-50/30 transition-all group border-b border-slate-50 last:border-b-0">
                    <td className="p-2 md:p-4 border-l border-slate-50 text-right font-bold text-indigo-600 bg-slate-50/30 text-[10px] md:text-sm">
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
                          className={`p-1 md:p-2 border-l border-slate-50 last:border-l-0 transition-all relative h-12 md:h-28 align-middle ${
                            slotInfo 
                            ? `cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500 z-10' 
                                  : 'hover:bg-indigo-50/50 active:bg-indigo-100'
                              }` 
                            : 'bg-gray-50/30 opacity-20 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex flex-col h-full justify-between select-none">
                            {isSelected && (
                              <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                <CheckCircle2 size={9} className="md:w-3 md:h-3" />
                              </div>
                            )}
                            {slotInfo && (
                              <div className="text-[9px] md:text-[10px] font-black text-indigo-600 px-0.5 flex flex-col items-end leading-tight">
                                <span className="truncate max-w-full">{slotInfo.subject}</span>
                                <span className="text-[7px] md:text-[8px] opacity-60 truncate max-w-full">{slotInfo.className}</span>
                              </div>
                            )}
                            
                            {cellData?.title ? (
                              <div className="bg-indigo-50/70 p-0.5 md:p-2 rounded md:rounded-xl border border-indigo-100 text-right">
                                <p className="font-bold text-indigo-900 text-[7px] md:text-[10px] line-clamp-1">{cellData.title}</p>
                                <p className="hidden md:block text-[8px] text-indigo-400 line-clamp-1">{cellData.objective}</p>
                              </div>
                            ) : slotInfo ? (
                              <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                 <div className="p-0.5 md:p-2 bg-slate-100 rounded-full text-slate-400">
                                   <Plus size={10} className="md:w-4 md:h-4" />
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
      </div>

      {/* Floating Action Button for Selection */}
      {selectedCells.length > 0 && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80 z-40 animate-in slide-in-from-bottom-6">
          <button 
            type="button"
            onClick={() => setActiveCell({
              isBulk: true,
              day: selectedCells[0].day,
              period: selectedCells[0].period,
              slotInfo: selectedCells[0].slotInfo
            })}
            className="w-full bg-indigo-600 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl flex items-center justify-between group hover:bg-indigo-700 transition-all active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl text-white">
                <Send size={18} />
              </div>
              <div className="text-right">
                <p className="font-bold text-sm sm:text-base">تحضير الدروس المختارة</p>
                <p className="text-xs opacity-80">تم تحديد {selectedCells.length} حصص</p>
              </div>
            </div>
            <ChevronRight className="group-hover:translate-x-[-4px] transition-all" />
          </button>
        </div>
      )}

      {/* Modal / Popup for Lesson Preparation */}
      {activeCell && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {selectedCells.length > 1 ? 'تحضير جماعي للدروس' : `تحضير الحصة ${activeCell.period}`}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {selectedCells.length > 1 ? `سيتم تطبيق التحضير على ${selectedCells.length} حصص` : activeCell.dayName}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setActiveCell(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
              {/* موضوع الدرس */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 sm:gap-2">
                    <BookOpen size={14} /> موضوع الدرس
                  </label>
                  <span className={`text-[10px] sm:text-[11px] font-bold ${
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
                  className={`w-full p-3.5 sm:p-4 bg-slate-50 rounded-2xl border-2 transition-all font-bold text-slate-700 outline-none text-sm sm:text-base ${
                    LIMITS.title - formData.title.length < 0 
                      ? 'border-red-300 focus:border-red-500 focus:bg-white' 
                      : 'border-transparent focus:bg-white focus:border-indigo-300'
                  }`}
                  placeholder="مثال: الكسور الاعتيادية"
                />
              </div>

              {/* الأهداف */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 sm:gap-2">
                    <Target size={14} /> الأهداف
                  </label>
                  <span className={`text-[10px] sm:text-[11px] font-bold ${
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
                  className={`w-full p-3.5 sm:p-4 bg-slate-50 rounded-2xl border-2 transition-all text-xs sm:text-sm min-h-[90px] sm:min-h-[100px] outline-none ${
                    LIMITS.objective - formData.objective.length < 0 
                      ? 'border-red-300 focus:border-red-500 focus:bg-white' 
                      : 'border-transparent focus:bg-white focus:border-indigo-300'
                  }`}
                  placeholder="ماذا يتوقع من الطالب تحقيقه؟"
                />
              </div>

              {/* الواجب */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 sm:gap-2">
                    <Home size={14} /> الواجب
                  </label>
                  <span className={`text-[10px] sm:text-[11px] font-bold ${
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
                  className={`w-full p-3.5 sm:p-4 bg-slate-50 rounded-2xl border-2 transition-all text-xs sm:text-sm outline-none ${
                    LIMITS.homework - formData.homework.length < 0 
                      ? 'border-red-300 focus:border-red-500 focus:bg-white' 
                      : 'border-transparent focus:bg-white focus:border-indigo-300'
                  }`}
                  placeholder="رقم الصفحة أو السؤال"
                />
              </div>

              <button 
                type="button"
                onClick={() => {
                  saveCellData(selectedCells, formData);
                }}
                className="w-full bg-indigo-600 text-white py-3.5 sm:py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 text-sm sm:text-base mt-2"
              >
                <Save size={18} /> حفظ للكل ({selectedCells.length} حصص)
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

      {/* Mobile info hint */}
      <div className="md:hidden mt-4 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RotateCw className="text-indigo-600 shrink-0" size={16} />
          <p className="text-[11px] text-indigo-900 font-bold leading-tight">
            {isRotated ? 'الجدول مائل 90° ليتناسب مع شاشة الجوال بالعرض' : 'الجدول بالوضع العادي (اسحب لليمين واليسار)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsRotated(!isRotated)}
          className="text-[10px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shrink-0 hover:bg-indigo-50 shadow-xs"
        >
          قلب الجدول 🔄
        </button>
      </div>
    </div>
  );
}

export default TeacherView;
