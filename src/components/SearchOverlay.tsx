import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal
} from 'react-native';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';
import { opsqlite } from '../db';
import { X } from 'lucide-react-native';

interface SearchResult {
  document_id: string;
  page_index: number;
  source: string;
  content: string;
  snippet: string;
}

export default function SearchOverlay({ visible, onClose }: { visible: boolean, onClose: () => void }) {
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.length > 2) {
      const res = opsqlite.execute(`
        SELECT document_id, page_index, source, content, snippet(search_fts, 4, '«', '»', '...', 20) as snippet
        FROM search_fts
        WHERE search_fts MATCH ?
        LIMIT 80
      `, [`${text}*`]);

      setResults(res.rows?._array || []);
    } else {
      setResults([]);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[styles.container, { backgroundColor: theme.background + 'EE' }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Search documents and canvas..."
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.resultItem, { borderBottomColor: theme.background }]}>
              <Text style={[styles.resultTitle, { color: theme.textPrimary }]}>
                {item.source.toUpperCase()} • Page {item.page_index + 1}
              </Text>
              <Text style={[styles.snippet, { color: theme.textSecondary }]}>
                {item.snippet}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    gap: 16,
  },
  input: {
    flex: 1,
    fontSize: 20,
    padding: 8,
  },
  list: {
    padding: 16,
  },
  resultItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  snippet: {
    fontSize: 16,
  },
});
