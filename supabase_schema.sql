-- جدول المعلمين (Teachers)
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- جدول الفصول (Classes)
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- جدول الخطط الأسبوعية (Weekly Plans)
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  data JSONB NOT NULL, -- سيتم تخزين بيانات الحصص هنا ككائن JSON
  is_submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- بذور البيانات (Seed Data)
-- يمكنك إضافة 18 معلماً و 8 فصول هنا كبداية
INSERT INTO teachers (name) VALUES 
('معلم 1'), ('معلم 2'), ('معلم 3'), ('معلم 4'), ('معلم 5'), ('معلم 6'), 
('معلم 7'), ('معلم 8'), ('معلم 9'), ('معلم 10'), ('معلم 11'), ('معلم 12'), 
('معلم 13'), ('معلم 14'), ('معلم 15'), ('معلم 16'), ('معلم 17'), ('معلم 18');

INSERT INTO classes (name) VALUES 
('فصل 1'), ('فصل 2'), ('فصل 3'), ('فصل 4'), 
('فصل 5'), ('فصل 6'), ('فصل 7'), ('فصل 8');
