import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Giriş' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="smart-measure/[claimFileId]"
        options={{ title: 'Kamera İle Ölç' }}
      />
    </Stack>
  );
}

