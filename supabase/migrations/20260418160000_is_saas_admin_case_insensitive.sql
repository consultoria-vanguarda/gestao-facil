-- is_saas_admin() deve reconhecer user_type independentemente de maiúsculas.

CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT lower(trim(COALESCE(p.user_type::text, ''))) = 'saas_admin'
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;
