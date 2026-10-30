-- Las palabras de cada mundo (para las erratas) se llenan solas: con cada sección indexada y con cada página (su
-- título y sus propiedades)
CREATE FUNCTION crisol_section_words() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO search_words (world_id, word)
    SELECT NEW.world_id, w FROM crisol_words(coalesce(NEW.heading, '') || ' ' || NEW.body) w
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER search_sections_words AFTER INSERT ON search_sections
  FOR EACH ROW EXECUTE FUNCTION crisol_section_words();--> statement-breakpoint
CREATE FUNCTION crisol_page_words() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO search_words (world_id, word)
    SELECT NEW.world_id, w FROM crisol_words(crisol_page_text(NEW.title, NEW.properties)) w
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER pages_words AFTER INSERT OR UPDATE OF title, properties ON pages
  FOR EACH ROW EXECUTE FUNCTION crisol_page_words();--> statement-breakpoint
-- Las de las páginas que ya había
INSERT INTO search_words (world_id, word)
  SELECT p.world_id, w FROM pages p, crisol_words(crisol_page_text(p.title, p.properties)) w
  ON CONFLICT DO NOTHING;
