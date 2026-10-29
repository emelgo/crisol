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
      comment: 'El dominio y los contratos no dependen de React ni de Fastify',
      severity: 'error',
      from: { path: '^packages/(domain|contracts)/' },
      to: { path: 'node_modules/(react|react-dom|fastify|@fastify)/' }
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
    exclude: { path: '(^|/)(node_modules|dist|coverage)/' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types']
    }
  }
}
