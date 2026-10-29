-- Lo que devolvieron las acciones aprobadas se guarda cifrado desde ahora; lo guardado antes en claro (podía llevar un
-- enlace de invitación con su secreto) se borra: solo lo leía la herramienta que esperaba la aprobación
UPDATE "approvals" SET "result" = NULL WHERE "result" IS NOT NULL;
