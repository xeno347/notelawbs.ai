import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useDocumentLibrary } from '../stores/useDocumentLibrary';
import { useSettings } from '../stores/useSettings';
import { colors } from '../theme/colors';
import { Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { useActiveDocument } from '../stores/useActiveDocument';

export default function LibraryScreen() {
  const { documents, isLoading, fetchDocuments } = useDocumentLibrary();
  const { setActiveDocument } = useActiveDocument();
  const { settings } = useSettings();
  const theme = settings.themeMode === 'dark' ? colors.dark : colors.light;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Lora' }]}>
          Documents
        </Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.accent }]}>
          <Plus size={24} color={theme.surface} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={{ color: theme.textSecondary }}>Loading...</Text>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.docRow, { backgroundColor: theme.surface }]}
              onPress={() => {
                setActiveDocument(item);
                navigation.navigate('DocumentWorkspace', { id: item.id });
              }}
            >
              <Text style={[styles.docTitle, { color: theme.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.docMeta, { color: theme.textSecondary }]}>
                {item.pageCount} pages • {item.ocrStatus}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyState={() => (
            <View style={styles.empty}>
              <Text style={{ color: theme.textSecondary }}>No documents found. Import or load demo.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 12,
    borderRadius: 100,
  },
  list: {
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
    gap: 12,
  },
  docRow: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  docTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    marginTop: 64,
  },
});
