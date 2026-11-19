-- Las cronologías pasan a ser una pestaña de página, como en LegendKeeper (ADR-0031, enmienda la decisión 4 del
-- ADR-0029): cada una lleva su pestaña (tab_id, única, y se va con ella, como un mapa). Las que ya había pasan a una
-- página nueva al final del primer nivel de su mundo, con su nombre, y una pestaña «Cronología». Lo que sabía cada
-- campaña de ella (su marca chronology) pasa a la página nueva; sin ninguna marca, la página nace oculta, como la
-- cronología, que sin marca no la veía nadie. Los page_tabs.kind chronology y tree no necesitan nada en la base (la
-- columna no lleva restricción)
ALTER TABLE "chronologies" ADD COLUMN "tab_id" uuid;--> statement-breakpoint
DO $$
DECLARE
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  item record;
  last_key text;
  new_page uuid;
  new_tab uuid;
BEGIN
  FOR item IN
    SELECT c.id, c.world_id, c.name, c.created_by,
      row_number() OVER (PARTITION BY c.world_id ORDER BY c.position COLLATE "C", c.id) AS n
    FROM chronologies c
    ORDER BY c.world_id, n
  LOOP
    -- La clave tras la última del primer nivel: la misma con un dígito más (una fracción que no acaba en cero)
    SELECT max(p.position COLLATE "C") INTO last_key FROM pages p WHERE p.world_id = item.world_id AND p.parent_id IS NULL;
    new_page := gen_random_uuid();
    new_tab := gen_random_uuid();
    INSERT INTO pages (id, world_id, parent_id, position, title, created_by, updated_by)
    VALUES (new_page, item.world_id, NULL, coalesce(last_key, 'a0') || substr(digits, 2 + (item.n::int - 1) % 60, 1),
      item.name, item.created_by, item.created_by);
    INSERT INTO page_tabs (id, world_id, page_id, kind, name, position, created_by, updated_by)
    VALUES (new_tab, item.world_id, new_page, 'chronology', 'Cronología', 'a0', item.created_by, item.created_by);
    UPDATE chronologies SET tab_id = new_tab WHERE id = item.id;
    -- Lo que sabían las campañas de la cronología, ahora de su página
    INSERT INTO knowledge (world_id, campaign_id, kind, target_id, known, characters)
    SELECT k.world_id, k.campaign_id, 'page', new_page::text, k.known, k.characters
    FROM knowledge k WHERE k.kind = 'chronology' AND k.target_id = item.id::text;
    IF NOT FOUND THEN
      INSERT INTO knowledge (world_id, campaign_id, kind, target_id, known, characters)
      VALUES (item.world_id, NULL, 'page', new_page::text, false, NULL);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
DELETE FROM "knowledge_news" WHERE "kind" = 'chronology';--> statement-breakpoint
DELETE FROM "knowledge" WHERE "kind" = 'chronology';--> statement-breakpoint
ALTER TABLE "chronologies" ALTER COLUMN "tab_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chronologies" ADD CONSTRAINT "chronologies_tab_id_page_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."page_tabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chronologies" ADD CONSTRAINT "chronologies_tabId_unique" UNIQUE("tab_id");
