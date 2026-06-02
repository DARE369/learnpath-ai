import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

interface LearningPath {
  id: string;
  title: string;
  subject: string;
  progress: number;
  videos: number;
}

export default function LearningScreen({ navigation }: any) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useSelector((state: RootState) => state.auth.token);

  useEffect(() => {
    fetchPaths();
  }, []);

  const fetchPaths = async () => {
    try {
      const response = await axios.get(`${API_BASE}/path/user-paths`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPaths(response.data);
    } catch (error) {
      console.error('Failed to fetch paths:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {paths.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No learning paths yet</Text>
          <TouchableOpacity style={styles.exploreButton}>
            <Text style={styles.exploreText}>Explore Topics</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={paths}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.pathCard}
              onPress={() =>
                navigation.navigate('VideoPlayer', { pathId: item.id, videoIndex: 0 })
              }
            >
              <View>
                <Text style={styles.pathTitle}>{item.title}</Text>
                <Text style={styles.pathSubject}>{item.subject}</Text>
              </View>
              <View style={styles.pathMeta}>
                <Text style={styles.videosCount}>{item.videos} videos</Text>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${item.progress}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{item.progress}%</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
  },
  listContainer: {
    padding: 16,
  },
  pathCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  pathSubject: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  pathMeta: {
    marginTop: 12,
  },
  videosCount: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff88',
  },
  progressText: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  exploreText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
