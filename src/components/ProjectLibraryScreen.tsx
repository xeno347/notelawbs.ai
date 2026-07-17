import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, FileText, Trash2, Pencil, Settings as SettingsIcon } from 'lucide-react-native';
import { useStore } from '../store';
import { getPalette, useTheme, RADIUS, TYPE, ELEVATION } from '../theme';
import { useAuth } from '../auth/authStore';
/** Projects home — flat Notion-style gallery. */
export default function ProjectLibraryScreen({ onSettings }: { onSettings: () => void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const projects = useStore((s) => s.projects);
  const createProject = useStore((s) => s.createProject);
  const openProject = useStore((s) => s.openProject);
  const renameProject = useStore((s) => s.renameProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const displayName = useAuth((s) => s.user?.displayName || s.user?.email || 'Researcher');
  const [draftTitle, setDraftTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const s = styles(p);

  const cols = width >= 1100 ? 4 : width >= 768 ? 3 : 2;
  const gap = 16;
  const pad = 22;
  const cardW = (Math.min(width, 1100) - pad * 2 - gap * (cols - 1)) / cols;

  const onCreate = async () => {
    setCreating(true);
    try {
      await createProject(draftTitle.trim() || 'Untitled project');
      setDraftTitle('');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Delete Project?', `"${title}" will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProject(id) },
    ]);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) await renameProject(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: pad },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={s.maxw}>
          <View style={s.navRow}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={s.settingsBtn} onPress={onSettings} activeOpacity={0.65}>
              <SettingsIcon size={20} color={p.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <Text style={s.largeTitle}>NoteLawbs.Ai</Text>
          <Text style={s.greeting}>Welcome back, {displayName.split(' ')[0]}</Text>

          {/* New project */}
          <View style={s.composer}>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="New matter name"
              placeholderTextColor={p.textMuted}
              style={s.composerInput}
              returnKeyType="done"
              onSubmitEditing={onCreate}
            />
            <TouchableOpacity style={s.createBtn} onPress={onCreate} disabled={creating} activeOpacity={0.85}>
              <Plus size={18} color="#fff" strokeWidth={2.6} />
              <Text style={s.createText}>{creating ? '…' : 'Create'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.sectionLabel}>
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </Text>

          <View style={[s.grid, { marginHorizontal: -gap / 2 }]}>
            {/* Always-visible new tile */}
            <View style={{ width: cardW + gap, padding: gap / 2 }}>
              <TouchableOpacity style={[s.tile, s.tileNew]} onPress={onCreate} activeOpacity={0.85}>
                <View style={s.newIcon}>
                  <Plus size={28} color={p.tint} strokeWidth={2.2} />
                </View>
                <Text style={[s.tileTitle, { color: p.tint }]}>New Project</Text>
              </TouchableOpacity>
            </View>

            {projects.map((proj) => {
              const renaming = renamingId === proj.id;
              return (
                <View key={proj.id} style={{ width: cardW + gap, padding: gap / 2 }}>
                  <TouchableOpacity style={s.tile} onPress={() => !renaming && openProject(proj.id)} activeOpacity={0.9}>
                    <View style={[s.cover, { backgroundColor: p.bg2 }]}>
                      <View style={[s.coverBadge, { backgroundColor: p.fill }]}>
                        <FileText size={18} color={p.textMid} strokeWidth={1.5} />
                      </View>
                    </View>
                    <View style={s.tileBody}>
                      {renaming ? (
                        <TextInput
                          value={renameValue}
                          onChangeText={setRenameValue}
                          style={s.renameInput}
                          autoFocus
                          onSubmitEditing={commitRename}
                          onBlur={commitRename}
                        />
                      ) : (
                        <Text style={s.tileTitle} numberOfLines={2}>
                          {proj.title}
                        </Text>
                      )}
                      <Text style={s.tileMeta}>
                        Updated{' '}
                        {new Date(proj.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {!renaming && (
                        <View style={s.tileActions}>
                          <TouchableOpacity
                            hitSlop={10}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setRenamingId(proj.id);
                              setRenameValue(proj.title);
                            }}>
                            <Pencil size={15} color={p.textMuted} strokeWidth={2} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            hitSlop={10}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              confirmDelete(proj.id, proj.title);
                            }}>
                            <Trash2 size={15} color={p.danger} strokeWidth={2} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    scroll: {},
    maxw: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
    navRow: { flexDirection: 'row', marginBottom: 4 },
    settingsBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    largeTitle: { ...TYPE.largeTitle, color: p.text, marginBottom: 4 },
    greeting: { ...TYPE.subhead, color: p.textMid, marginBottom: 18 },
    composer: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 22,
      alignItems: 'center',
    },
    composerInput: {
      flex: 1,
      ...TYPE.body,
      color: p.text,
      backgroundColor: p.grouped,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: p.text,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    createText: { color: '#fff', fontWeight: '500', fontSize: 14 },
    sectionLabel: { ...TYPE.footnote, color: p.textMid, marginBottom: 10, fontWeight: '500' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    tile: {
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.card,
      minHeight: 210,
    },
    tileNew: {
      alignItems: 'center',
      justifyContent: 'center',
      borderStyle: 'dashed',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      minHeight: 210,
      gap: 10,
    },
    newIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.lg,
      backgroundColor: p.hover,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cover: { height: 88, justifyContent: 'center' },
    coverBadge: {
      position: 'absolute',
      left: 14,
      bottom: 12,
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileBody: { padding: 16, gap: 4 },
    tileTitle: { ...TYPE.headline, color: p.text },
    tileMeta: { ...TYPE.caption1, color: p.textMid },
    tileActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
    renameInput: { ...TYPE.headline, color: p.text, padding: 0 },
  });
