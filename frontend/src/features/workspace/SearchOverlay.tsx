import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { useSettings } from '../settings/useSettings';
import { colors } from '../../theme/colors';
import { X } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { useNavigation } from '@react-navigation/native';
import { search } from '../auth/backendApi';
import { useAuth } from '../auth/useAuth';

interface SearchResult {
  document_id: string;
  page_index: number;
  source: string;
  content: string;
  snippet: string;
}

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}

export default function SearchOverlay({ visible, onClose, navigation }: SearchOverlayProps) {
  const fallbackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const activeNavigation = navigation || fallbackNavigation;
  const { settings } = useSettings();
  const { token } = useAuth();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length > 2 && token) {
      const res = await search(settings.backendUrl, token, text);
      setResults(res.results as SearchResult[]);
    } else {
      setResults([]);
    }
  };

  const handleSelectResult = (item: SearchResult) => {
    activeNavigation.navigate('DocumentWorkspace', { id: item.document_id, page: item.page_index + 1 });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[styles.container, { backgroundColor: theme.background + 'EE' }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Search documents and workspace..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={(text) => void handleSearch(text)}
            autoFocus
          />
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.document_id}-${item.page_index}-${index}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.resultItem, { borderBottomColor: theme.background }]} onPress={() => handleSelectResult(item)}>
              <Text style={[styles.resultTitle, { color: theme.textPrimary }]}>
                {item.source.toUpperCase()} • Page {item.page_index + 1}
              </Text>
              <Text style={[styles.snippet, { color: theme.textSecondary }]}>{item.snippet}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    gap: 16,
  },
  input: { flex: 1, fontSize: 20, padding: 8 },
  list: { padding: 16 },
  resultItem: { paddingVertical: 16, borderBottomWidth: 1 },
  resultTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  snippet: { fontSize: 16 },
});
