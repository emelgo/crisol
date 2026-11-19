-- Cada evento y cada grupo, de una cronología, como en Everlore (ADR-0032, enmienda la decisión 2 del ADR-0031): ya no
-- salen todos los eventos del mundo en todas las cronologías. Los que había van a una sola, sin copiarse: la primera (por
-- fecha de creación) que lo pedía en su filtro de grupos; si no, la primera que los juntaba todos; si no, la primera del
-- mundo (y, en un mundo con eventos y sin cronologías, una página «Cronología» nueva, oculta como lo estaban ellos, al
-- final del primer nivel). Cada grupo se queda en la primera cronología que lo usa (por sus eventos o por su filtro) y,
-- si lo usaban más, cada una se lleva una copia con sus eventos; los que no usaba nadie, a la primera del mundo. El
-- filtro pierde los grupos y, si no se había acotado por plantillas ni etiquetas, deja de juntar las páginas con fecha
-- (lo que hacía que todas se vieran iguales)
ALTER TABLE "timeline_events" ADD COLUMN "chronology_id" uuid;--> statement-breakpoint
ALTER TABLE "timeline_groups" ADD COLUMN "chronology_id" uuid;--> statement-breakpoint
DO $$
DECLARE
  w record;
  gr record;
  target uuid;
  first_chronology uuid;
  last_key text;
  new_page uuid;
  new_tab uuid;
  copy uuid;
BEGIN
  FOR w IN
    SELECT DISTINCT x.world_id FROM (SELECT world_id FROM timeline_events UNION SELECT world_id FROM timeline_groups) x
    WHERE NOT EXISTS (SELECT 1 FROM chronologies c WHERE c.world_id = x.world_id)
  LOOP
    -- La clave tras la última del primer nivel: la misma con un dígito más (una fracción que no acaba en cero)
    SELECT max(p.position COLLATE "C") INTO last_key FROM pages p WHERE p.world_id = w.world_id AND p.parent_id IS NULL;
    new_page := gen_random_uuid();
    new_tab := gen_random_uuid();
    INSERT INTO pages (id, world_id, parent_id, position, title)
    VALUES (new_page, w.world_id, NULL, coalesce(last_key, 'a0') || 'V', 'Cronología');
    INSERT INTO page_tabs (id, world_id, page_id, kind, name, position)
    VALUES (new_tab, w.world_id, new_page, 'chronology', 'Cronología', 'a0');
    INSERT INTO chronologies (world_id, tab_id, calendar_id, filter)
    VALUES (w.world_id, new_tab, NULL, '{"pages": false, "templates": [], "tags": []}'::jsonb);
    INSERT INTO knowledge (world_id, campaign_id, kind, target_id, known, characters)
    VALUES (w.world_id, NULL, 'page', new_page::text, false, NULL);
  END LOOP;

  UPDATE timeline_events e SET chronology_id = coalesce(
    (SELECT c.id FROM chronologies c
      WHERE c.world_id = e.world_id AND e.group_id IS NOT NULL AND coalesce(c.filter->'groups', '[]'::jsonb) ? e.group_id::text
      ORDER BY c.created_at, c.id LIMIT 1),
    (SELECT c.id FROM chronologies c
      WHERE c.world_id = e.world_id AND jsonb_array_length(coalesce(c.filter->'groups', '[]'::jsonb)) = 0
      ORDER BY c.created_at, c.id LIMIT 1),
    (SELECT c.id FROM chronologies c WHERE c.world_id = e.world_id ORDER BY c.created_at, c.id LIMIT 1));

  FOR gr IN SELECT * FROM timeline_groups LOOP
    first_chronology := NULL;
    FOR target IN
      SELECT c.id FROM chronologies c
      WHERE c.world_id = gr.world_id AND (
        EXISTS (SELECT 1 FROM timeline_events e WHERE e.group_id = gr.id AND e.chronology_id = c.id)
        OR coalesce(c.filter->'groups', '[]'::jsonb) ? gr.id::text)
      ORDER BY c.created_at, c.id
    LOOP
      IF first_chronology IS NULL THEN
        first_chronology := target;
        UPDATE timeline_groups SET chronology_id = target WHERE id = gr.id;
      ELSE
        copy := gen_random_uuid();
        INSERT INTO timeline_groups (id, world_id, chronology_id, name, color, position, created_by, updated_by)
        VALUES (copy, gr.world_id, target, gr.name, gr.color, gr.position, gr.created_by, gr.updated_by);
        UPDATE timeline_events SET group_id = copy WHERE group_id = gr.id AND chronology_id = target;
      END IF;
    END LOOP;
    IF first_chronology IS NULL THEN
      UPDATE timeline_groups SET chronology_id =
        (SELECT c.id FROM chronologies c WHERE c.world_id = gr.world_id ORDER BY c.created_at, c.id LIMIT 1)
      WHERE id = gr.id;
    END IF;
  END LOOP;

  UPDATE chronologies SET filter = (filter - 'groups') ||
    CASE WHEN jsonb_array_length(coalesce(filter->'templates', '[]'::jsonb)) = 0
      AND jsonb_array_length(coalesce(filter->'tags', '[]'::jsonb)) = 0
    THEN '{"pages": false}'::jsonb ELSE '{}'::jsonb END;
END $$;--> statement-breakpoint
ALTER TABLE "timeline_events" ALTER COLUMN "chronology_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "timeline_groups" ALTER COLUMN "chronology_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_chronology_id_chronologies_id_fk" FOREIGN KEY ("chronology_id") REFERENCES "public"."chronologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_groups" ADD CONSTRAINT "timeline_groups_chronology_id_chronologies_id_fk" FOREIGN KEY ("chronology_id") REFERENCES "public"."chronologies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_events_chronology_id_index" ON "timeline_events" USING btree ("chronology_id");--> statement-breakpoint
CREATE INDEX "timeline_groups_chronology_id_index" ON "timeline_groups" USING btree ("chronology_id");
