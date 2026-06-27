import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibraryScreen from '../screens/LibraryScreen';
import DocumentWorkspaceScreen from '../screens/DocumentWorkspaceScreen';
import UtilitiesScreen from '../screens/UtilitiesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { View, StyleSheet } from 'react-native';
import SideRail from '../components/SideRail';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Library: undefined;
  DocumentWorkspace: { id: string; page?: number };
  Utilities: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigation() {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <NavigationContainer>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SideRail />
        <View style={styles.content}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="Library" component={LibraryScreen} />
            <Stack.Screen name="DocumentWorkspace" component={DocumentWorkspaceScreen} />
            <Stack.Screen name="Utilities" component={UtilitiesScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </View>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
});
