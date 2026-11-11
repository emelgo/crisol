-- Las plantillas de serie dejan de existir (ADR-0024): las que use cada cuenta (en sus páginas, sus paneles o sus
-- plantillas) pasan a ser suyas, con las que esas nombran en sus tablas y enlaces, con los mismos ids de campo, su
-- panel y su esqueleto. Su id legible («pnj») se cambia por el nuevo en páginas, paneles, propiedades y linajes, así
-- las tablas que se llenan solas dan lo mismo antes y después. El contenido, el de BUILT_IN_TEMPLATES al quitarlas
CREATE FUNCTION crisol_remap_templates(j jsonb, ids jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE
  k text;
  v jsonb;
  result jsonb;
BEGIN
  IF jsonb_typeof(j) = 'object' THEN
    result := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(j) LOOP
      IF k = 'template' AND jsonb_typeof(v) = 'string' AND ids ? (v #>> '{}') THEN
        result := result || jsonb_build_object(k, ids -> (v #>> '{}'));
      ELSIF k = 'targets' AND jsonb_typeof(v) = 'array' THEN
        result := result || jsonb_build_object(k, (
          SELECT coalesce(jsonb_agg(CASE WHEN ids ? (e #>> '{}') THEN ids -> (e #>> '{}') ELSE e END ORDER BY n), '[]'::jsonb)
          FROM jsonb_array_elements(v) WITH ORDINALITY AS a(e, n)));
      ELSE
        result := result || jsonb_build_object(k, crisol_remap_templates(v, ids));
      END IF;
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(j) = 'array' THEN
    RETURN (SELECT coalesce(jsonb_agg(crisol_remap_templates(e, ids) ORDER BY n), '[]'::jsonb)
      FROM jsonb_array_elements(j) WITH ORDINALITY AS a(e, n));
  END IF;
  RETURN j;
END
$f$;
--> statement-breakpoint
-- Las plantillas que nombra un JSON (sus tablas, «template», y sus enlaces, «targets»): no cuenta un id de campo
CREATE FUNCTION crisol_template_refs(j jsonb) RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  WITH RECURSIVE nodes(v) AS (
    SELECT j
    UNION ALL
    SELECT c.value FROM nodes, LATERAL (
      SELECT value FROM jsonb_each(CASE WHEN jsonb_typeof(nodes.v) = 'object' THEN nodes.v ELSE '{}'::jsonb END)
      UNION ALL
      SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(nodes.v) = 'array' THEN nodes.v ELSE '[]'::jsonb END)
    ) AS c
  )
  SELECT coalesce(array_agg(DISTINCT r), '{}') FROM (
    SELECT v ->> 'template' AS r FROM nodes WHERE jsonb_typeof(v) = 'object' AND jsonb_typeof(v -> 'template') = 'string'
    UNION ALL
    SELECT jsonb_array_elements_text(v -> 'targets') FROM nodes
      WHERE jsonb_typeof(v) = 'object' AND jsonb_typeof(v -> 'targets') = 'array'
  ) AS refs
$f$;
--> statement-breakpoint
DO $d$
DECLARE
  data jsonb := $j$[{"id": "pnj", "name": "PNJ", "icon": "user", "fields": [{"name": "Especie", "field": "especie", "type": "text", "value": ""}, {"name": "Rol", "field": "rol", "type": "text", "value": ""}, {"name": "Facción", "field": "faccion", "type": "pages", "single": true, "targets": ["faccion"], "value": []}, {"name": "Lugar", "field": "lugar", "type": "pages", "single": true, "targets": ["lugar"], "value": []}, {"name": "Estado", "field": "estado", "type": "choice", "value": "", "options": ["Vive", "Ha muerto", "En paradero desconocido", "No se sabe"]}, {"name": "Padres", "field": "padres", "type": "pages", "targets": ["pnj"], "value": []}, {"name": "Pareja", "field": "pareja", "type": "pages", "targets": ["pnj"], "value": []}], "panel": [{"id": "retrato", "type": "image", "fileId": null, "caption": ""}, {"id": "llevaencima", "type": "related", "title": "Lleva encima", "template": "objeto", "field": "portador", "columns": ["tipo", "rareza"], "sort": "title"}], "skeleton": "## Quién es\n\n## Cómo interpretarlo\n\n## Ganchos\n", "needs": ["faccion", "lugar", "objeto", "pnj"]}, {"id": "lugar", "name": "Lugar", "icon": "castle", "fields": [{"name": "Tipo", "field": "tipo", "type": "choice", "value": "", "options": ["Plano", "Continente", "Región", "Reino", "Ciudad", "Pueblo", "Aldea", "Barrio", "Edificio", "Mazmorra", "Paraje"]}, {"name": "Dentro de", "field": "dentro-de", "type": "pages", "single": true, "targets": ["lugar"], "value": []}, {"name": "Población", "field": "poblacion", "type": "number", "value": null}, {"name": "Gobierna", "field": "gobierna", "type": "pages", "single": true, "targets": ["pnj"], "value": []}], "panel": [{"id": "imagen", "type": "image", "fileId": null, "caption": ""}, {"id": "lugaresdentro", "type": "related", "title": "Lugares dentro", "template": "lugar", "field": "dentro-de", "columns": ["tipo"], "sort": "title"}, {"id": "habitantes", "type": "related", "title": "Habitantes", "template": "pnj", "field": "lugar", "columns": ["rol", "estado"], "sort": "title"}], "skeleton": "## Descripción\n\n## Ganchos\n", "needs": ["faccion", "lugar", "objeto", "pnj"]}, {"id": "faccion", "name": "Facción", "icon": "shield", "fields": [{"name": "Tipo", "field": "tipo", "type": "choice", "value": "", "options": ["Reino", "Casa noble", "Gremio", "Orden", "Culto", "Compañía", "Banda", "Tribu"]}, {"name": "Líder", "field": "lider", "type": "pages", "single": true, "targets": ["pnj"], "value": []}, {"name": "Sede", "field": "sede", "type": "pages", "single": true, "targets": ["lugar"], "value": []}, {"name": "Objetivo", "field": "objetivo", "type": "text", "value": ""}], "panel": [{"id": "emblema", "type": "image", "fileId": null, "caption": ""}, {"id": "miembros", "type": "related", "title": "Miembros", "template": "pnj", "field": "faccion", "columns": ["rol", "estado"], "sort": "title"}], "skeleton": "## Quiénes son\n\n## Qué quieren\n\n## Ganchos\n", "needs": ["faccion", "lugar", "objeto", "pnj"]}, {"id": "objeto", "name": "Objeto", "icon": "gem", "fields": [{"name": "Tipo", "field": "tipo", "type": "choice", "value": "", "options": ["Arma", "Armadura", "Escudo", "Poción", "Pergamino", "Anillo", "Varita", "Vara", "Bastón", "Objeto maravilloso", "Munición", "Herramienta", "Equipo", "Tesoro"]}, {"name": "Rareza", "field": "rareza", "type": "choice", "value": "", "options": ["Común", "Poco común", "Raro", "Muy raro", "Legendario", "Artefacto"]}, {"name": "Sintonización", "field": "sintonizacion", "type": "boolean", "value": false}, {"name": "Valor", "field": "valor", "type": "text", "value": ""}, {"name": "Portador", "field": "portador", "type": "pages", "single": true, "targets": ["pnj"], "value": []}], "panel": [{"id": "imagen", "type": "image", "fileId": null, "caption": ""}], "skeleton": "## Descripción\n\n## Historia\n", "needs": ["faccion", "lugar", "objeto", "pnj"]}, {"id": "mision", "name": "Misión", "icon": "scroll", "fields": [{"name": "Estado", "field": "estado", "type": "choice", "value": "", "options": ["Pendiente", "En curso", "Completada", "Fallida"]}, {"name": "La da", "field": "la-da", "type": "pages", "single": true, "targets": ["pnj", "faccion"], "value": []}, {"name": "Lugar", "field": "lugar", "type": "pages", "single": true, "targets": ["lugar"], "value": []}, {"name": "Recompensa", "field": "recompensa", "type": "text", "value": ""}], "panel": [], "skeleton": "## Objetivos\n\n- [ ] Primer objetivo\n\n## Qué pasa\n", "needs": ["faccion", "lugar", "mision", "objeto", "pnj"]}, {"id": "sesion", "name": "Sesión", "icon": "calendar", "fields": [{"name": "Número", "field": "numero", "type": "number", "value": null}, {"name": "Fecha", "field": "fecha", "type": "text", "value": ""}, {"name": "Aparecen", "field": "aparecen", "type": "pages", "targets": ["pnj"], "value": []}], "panel": [], "skeleton": "## Resumen\n\n## Qué pasó\n\n## Pendiente\n", "needs": ["faccion", "lugar", "objeto", "pnj", "sesion"]}]$j$::jsonb;
  builtins text[] := ARRAY['pnj','lugar','faccion','objeto','mision','sesion'];
  org record;
  used text[];
  wanted text[];
  ids jsonb;
  t jsonb;
  owner text;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    -- Las de serie que usa la cuenta
    SELECT array_agg(b) INTO used FROM unnest(builtins) AS b WHERE
      EXISTS (
        SELECT 1 FROM pages p JOIN worlds w ON w.id = p.world_id
        WHERE w.organization_id = org.id AND (
          p.template = b OR b = ANY(p.template_line)
          OR b = ANY(crisol_template_refs(p.panel)) OR b = ANY(crisol_template_refs(p.properties))))
      OR EXISTS (
        SELECT 1 FROM page_templates pt
        WHERE pt.organization_id = org.id AND (
          pt.based_on = b OR b = ANY(pt.line)
          OR b = ANY(crisol_template_refs(pt.panel)) OR b = ANY(crisol_template_refs(pt.fields))));
    IF used IS NULL THEN
      CONTINUE;
    END IF;
    -- Con las que esas nombran
    SELECT array_agg(DISTINCT n) INTO wanted
      FROM jsonb_array_elements(data) AS e(t), jsonb_array_elements_text(e.t -> 'needs') AS n
      WHERE e.t ->> 'id' = ANY(used);
    SELECT m.user_id INTO owner FROM organization_members m
      WHERE m.organization_id = org.id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1;
    ids := '{}'::jsonb;
    FOR t IN SELECT e.t FROM jsonb_array_elements(data) AS e(t) WHERE e.t ->> 'id' = ANY(wanted) LOOP
      ids := ids || jsonb_build_object(t ->> 'id', gen_random_uuid()::text);
    END LOOP;
    FOR t IN SELECT e.t FROM jsonb_array_elements(data) AS e(t) WHERE e.t ->> 'id' = ANY(wanted) LOOP
      INSERT INTO page_templates (id, organization_id, name, icon, based_on, line, fields, panel, skeleton, created_by, updated_by)
      VALUES (
        (ids ->> (t ->> 'id'))::uuid, org.id, t ->> 'name', t ->> 'icon', NULL, ARRAY[ids ->> (t ->> 'id')],
        crisol_remap_templates(t -> 'fields', ids), crisol_remap_templates(t -> 'panel', ids), t ->> 'skeleton',
        owner, owner);
    END LOOP;
    -- Lo que las nombraba, con su id nuevo
    UPDATE pages p SET
      template = coalesce(ids ->> p.template, p.template),
      template_line = ARRAY(SELECT coalesce(ids ->> l, l) FROM unnest(p.template_line) WITH ORDINALITY AS u(l, n) ORDER BY n),
      panel = crisol_remap_templates(p.panel, ids),
      properties = crisol_remap_templates(p.properties, ids)
    FROM worlds w
    WHERE w.id = p.world_id AND w.organization_id = org.id AND (
      p.template = ANY(wanted) OR p.template_line && wanted
      OR crisol_template_refs(p.panel) && wanted OR crisol_template_refs(p.properties) && wanted);
    UPDATE page_templates pt SET
      based_on = coalesce(ids ->> pt.based_on, pt.based_on),
      line = ARRAY(SELECT coalesce(ids ->> l, l) FROM unnest(pt.line) WITH ORDINALITY AS u(l, n) ORDER BY n),
      fields = crisol_remap_templates(pt.fields, ids),
      panel = crisol_remap_templates(pt.panel, ids)
    WHERE pt.organization_id = org.id;
  END LOOP;
END
$d$;
--> statement-breakpoint
DROP FUNCTION crisol_remap_templates(jsonb, jsonb);
--> statement-breakpoint
DROP FUNCTION crisol_template_refs(jsonb);
