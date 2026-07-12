import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { useStore } from '../store';
import { getPalette, SERIF } from '../theme';
import {
  runResearch,
  getStoredKey,
  saveKey,
  verifyKey,
} from '../research/service';

const STAGES = ['Enhance query', 'Retrieve authorities', 'Draft memo'];

function PulseDot({ color, active }: { color: string; active: boolean }) {
  const a = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!active) {
      a.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.3, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, a]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: a }} />;
}

export default function ResearchPanel({ onClose }: { onClose: () => void }) {
  const p = getPalette();
  const research = useStore((s) => s.research);
  const setResearch = useStore((s) => s.setResearch);
  const addAiNode = useStore((s) => s.addAiNode);

  const [query, setQuery] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [stage, setStage] = useState(-1);

  useEffect(() => {
    getStoredKey().then((k) => setHasKey(!!k));
  }, []);

  const mode = research.mode;
  const loading = research.status === 'loading';

  const doResearch = async () => {
    if (!query.trim()) return;
    setResearch({ status: 'loading', query, error: null, result: null });
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 600);
    const t2 = setTimeout(() => setStage(2), 1400);
    const result = await runResearch(query.trim());
    clearTimeout(t1);
    clearTimeout(t2);
    setStage(-1);
    setResearch({
      status: 'done',
      result,
      mode: result.mode,
      error:
        result.mode === 'offline' && hasKey
          ? 'Live AI unavailable — used on-device pack'
          : null,
    });
  };

  const doSaveKey = async () => {
    setSavingKey(true);
    setKeyStatus('Verifying…');
    const ok = await verifyKey(keyInput);
    if (!ok) {
      setKeyStatus('Key verification failed');
      setSavingKey(false);
      return;
    }
    await saveKey(keyInput);
    setHasKey(true);
    setKeyInput('');
    setKeyStatus('Key saved — live research enabled');
    setResearch({ mode: 'live' });
    setSavingKey(false);
  };

  const sections = research.result?.memo?.sections || [];
  const enhanced = research.result?.enhanced;
  const sources = research.result?.judgments || [];
  const s = styles(p);

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.panel}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>Legal research</Text>
              <View style={[s.badge, mode === 'live' ? s.badgeLive : s.badgeOffline]}>
                <Text style={[s.badgeText, { color: mode === 'live' ? '#3F7A54' : '#B07A16' }]}>
                  {mode === 'live' ? 'LIVE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
            <TextInput
              style={s.queryInput}
              placeholder="Frame a plain-language research question…"
              placeholderTextColor={p.textMuted}
              value={query}
              onChangeText={setQuery}
              multiline
            />
            <TouchableOpacity style={s.runBtn} onPress={doResearch} disabled={loading}>
              <Text style={s.runText}>{loading ? 'Researching…' : 'Run research'}</Text>
            </TouchableOpacity>

            {loading && (
              <View style={s.stages}>
                {STAGES.map((label, i) => (
                  <View key={label} style={s.stageRow}>
                    <PulseDot color={i <= stage ? p.accent : p.border} active={i === stage} />
                    <Text style={[s.stageLabel, i <= stage && { color: p.text }]}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {!hasKey && (
              <View style={s.keyBox}>
                <Text style={s.keyTitle}>Enable live AI research</Text>
                <Text style={s.keyHint}>
                  Paste your Anthropic API key. Stored only on this device and sent directly to
                  Anthropic — no backend server.
                </Text>
                <TextInput
                  style={s.keyInput}
                  placeholder="sk-ant-…"
                  placeholderTextColor={p.textMuted}
                  value={keyInput}
                  onChangeText={setKeyInput}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={s.keyBtn}
                  onPress={doSaveKey}
                  disabled={savingKey || keyInput.trim().length < 10}>
                  <Text style={s.keyBtnText}>Save key</Text>
                </TouchableOpacity>
                {!!keyStatus && <Text style={s.keyStatus}>{keyStatus}</Text>}
              </View>
            )}

            {!!research.error && <Text style={s.errorText}>{research.error}</Text>}

            {sections.length > 0 && (
              <View style={s.memo}>
                <Text style={s.memoTitle}>Research Memorandum</Text>
                {enhanced && enhanced.length > 0 && (
                  <View style={s.enhancedBox}>
                    <Text style={s.enhancedLabel}>Enhanced query</Text>
                    <Text style={s.enhancedText}>{enhanced.join(' · ')}</Text>
                  </View>
                )}
                {sections.map((sec, i) => (
                  <View key={i} style={[s.section, i > 0 && s.sectionRule]}>
                    <Text style={s.sectionHeading}>{sec.heading}</Text>
                    <Text style={s.sectionBody}>{sec.body}</Text>
                    {sec.citations?.length > 0 && (
                      <View style={s.citeRows}>
                        {sec.citations.map((c, j) => (
                          <Text key={j} style={s.citeRow}>
                            {c}
                          </Text>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={s.toCanvas}
                      onPress={() =>
                        addAiNode({
                          heading: sec.heading,
                          body: sec.body,
                          citations: sec.citations || [],
                        })
                      }>
                      <Text style={s.toCanvasText}>→ canvas</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {sources.length > 0 && (
                  <View style={s.sources}>
                    <Text style={s.sourcesLabel}>Sources</Text>
                    {sources.map((j) => (
                      <Text key={j.id} style={s.sourceItem}>
                        {j.title} — {j.citation}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {research.status === 'idle' && (
              <Text style={s.hint}>
                Answers are drafted from a curated pack of 14 leading Indian authorities,
                on-device. Add an API key above for live AI drafting.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    backdrop: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
    panel: {
      width: '86%',
      maxWidth: 440,
      backgroundColor: p.bg,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: -4, height: 0 },
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 52,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.surface,
    },
    title: { fontSize: 20, fontWeight: '700', color: p.text, fontFamily: SERIF },
    badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeLive: { backgroundColor: 'rgba(63,122,84,0.16)' },
    badgeOffline: { backgroundColor: 'rgba(199,154,40,0.18)' },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    closeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: p.border },
    closeText: { color: p.text, fontSize: 13 },
    body: { flex: 1 },
    bodyContent: { padding: 18 },
    queryInput: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 10,
      padding: 12,
      minHeight: 76,
      color: p.text,
      backgroundColor: p.surface,
      fontSize: 15,
      fontFamily: SERIF,
      textAlignVertical: 'top',
      marginBottom: 10,
    },
    runBtn: { backgroundColor: p.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
    runText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    stages: { marginBottom: 16, gap: 10 },
    stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stageLabel: { fontSize: 13, color: p.textMuted },
    keyBox: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 10, padding: 14, marginBottom: 16 },
    keyTitle: { fontSize: 14, fontWeight: '700', color: p.text, marginBottom: 6 },
    keyHint: { fontSize: 12, color: p.textMuted, marginBottom: 10, lineHeight: 17 },
    keyInput: { borderWidth: 1, borderColor: p.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: p.text, backgroundColor: p.bg, marginBottom: 10 },
    keyBtn: { backgroundColor: p.text, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
    keyBtnText: { color: p.surface, fontWeight: '700' },
    keyStatus: { fontSize: 12, color: p.textMuted, marginTop: 8 },
    errorText: { fontSize: 13, color: p.accent, marginBottom: 12 },
    memo: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 18 },
    memoTitle: { fontSize: 18, fontWeight: '700', color: p.text, fontFamily: SERIF, marginBottom: 12, textAlign: 'center' },
    enhancedBox: { backgroundColor: p.bg2, borderRadius: 8, padding: 10, marginBottom: 12 },
    enhancedLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: p.textMuted, marginBottom: 3 },
    enhancedText: { fontSize: 12.5, color: p.textMid },
    section: { paddingVertical: 12 },
    sectionRule: { borderTopWidth: 1, borderTopColor: p.border },
    sectionHeading: { fontSize: 15, fontWeight: '700', color: p.text, marginBottom: 6, fontFamily: SERIF },
    sectionBody: { fontSize: 13.5, lineHeight: 21, color: p.textMid, marginBottom: 8, fontFamily: SERIF, textAlign: 'justify' },
    citeRows: { marginBottom: 8 },
    citeRow: { fontSize: 11.5, color: p.textMuted, marginBottom: 2, fontFamily: SERIF },
    toCanvas: { alignSelf: 'flex-start', borderWidth: 1, borderColor: p.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    toCanvasText: { color: p.accent, fontSize: 12, fontWeight: '700' },
    sources: { marginTop: 8, borderTopWidth: 2, borderTopColor: p.text, paddingTop: 10 },
    sourcesLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: p.textMuted, marginBottom: 6 },
    sourceItem: { fontSize: 12, color: p.textMid, marginBottom: 4, fontFamily: SERIF },
    hint: { color: p.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', padding: 20, fontFamily: SERIF },
  });
