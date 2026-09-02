import { Stack } from 'expo-router';

import { ErrorBoundary } from '@components/error-boundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
