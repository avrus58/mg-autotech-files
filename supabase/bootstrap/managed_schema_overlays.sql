-- MG AutoTech application-owned overlays for Supabase-managed schemas
-- Source project ref: jujaeyvyaeesmipihrrw
-- Generated: 2026-07-16 (Europe/Berlin)
-- This file does not recreate auth or storage schemas, tables, functions, or managed triggers.

BEGIN;
SET LOCAL check_function_bodies = false;
SET LOCAL search_path = public, extensions;

-- Application auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- Application storage policies
DROP POLICY IF EXISTS "Admins can read all customer files" ON storage.objects;
CREATE POLICY "Admins can read all customer files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'customer-files'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

DROP POLICY IF EXISTS "Admins can update modified customer files" ON storage.objects;
CREATE POLICY "Admins can update modified customer files" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'customer-files'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

DROP POLICY IF EXISTS "Admins can upload modified customer files" ON storage.objects;
CREATE POLICY "Admins can upload modified customer files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'customer-files'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

DROP POLICY IF EXISTS "Customers can read own file expert objects" ON storage.objects;
CREATE POLICY "Customers can read own file expert objects" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'file-expert'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

DROP POLICY IF EXISTS "Customers can upload own file expert objects" ON storage.objects;
CREATE POLICY "Customers can upload own file expert objects" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'file-expert'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

DROP POLICY IF EXISTS "Staff can read customer files" ON storage.objects;
CREATE POLICY "Staff can read customer files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'customer-files'::text) AND has_staff_permission('files.download'::text)));

DROP POLICY IF EXISTS "Staff can read file expert objects" ON storage.objects;
CREATE POLICY "Staff can read file expert objects" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'file-expert'::text) AND has_staff_permission('file_expert.manage'::text)));

DROP POLICY IF EXISTS "Staff can upload customer files" ON storage.objects;
CREATE POLICY "Staff can upload customer files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'customer-files'::text) AND has_staff_permission('files.upload'::text)));

DROP POLICY IF EXISTS "Users can read own completed modified files" ON storage.objects;
CREATE POLICY "Users can read own completed modified files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'customer-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can read own customer files" ON storage.objects;
CREATE POLICY "Users can read own customer files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'customer-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can upload own customer files" ON storage.objects;
CREATE POLICY "Users can upload own customer files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'customer-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

COMMIT;
