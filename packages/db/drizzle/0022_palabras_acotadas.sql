-- Las palabras para las erratas, de 3 a 64 letras: una más larga no es una palabra (y levenshtein no pasa de 255)
CREATE OR REPLACE FUNCTION crisol_words(text) RETURNS SETOF text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT DISTINCT w FROM regexp_split_to_table(lower(crisol_unaccent($1)), '[^a-z0-9]+') w WHERE length(w) BETWEEN 3 AND 64 $$;--> statement-breakpoint
DELETE FROM search_words WHERE length(word) > 64;
