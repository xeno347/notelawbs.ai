import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { useSettings } from '../stores/useSettings';
import { useActiveDocument } from '../stores/useActiveDocument';
import { colors } from '../theme/colors';
import {
  Search,
  Files,
  Layout,
  Bookmark,
  Wrench,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react-native';

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 220;

export default function SideRail() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, setSettings } = useSettings();
  const { activeDocument } = useActiveDocument();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;

  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(settings.sideRailExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH, {
      duration: 300,
    }),
  }));

  const NavItem = ({
    icon: Icon,
    label,
    onPress,
    disabled = false,
    active = false
  }: {
    icon: any,
    label: string,
    onPress: () => void,
    disabled?: boolean,
    active?: boolean
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.navItem,
        active && { backgroundColor: theme.accent + '20' },
        disabled && { opacity: 0.3 }
      ]}
    >
      <View style={styles.iconContainer}>
        <Icon size={24} color={active ? theme.accentSecondary : theme.textPrimary} />
      </View>
      {settings.sideRailExpanded && (
        <Text style={[
          styles.navLabel,
          { color: active ? theme.textPrimary : theme.textSecondary }
        ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[
      styles.rail,
      { backgroundColor: theme.surface, borderRightColor: theme.background + '40' },
      animatedStyle
    ]}>
      <View style={styles.topSection}>
        <NavItem
          icon={Search}
          label="Search"
          onPress={() => { /* Open Search Overlay */ }}
        />
        <NavItem
          icon={Files}
          label="Documents"
          onPress={() => navigation.navigate('Library')}
          active={true} // Simplified for now
        />
        <NavItem
          icon={Layout}
          label="Workspace"
          onPress={() => activeDocument && navigation.navigate('DocumentWorkspace', { id: activeDocument.id })}
          disabled={!activeDocument}
        />
        <NavItem
          icon={Bookmark}
          label="Index"
          onPress={() => { /* Toggle index panel */ }}
          disabled={!activeDocument}
        />
      </View>

      <View style={styles.spacer} />

      <View style={styles.bottomSection}>
        <NavItem
          icon={Wrench}
          label="Utilities"
          onPress={() => navigation.navigate('Utilities')}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          onPress={() => navigation.navigate('Settings')}
        />
        <TouchableOpacity
          onPress={() => setSettings({ sideRailExpanded: !settings.sideRailExpanded })}
          style={styles.collapseToggle}
        >
          {settings.sideRailExpanded ? (
            <ChevronLeft size={20} color={theme.textSecondary} />
          ) : (
            <ChevronRight size={20} color={theme.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: '100%',
    borderRightWidth: 1,
    paddingVertical: 16,
  },
  topSection: {
    gap: 8,
  },
  bottomSection: {
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  navLabel: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  collapseToggle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});
