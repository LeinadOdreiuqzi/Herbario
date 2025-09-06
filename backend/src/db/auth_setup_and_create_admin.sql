-- Herbario - Configuración de autenticación y alta segura de usuarios (Opción B adaptada)
-- Objetivo:
--  - Crear un rol lógico (sin login) para gestionar privilegios sobre public.users
--  - Encapsular el hash de contraseñas en una función SECURITY DEFINER
--  - Conceder únicamente EXECUTE a la función para el rol de conexión de la app (aquí DB_USER=postgres)
--  - Crear un usuario administrador inicial con contraseña hasheada
--
-- Requisitos previos:
--  - Base de datos: herbario (DB_NAME=herbario)
--  - Rol de conexión: postgres (DB_USER=postgres)
--  - La tabla public.users ya debe existir (según schema.sql)
--
-- Mejores prácticas:
--  - Nunca almacenar contraseñas en texto plano; se usa bcrypt vía pgcrypto: crypt(..., gen_salt('bf', 12))
--  - Mantener el acceso a public.users restringido; exponer lectura sólo vía vistas seguras si es necesario

BEGIN;

-- 0) Asegurar extensiones necesarias (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- bcrypt/crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS citext;    -- emails case-insensitive

-- 1) (Opcional recomendado) Esquema dedicado para funciones de autenticación
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION postgres;

-- 2) Crear rol lógico (sin login) para permisos sobre public.users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'herbario_auth') THEN
    CREATE ROLE herbario_auth NOLOGIN;
  END IF;
END$$;

-- 3) Permisos mínimos sobre public.users para el rol lógico
--    No exponer password_hash vía SELECT masivo a otros roles.
REVOKE ALL ON TABLE public.users FROM PUBLIC;
GRANT INSERT,
       UPDATE(email, password_hash, last_login_at),
       SELECT(id, email, is_admin, created_at, last_login_at)
  ON public.users TO herbario_auth;

-- 4) Función segura para crear usuarios con hash de contraseña (bcrypt, cost=12)
CREATE OR REPLACE FUNCTION auth.create_user(
  p_email citext,
  p_plain_password text,
  p_is_admin boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validaciones básicas
  IF p_email IS NULL OR length(btrim(p_email::text)) = 0 THEN
    RAISE EXCEPTION 'email requerido';
  END IF;
  IF p_plain_password IS NULL OR length(p_plain_password) < 10 THEN
    RAISE EXCEPTION 'la contraseña debe tener al menos 10 caracteres';
  END IF;

  -- Inserción con hash seguro (bcrypt, cost=12)
  INSERT INTO public.users(email, password_hash, is_admin)
  VALUES (
    lower(p_email),
    crypt(p_plain_password, gen_salt('bf', 12)),
    COALESCE(p_is_admin, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'el email % ya existe', p_email;
END
$$;

-- Asegurar propietario de la función (para que SECURITY DEFINER tenga efecto con los permisos correctos)
ALTER FUNCTION auth.create_user(citext, text, boolean) OWNER TO postgres;

-- 5) Conceder EXECUTE sobre la función al rol de conexión de la app (DB_USER=postgres)
GRANT EXECUTE ON FUNCTION auth.create_user(citext, text, boolean) TO postgres;

-- 6) (Opcional) Vista segura sin password_hash para lecturas desde la app
CREATE OR REPLACE VIEW public.v_users_safe AS
SELECT id, email, is_admin, created_at, last_login_at
FROM public.users;

GRANT SELECT ON public.v_users_safe TO postgres;

-- Permisos adicionales para verificación de contraseña con crypt()
GRANT SELECT(password_hash) ON public.users TO herbario_auth;
-- Permisos para la cuenta de la aplicación (lectura de columnas y actualización de last_login_at)
-- 1b) Crear/actualizar rol de aplicación con LOGIN y contraseña conocida (solo desarrollo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'herbario_app') THEN
    CREATE ROLE herbario_app LOGIN PASSWORD '7^*aYLlvfckJ<3>dF4Ot';
  ELSE
    ALTER ROLE herbario_app WITH LOGIN PASSWORD '7^*aYLlvfckJ<3>dF4Ot';
  END IF;
END$$;

-- Permitir conexión a la BD y uso de esquema público
GRANT CONNECT ON DATABASE herbario TO herbario_app;
GRANT USAGE ON SCHEMA public TO herbario_app;

-- Asignar el rol lógico a la cuenta de la aplicación si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'herbario_app') THEN
    GRANT herbario_auth TO herbario_app;
  END IF;
END$$;

COMMIT;

-- 7) [REMOVIDO] No crear usuarios por defecto desde script. Usa registros existentes en la base de datos.
--    Limpieza preventiva: eliminar usuario de ejemplo si quedó de ejecuciones previas.
DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE email::text = 'admin@herbario.local') THEN
    DELETE FROM public.users WHERE email::text = 'admin@herbario.local';
    RAISE NOTICE 'Usuario demo admin@herbario.local eliminado por seguridad.';
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- Ignorar si la tabla no existe aún en ciertos entornos
  NULL;
END
$cleanup$;

-- Notas de seguridad:
--  - Usa contraseñas largas (>14) y únicas. Considera un cost mayor si tu servidor lo soporta (gen_salt('bf', 12+)).
--  - Limita el acceso directo a public.users. Prefiere funciones/vistas específicas.
--  - Si en el futuro usas un rol de aplicación distinto (p. ej., herbario_app), sustituye el GRANT EXECUTE a dicho rol y evita que la app use el superusuario postgres.