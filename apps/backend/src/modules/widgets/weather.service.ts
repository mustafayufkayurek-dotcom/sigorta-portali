import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WeatherDayData {
  day: string;
  tempC: number;
  maxTempC: number;
  minTempC: number;
  description: string;
  weatherCode: number;
  icon: string;
  iconKey: string;
}

export interface WeatherData {
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

const WEATHER_CODE_MAP: Record<number, { description: string; icon: string; iconKey: string }> = {
  113: { description: 'Güneşli', icon: '☀️', iconKey: 'sun' },
  116: { description: 'Az Bulutlu', icon: '⛅', iconKey: 'partly-cloudy' },
  119: { description: 'Bulutlu', icon: '☁️', iconKey: 'cloud' },
  122: { description: 'Çok Bulutlu', icon: '☁️', iconKey: 'cloud' },
  143: { description: 'Sisli', icon: '🌫️', iconKey: 'cloud' },
  176: { description: 'Hafif Yağmurlu', icon: '🌦️', iconKey: 'rain' },
  179: { description: 'Karlı', icon: '🌨️', iconKey: 'snow' },
  182: { description: 'Sulu Kar', icon: '🌨️', iconKey: 'snow' },
  185: { description: 'Dondurucu Çisenti', icon: '🌨️', iconKey: 'snow' },
  200: { description: 'Gök Gürültülü Yağmur', icon: '⛈️', iconKey: 'storm' },
  227: { description: 'Kar Fırtınası', icon: '❄️', iconKey: 'snow' },
  230: { description: 'Blizzard', icon: '❄️', iconKey: 'snow' },
  248: { description: 'Sis', icon: '🌫️', iconKey: 'cloud' },
  260: { description: 'Buzlanma Sisi', icon: '🌫️', iconKey: 'cloud' },
  263: { description: 'Hafif Çisenti', icon: '🌦️', iconKey: 'rain' },
  266: { description: 'Çisenti', icon: '🌦️', iconKey: 'rain' },
  281: { description: 'Dondurucu Çisenti', icon: '🌨️', iconKey: 'snow' },
  284: { description: 'Şiddetli Dondurucu Çisenti', icon: '🌨️', iconKey: 'snow' },
  293: { description: 'Hafif Yağmur', icon: '🌧️', iconKey: 'rain' },
  296: { description: 'Yağmur', icon: '🌧️', iconKey: 'rain' },
  299: { description: 'Orta Şiddetli Yağmur', icon: '🌧️', iconKey: 'rain' },
  302: { description: 'Şiddetli Yağmur', icon: '🌧️', iconKey: 'rain' },
  305: { description: 'Çok Şiddetli Yağmur', icon: '🌧️', iconKey: 'rain' },
  308: { description: 'Aşırı Yağmur', icon: '🌧️', iconKey: 'rain' },
  311: { description: 'Dondurucu Yağmur', icon: '🌨️', iconKey: 'snow' },
  314: { description: 'Şiddetli Dondurucu Yağmur', icon: '🌨️', iconKey: 'snow' },
  317: { description: 'Hafif Sulu Kar', icon: '🌨️', iconKey: 'snow' },
  320: { description: 'Orta Sulu Kar', icon: '🌨️', iconKey: 'snow' },
  323: { description: 'Hafif Kar', icon: '❄️', iconKey: 'snow' },
  326: { description: 'Orta Kar', icon: '❄️', iconKey: 'snow' },
  329: { description: 'Yoğun Kar', icon: '❄️', iconKey: 'snow' },
  332: { description: 'Şiddetli Kar', icon: '❄️', iconKey: 'snow' },
  335: { description: 'Çok Şiddetli Kar', icon: '❄️', iconKey: 'snow' },
  338: { description: 'Aşırı Kar', icon: '❄️', iconKey: 'snow' },
  350: { description: 'Buz Parçacıkları', icon: '🌨️', iconKey: 'snow' },
  353: { description: 'Hafif Sağanak', icon: '🌦️', iconKey: 'rain' },
  356: { description: 'Orta Sağanak', icon: '🌧️', iconKey: 'rain' },
  359: { description: 'Şiddetli Sağanak', icon: '🌧️', iconKey: 'rain' },
  362: { description: 'Hafif Karlı Sağanak', icon: '🌨️', iconKey: 'snow' },
  365: { description: 'Orta Karlı Sağanak', icon: '🌨️', iconKey: 'snow' },
  368: { description: 'Hafif Kar Yağışı', icon: '❄️', iconKey: 'snow' },
  371: { description: 'Orta Kar Yağışı', icon: '❄️', iconKey: 'snow' },
  374: { description: 'Hafif Buzlu Sağanak', icon: '🌨️', iconKey: 'snow' },
  377: { description: 'Orta Buzlu Sağanak', icon: '🌨️', iconKey: 'snow' },
  386: { description: 'Gök Gürültülü Hafif Yağmur', icon: '⛈️', iconKey: 'storm' },
  389: { description: 'Gök Gürültülü Yağmur', icon: '⛈️', iconKey: 'storm' },
  392: { description: 'Gök Gürültülü Hafif Kar', icon: '⛈️', iconKey: 'storm' },
  395: { description: 'Gök Gürültülü Kar', icon: '⛈️', iconKey: 'storm' },
};

function getWeatherMeta(code: number): { description: string; icon: string; iconKey: string } {
  return WEATHER_CODE_MAP[code] ?? { description: 'Bilinmiyor', icon: '🌡️', iconKey: 'cloud' };
}

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function getDayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Bugün';
  if (index === 1) return 'Yarın';
  try {
    const d = new Date(dateStr);
    return DAY_NAMES[d.getDay()];
  } catch {
    return `+${index}`;
  }
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cache: Map<string, { data: WeatherData; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  async getWeather(city: string): Promise<WeatherData> {
    const key = city.toLowerCase();
    const cached = this.cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const response = await axios.get(url, { timeout: 8000 });
      const json = response.data;

      const current = json.current_condition?.[0];
      if (!current) {
        throw new Error('Hava durumu verisi bulunamadı');
      }

      const code = parseInt(current.weatherCode, 10);
      const meta = getWeatherMeta(code);

      // Parse 3-day forecast from weather array
      const weatherDays: any[] = json.weather ?? [];
      const forecast: WeatherDayData[] = weatherDays.slice(0, 3).map((day: any, idx: number) => {
        const dayCode = parseInt(day.hourly?.[4]?.weatherCode ?? day.hourly?.[0]?.weatherCode ?? '113', 10);
        const dayMeta = getWeatherMeta(dayCode);
        const avgTempC = Math.round((parseInt(day.maxtempC, 10) + parseInt(day.mintempC, 10)) / 2);
        return {
          day: getDayLabel(day.date, idx),
          tempC: avgTempC,
          maxTempC: parseInt(day.maxtempC, 10),
          minTempC: parseInt(day.mintempC, 10),
          description: dayMeta.description,
          weatherCode: dayCode,
          icon: dayMeta.icon,
          iconKey: dayMeta.iconKey,
        };
      });

      const data: WeatherData = {
        city,
        tempC: parseInt(current.temp_C, 10),
        feelsLikeC: parseInt(current.FeelsLikeC, 10),
        description: meta.description,
        weatherCode: code,
        humidity: parseInt(current.humidity, 10),
        windKph: parseInt(current.windspeedKmph, 10),
        icon: meta.icon,
        iconKey: meta.iconKey,
        forecast,
      };

      this.cache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
      return data;
    } catch (err) {
      this.logger.warn(`wttr.in'den veri alınamadı (${city}): ${(err as Error).message}`);
      return this.getMockWeather(city);
    }
  }

  private getMockWeather(city: string): WeatherData {
    return {
      city,
      tempC: 20,
      feelsLikeC: 19,
      description: 'Az Bulutlu',
      weatherCode: 116,
      humidity: 55,
      windKph: 12,
      icon: '⛅',
      iconKey: 'partly-cloudy',
      forecast: [
        { day: 'Bugün', tempC: 20, maxTempC: 22, minTempC: 16, description: 'Az Bulutlu', weatherCode: 116, icon: '⛅', iconKey: 'partly-cloudy' },
        { day: 'Yarın', tempC: 18, maxTempC: 20, minTempC: 14, description: 'Yağmurlu', weatherCode: 296, icon: '🌧️', iconKey: 'rain' },
        { day: 'Per', tempC: 22, maxTempC: 24, minTempC: 17, description: 'Güneşli', weatherCode: 113, icon: '☀️', iconKey: 'sun' },
      ],
    };
  }
}
