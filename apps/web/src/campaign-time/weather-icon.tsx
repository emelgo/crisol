/** El icono de cada condición del clima, teñido por su familia (sol, nube, agua, nieve) */
import type { WEATHER_CONDITIONS } from '@crisol/contracts'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  type LucideIcon,
  Snowflake,
  Sun
} from 'lucide-react'
import styles from './time.module.css'

type Condition = (typeof WEATHER_CONDITIONS)[number]

const ICONS: Record<Condition, [LucideIcon, 'sun' | 'cloud' | 'wet' | 'snow']> = {
  clear: [Sun, 'sun'],
  'mostly-clear': [Sun, 'sun'],
  'partly-cloudy': [CloudSun, 'sun'],
  'scattered-clouds': [CloudSun, 'cloud'],
  'broken-clouds': [Cloudy, 'cloud'],
  overcast: [Cloud, 'cloud'],
  fog: [CloudFog, 'cloud'],
  mist: [CloudFog, 'cloud'],
  drizzle: [CloudDrizzle, 'wet'],
  rain: [CloudRain, 'wet'],
  'heavy-rain': [CloudRainWind, 'wet'],
  sleet: [CloudHail, 'snow'],
  thunderstorm: [CloudLightning, 'wet'],
  flurries: [CloudSnow, 'snow'],
  snow: [Snowflake, 'snow']
}

export function WeatherIcon({ condition, size = 18 }: { condition: string; size?: number }) {
  const [Icon, family] = ICONS[condition as Condition] ?? [Cloud, 'cloud']
  return <Icon aria-hidden="true" size={size} className={styles.weatherIcon} data-family={family} />
}
