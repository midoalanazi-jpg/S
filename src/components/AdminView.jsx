import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { 
  Plus, Trash2, Save, Download, Upload,
  User, Users, ChevronRight, FileText, CheckCircle2,
  Calendar, X, Layout, KeyRound, Lock, Eye, EyeOff, ShieldCheck, Search, Edit2, RotateCcw,
  Star, Bookmark, Smartphone, Monitor, Check, Sparkles, RefreshCw, Home, Share2, Copy, School
} from 'lucide-react';
import HijriDatePicker from '@mk01/react-hijri-date-picker';

import { supabase } from '../supabaseClient';
import { parseNessabyBackup, importNessabyDataToSupabase } from '../utils/nessabyImporter';

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
  const { schoolPhone: urlPhone } = useParams();
  const currentSchoolPhone = urlPhone || (window.location.pathname.startsWith('/s/') ? localStorage.getItem('active_school_phone') : null);

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
  const [assigningLeaderClass, setAssigningLeaderClass] = useState(null);
  const [selectedLeaderTeacherId, setSelectedLeaderTeacherId] = useState('');
  const [isSavingLeader, setIsSavingLeader] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // School & Principal Info State
  const [showSchoolInfoModal, setShowSchoolInfoModal] = useState(false);
  const [principalName, setPrincipalName] = useState(() => localStorage.getItem('admin_principal_name') || '');
  const [schoolPhone, setSchoolPhone] = useState(() => localStorage.getItem('admin_school_contact_phone') || '');
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('admin_school_name') || '');
  const [educationDept, setEducationDept] = useState(() => localStorage.getItem('admin_education_dept') || 'ادارة التعليم');
  const [schoolGender, setSchoolGender] = useState(() => localStorage.getItem('admin_school_gender') || 'boys'); // 'boys' | 'girls'
  const [isSavingSchoolInfo, setIsSavingSchoolInfo] = useState(false);

  // Passwords Management & PIN State
  const [showPinModal, setShowPinModal] = useState(false);
  const [storedAdminPin, setStoredAdminPin] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [newPinVal, setNewPinVal] = useState('');
  const [confirmPinVal, setConfirmPinVal] = useState('');

  const [showPasswordsModal, setShowPasswordsModal] = useState(false);
  const [teacherPasswords, setTeacherPasswords] = useState({});
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingPasswordVal, setEditingPasswordVal] = useState('');
  const [passwordSearchQuery, setPasswordSearchQuery] = useState('');

  // Nessaby Import State
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState('replace'); // 'replace' | 'merge'
  const fileInputRef = useRef(null);

  // Bookmark Prompt State
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);

  // Smooth Hide on Scroll Down State
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 70) {
        // Scroll Down -> Hide Header
        setShowHeader(false);
      } else {
        // Scroll Up or Top -> Show Header
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Load data from Supabase
  useEffect(() => {
    if (currentSchoolPhone) {
      localStorage.setItem('active_school_phone', currentSchoolPhone);
      fetchInitialData();
    } else {
      setIsLoading(false);
    }

    // Check if user previously chose "لا تسألني مرة أخرى"
    const dontAsk = localStorage.getItem('admin_bookmark_dont_ask');
    if (dontAsk !== 'true') {
      const timer = setTimeout(() => {
        setShowBookmarkPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentSchoolPhone]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: clsData } = await supabase.from('classes').select('*').eq('school_phone', currentSchoolPhone).order('created_at');
      const { data: tchData } = await supabase.from('teachers').select('*').eq('school_phone', currentSchoolPhone).order('created_at');
      const { data: plansData } = await supabase.from('weekly_plans').select('*').eq('school_phone', currentSchoolPhone);
      const { data: schoolRecord } = await supabase.from('schools').select('*').eq('phone', currentSchoolPhone).maybeSingle();
      const { data: allSettings } = await supabase.from('settings').select('*');

      let passwordsObj = {};
      let savedPin = '';

      if (schoolRecord) {
        if (schoolRecord.name) setSchoolName(schoolRecord.name);
        if (schoolRecord.admin_pin) savedPin = schoolRecord.admin_pin;
        if (schoolRecord.settings) {
          const s = schoolRecord.settings;
          if (s.teacher_passwords) passwordsObj = s.teacher_passwords;
          if (s.principal_name) setPrincipalName(s.principal_name);
          if (s.education_dept) setEducationDept(s.education_dept);
          if (s.school_gender) setSchoolGender(s.school_gender);
          if (s.school_contact_phone) setSchoolPhone(s.school_contact_phone);
        }
      }

      if (allSettings && allSettings.length > 0) {
        const settingsMap = {};
        allSettings.forEach(s => { settingsMap[s.key] = s.value; });

        if (!Object.keys(passwordsObj).length && settingsMap.teacher_passwords) {
          try {
            passwordsObj = typeof settingsMap.teacher_passwords === 'string' 
              ? JSON.parse(settingsMap.teacher_passwords) 
              : settingsMap.teacher_passwords;
          } catch (e) {
            console.error('Error parsing teacher passwords:', e);
          }
        }

        if (!savedPin && settingsMap.admin_pin) {
          savedPin = settingsMap.admin_pin;
        }

        if (!schoolRecord?.name && settingsMap.school_name) {
          setSchoolName(settingsMap.school_name);
        }
      }

      if (!savedPin) {
        savedPin = localStorage.getItem(`admin_master_pin_${currentSchoolPhone}`) || localStorage.getItem('admin_master_pin') || '';
      }
      setStoredAdminPin(savedPin);

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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (jsonErr) {
        alert('الملف المحدد تالف أو ليس بصيغة JSON صالحة.');
        return;
      }

      const parsed = parseNessabyBackup(json);
      if (!parsed.classes.length && !parsed.teachers.length) {
        alert('الملف المحدد لا يحتوي على بيانات فصول أو معلمين.');
        return;
      }

      setImportPreviewData(parsed);
      setImportMode('replace');
    } catch (err) {
      console.error('Error parsing file:', err);
      alert(`خطأ في قراءة ملف نصابي: ${err.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreviewData) return;
    setIsImporting(true);
    try {
      await importNessabyDataToSupabase(importPreviewData, importMode === 'replace', currentSchoolPhone);
      setImportPreviewData(null);
      await fetchInitialData();
      alert('✅ تم استيراد الجداول والفصول والمعلمين وإسنادات المواد بنجاح!');
    } catch (err) {
      console.error('Import execution error:', err);
      alert(`❌ حدث خطأ أثناء الاستيراد: ${err.message || err}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenPinModal = () => {
    setAdminPin('');
    setPinError('');
    setNewPinVal('');
    setConfirmPinVal('');
    if (!storedAdminPin) {
      setIsSettingNewPin(true);
    } else {
      setIsSettingNewPin(false);
    }
    setShowPinModal(true);
  };

  const handleSaveNewAdminPin = async (e) => {
    if (e) e.preventDefault();
    const pin = newPinVal.trim();
    if (!pin) {
      setPinError('يرجى إدخال رمز سري صالح (أرقام أو حروف)');
      return;
    }
    if (pin.length < 3) {
      setPinError('يجب أن يتكون الرمز السري من 3 خانات على الأقل');
      return;
    }
    if (confirmPinVal.trim() && pin !== confirmPinVal.trim()) {
      setPinError('الرمزان غير متطابقين!');
      return;
    }

    try {
      await supabase.from('schools').upsert({
        phone: currentSchoolPhone,
        admin_pin: pin
      }, { onConflict: 'phone' });

      await supabase.from('settings').upsert({
        key: 'admin_pin',
        value: pin
      });

      localStorage.setItem(`admin_master_pin_${currentSchoolPhone}`, pin);
      localStorage.setItem('admin_master_pin', pin);
      setStoredAdminPin(pin);
      setFailedPinAttempts(0);
      setIsSettingNewPin(false);
      setShowPinModal(false);
      setAdminPin('');
      setNewPinVal('');
      setConfirmPinVal('');
      setPinError('');
      setShowPasswordsModal(true);
      alert('✅ تم تعيين الرمز السري بنجاح وفتح لوحة كلمات السر');
    } catch (err) {
      console.error('Error saving admin pin:', err);
      setPinError('حدث خطأ أثناء حفظ الرمز السري');
    }
  };

  const handleVerifyAdminPin = async (e) => {
    if (e) e.preventDefault();
    const entered = adminPin.trim();

    if (!storedAdminPin) {
      setIsSettingNewPin(true);
      return;
    }

    if (entered === storedAdminPin) {
      setFailedPinAttempts(0);
      setShowPinModal(false);
      setPinError('');
      setAdminPin('');
      setShowPasswordsModal(true);
    } else {
      const nextAttempts = failedPinAttempts + 1;
      setFailedPinAttempts(nextAttempts);

      if (nextAttempts >= 10) {
        try {
          await supabase.from('schools').upsert({
            phone: currentSchoolPhone,
            admin_pin: ''
          }, { onConflict: 'phone' });

          await supabase.from('settings').upsert({
            key: 'admin_pin',
            value: ''
          });
        } catch (err) {
          console.error('Error resetting admin pin:', err);
        }
        localStorage.removeItem(`admin_master_pin_${currentSchoolPhone}`);
        localStorage.removeItem('admin_master_pin');
        setStoredAdminPin('');
        setFailedPinAttempts(0);
        setIsSettingNewPin(true);
        setAdminPin('');
        setNewPinVal('');
        setConfirmPinVal('');
        setPinError('⚠️ تم إدخال كلمة المرور خطأ 10 مرات وتم مسحها تلقائياً. يرجى تعيين كلمة مرور جديدة الآن:');
      } else {
        const remaining = 10 - nextAttempts;
        setPinError(`كلمة المرور غير صحيحة! المحاولة (${nextAttempts}/10) - متبقي ${remaining} محاولات قبل مسحها.`);
      }
    }
  };

  const handleSaveTeacherPassword = async (teacherId, newPwd) => {
    if (!newPwd.trim()) {
      alert('يرجى إدخال كلمة مرور صالحة (حرف أو رقم على الأقل)');
      return;
    }
    try {
      const updated = { ...teacherPasswords, [teacherId]: newPwd.trim() };

      const { data: schoolRecord } = await supabase.from('schools').select('*').eq('phone', currentSchoolPhone).maybeSingle();
      await supabase.from('schools').upsert({
        phone: currentSchoolPhone,
        settings: { ...(schoolRecord?.settings || {}), teacher_passwords: updated }
      }, { onConflict: 'phone' });

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

      const { data: schoolRecord } = await supabase.from('schools').select('*').eq('phone', currentSchoolPhone).maybeSingle();
      await supabase.from('schools').upsert({
        phone: currentSchoolPhone,
        settings: { ...(schoolRecord?.settings || {}), teacher_passwords: updated }
      }, { onConflict: 'phone' });

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
        .insert([{ name: newClassName.trim(), schedule: {}, school_phone: currentSchoolPhone }])
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
          name: newTeacherName.trim(), 
          assignments: teacherAssignments,
          leader_of: teacherLeaderships,
          school_phone: currentSchoolPhone
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

  const handleSaveClassLeader = async (classId, newLeaderTeacherId) => {
    if (!classId) return;
    setIsSavingLeader(true);

    try {
      // 1. Identify previous leaders of this class (teachers who currently have classId in their leader_of array)
      const oldLeaders = teachers.filter(t => {
        const list = Array.isArray(t.leader_of) ? t.leader_of : [];
        return list.includes(classId) && t.id !== newLeaderTeacherId;
      });

      // 2. Remove classId from old leaders in Supabase
      for (const oldTeacher of oldLeaders) {
        const currentList = Array.isArray(oldTeacher.leader_of) ? oldTeacher.leader_of : [];
        const updatedList = currentList.filter(id => id !== classId);
        const { error } = await supabase
          .from('teachers')
          .update({ leader_of: updatedList })
          .eq('id', oldTeacher.id);
        if (error) throw error;
      }

      // 3. Add classId to new leader (if a teacher is selected)
      if (newLeaderTeacherId) {
        const newTeacher = teachers.find(t => t.id === newLeaderTeacherId);
        if (newTeacher) {
          const currentList = Array.isArray(newTeacher.leader_of) ? newTeacher.leader_of : [];
          const updatedList = currentList.includes(classId) ? currentList : [...currentList, classId];
          const { error } = await supabase
            .from('teachers')
            .update({ leader_of: updatedList })
            .eq('id', newLeaderTeacherId);
          if (error) throw error;
        }
      }

      // 4. Update local state `teachers`
      setTeachers(prev => prev.map(t => {
        let currentList = Array.isArray(t.leader_of) ? [...t.leader_of] : [];
        if (t.id === newLeaderTeacherId) {
          if (!currentList.includes(classId)) currentList.push(classId);
        } else {
          currentList = currentList.filter(id => id !== classId);
        }
        return { ...t, leader_of: currentList };
      }));

      setAssigningLeaderClass(null);
      setSelectedLeaderTeacherId('');
      alert('تم حفظ إسناد رائد الفصل بنجاح');
    } catch (err) {
      console.error('Error saving class leader:', err);
      alert(`خطأ أثناء حفظ رائد الفصل: ${err.message || err}`);
    } finally {
      setIsSavingLeader(false);
    }
  };

  const updateTempSchedule = (dayId, period, subject) => {
    setTempSchedule(prev => ({
      ...prev,
      [`${dayId}_${period}`]: subject
    }));
  };

  const currentEditingClass = classes.find(c => c.id === editingScheduleClassId);

  const handleSaveSchoolInfo = async (e) => {
    if (e) e.preventDefault();
    setIsSavingSchoolInfo(true);
    try {
      const { data: currentSchoolRecord } = await supabase.from('schools').select('*').eq('phone', currentSchoolPhone).maybeSingle();

      await supabase.from('schools').upsert({
        phone: currentSchoolPhone,
        name: schoolName.trim(),
        settings: {
          ...(currentSchoolRecord?.settings || {}),
          principal_name: principalName.trim(),
          education_dept: educationDept.trim(),
          school_gender: schoolGender,
          school_contact_phone: schoolPhone.trim()
        }
      }, { onConflict: 'phone' });

      localStorage.setItem('admin_principal_name', principalName.trim());
      localStorage.setItem('admin_school_contact_phone', schoolPhone.trim());
      localStorage.setItem('admin_school_name', schoolName.trim());
      localStorage.setItem('admin_education_dept', educationDept.trim());
      localStorage.setItem('admin_school_gender', schoolGender);

      setShowSchoolInfoModal(false);
      alert('تم حفظ بيانات المدير والمدرسة بنجاح');
    } catch (err) {
      console.error('Error saving school info:', err);
      alert(`خطأ في حفظ البيانات: ${err.message || err}`);
    } finally {
      setIsSavingSchoolInfo(false);
    }
  };

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

  // Export Logic with localStorage persistence (week, semester, and year are persisted, date always defaults to today's live Hijri date)
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
          hijriDate: todayHijri // Always calculate and default to today's live date!
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

  // Auto-save exportConfig changes to localStorage (excluding static date so it always calculates today's date fresh)
  useEffect(() => {
    try {
      localStorage.setItem('admin_export_config', JSON.stringify({
        classId: exportConfig.classId,
        weekNumber: exportConfig.weekNumber,
        semester: exportConfig.semester,
        year: exportConfig.year
      }));
    } catch (e) {
      console.error('Error saving export config:', e);
    }
  }, [exportConfig.classId, exportConfig.weekNumber, exportConfig.semester, exportConfig.year]);

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

  const formatSemester = (sem) => {
    if (!sem) return '';
    const trimmed = sem.trim();
    if (trimmed.startsWith('الفصل')) return trimmed;
    return `الفصل ${trimmed}`;
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
    const classLeader = teachers.find(t => {
      if (!t.leader_of) return false;
      const list = Array.isArray(t.leader_of) ? t.leader_of : [];
      return list.includes(cls.id);
    });

    return {
      ...cls,
      plans: aggregatedPlans,
      leaderName: classLeader ? classLeader.name : ''
    };
  };

  const printData = getFullClassData();
  const allPrintData = isBulkExport ? classes.map(c => getFullClassData(c.id)).filter(d => d !== null) : [];

  if (!currentSchoolPhone) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header مع تأثير الاختفاء السلس عند السكرول لأسفل والظهور عند السكرول لأعلى */}
      <div className={`sticky top-3 z-40 transition-all duration-300 transform ${
        showHeader ? 'translate-y-0 opacity-100' : '-translate-y-28 opacity-0 pointer-events-none'
      } print:hidden`}>
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-lg border border-slate-100 gap-4">
          
          {/* الجانب الأيمن: الشعار واسم المدرسة والبيانات */}
          <div className="flex items-center gap-3 shrink-0">
            <img 
              src="/logo.png" 
              alt="شعار نصابي" 
              className="w-12 h-12 object-contain rounded-2xl shadow-xs shrink-0 bg-white p-0.5 border border-slate-100" 
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">لوحة تحكم المدير</h1>
                {schoolName && schoolName !== 'مدرستي' && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 whitespace-nowrap">
                    {schoolName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
                إدارة الخطط والجداول — <span className="text-gray-400">رقم المدرسة:</span> <span className="font-mono text-gray-700 font-bold" dir="ltr">{currentSchoolPhone}</span>
              </p>
            </div>
          </div>

          {/* الجانب الأيسر: الأزرار منظمة ومقسمة بشكل مريح */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start lg:justify-end overflow-x-auto pb-1 sm:pb-0">
            
            {/* 1. مشاركة الرابط للمعلمين */}
            <button 
              onClick={() => {
                const url = `${window.location.origin}/s/${currentSchoolPhone}`;
                const text = `السلام عليكم ورحمة الله وبركاته،\nالزملاء المعلمون، هذا رابط منصة الخطة الأسبوعية لمدرستنا:\n${url}\n\nيرجى الدخول وتعبئة الخطة الأسبوعية.`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-sm shadow-emerald-100 transition-all active:scale-95 whitespace-nowrap"
              title="إرسال رابط المدرسة لمعلميك عبر الواتساب"
            >
              <Share2 size={15} />
              <span>مشاركة واتساب</span>
            </button>

            {/* 2. نسخ الرابط */}
            <button 
              onClick={() => {
                const url = `${window.location.origin}/s/${currentSchoolPhone}`;
                navigator.clipboard.writeText(url);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs border border-slate-200/80 shadow-xs transition-all active:scale-95 whitespace-nowrap"
              title="نسخ رابط المعلمين"
            >
              {copiedLink ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>

            {/* فاصل رأسي خفيف */}
            <div className="hidden sm:block w-[1px] h-6 bg-slate-200 mx-0.5 shrink-0"></div>

            {/* 3. كلمات السر */}
            <button 
              onClick={() => setShowPasswordsModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-2xl font-bold text-xs border border-amber-200/80 shadow-xs transition-all active:scale-95 whitespace-nowrap"
              title="كلمات سر المعلمين والرمز السري"
            >
              <KeyRound size={15} className="text-amber-600" />
              <span>كلمات السر</span>
            </button>

            {/* 4. استيراد جدول نصابي */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".nessaby,.json,application/json" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-2xl font-bold text-xs border border-indigo-200/80 shadow-xs transition-all active:scale-95 whitespace-nowrap"
              title="استيراد جدول نصابي"
            >
              <Upload size={15} className="text-indigo-600" />
              <span>استيراد جدول</span>
            </button>

            {/* 5. الرئيسية */}
            <Link
              to={currentSchoolPhone ? `/s/${currentSchoolPhone}` : '/'}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-2xl font-bold text-xs border border-slate-200/80 shadow-xs transition-all active:scale-95 whitespace-nowrap"
              title="العودة للشاشة الرئيسية (بوابة المعلم)"
            >
              <Home size={15} className="text-slate-600" />
              <span>الرئيسية</span>
            </Link>

          </div>
        </div>
      </div>

      {/* زر تعديل بيانات المدرسة */}
      <div className="flex justify-start print:hidden">
        <button 
          onClick={() => setShowSchoolInfoModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-2xl font-bold text-xs border border-slate-200 shadow-sm transition-all active:scale-95"
          title="تعديل بيانات المدرسة والمدير"
        >
          <User size={16} className="text-blue-600" />
          <span>تعديل بيانات المدرسة</span>
        </button>
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
              placeholder="مثال: الفصل الأول"
            />
            <datalist id="semesters-list">
              <option value="الفصل الأول" />
              <option value="الفصل الثاني" />
              <option value="الفصل الثالث" />
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
                    {classes.map(c => {
                      const currentLeader = teachers.find(t => {
                        if (!t.leader_of) return false;
                        const list = Array.isArray(t.leader_of) ? t.leader_of : [];
                        return list.includes(c.id);
                      });

                      return (
                        <div key={c.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:shadow-md border border-gray-100 hover:border-blue-100 transition-all gap-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-800 text-base">{c.name}</span>
                              {currentLeader ? (
                                <span className="text-[11px] font-bold bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1">
                                  <ShieldCheck size={12} className="text-amber-600" />
                                  رائد الفصل: {currentLeader.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400 bg-gray-200/60 px-2 py-0.5 rounded-md font-medium">
                                  بدون رائد فصل
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 mt-0.5">المعرف: {c.id.slice(-5)}</span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* زر إسناد ريادة الفصل بجانب إعداد الجدول */}
                            <button 
                              onClick={() => {
                                setAssigningLeaderClass(c);
                                setSelectedLeaderTeacherId(currentLeader ? currentLeader.id : '');
                              }}
                              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm ${
                                currentLeader 
                                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200' 
                                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-100'
                              }`}
                              title="إسناد ريادة الفصل"
                            >
                              <ShieldCheck size={14} />
                              <span>{currentLeader ? `رائد الفصل: ${currentLeader.name}` : 'إسناد ريادة الفصل'}</span>
                            </button>

                            {/* زر إعداد الجدول */}
                            <button 
                              onClick={() => openScheduleEditor(c)}
                              className="flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-600 px-3.5 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            >
                              <Calendar size={14} /> إعداد الجدول
                            </button>

                            {/* زر حذف الفصل */}
                            <button 
                              onClick={() => deleteClass(c.id)} 
                              className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                              title="حذف الفصل"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

      {/* PIN Verification & Reset Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in" dir="rtl">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-7 space-y-6 animate-in zoom-in-95 border border-slate-100">
            {isSettingNewPin ? (
              // شاشة تعيين رمز سري جديد
              <>
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <KeyRound size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {storedAdminPin ? 'إعادة تعيين الرمز السري' : 'تعيين رمز سري جديد'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    حدد رمزاً سرياً خاصاً بالمدير لحماية كلمات سر المعلمين وإعدادات النظام
                  </p>
                </div>

                <form onSubmit={handleSaveNewAdminPin} className="space-y-3.5">
                  <div className="space-y-2.5">
                    <input 
                      type="password"
                      autoFocus
                      value={newPinVal}
                      onChange={(e) => {
                        setNewPinVal(e.target.value);
                        if (pinError) setPinError('');
                      }}
                      placeholder="أدخل الرمز السري الجديد..."
                      className="w-full p-3.5 bg-slate-50 text-center text-lg tracking-widest font-black rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />

                    <input 
                      type="password"
                      value={confirmPinVal}
                      onChange={(e) => {
                        setConfirmPinVal(e.target.value);
                        if (pinError) setPinError('');
                      }}
                      placeholder="تأكيد الرمز السري..."
                      className="w-full p-3.5 bg-slate-50 text-center text-lg tracking-widest font-black rounded-2xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />

                    {pinError && (
                      <p className="text-xs font-bold text-red-500 text-center mt-2 bg-red-50 p-2.5 rounded-xl border border-red-100">
                        {pinError}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinModal(false);
                        setPinError('');
                        setIsSettingNewPin(false);
                      }}
                      className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Save size={16} /> حفظ وفتح اللوحة
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // شاشة إدخال الرمز السري للتحقق
              <>
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <Lock size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">الرمز السري للمدير</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    أدخل الرمز السري للوصول إلى كلمات سر المعلمين
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
                      <p className="text-xs font-bold text-red-500 text-center mt-2.5 bg-red-50 p-2.5 rounded-xl border border-red-100 leading-relaxed">
                        {pinError}
                      </p>
                    )}
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingNewPin(true);
                        setPinError('');
                        setNewPinVal('');
                        setConfirmPinVal('');
                      }}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-bold hover:underline"
                    >
                      نسيت الرمز السري؟ اضغط لتعيين رمز جديد
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinModal(false);
                        setAdminPin('');
                        setPinError('');
                      }}
                      className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <KeyRound size={16} /> فتح اللوحة
                    </button>
                  </div>
                </form>
              </>
            )}
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

      {/* Nessaby Import Preview & Confirmation Modal */}
      {importPreviewData && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in" dir="rtl">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-6 md:p-8 space-y-6 border border-slate-100 animate-in zoom-in-95 text-right relative">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner border border-emerald-100">
                  <Sparkles size={24} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">استيراد جدول نصابي</h3>
                  <p className="text-xs text-slate-500 font-bold">معاينة وتأكيد استيراد البيانات إلى النظام</p>
                </div>
              </div>
              
              {!isImporting && (
                <button
                  onClick={() => setImportPreviewData(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
                  title="إغلاق"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                <p className="text-[10px] text-slate-400 font-bold">المدرسة</p>
                <p className="text-xs font-black text-slate-800 mt-1 truncate" title={importPreviewData.schoolName || 'نصابي'}>
                  {importPreviewData.schoolName || 'نصابي'}
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl text-center">
                <p className="text-[10px] text-blue-500 font-bold">الفصول</p>
                <p className="text-lg font-black text-blue-700 mt-0.5">
                  {importPreviewData.classes.length}
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-center">
                <p className="text-[10px] text-emerald-600 font-bold">المعلمون</p>
                <p className="text-lg font-black text-emerald-700 mt-0.5">
                  {importPreviewData.teachers.length}
                </p>
              </div>

              <div className="p-3.5 bg-purple-50/60 border border-purple-100 rounded-2xl text-center">
                <p className="text-[10px] text-purple-600 font-bold">الحصص</p>
                <p className="text-lg font-black text-purple-700 mt-0.5">
                  {importPreviewData.totalSlots}
                </p>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 block">طريقة الاستيراد:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  disabled={isImporting}
                  className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    importMode === 'replace'
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-black text-xs">🔄 استبدال شامل</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">مستحسن</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    مسح الفصول والمعلمين القدامى، وتثبيت الجدول الجديد بالكامل.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  disabled={isImporting}
                  className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                    importMode === 'merge'
                      ? 'border-blue-500 bg-blue-50/40 text-blue-950 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-black text-xs">➕ دمج وتحديث</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    تحديث الفصول الموجودة وإضافة المعلمين الجدد دون حذف السجلات السابقة.
                  </p>
                </button>
              </div>
            </div>

            {/* Info Notice */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 leading-relaxed font-bold flex items-start gap-2.5">
              <span className="text-base shrink-0">💡</span>
              <span>
                يقوم النظام بربط جدول الحصص الأسبوعي، توزيع المواد، وتعيين الصلاحيات لجميع المعلمين في نظام الخطط الأسبوعية تلقائياً.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>جاري حفظ وتحديث البيانات...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>بدء الاستيراد وتحديث النظام</span>
                  </>
                )}
              </button>

              {!isImporting && (
                <button
                  type="button"
                  onClick={() => setImportPreviewData(null)}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightweight Bookmark Prompt */}
      {showBookmarkPrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm print:hidden animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 space-y-4 border border-slate-100 animate-in zoom-in-95 text-center relative">
            <button
              onClick={() => setShowBookmarkPrompt(false)}
              className="absolute left-4 top-4 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-all"
              title="إغلاق"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-100">
              <Star size={24} className="fill-amber-400 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">لحفظ الصفحة وسهولة الوصول</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                اضغط <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-bold font-mono text-indigo-600">Ctrl + D</kbd> لحفظ الصفحة في المفضلة، أو اضغط على علامة النجمة <span className="text-amber-500 font-bold">⭐</span> في شريط المتصفح بالأعلى.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => setShowBookmarkPrompt(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-100 transition-all active:scale-95"
              >
                فهمت، حسناً
              </button>

              <button
                onClick={() => {
                  localStorage.setItem('admin_bookmark_dont_ask', 'true');
                  setShowBookmarkPrompt(false);
                }}
                className="w-full py-1.5 text-[11px] text-slate-400 hover:text-red-500 font-bold transition-all"
              >
                لا تسألني مرة أخرى
              </button>
            </div>
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
                  <p className="font-bold text-[11px]">{educationDept || 'ادارة التعليم بمحافظة حفر الباطن'}</p>
                  <p className="font-bold text-[11px]">{schoolName || 'مدرسة سمرة بن عمرو الابتدائية'}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-[16px] text-[#2b4c7e] border-b-2 border-[#2b4c7e] mb-1 px-4">
                    الخطة التعليمية الأسبوعية - {formatSemester(exportConfig.semester)} - {exportConfig.year}
                  </p>
                  <p className="text-[11px] font-bold">{schoolGender === 'girls' ? 'اسم الطالبة:' : 'اسم الطالب:'} ................................................................</p>
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
                <p>جوال المدرسة: {schoolPhone || '.........................'}</p>
                <div className="flex justify-between pt-2 px-4">
                  <p>{schoolGender === 'girls' ? 'رائدة الفصل:' : 'رائد الفصل:'} {data.leaderName || '.........................'}</p>
                  <p>{schoolGender === 'girls' ? 'مديرة المدرسة:' : 'مدير المدرسة:'} {principalName || '.........................'}</p>
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

      {/* Assign Class Leader Modal Overlay */}
      {assigningLeaderClass && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">إسناد ريادة الفصل</h3>
                  <p className="text-xs text-indigo-100 font-medium">{assigningLeaderClass.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningLeaderClass(null)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-all text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2 mr-1">
                  اختر المعلم ليكون رائداً لفصل ({assigningLeaderClass.name}):
                </label>
                <select
                  value={selectedLeaderTeacherId}
                  onChange={(e) => setSelectedLeaderTeacherId(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">-- بدون رائد فصل (إلغاء التعيين) --</option>
                  {teachers.map(t => {
                    const otherClassesLed = (Array.isArray(t.leader_of) ? t.leader_of : [])
                      .filter(id => id !== assigningLeaderClass.id)
                      .map(id => classes.find(c => c.id === id)?.name)
                      .filter(Boolean);

                    return (
                      <option key={t.id} value={t.id}>
                        أ. {t.name} {otherClassesLed.length > 0 ? `(رائد لـ: ${otherClassesLed.join('، ')})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-xs leading-relaxed">
                💡 سيظهر اسم رائد الفصل تلقائياً في أسفل الخطة الأسبوعية عند التصدير والطباعة.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingLeader}
                  onClick={() => handleSaveClassLeader(assigningLeaderClass.id, selectedLeaderTeacherId)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{isSavingLeader ? 'جاري الحفظ...' : 'حفظ الإسناد'}</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingLeader}
                  onClick={() => setAssigningLeaderClass(null)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* School & Principal Info Modal Overlay */}
      {showSchoolInfoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md print:hidden animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <User size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">بيانات المدير والمدرسة</h3>
                  <p className="text-xs text-blue-100 font-medium">تظهر في أسفل وأعلى الخطة الأسبوعية عند الطباعة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolInfoModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-all text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSchoolInfo} className="p-6 space-y-4">
              {/* نوع المدرسة: بنين / بنات */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block mr-1">
                  نوع المدرسة (لتأنيث المسميات بالطباعة والتصدير):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSchoolGender('boys')}
                    className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      schoolGender === 'boys'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>👨‍🎓 بنين (مدير / رائد / طالب)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchoolGender('girls')}
                    className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      schoolGender === 'girls'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-md shadow-pink-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>👩‍🎓 بنات (مديرة / رائدة / طالبة)</span>
                  </button>
                </div>
              </div>

              {/* اسم المدير / المديرة */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block mr-1">
                  {schoolGender === 'girls' ? 'اسم مديرة المدرسة:' : 'اسم مدير المدرسة:'}
                </label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder={schoolGender === 'girls' ? 'مثال: نورة محمد القحطاني' : 'مثال: أحمد محمد القحطاني'}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              {/* جوال المدرسة */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block mr-1">
                  جوال / هاتف المدرسة (اختياري):
                </label>
                <input
                  type="text"
                  value={schoolPhone}
                  onChange={(e) => setSchoolPhone(e.target.value)}
                  placeholder="اختياري - هاتف المدرسة الرسمي"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-left"
                  dir="ltr"
                />
              </div>

              {/* اسم المدرسة */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block mr-1">
                  اسم المدرسة (الهيدر بالأعلى):
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="مثال: مدرسة سمرة بن عمرو الابتدائية"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              {/* إدارة التعليم */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block mr-1">
                  إدارة التعليم (الهيدر بالأعلى):
                </label>
                <input
                  type="text"
                  value={educationDept}
                  onChange={(e) => setEducationDept(e.target.value)}
                  placeholder="مثال: ادارة التعليم بمحافظة حفر الباطن"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-xs leading-relaxed">
                💡 سيتم حفظ هذه البيانات سحابياً والاعتماد عليها تلقائياً في جميع عمليات التصدير والطباعة.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSchoolInfo}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{isSavingSchoolInfo ? 'جاري الحفظ...' : 'حفظ البيانات'}</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingSchoolInfo}
                  onClick={() => setShowSchoolInfoModal(false)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
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

