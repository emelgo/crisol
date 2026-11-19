import { useTranslation } from 'react-i18next'
import { Tour } from '../components/tour.tsx'

/**
 * El tutorial guiado dentro de un mundo: un paso por cada botón de la barra y por cada zona de la página. Sale en
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
              // El árbol, con «Páginas» de la barra resaltado a la vez; justo después, el engranaje junto a su nombre
              {
                target: '[data-tour="arbol"]',
                text: t('tour.world.wiki'),
                placement: 'right',
                also: [{ target: '[data-tour="barra-wiki"]' }]
              },
              { target: '[data-tour="engranaje"]', text: t('tour.world.settings'), placement: 'right' },
              { target: '[data-tour="buscador"]', text: t('tour.world.search'), placement: 'right' },
              // El botón del panel, que sale aunque esté plegado, con el panel resaltado si se ve
              {
                target: '[data-tour="plegar-panel"]',
                text: t('tour.world.panel'),
                also: [{ target: '[data-tour="panel-bloques"]' }]
              },
              { target: '[data-tour="barra-calendarios"]', text: t('tour.world.calendars'), placement: 'right' },
              { target: '[data-tour="barra-archivos-mundo"]', text: t('tour.world.files'), placement: 'right' },
              { target: '[data-tour="dados"]', text: t('tour.world.dice'), placement: 'top' },
              { target: '[data-tour="barra-historial"]', text: t('tour.world.history'), placement: 'right' },
              { target: '[data-tour="barra-papelera"]', text: t('tour.world.trash'), placement: 'right' }
            ] as const)
          : []),
        ...(master
          ? []
          : ([
              { target: '[data-tour="barra-inicio"]', text: t('tour.world.home'), placement: 'right' },
              { target: '[data-tour="dados"]', text: t('tour.world.dice'), placement: 'top' }
            ] as const)),
        { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' },
        { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
      ]}
    />
  )
}
