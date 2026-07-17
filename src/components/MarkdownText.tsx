import React, { useMemo } from 'react';
import { Text, View, StyleSheet, type TextStyle, type StyleProp } from 'react-native';

type Props = {
  text: string;
  color: string;
  muted?: string;
  style?: StyleProp<TextStyle>;
};

type Seg = { text: string; bold?: boolean; italic?: boolean };

/** Split inline **bold** and *italic* (non-overlapping, bold first). */
function parseInline(line: string): Seg[] {
  const out: Seg[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), bold: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out.length ? out : [{ text: line }];
}

type Block =
  | { kind: 'h'; level: number; segs: Seg[] }
  | { kind: 'li'; ordered: boolean; segs: Seg[] }
  | { kind: 'p'; segs: Seg[] };

function parseBlocks(src: string): Block[] {
  const lines = (src || '').split('\n');
  const blocks: Block[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      blocks.push({ kind: 'p', segs: [{ text: ' ' }] });
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length, segs: parseInline(h[2]) });
      continue;
    }
    const ul = /^[-*]\s+(.+)$/.exec(line);
    if (ul) {
      blocks.push({ kind: 'li', ordered: false, segs: parseInline(ul[1]) });
      continue;
    }
    const ol = /^\d+\.\s+(.+)$/.exec(line);
    if (ol) {
      blocks.push({ kind: 'li', ordered: true, segs: parseInline(ol[1]) });
      continue;
    }
    blocks.push({ kind: 'p', segs: parseInline(line) });
  }
  return blocks;
}

function Inline({ segs, color, base }: { segs: Seg[]; color: string; base: TextStyle }) {
  return (
    <Text style={[base, { color }]}>
      {segs.map((s, i) => (
        <Text
          key={i}
          style={{
            fontWeight: s.bold ? '700' : base.fontWeight,
            fontStyle: s.italic ? 'italic' : 'normal',
          }}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Minimal markdown renderer: headings, bold/italic, bullets, numbered lists.
 * No HTML / links / code fences — enough for structured linear drafting.
 */
export default function MarkdownText({ text, color, style }: Props) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          const size = b.level === 1 ? 20 : b.level === 2 ? 17 : 15;
          return (
            <Inline
              key={i}
              segs={b.segs}
              color={color}
              base={{ fontSize: size, fontWeight: '700', lineHeight: size + 6, marginTop: i ? 8 : 0 }}
            />
          );
        }
        if (b.kind === 'li') {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={[styles.bullet, { color }, style]}>{b.ordered ? '•' : '•'}</Text>
              <View style={styles.liBody}>
                <Inline
                  segs={b.segs}
                  color={color}
                  base={{ fontSize: 16, lineHeight: 24, fontWeight: '400' }}
                />
              </View>
            </View>
          );
        }
        return (
          <Inline
            key={i}
            segs={b.segs}
            color={color}
            base={{ fontSize: 16, lineHeight: 24, fontWeight: '400', ...(StyleSheet.flatten(style) || {}) }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  liRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { fontSize: 16, lineHeight: 24, width: 14 },
  liBody: { flex: 1 },
});
