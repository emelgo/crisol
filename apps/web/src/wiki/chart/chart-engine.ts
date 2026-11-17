/**
 * Origen: Crisol antiguo (de Enrique), `apps/desktop/src/renderer/src/graficos/motor.ts`, commit 3f68f11 (2026-10-28),
 * UNLICENSED (suyo); entrada en docs/terceros.md. Chart.js con solo lo que usan los bloques ```chart (los seis tipos,
 * leyenda, recuadro al pasar el ratón y rellenos). Se importa con import(): va en un trozo aparte que se carga con el
 * primer gráfico
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  Tooltip
} from 'chart.js'

Chart.register(
  BarController,
  LineController,
  PieController,
  DoughnutController,
  RadarController,
  PolarAreaController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Legend,
  Tooltip,
  Filler
)

export { Chart }
