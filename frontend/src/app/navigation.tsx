import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ShellScreen from '../features/dashboard/ShellScreen';
import LibraryScreen from '../features/documents/LibraryScreen';
import DocumentWorkspaceScreen from '../features/workspace/DocumentWorkspaceScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import UtilitiesScreen from '../features/tools/UtilitiesScreen';
import LoginScreen from '../features/auth/LoginScreen';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../features/auth/useAuth';
import { colors } from '../theme/colors';
import { useSettings } from '../features/settings/useSettings';

export type RootStackParamList = {
  Shell: undefined;
  Library: undefined;
  DocumentWorkspace: { id: string; page?: number };
  Utilities: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();

export default function AppNavigation() {
  const status = useAuth((state) => state.status);
  const themeMode = useSettings((state) => state.settings.themeMode);
  const theme = themeMode === 'dark' ? colors.dark : colors.light;

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status === 'signedIn' ? (
        <Stack.Navigator
          initialRouteName="Shell"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Shell" component={ShellScreen} />
          <Stack.Screen name="Library" component={LibraryScreen} />
          <Stack.Screen name="DocumentWorkspace" component={DocumentWorkspaceScreen} />
          <Stack.Screen name="Utilities" component={UtilitiesScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
