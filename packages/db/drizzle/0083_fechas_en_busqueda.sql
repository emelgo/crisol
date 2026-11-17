-- Las propiedades «Fecha» (módulo 8, docs/specs/fechas.md): en la búsqueda entra cómo se leen («18 de Siega de
-- 1250 RC», sin lo solo del máster; lo pone el servidor), no su valor (un objeto con el calendario y los ids de los
-- meses, que llenaría las palabras de ruido). No hay páginas con fechas de antes: nada que recalcular
CREATE OR REPLACE FUNCTION crisol_page_text(title text, properties jsonb) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT title || ' ' || coalesce((
    SELECT string_agg(CASE
      WHEN p->>'type' = 'date' THEN p->>'text'
      WHEN jsonb_typeof(p->'value') = 'array' THEN (SELECT string_agg(v, ' ') FROM jsonb_array_elements_text(p->'value') v)
      ELSE p->>'value' END, ' ')
    FROM jsonb_array_elements(properties) p WHERE p->>'type' IS DISTINCT FROM 'pages'), '') $$;
