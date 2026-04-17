-- ============================================================================
-- REPARO COMPLETO: profiles + funções/trigger de auth
-- Uso: rodar manualmente no SQL Editor quando a migration schema_v1 falhar
-- por causa de estrutura parcial em public.profiles.
-- ============================================================================

-- 1) Garante tabela base de profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY
);

-- 2) Garante colunas esperadas pela migration/schema atual
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consultant_id VARCHAR(32);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id VARCHAR(32);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ;

-- Defaults/not null seguros
UPDATE public.profiles
SET user_type = 'admin'
WHERE user_type IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN user_type SET DEFAULT 'admin';

ALTER TABLE public.profiles
  ALTER COLUMN user_type SET NOT NULL;

UPDATE public.profiles
SET created_date = NOW()
WHERE created_date IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN created_date SET DEFAULT NOW();

ALTER TABLE public.profiles
  ALTER COLUMN created_date SET NOT NULL;

-- Se existir coluna obrigatória extra (ex.: business_name), preenche valores mínimos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'business_name'
  ) THEN
    EXECUTE $sql$
      UPDATE public.profiles
      SET business_name = COALESCE(
        NULLIF(TRIM(business_name), ''),
        NULLIF(TRIM(full_name), ''),
        NULLIF(TRIM(email), ''),
        'Conta sem nome'
      )
      WHERE business_name IS NULL OR TRIM(business_name) = ''
    $sql$;
  END IF;
END $$;

-- 3) Índices auxiliares
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_consultant_id_idx ON public.profiles(consultant_id);
CREATE INDEX IF NOT EXISTS profiles_client_id_idx ON public.profiles(client_id);

-- 4) FKs (adiciona somente se ainda não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Não foi possível criar FK profiles.id -> auth.users.id: %', SQLERRM;
    END;
  END IF;

  IF to_regclass('public.consultant') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'profiles_consultant_id_fkey'
         AND conrelid = 'public.profiles'::regclass
     )
  THEN
    BEGIN
      ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_consultant_id_fkey
      FOREIGN KEY (consultant_id) REFERENCES public.consultant(id);
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Não foi possível criar FK profiles.consultant_id -> consultant.id: %', SQLERRM;
    END;
  END IF;

  IF to_regclass('public.client') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'profiles_client_id_fkey'
         AND conrelid = 'public.profiles'::regclass
     )
  THEN
    BEGIN
      ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.client(id);
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Não foi possível criar FK profiles.client_id -> client.id: %', SQLERRM;
    END;
  END IF;
END $$;

-- 5) Funções auxiliares usadas nas políticas
CREATE OR REPLACE FUNCTION public.current_user_type()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT p.user_type FROM public.profiles p WHERE p.id = auth.uid()), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS VARCHAR(32)
LANGUAGE sql
STABLE
AS $$
  SELECT p.client_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_consultant_id()
RETURNS VARCHAR(32)
LANGUAGE sql
STABLE
AS $$
  SELECT p.consultant_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- 6) Trigger de provisionamento de profile no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  cl RECORD;
  has_business_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'business_name'
  ) INTO has_business_name;

  IF to_regclass('public.consultant') IS NOT NULL THEN
    SELECT id, name
      INTO c
    FROM public.consultant
    WHERE email = NEW.email
    LIMIT 1;
  END IF;

  IF to_regclass('public.client') IS NOT NULL THEN
    SELECT id, company_name
      INTO cl
    FROM public.client
    WHERE email = NEW.email
    LIMIT 1;
  END IF;

  IF has_business_name THEN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      business_name,
      user_type,
      consultant_id,
      client_id,
      created_date
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(c.name, cl.company_name, NEW.email),
      COALESCE(cl.company_name, c.name, NEW.email, 'Conta sem nome'),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE 'admin'
      END,
      c.id,
      cl.id,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, created_date)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(c.name, cl.company_name, NEW.email),
      CASE
        WHEN c.id IS NOT NULL THEN 'consultant'
        WHEN cl.id IS NOT NULL THEN 'client'
        ELSE 'admin'
      END,
      c.id,
      cl.id,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- 7) Reconciliar usuários já existentes no auth.users
DO $$
DECLARE
  has_business_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'business_name'
  ) INTO has_business_name;

  IF to_regclass('public.consultant') IS NOT NULL AND to_regclass('public.client') IS NOT NULL THEN
    IF has_business_name THEN
      INSERT INTO public.profiles (
        id, email, full_name, business_name, user_type, consultant_id, client_id, created_date
      )
      SELECT
        u.id,
        u.email,
        COALESCE(c.name, cl.company_name, u.email),
        COALESCE(cl.company_name, c.name, u.email, 'Conta sem nome'),
        CASE
          WHEN c.id IS NOT NULL THEN 'consultant'
          WHEN cl.id IS NOT NULL THEN 'client'
          ELSE 'admin'
        END,
        c.id,
        cl.id,
        NOW()
      FROM auth.users u
      LEFT JOIN public.consultant c ON c.email = u.email
      LEFT JOIN public.client cl ON cl.email = u.email
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, created_date)
      SELECT
        u.id,
        u.email,
        COALESCE(c.name, cl.company_name, u.email),
        CASE
          WHEN c.id IS NOT NULL THEN 'consultant'
          WHEN cl.id IS NOT NULL THEN 'client'
          ELSE 'admin'
        END,
        c.id,
        cl.id,
        NOW()
      FROM auth.users u
      LEFT JOIN public.consultant c ON c.email = u.email
      LEFT JOIN public.client cl ON cl.email = u.email
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSIF to_regclass('public.consultant') IS NOT NULL THEN
    IF has_business_name THEN
      INSERT INTO public.profiles (
        id, email, full_name, business_name, user_type, consultant_id, client_id, created_date
      )
      SELECT
        u.id,
        u.email,
        COALESCE(c.name, u.email),
        COALESCE(c.name, u.email, 'Conta sem nome'),
        CASE WHEN c.id IS NOT NULL THEN 'consultant' ELSE 'admin' END,
        c.id,
        NULL,
        NOW()
      FROM auth.users u
      LEFT JOIN public.consultant c ON c.email = u.email
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, created_date)
      SELECT
        u.id,
        u.email,
        COALESCE(c.name, u.email),
        CASE WHEN c.id IS NOT NULL THEN 'consultant' ELSE 'admin' END,
        c.id,
        NULL,
        NOW()
      FROM auth.users u
      LEFT JOIN public.consultant c ON c.email = u.email
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSIF to_regclass('public.client') IS NOT NULL THEN
    IF has_business_name THEN
      INSERT INTO public.profiles (
        id, email, full_name, business_name, user_type, consultant_id, client_id, created_date
      )
      SELECT
        u.id,
        u.email,
        COALESCE(cl.company_name, u.email),
        COALESCE(cl.company_name, u.email, 'Conta sem nome'),
        CASE WHEN cl.id IS NOT NULL THEN 'client' ELSE 'admin' END,
        NULL,
        cl.id,
        NOW()
      FROM auth.users u
      LEFT JOIN public.client cl ON cl.email = u.email
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, created_date)
      SELECT
        u.id,
        u.email,
        COALESCE(cl.company_name, u.email),
        CASE WHEN cl.id IS NOT NULL THEN 'client' ELSE 'admin' END,
        NULL,
        cl.id,
        NOW()
      FROM auth.users u
      LEFT JOIN public.client cl ON cl.email = u.email
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSE
    IF has_business_name THEN
      INSERT INTO public.profiles (
        id, email, full_name, business_name, user_type, consultant_id, client_id, created_date
      )
      SELECT
        u.id,
        u.email,
        u.email,
        COALESCE(u.email, 'Conta sem nome'),
        'admin',
        NULL,
        NULL,
        NOW()
      FROM auth.users u
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, email, full_name, user_type, consultant_id, client_id, created_date)
      SELECT
        u.id,
        u.email,
        u.email,
        'admin',
        NULL,
        NULL,
        NOW()
      FROM auth.users u
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 8) Mantém RLS ativa na profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
