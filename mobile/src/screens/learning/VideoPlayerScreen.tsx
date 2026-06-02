import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';

export default function VideoPlayerScreen() {
  const route = useRoute<any>();
  const { pathId, videoIndex } = route.params;
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#00ff88" />
      ) : (
        <>
          <View style={styles.playerPlaceholder}>
            <Text style={styles.placeholderText}>Video Player</Text>
            <Text style={styles.placeholderSubtext}>Path {pathId} - Video {videoIndex}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton}>
              <Text style={styles.buttonText}>⏮ 1.25x</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Text style={styles.buttonText}>CC Captions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Text style={styles.buttonText}>📥 Download</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  playerPlaceholder: {
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  controlButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
