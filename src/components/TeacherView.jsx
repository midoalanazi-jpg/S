import React, { useState, useEffect } from 'react';
import { 
  Send, User, Users, Calendar, 
  BookOpen, Target, Home, StickyNote,
  AlertCircle, X, Save, Plus, CheckCircle2, ChevronRight
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
      setClasses(clsData || []);
      setTeachers(tchData || []);
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
    if (selectedTeacherId) {
      fetchTeacherPlans();
    }
  }, [selectedTeacherId]);

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

  if (!selectedTeacherId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full border border-slate-100">
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-8">تسجيل دخول المعلم</h1>
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-2 block mr-1">اسم المعلم</label>
              <select 
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 outline-none transition-all"
              >
                <option value="">-- اختر من القائمة --</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>
          <div className="text-center mt-6 text-slate-500 opacity-80">
            <p className="text-sm font-light mb-1">تقبلو تحياتي</p>
            <p className="text-sm font-light tracking-widest">ابو انس</p>
          </div>
        </div>
      </div>
    );
  }

  const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

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
            onClick={() => { setSelectedTeacherId(''); }}
            className="text-sm font-bold text-slate-400 hover:text-slate-600"
          >
            تغيير المعلم
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
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <BookOpen size={14} /> عنوان الدرس
                </label>
                <input 
                  type="text"
                  autoFocus
                  defaultValue={selectedCells.length === 1 ? (planData[activeCell.slotInfo.classId]?.[activeCell.day]?.[activeCell.period]?.title || '') : ''}
                  id="modal-title"
                  className="w-full p-4 bg-slate-50 rounded-2xl border-transparent focus:bg-white focus:border-indigo-300 focus:ring-0 outline-none transition-all font-bold text-slate-700"
                  placeholder="مثال: الكسور الاعتيادية"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <Target size={14} /> الأهداف
                </label>
                <textarea 
                  id="modal-objective"
                  defaultValue={selectedCells.length === 1 ? (planData[activeCell.slotInfo.classId]?.[activeCell.day]?.[activeCell.period]?.objective || '') : ''}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-transparent focus:bg-white focus:border-indigo-300 focus:ring-0 outline-none transition-all text-sm min-h-[100px]"
                  placeholder="ماذا يتوقع من الطالب تحقيقه؟"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <Home size={14} /> الواجب
                </label>
                <input 
                  type="text"
                  id="modal-homework"
                  defaultValue={selectedCells.length === 1 ? (planData[activeCell.slotInfo.classId]?.[activeCell.day]?.[activeCell.period]?.homework || '') : ''}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-transparent focus:bg-white focus:border-indigo-300 focus:ring-0 outline-none transition-all text-sm"
                  placeholder="رقم الصفحة أو السؤال"
                />
              </div>

              <button 
                onClick={() => {
                  const title = document.getElementById('modal-title').value;
                  const objective = document.getElementById('modal-objective').value;
                  const homework = document.getElementById('modal-homework').value;
                  saveCellData(selectedCells, { title, objective, homework });
                }}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 mt-4"
              >
                <Save size={20} /> حفظ للكل ({selectedCells.length} حصص)
              </button>
            </div>
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
