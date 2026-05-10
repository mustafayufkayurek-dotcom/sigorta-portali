import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const LOCATION_TASK = 'background-location-task';
const PENDING_LOCATIONS_KEY = 'pendingLocations';
const API_BASE = 'http://localhost:3000/api/v1';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  batteryLevel?: number;
  timestamp: string;
}

// ─── Arka Plan Task Tanımı (modül seviyesinde, component dışında) ─────────────

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('[LocationTask] Hata:', error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };

  const points: LocationPoint[] = locations.map((loc) => ({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? undefined,
    altitude: loc.coords.altitude,
    speed: loc.coords.speed,
    heading: loc.coords.heading,
    timestamp: new Date(loc.timestamp).toISOString(),
  }));

  try {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
      await appendPendingLocations(points);
      return;
    }

    await axios.post(
      `${API_BASE}/user-locations`,
      { locations: points },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 },
    );
  } catch {
    // Bağlantı yoksa lokalde biriktir
    await appendPendingLocations(points);
  }
});

async function appendPendingLocations(points: LocationPoint[]) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_LOCATIONS_KEY);
    const existing: LocationPoint[] = raw ? JSON.parse(raw) : [];
    const merged = [...existing, ...points].slice(-500); // maksimum 500 nokta
    await AsyncStorage.setItem(PENDING_LOCATIONS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('[LocationTask] Lokal kayıt hatası:', e);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  useEffect(() => {
    TaskManager.isTaskRegisteredAsync(LOCATION_TASK).then((registered) => {
      if (registered) {
        Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
          .then(setIsTracking)
          .catch(() => setIsTracking(false));
      }
    });
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      setPermissionStatus('denied');
      return false;
    }
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      setPermissionStatus('denied');
      return false;
    }
    setPermissionStatus('granted');
    return true;
  }, []);

  const startTracking = useCallback(async () => {
    const ok = await requestPermissions();
    if (!ok) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000,   // 5 dakika
      distanceInterval: 50,           // 50 metre
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Konum Takibi',
        notificationBody: 'Saha konumunuz arka planda izleniyor.',
      },
    });

    setIsTracking(true);
    await flushPendingLocations();
  }, [requestPermissions]);

  const stopTracking = useCallback(async () => {
    const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
    if (registered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
    setIsTracking(false);
  }, []);

  const flushPendingLocations = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_LOCATIONS_KEY);
      if (!raw) return;

      const pending: LocationPoint[] = JSON.parse(raw);
      if (pending.length === 0) return;

      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;

      await axios.post(
        `${API_BASE}/user-locations`,
        { locations: pending },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
      );

      await AsyncStorage.removeItem(PENDING_LOCATIONS_KEY);
    } catch {
      // Sessizce devam
    }
  }, []);

  return { isTracking, permissionStatus, startTracking, stopTracking, flushPendingLocations };
}
