import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API = 'http://localhost:3000/api/v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Push] Gerçek bir cihaz gereklidir');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Bildirim izni verilmedi');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

async function savePushToken(token: string) {
  try {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) return;

    await axios.post(
      `${API}/users/me/expo-push-token`,
      { token },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch (e) {
    console.error('[Push] Token kaydedilemedi:', e);
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    let mounted = true;

    registerForPushNotificationsAsync().then((token) => {
      if (token && mounted) {
        savePushToken(token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      console.log('[Push] Bildirim alındı:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      console.log('[Push] Bildirime tıklandı:', response);
    });

    return () => {
      mounted = false;
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);
}
