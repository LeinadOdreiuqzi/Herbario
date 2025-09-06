-- Herbario DB Schema (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='plant_status_enum') THEN CREATE TYPE plant_status_enum AS ENUM ('pending','accepted','rejected'); END IF; END$$;

CREATE TABLE IF NOT EXISTS users(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL CHECK(length(password_hash)>0),
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS plants(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK(length(btrim(name))>0),
  scientific_name text,
  family text,
  description text,
  latitude double precision CHECK(latitude IS NULL OR (latitude>=-90 AND latitude<=90)),
  longitude double precision CHECK(longitude IS NULL OR (longitude>=-180 AND longitude<=180)),
  status plant_status_enum NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plant_images(
  plant_id uuid PRIMARY KEY REFERENCES plants(id) ON DELETE CASCADE,
  mime_type text NOT NULL CHECK(mime_type ~ '^[A-Za-z0-9._+-]+/[A-Za-z0-9._+-]+$'),
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plant_status_history(
  id bigserial PRIMARY KEY,
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  old_status plant_status_enum,
  new_status plant_status_enum NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plants_status_created_at ON plants(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plants_family_lower ON plants((lower(family)));
CREATE INDEX IF NOT EXISTS idx_plants_name_trgm ON plants USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_plants_scientific_trgm ON plants USING gin(scientific_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$BEGIN NEW.updated_at:=now(); RETURN NEW; END$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_plants_set_updated_at ON plants;
CREATE TRIGGER trg_plants_set_updated_at BEFORE UPDATE ON plants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION normalize_status_fields() RETURNS trigger AS $$BEGIN IF TG_OP='UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN IF NEW.status='accepted' THEN NEW.rejected_by:=NULL; NEW.rejection_reason:=NULL; ELSIF NEW.status='rejected' THEN NEW.accepted_by:=NULL; END IF; END IF; RETURN NEW; END$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_plants_normalize_status ON plants;
CREATE TRIGGER trg_plants_normalize_status BEFORE UPDATE OF status ON plants FOR EACH ROW EXECUTE FUNCTION normalize_status_fields();

CREATE OR REPLACE FUNCTION log_status_change() RETURNS trigger AS $$DECLARE actor uuid; reason_text text; BEGIN IF TG_OP='UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN actor:=COALESCE(NEW.accepted_by,NEW.rejected_by,NEW.submitted_by,NULL); IF NEW.status='rejected' THEN reason_text:=NEW.rejection_reason; ELSE reason_text:=NULL; END IF; INSERT INTO plant_status_history(plant_id,old_status,new_status,changed_by,reason,changed_at) VALUES(NEW.id,OLD.status,NEW.status,actor,reason_text,now()); END IF; RETURN NEW; END$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_plants_log_status ON plants;
CREATE TRIGGER trg_plants_log_status AFTER UPDATE OF status ON plants FOR EACH ROW WHEN(OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION log_status_change();

CREATE OR REPLACE FUNCTION log_initial_status() RETURNS trigger AS $$BEGIN INSERT INTO plant_status_history(plant_id,old_status,new_status,changed_by,reason,changed_at) VALUES(NEW.id,NULL,NEW.status,NEW.submitted_by,NULL,now()); RETURN NEW; END$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_plants_log_initial_status ON plants;
CREATE TRIGGER trg_plants_log_initial_status AFTER INSERT ON plants FOR EACH ROW EXECUTE FUNCTION log_initial_status();

CREATE OR REPLACE FUNCTION fn_create_submission(p_name text,p_scientific_name text DEFAULT NULL,p_family text DEFAULT NULL,p_description text DEFAULT NULL,p_latitude double precision DEFAULT NULL,p_longitude double precision DEFAULT NULL,p_submitted_by uuid DEFAULT NULL,p_image_mime text DEFAULT NULL,p_image_data bytea DEFAULT NULL) RETURNS uuid AS $$DECLARE v_plant_id uuid; BEGIN IF p_name IS NULL OR length(btrim(p_name))=0 THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF; IF p_latitude IS NOT NULL AND (p_latitude<-90 OR p_latitude>90) THEN RAISE EXCEPTION 'Latitud fuera de rango'; END IF; IF p_longitude IS NOT NULL AND (p_longitude<-180 OR p_longitude>180) THEN RAISE EXCEPTION 'Longitud fuera de rango'; END IF; INSERT INTO plants(name,scientific_name,family,description,latitude,longitude,status,submitted_by) VALUES(p_name,p_scientific_name,p_family,p_description,p_latitude,p_longitude,'pending',p_submitted_by) RETURNING id INTO v_plant_id; IF p_image_data IS NOT NULL THEN IF p_image_mime IS NULL OR p_image_mime !~ '^[A-Za-z0-9._+-]+/[A-Za-z0-9._+-]+$' THEN RAISE EXCEPTION 'mime inválido'; END IF; INSERT INTO plant_images(plant_id,mime_type,data) VALUES(v_plant_id,p_image_mime,p_image_data); END IF; RETURN v_plant_id; END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_accept_plant(p_plant_id uuid,p_admin_id uuid) RETURNS void AS $$BEGIN IF p_admin_id IS NULL THEN RAISE EXCEPTION 'Se requiere administrador'; END IF; UPDATE plants SET status='accepted',accepted_by=p_admin_id WHERE id=p_plant_id; IF NOT FOUND THEN RAISE EXCEPTION 'Planta no encontrada: %',p_plant_id; END IF; END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_reject_plant(p_plant_id uuid,p_admin_id uuid,p_reason text DEFAULT NULL) RETURNS void AS $$BEGIN IF p_admin_id IS NULL THEN RAISE EXCEPTION 'Se requiere administrador'; END IF; UPDATE plants SET status='rejected',rejected_by=p_admin_id,rejection_reason=p_reason WHERE id=p_plant_id; IF NOT FOUND THEN RAISE EXCEPTION 'Planta no encontrada: %',p_plant_id; END IF; END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_plant(p_plant_id uuid,p_name text DEFAULT NULL,p_scientific_name text DEFAULT NULL,p_family text DEFAULT NULL,p_description text DEFAULT NULL,p_latitude double precision DEFAULT NULL,p_longitude double precision DEFAULT NULL) RETURNS void AS $$BEGIN UPDATE plants SET name=COALESCE(p_name,name),scientific_name=COALESCE(p_scientific_name,scientific_name),family=COALESCE(p_family,family),description=COALESCE(p_description,description),latitude=COALESCE(p_latitude,latitude),longitude=COALESCE(p_longitude,longitude) WHERE id=p_plant_id; IF NOT FOUND THEN RAISE EXCEPTION 'Planta no encontrada: %',p_plant_id; END IF; END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_delete_plant(p_plant_id uuid) RETURNS void AS $$BEGIN DELETE FROM plants WHERE id=p_plant_id; IF NOT FOUND THEN RAISE EXCEPTION 'Planta no encontrada: %',p_plant_id; END IF; END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_upsert_image(p_plant_id uuid,p_mime text,p_data bytea) RETURNS void AS $$BEGIN IF p_mime IS NULL OR p_mime !~ '^[A-Za-z0-9._+-]+/[A-Za-z0-9._+-]+$' THEN RAISE EXCEPTION 'mime inválido'; END IF; IF p_data IS NULL THEN RAISE EXCEPTION 'imagen requerida'; END IF; INSERT INTO plant_images(plant_id,mime_type,data) VALUES(p_plant_id,p_mime,p_data) ON CONFLICT(plant_id) DO UPDATE SET mime_type=EXCLUDED.mime_type,data=EXCLUDED.data,created_at=now(); END$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_count_pending() RETURNS bigint STABLE LANGUAGE sql AS $$SELECT COUNT(*)::bigint FROM plants WHERE status='pending'::plant_status_enum$$;

CREATE OR REPLACE FUNCTION fn_list_plants(p_status plant_status_enum DEFAULT NULL,p_q text DEFAULT NULL,p_family text DEFAULT NULL,p_limit int DEFAULT 50,p_offset int DEFAULT 0)
RETURNS TABLE(id uuid,name text,scientific_name text,family text,description text,latitude double precision,longitude double precision,status plant_status_enum,created_at timestamptz,updated_at timestamptz) AS $$
BEGIN RETURN QUERY SELECT pl.id,pl.name,pl.scientific_name,pl.family,pl.description,pl.latitude,pl.longitude,pl.status,pl.created_at,pl.updated_at FROM plants pl WHERE (p_status IS NULL OR pl.status=p_status) AND (p_family IS NULL OR p_family='' OR lower(pl.family)=lower(p_family)) AND (p_q IS NULL OR p_q='' OR lower(pl.name) LIKE '%'||lower(p_q)||'%' OR lower(pl.scientific_name) LIKE '%'||lower(p_q)||'%') ORDER BY pl.created_at DESC LIMIT GREATEST(p_limit,0) OFFSET GREATEST(p_offset,0); END$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_count_plants(p_status plant_status_enum DEFAULT NULL,p_q text DEFAULT NULL,p_family text DEFAULT NULL) RETURNS bigint AS $$BEGIN RETURN (SELECT COUNT(*)::bigint FROM plants pl WHERE (p_status IS NULL OR pl.status=p_status) AND (p_family IS NULL OR p_family='' OR lower(pl.family)=lower(p_family)) AND (p_q IS NULL OR p_q='' OR lower(pl.name) LIKE '%'||lower(p_q)||'%' OR lower(pl.scientific_name) LIKE '%'||lower(p_q)||'%')); END$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE VIEW v_public_accepted_plants AS SELECT p.id,p.name,p.scientific_name,p.family,p.description,p.latitude,p.longitude,p.created_at,(pi.plant_id IS NOT NULL) AS has_image FROM plants p LEFT JOIN plant_images pi ON pi.plant_id=p.id WHERE p.status='accepted';

CREATE OR REPLACE VIEW v_pending_count AS SELECT COUNT(*)::bigint AS total_pending FROM plants WHERE status='pending';

CREATE OR REPLACE VIEW v_family_stats AS SELECT COALESCE(NULLIF(btrim(family),''),'(sin familia)') AS family,COUNT(*)::bigint AS total FROM plants WHERE status='accepted' GROUP BY COALESCE(NULLIF(btrim(family),''),'(sin familia)') ORDER BY total DESC;

CREATE OR REPLACE VIEW v_recent_submissions AS SELECT p.id,p.name,p.scientific_name,p.family,p.status,p.created_at,p.submitted_by FROM plants p ORDER BY p.created_at DESC LIMIT 50;