import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { useSettings } from '../settings/useSettings';
import { useActiveDocument } from './useActiveDocument';
import { colors } from '../../theme/colors';
import {
  Search,
  Files,
  Layout,
  Wrench,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import SearchOverlay from './SearchOverlay';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 240;

export default function SideRail() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings, setSettings } = useSettings();
  const { activeDocument } = useActiveDocument();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [searchVisible, setSearchVisible] = React.useState(false);

  // Get current route name
  const currentRouteName = useNavigationState((state) => {
    if (!state) return '';
    return state.routes[state.index].name;
  });

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
    routeName = ''
  }: {
    icon: any,
    label: string,
    onPress: () => void,
    disabled?: boolean,
    routeName?: string
  }) => {
    const active = currentRouteName === routeName;
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[
          styles.navItem,
          active && { backgroundColor: theme.accent + '15' },
          disabled && { opacity: 0.25 }
        ]}
      >
        <View style={styles.iconContainer}>
          <Icon size={22} color={active ? theme.accent : theme.textPrimary} />
        </View>
        {settings.sideRailExpanded && (
          <Text style={[
            styles.navLabel,
            { color: active ? theme.textPrimary : theme.textSecondary }
          ]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Animated.View style={[
        styles.rail,
        { backgroundColor: theme.surface, borderRightColor: theme.border },
        animatedStyle
      ]}>
        <View style={styles.topSection}>
          <View style={styles.header}>
            <View style={[styles.logo, { backgroundColor: theme.accent }]}>
               <Text style={styles.logoChar}>N</Text>
            </View>
            {settings.sideRailExpanded && (
              <Text style={[styles.brand, { color: theme.textPrimary }]}>NoteLawb</Text>
            )}
          </View>

          <NavItem
            icon={Search}
            label="Search"
            onPress={() => setSearchVisible(true)}
          />
          <NavItem
            icon={Files}
            label="Documents"
            onPress={() => navigation.navigate('Library')}
            routeName="Library"
          />
          <NavItem
            icon={Layout}
            label="Workspace"
            onPress={() => activeDocument && navigation.navigate('DocumentWorkspace', { id: activeDocument.id })}
            disabled={!activeDocument}
            routeName="DocumentWorkspace"
          />
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottomSection}>
          <NavItem
            icon={Wrench}
            label="Utilities"
            onPress={() => navigation.navigate('Utilities')}
            routeName="Utilities"
          />
          <NavItem
            icon={Settings}
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
            routeName="Settings"
          />

          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSettings({ sideRailExpanded: !settings.sideRailExpanded });
            }}
            style={styles.collapseBtn}
          >
            {settings.sideRailExpanded ? (
              <ChevronLeft size={20} color={theme.textSecondary} />
            ) : (
              <ChevronRight size={20} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
      <SearchOverlay visible={searchVisible} onClose={() => setSearchVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: '100%',
    borderRightWidth: 1,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoChar: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 18,
  },
  brand: {
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  topSection: {
    gap: 6,
  },
  bottomSection: {
    gap: 6,
  },
  spacer: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 10,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  },
  navLabel: {
    marginLeft: 16,
    fontSize: 15,
    fontWeight: '600',
  },
  collapseBtn: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
});
