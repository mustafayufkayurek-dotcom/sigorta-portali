import { Tabs } from 'expo-router';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function TabsLayout() {
  usePushNotifications();

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dosyalarım',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
