import { useTranslation } from 'react-i18next'
import { Tour } from '../components/tour.tsx'

/**
 * El tutorial guiado dentro de un mundo: un paso por cada pestaña de su barra y por cada zona de la página. Sale en
 * cualquier página del mundo (también en su portada); los pasos que no están en la pantalla se saltan
 */
export function WorldTour({ master }: { master: boolean }) {
  const { t } = useTranslation()
  return (
    <Tour
      id="mundo"
      // Un paso por cada botón de la barra (y lo que se añada a ella, también aquí)
      steps={[
        ...(master
          ? ([
              // El mundo a pantalla completa (ADR-0027): su barra de la izquierda, su cabecera y la página con su panel
              { target: '[data-tour="mundo-paginas"]', text: t('tour.world.pages'), placement: 'right' },
              { target: '[data-tour="buscador"]', text: t('tour.world.search'), placement: 'right' },
              { target: '[data-tour="mundo-archivos"]', text: t('tour.world.files'), placement: 'right' },
              { target: '[data-tour="panel-bloques"]', text: t('tour.world.panel'), placement: 'left' },
              { target: '[data-tour="quien-la-conoce"]', text: t('tour.world.whoKnows'), placement: 'bottom' },
              { target: '[data-tour="menu-mundo"]', text: t('tour.world.worldMenu'), placement: 'bottom' },
              { target: '[data-tour="dados"]', text: t('tour.world.dice'), placement: 'top' }
            ] as const)
          : []),
        ...(master
          ? []
          : ([
              { target: '[data-tour="barra-inicio"]', text: t('tour.world.home'), placement: 'right' },
              { target: '[data-tour="dados"]', text: t('tour.world.dice'), placement: 'top' }
            ] as const)),
        { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: master ? 'bottom' : 'right' },
        { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
      ]}
    />
  )
}
