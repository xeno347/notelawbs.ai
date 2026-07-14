import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MousePointer2 } from 'lucide-react-native';
import { useCollab } from '../collab/collabStore';

/**
 * Renders peer cursors inside the transformed canvas board. Coordinates are in
 * board/world space; we inverse-scale each cursor so it stays a constant size
 * regardless of the local zoom level.
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
              // Keep cursor tip pinned without Reanimated transformOrigin.
            }}>
            <MousePointer2 size={20} color={peer.color} fill={peer.color} strokeWidth={1.4} />
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
    marginTop: 2,
    marginLeft: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 120,
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
