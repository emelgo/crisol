/** Límites entre módulos (CONSTRAINTS.md). Analiza con SWC: TypeScript 7 ya no trae API de JavaScript */
module.exports = {
  forbidden: [
    {
      name: 'sala-limpia',
      comment: 'El código no importa nada de research/',
      severity: 'error',
      from: { path: '^(apps|packages|scripts)/' },
      to: { path: '^research/' }
    },
    {
      name: 'cliente-sin-servidor',
      comment: 'La web no importa el servidor: se hablan por los contratos',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/server/' }
    },
    {
      name: 'dominio-sin-frameworks',
      comment:
        'El dominio, los contratos, el esquema del editor, los dados y los sistemas no dependen de React ni de Fastify',
      severity: 'error',
      from: { path: '^packages/(domain|contracts|editor|dice|systems)/' },
      to: { path: 'node_modules/(react|react-dom|fastify|@fastify|@tiptap/react)/' }
    },
    {
      name: 'drizzle-solo-en-db',
      comment: 'Solo packages/db habla con Drizzle: así toda escritura de dominio pasa por operation() y el historial',
      severity: 'error',
      from: { path: '^(apps|e2e)/', pathNot: '\\.test\\.ts$' },
      to: { path: 'node_modules/drizzle-orm/' }
    },
    {
      name: 'dominio-puro',
      comment: 'El dominio, los dados y los sistemas no dependen de la base de datos ni del servidor',
      severity: 'error',
      from: { path: '^packages/(domain|dice|systems)/' },
      to: { path: '^(packages/db|apps)/' }
    },
    {
      name: 'sin-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'importa-algo-que-existe',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    }
  ],
  options: {
    parser: 'swc',
    doNotFollow: { path: 'node_modules' },
    // node_modules no se excluye: hace falta en el grafo para las reglas sobre paquetes npm
    exclude: { path: '(^|/)(dist|coverage)/' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types']
    }
  }
}
