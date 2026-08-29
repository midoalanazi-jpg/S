import { supabase } from '../supabaseClient';

export const DAY_NAME_TO_ID = {
  'الأحد': 'sun',
  'الاثنين': 'mon',
  'الإثنين': 'mon',
  'الثلاثاء': 'tue',
  'الأربعاء': 'wed',
  'الاربعاء': 'wed',
  'الخميس': 'thu',
  'sun': 'sun',
  'mon': 'mon',
  'tue': 'tue',
  'wed': 'wed',
  'thu': 'thu'
};

/**
 * تحليل ملف تصدير نصابي وتحويله إلى بنية متوافقة مع المنصة
 */
export function parseNessabyBackup(rawJson) {
  let data = rawJson;
  if (data && typeof data === 'object') {
    if (data.data && typeof data.data === 'object') {
      data = data.data;
    } else if (data.state && typeof data.state === 'object') {
      data = data.state;
    }
  }

  if (!data || typeof data !== 'object') {
    throw new Error('الملف لا يحتوي على بيانات صالحة');
  }

  const schoolName = data.school?.name || data.schoolName || data.school_name || rawJson.schoolName || '';
  const rawClasses = Array.isArray(data.classes) ? data.classes : [];
  const rawTeachers = Array.isArray(data.teachers) ? data.teachers : [];
  const rawSchedule = (data.schedule || data.timetable || data.table || data.class_schedule || {});

  // 1. استخراج جميع أسماء الفصول
  const classNamesSet = new Set();
  rawClasses.forEach(c => {
    const name = (typeof c === 'string' ? c : (c.name || c.className || c.title))?.trim();
    if (name) classNamesSet.add(name);
  });
  Object.keys(rawSchedule).forEach(k => {
    const name = k?.trim();
    if (name) classNamesSet.add(name);
  });

  const parsedClasses = Array.from(classNamesSet).map(name => {
    const scheduleObj = {};
    const clsSchedule = rawSchedule[name] || {};
    let slotCount = 0;

    Object.keys(clsSchedule).forEach(dayName => {
      const dayId = DAY_NAME_TO_ID[dayName.trim()];
      if (!dayId) return;

      const dayPeriods = clsSchedule[dayName] || {};
      Object.keys(dayPeriods).forEach(p => {
        const periodNum = parseInt(p, 10);
        if (periodNum >= 1 && periodNum <= 7) {
          const cell = dayPeriods[p];
          let subject = '';
          if (typeof cell === 'string') {
            subject = cell.trim();
          } else if (cell && typeof cell === 'object') {
            subject = (cell.subject || cell.name || '').trim();
          }
          if (subject && subject !== '🚫' && subject !== '—') {
            scheduleObj[`${dayId}_${periodNum}`] = subject;
            slotCount++;
          }
        }
      });
    });

    return {
      name,
      schedule: scheduleObj,
      slotCount
    };
  });

  // 2. استخراج المعلمين وإسناداتهم
  const teachersMap = new Map();

  const getOrCreateTeacher = (tName) => {
    const cleanName = tName.trim();
    if (!teachersMap.has(cleanName)) {
      teachersMap.set(cleanName, {
        name: cleanName,
        assignmentsByClassName: {}
      });
    }
    return teachersMap.get(cleanName);
  };

  // من مصفوفة المعلمين
  rawTeachers.forEach(t => {
    const name = (typeof t === 'string' ? t : (t.name || t.teacherName))?.trim();
    if (!name) return;
    const teacherObj = getOrCreateTeacher(name);

    if (Array.isArray(t.assignments)) {
      t.assignments.forEach(assign => {
        const sub = (assign.subject || assign.name || '').trim();
        const assignClasses = Array.isArray(assign.classes) ? assign.classes : (assign.class ? [assign.class] : []);
        if (sub) {
          assignClasses.forEach(cls => {
            const cName = (typeof cls === 'string' ? cls : cls.name)?.trim();
            if (cName) {
              if (!teacherObj.assignmentsByClassName[cName]) {
                teacherObj.assignmentsByClassName[cName] = new Set();
              }
              teacherObj.assignmentsByClassName[cName].add(sub);
            }
          });
        }
      });
    } else if (t.subject) {
      const sub = t.subject.trim();
      const assignClasses = Array.isArray(t.classes) ? t.classes : (t.class ? [t.class] : []);
      assignClasses.forEach(cls => {
        const cName = (typeof cls === 'string' ? cls : cls.name)?.trim();
        if (cName) {
          if (!teacherObj.assignmentsByClassName[cName]) {
            teacherObj.assignmentsByClassName[cName] = new Set();
          }
          teacherObj.assignmentsByClassName[cName].add(sub);
        }
      });
    }
  });

  // من جدول الحصص الأسبوعي مباشرة (لضمان شمولية جميع المعلمين والحصص المسندة)
  Object.keys(rawSchedule).forEach(clsName => {
    const cleanClsName = clsName.trim();
    const dayGrid = rawSchedule[clsName] || {};
    Object.keys(dayGrid).forEach(day => {
      const periods = dayGrid[day] || {};
      Object.keys(periods).forEach(p => {
        const cell = periods[p];
        if (cell && typeof cell === 'object') {
          const tName = (cell.teacher || cell.teacherName || '').trim();
          const sub = (cell.subject || cell.name || '').trim();
          if (tName && sub && sub !== '🚫' && sub !== '—') {
            const teacherObj = getOrCreateTeacher(tName);
            if (!teacherObj.assignmentsByClassName[cleanClsName]) {
              teacherObj.assignmentsByClassName[cleanClsName] = new Set();
            }
            teacherObj.assignmentsByClassName[cleanClsName].add(sub);
          }
        }
      });
    });
  });

  const parsedTeachers = Array.from(teachersMap.values()).map(t => {
    const assignmentsPlain = {};
    Object.keys(t.assignmentsByClassName).forEach(clsName => {
      assignmentsPlain[clsName] = Array.from(t.assignmentsByClassName[clsName]);
    });
    return {
      name: t.name,
      assignmentsByClassName: assignmentsPlain
    };
  });

  const totalSlots = parsedClasses.reduce((sum, c) => sum + c.slotCount, 0);

  return {
    schoolName,
    classes: parsedClasses,
    teachers: parsedTeachers,
    totalSlots
  };
}

/**
 * تنفيذ الاستيراد وحفظ البيانات في Supabase مع ربطها برقم هاتف المدرسة الحالي
 */
export async function importNessabyDataToSupabase(parsedData, isOverwrite = true, schoolPhone = null) {
  const { classes: newClasses, teachers: newTeachers, schoolName } = parsedData;

  if (isOverwrite) {
    // 1. مسح البيانات القديمة الخاصة بالمدرسة الحالية
    if (schoolPhone) {
      const { data: exPlans } = await supabase.from('weekly_plans').select('id').eq('school_phone', schoolPhone);
      if (exPlans && exPlans.length > 0) {
        await supabase.from('weekly_plans').delete().in('id', exPlans.map(p => p.id));
      }

      const { data: exTeachers } = await supabase.from('teachers').select('id').eq('school_phone', schoolPhone);
      if (exTeachers && exTeachers.length > 0) {
        await supabase.from('teachers').delete().in('id', exTeachers.map(t => t.id));
      }

      const { data: exClasses } = await supabase.from('classes').select('id').eq('school_phone', schoolPhone);
      if (exClasses && exClasses.length > 0) {
        await supabase.from('classes').delete().in('id', exClasses.map(c => c.id));
      }
    }
  }

  // 2. إدخال الفصول
  const classMapByName = {};

  if (isOverwrite) {
    const classesToInsert = newClasses.map(c => ({
      name: c.name,
      schedule: c.schedule || {},
      school_phone: schoolPhone
    }));

    if (classesToInsert.length > 0) {
      const { data: insertedClasses, error: clsErr } = await supabase
        .from('classes')
        .insert(classesToInsert)
        .select();

      if (clsErr) throw clsErr;

      (insertedClasses || []).forEach(c => {
        classMapByName[c.name.trim()] = c.id;
      });
    }
  } else {
    // وضع الدمج: جلب الفصول الحالية وتحديثها أو إضافتها
    let query = supabase.from('classes').select('*');
    if (schoolPhone) query = query.eq('school_phone', schoolPhone);
    const { data: currentClasses } = await query;

    const existingClassMap = {};
    (currentClasses || []).forEach(c => {
      existingClassMap[c.name.trim()] = c;
      classMapByName[c.name.trim()] = c.id;
    });

    for (const c of newClasses) {
      const trimmed = c.name.trim();
      if (existingClassMap[trimmed]) {
        const existing = existingClassMap[trimmed];
        const mergedSchedule = { ...(existing.schedule || {}), ...(c.schedule || {}) };
        await supabase.from('classes').update({ schedule: mergedSchedule }).eq('id', existing.id);
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('classes')
          .insert([{ name: trimmed, schedule: c.schedule || {}, school_phone: schoolPhone }])
          .select();

        if (!insErr && ins && ins[0]) {
          classMapByName[trimmed] = ins[0].id;
        }
      }
    }
  }

  // 3. إدخال المعلمين وربطهم بمعرفات الفصول (UUIDs)
  if (isOverwrite) {
    const teachersToInsert = newTeachers.map(t => {
      const assignments = {};
      Object.keys(t.assignmentsByClassName || {}).forEach(cName => {
        const classId = classMapByName[cName.trim()];
        if (classId) {
          assignments[classId] = Array.from(new Set(t.assignmentsByClassName[cName]));
        }
      });

      return {
        name: t.name,
        assignments: assignments,
        leader_of: [],
        school_phone: schoolPhone
      };
    });

    if (teachersToInsert.length > 0) {
      const { error: tchErr } = await supabase
        .from('teachers')
        .insert(teachersToInsert);

      if (tchErr) throw tchErr;
    }
  } else {
    // وضع الدمج للمعلمين
    let tchQuery = supabase.from('teachers').select('*');
    if (schoolPhone) tchQuery = tchQuery.eq('school_phone', schoolPhone);
    const { data: currentTeachers } = await tchQuery;

    const existingTeacherMap = {};
    (currentTeachers || []).forEach(t => {
      existingTeacherMap[t.name.trim()] = t;
    });

    for (const t of newTeachers) {
      const trimmedName = t.name.trim();
      const assignments = {};
      Object.keys(t.assignmentsByClassName || {}).forEach(cName => {
        const classId = classMapByName[cName.trim()];
        if (classId) {
          assignments[classId] = Array.from(new Set(t.assignmentsByClassName[cName]));
        }
      });

      if (existingTeacherMap[trimmedName]) {
        const existing = existingTeacherMap[trimmedName];
        const mergedAssignments = { ...(existing.assignments || {}) };
        Object.keys(assignments).forEach(cId => {
          const existingSubs = mergedAssignments[cId] || [];
          mergedAssignments[cId] = Array.from(new Set([...existingSubs, ...assignments[cId]]));
        });

        await supabase.from('teachers').update({ assignments: mergedAssignments }).eq('id', existing.id);
      } else {
        await supabase.from('teachers').insert([{
          name: trimmedName,
          assignments: assignments,
          leader_of: [],
          school_phone: schoolPhone
        }]);
      }
    }
  }

  // 4. حفظ اسم المدرسة إن وُجد
  if (schoolName && schoolPhone) {
    await supabase.from('schools').upsert({
      phone: schoolPhone,
      name: schoolName
    }, { onConflict: 'phone' });
  }

  return { success: true };
}

