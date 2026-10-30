-- La búsqueda en español (ADR-0003): sin tildes, por la raíz de cada palabra y con erratas. Las tres extensiones son
-- «trusted»: las crea el dueño de la base
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;--> statement-breakpoint
-- El español de siempre, pero sin tildes antes de sacar la raíz: «dragón» y «dragon» son lo mismo
CREATE TEXT SEARCH CONFIGURATION es_unaccent (COPY = pg_catalog.spanish);--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION es_unaccent ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;--> statement-breakpoint
-- unaccent no es inmutable (depende del diccionario que se busque): esta sí, para los índices
CREATE FUNCTION crisol_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint
-- Lo que se busca de una página además de su texto: el título y los valores de sus propiedades (no las que enlazan
-- páginas: son ids)
CREATE FUNCTION crisol_page_text(title text, properties jsonb) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT title || ' ' || coalesce((
    SELECT string_agg(CASE jsonb_typeof(p->'value')
      WHEN 'array' THEN (SELECT string_agg(v, ' ') FROM jsonb_array_elements_text(p->'value') v)
      ELSE p->>'value' END, ' ')
    FROM jsonb_array_elements(properties) p WHERE p->>'type' IS DISTINCT FROM 'pages'), '') $$;--> statement-breakpoint
-- Las palabras de un texto, sin tildes ni mayúsculas, de 3 letras o más (para las erratas)
CREATE FUNCTION crisol_words(text) RETURNS SETOF text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT DISTINCT w FROM regexp_split_to_table(lower(crisol_unaccent($1)), '[^a-z0-9]+') w WHERE length(w) >= 3 $$;
