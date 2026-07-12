import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Home, BarChart3, FileText, ShoppingBag, Plus, Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import HomeScreen from './HomeScreen';
import DataScreen from '../documents/DataScreen';
import ProtocolScreen from '../protocol/ProtocolScreen';
import MarketplaceScreen from './MarketplaceScreen';
import { RootStackParamList } from '../../app/navigation';
import { useActiveDocument } from '../workspace/useActiveDocument';
import { importDocument } from '../documents/importService';
import { useDocumentLibrary } from '../documents/useDocumentLibrary';
import SearchOverlay from '../workspace/SearchOverlay';

type TabKey = 'home' | 'data' | 'protocol' | 'marketplace' | 'search';

const tabConfig = [
  { key: 'home' as TabKey, label: 'Home', icon: Home },
  { key: 'data' as TabKey, label: 'Data', icon: BarChart3 },
  { key: 'search' as TabKey, label: 'Search', icon: Search },
  { key: 'protocol' as TabKey, label: 'Protocol', icon: FileText },
  { key: 'marketplace' as TabKey, label: 'Marketplace', icon: ShoppingBag },
];

export default function ShellScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { setActiveDocument } = useActiveDocument();
  const { fetchDocuments } = useDocumentLibrary();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [tab, setTab] = useState<TabKey>('home');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const handleQuickAction = async () => {
    const doc = await importDocument();
    if (doc) {
      setActiveDocument(doc);
      await fetchDocuments();
      navigation.navigate('DocumentWorkspace', { id: doc.id });
    }
  };

  const handleTabPress = (item: (typeof tabConfig)[0]) => {
    if (item.key === 'search') {
      setIsSearchVisible(true);
    } else {
      setTab(item.key);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={[styles.backdrop, { backgroundColor: theme.accent, opacity: settings.themeMode === 'dark' ? 0.12 : 0.08 }]} />
        <View style={styles.content}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'data' && <DataScreen />}
          {tab === 'protocol' && <ProtocolScreen />}
          {tab === 'marketplace' && <MarketplaceScreen />}
        </View>

        <View style={styles.bottomDockWrap} pointerEvents="box-none">
          <View style={[styles.bottomDock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {tabConfig.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <TouchableOpacity key={item.key} onPress={() => handleTabPress(item)} style={styles.tabButton} activeOpacity={0.8}>
                  <Icon size={20} color={active ? '#111' : theme.textSecondary} />
                  <Text style={[styles.tabLabel, { color: active ? '#111' : theme.textSecondary }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            accessibilityLabel="Quick import"
            onPress={handleQuickAction}
            style={styles.quickButton}
          >
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <SearchOverlay visible={isSearchVisible} onClose={() => setIsSearchVisible(false)} navigation={navigation} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  content: {
    flex: 1,
  },
  bottomDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bottomDock: {
    flex: 1,
    maxWidth: 660,
    minHeight: 84,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickButton: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: '#ff7a2f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff7a2f',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
