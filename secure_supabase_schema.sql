-- =========================================================================
-- secure_supabase_schema.sql
-- تفعيل أمان الصفوف (Row Level Security) وحماية البيانات بدون حذف أو تعديل أي سجل
-- =========================================================================

-- 1. تفعيل RLS على جميع الجداول
ALTER TABLE IF EXISTS schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;

-- 2. إزالة أي سياسات قديمة متعارضة
DROP POLICY IF EXISTS "Public select schools" ON schools;
DROP POLICY IF EXISTS "Public upsert schools" ON schools;
DROP POLICY IF EXISTS "Public delete schools" ON schools;

DROP POLICY IF EXISTS "Public select teachers" ON teachers;
DROP POLICY IF EXISTS "Public upsert teachers" ON teachers;
DROP POLICY IF EXISTS "Public delete teachers" ON teachers;

DROP POLICY IF EXISTS "Public select classes" ON classes;
DROP POLICY IF EXISTS "Public upsert classes" ON classes;
DROP POLICY IF EXISTS "Public delete classes" ON classes;

DROP POLICY IF EXISTS "Public select weekly_plans" ON weekly_plans;
DROP POLICY IF EXISTS "Public upsert weekly_plans" ON weekly_plans;
DROP POLICY IF EXISTS "Public delete weekly_plans" ON weekly_plans;

DROP POLICY IF EXISTS "Public select settings" ON settings;
DROP POLICY IF EXISTS "Public upsert settings" ON settings;

-- 3. سياسات جدول المدارس (schools)
CREATE POLICY "Public select schools" ON schools 
  FOR SELECT USING (true);

CREATE POLICY "Public upsert schools" ON schools 
  FOR ALL USING (phone IS NOT NULL AND length(phone) >= 4)
  WITH CHECK (phone IS NOT NULL AND length(phone) >= 4);

-- 4. سياسات جدول المعلمين (teachers)
CREATE POLICY "Public select teachers" ON teachers 
  FOR SELECT USING (true);

CREATE POLICY "Public upsert teachers" ON teachers 
  FOR ALL USING (school_phone IS NOT NULL AND length(school_phone) >= 4)
  WITH CHECK (school_phone IS NOT NULL AND length(school_phone) >= 4);

-- 5. سياسات جدول الفصول (classes)
CREATE POLICY "Public select classes" ON classes 
  FOR SELECT USING (true);

CREATE POLICY "Public upsert classes" ON classes 
  FOR ALL USING (school_phone IS NOT NULL AND length(school_phone) >= 4)
  WITH CHECK (school_phone IS NOT NULL AND length(school_phone) >= 4);

-- 6. سياسات جدول الخطط الأسبوعية (weekly_plans)
CREATE POLICY "Public select weekly_plans" ON weekly_plans 
  FOR SELECT USING (true);

CREATE POLICY "Public upsert weekly_plans" ON weekly_plans 
  FOR ALL USING (school_phone IS NOT NULL AND length(school_phone) >= 4)
  WITH CHECK (school_phone IS NOT NULL AND length(school_phone) >= 4);

-- 7. سياسات جدول الإعدادات العامة (settings)
CREATE POLICY "Public select settings" ON settings 
  FOR SELECT USING (true);

CREATE POLICY "Public upsert settings" ON settings 
  FOR ALL USING (true)
  WITH CHECK (true);
