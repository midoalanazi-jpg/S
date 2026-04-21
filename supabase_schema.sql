-- مسح الجداول القديمة إذا كانت موجودة (للبدء من جديد)
DROP TABLE IF EXISTS weekly_plans, classes, teachers, settings CASCADE;

-- 1. جدول المعلمين (Teachers) مع دعم إسناد المواد
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  assignments JSONB DEFAULT '{}'::jsonb, -- لتخزين { classId: [subjects] }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. جدول الفصول (Classes) مع دعم جدول الحصص
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  schedule JSONB DEFAULT '{}'::jsonb, -- لتخزين { day_period: subject }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. جدول التحضيرات الأسبوعية (Weekly Plans)
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  week_data JSONB NOT NULL, -- لتخزين محتوى التحضير (العنوان، الأهداف، الواجب)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(teacher_id, class_id)
);

-- 4. إعدادات النظام العامة
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- بذور بيانات أولية للبدء
INSERT INTO settings (key, value) VALUES 
('current_semester', 'الثاني'),
('current_year', '1447 هـ');
