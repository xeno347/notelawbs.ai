import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigation from './src/app/navigation';
import { StatusBar } from 'react-native';
import { useAuth } from './src/features/auth/useAuth';
import { useSettings } from './src/features/settings/useSettings';

function App(): React.JSX.Element {
  const bootstrapAuth = useAuth((state) => state.bootstrap);
  const bootstrapSettings = useSettings((state) => state.bootstrap);

  useEffect(() => {
    const boot = async () => {
      await bootstrapSettings();
      await bootstrapAuth(useSettings.getState().settings.backendUrl);
    };

    boot().catch((error) => {
      console.error('App bootstrap failed:', error);
    });
  }, [bootstrapAuth, bootstrapSettings]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AppNavigation />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
