'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

const TURKEY_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
  'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
  'Mersin', 'Istanbul', 'Izmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
  'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop',
  'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van',
  'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak',
  'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
];

interface WeatherDayData {
  day: string;
  tempC: number;
  maxTempC: number;
  minTempC: number;
  description: string;
  weatherCode: number;
  icon: string;
  iconKey: string;
}

interface WeatherData {
  city: string;
  tempC: number;
  feelsLikeC: number;
  description: string;
  weatherCode: number;
  humidity: number;
  windKph: number;
  icon: string;
  iconKey: string;
  forecast: WeatherDayData[];
}

type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 8) return 'morning';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'evening';
  return 'night';
}

function getWeatherIcon(iconKey: string, fallbackIcon: string, timeOfDay: TimeOfDay): string {
  const key = iconKey?.toLowerCase() ?? '';
  const isNight = timeOfDay === 'night';

  if (key.includes('clear') || key.includes('sunny')) {
    return isNight ? '🌙' : '☀️';
  }
  if (key.includes('partly_cloudy') || key.includes('partly-cloudy')) {
    return isNight ? '☁️🌙' : '⛅';
  }
  if (key.includes('cloud') || key.includes('overcast')) {
    return isNight ? '☁️🌙' : '☁️';
  }
  // Rain, snow, storm — same regardless of time
  if (key.includes('rain') || key.includes('drizzle') || key.includes('shower')) return '🌧️';
  if (key.includes('snow') || key.includes('sleet') || key.includes('blizzard')) return '❄️';
  if (key.includes('thunder') || key.includes('storm')) return '⛈️';
  if (key.includes('fog') || key.includes('mist') || key.includes('haze')) return '🌫️';
  if (key.includes('wind')) return '💨';

  return fallbackIcon;
}

type BandStyle = {
  gradient: string;
  textPrimary: string;
  textSecondary: string;
  selectClass: string;
  dividerColor: string;
};

function getBandStyle(timeOfDay: TimeOfDay): BandStyle {
  switch (timeOfDay) {
    case 'morning':
      return {
        gradient: 'bg-gradient-to-r from-amber-50 to-sky-50',
        textPrimary: 'text-gray-800',
        textSecondary: 'text-gray-500',
        selectClass: 'border-amber-200 text-gray-600 focus:ring-amber-400',
        dividerColor: 'text-amber-200',
      };
    case 'day':
      return {
        gradient: 'bg-gradient-to-r from-sky-50 to-blue-50',
        textPrimary: 'text-gray-800',
        textSecondary: 'text-gray-500',
        selectClass: 'border-sky-200 text-gray-600 focus:ring-sky-400',
        dividerColor: 'text-sky-200',
      };
    case 'evening':
      return {
        gradient: 'bg-gradient-to-r from-orange-50 to-purple-50',
        textPrimary: 'text-gray-800',
        textSecondary: 'text-gray-500',
        selectClass: 'border-orange-200 text-gray-600 focus:ring-orange-400',
        dividerColor: 'text-orange-200',
      };
    case 'night':
      return {
        gradient: 'bg-gradient-to-r from-slate-800 to-indigo-900',
        textPrimary: 'text-white',
        textSecondary: 'text-slate-300',
        selectClass: 'border-slate-600 text-slate-200 bg-slate-700 focus:ring-indigo-400',
        dividerColor: 'text-slate-600',
      };
  }
}

const LS_KEY = 'dashboard_weather_city';

export default function WeatherWidget() {
  const [city, setCity] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LS_KEY) ?? 'Istanbul';
    }
    return 'Istanbul';
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());

  // Refresh time-of-day every minute so band updates live
  useEffect(() => {
    const interval = setInterval(() => setTimeOfDay(getTimeOfDay()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = useCallback(async (selectedCity: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API}/widgets/weather`, {
        params: { city: selectedCity },
      });
      setWeather(res.data.data as WeatherData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(city);
  }, [city, fetchWeather]);

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value;
    setCity(newCity);
    localStorage.setItem(LS_KEY, newCity);
  };

  const nextDays = weather?.forecast?.slice(1) ?? [];
  const band = getBandStyle(timeOfDay);

  const todayIcon = weather
    ? getWeatherIcon(weather.iconKey, weather.icon, timeOfDay)
    : null;

  return (
    <div
      className={`flex items-center gap-1.5 h-12 px-3 min-w-0 transition-colors duration-700 ${band.gradient}`}
    >
      {/* City selector */}
      <select
        value={city}
        onChange={handleCityChange}
        className={`text-xs border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:ring-1 max-w-[96px] flex-shrink-0 transition-colors duration-700 ${band.selectClass}`}
      >
        {TURKEY_CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {loading ? (
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-500 ml-1" />
      ) : error ? (
        <span className={`text-xs ml-1 ${band.textSecondary}`}>—</span>
      ) : weather ? (
        <>
          {/* Today — larger, bold */}
          <div className="flex items-center gap-1 ml-1">
            <span className="text-base leading-none">{todayIcon}</span>
            <span className={`text-sm font-bold tabular-nums whitespace-nowrap transition-colors duration-700 ${band.textPrimary}`}>
              {weather.tempC}°
            </span>
            <span className={`text-xs hidden sm:inline whitespace-nowrap transition-colors duration-700 ${band.textSecondary}`}>
              {weather.description}
            </span>
          </div>

          {/* Divider */}
          <span className={`text-sm mx-0.5 hidden md:inline transition-colors duration-700 ${band.dividerColor}`}>|</span>

          {/* Next 2 days — smaller, muted */}
          <div className="hidden md:flex items-center gap-2">
            {nextDays.map((d) => (
              <div key={d.day} className="flex items-center gap-1">
                <span className={`text-xs font-medium whitespace-nowrap transition-colors duration-700 ${band.textSecondary}`}>
                  {d.day}:
                </span>
                <span className="text-sm leading-none">
                  {getWeatherIcon(d.iconKey, d.icon, timeOfDay)}
                </span>
                <span className={`text-xs tabular-nums whitespace-nowrap font-medium transition-colors duration-700 ${band.textSecondary}`}>
                  {d.tempC}°
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
