import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MousePointer2 } from 'lucide-react-native';
import { useCollab } from '../collab/collabStore';

/**
 * Peer cursors — thin pointer + small name pill (Notion/Figma style).
 */
export default function CollabCursors({ scale }: { scale: number }) {
  const peers = useCollab((s) => s.peers);
  const live = useCollab((s) => s.status === 'live');
  if (!live) return null;

  const inv = 1 / (scale || 1);

  return (
    <>
      {Object.values(peers).map((peer) => {
        if (peer.x == null || peer.y == null) return null;
        return (
          <View
            key={peer.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: peer.x,
              top: peer.y,
              transform: [{ scale: inv }],
            }}>
            <MousePointer2 size={16} color={peer.color} fill={peer.color} strokeWidth={1.2} />
            <View style={[styles.tag, { backgroundColor: peer.color }]}>
              <Text style={styles.tagText} numberOfLines={1}>
                {peer.name}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  tag: {
    marginTop: 0,
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 120,
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '500' },
});
