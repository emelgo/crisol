-- La pantalla del máster (módulos 8 y 10 · campaña, decisión 24): la nota fijada, lo que enseña y las tablas elegidas
-- del cajón G, por campaña y escena, en el servidor (no en el navegador)
ALTER TABLE "scene_states" ADD COLUMN "gm_screen" jsonb;