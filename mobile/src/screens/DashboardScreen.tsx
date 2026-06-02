import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

interface DashboardStats {
  user: {
    name: string;
    email: string;
  };
  this_week: {
    active_minutes: number;
    videos_watched: number;
    quizzes_completed: number;
    avg_score: number;
  };
  streak: number;
  total_points: number;
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const isOnline = useSelector((state: RootState) => state.offline.isOnline);

  useEffect(() => {
    if (isOnline) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [isOnline]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/progress/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{user?.name || 'Learner'}</Text>
        {!isOnline && <Text style={styles.offlineIndicator}>📡 Offline Mode</Text>}
      </View>

      {loading && !stats ? (
        <ActivityIndicator size="large" color="#00ff88" style={styles.loader} />
      ) : (
        <>
          {/* Stats Cards */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.this_week.active_minutes || 0}</Text>
              <Text style={styles.statLabel}>Minutes Studied</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.this_week.videos_watched || 0}</Text>
              <Text style={styles.statLabel}>Videos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.this_week.quizzes_completed || 0}</Text>
              <Text style={styles.statLabel}>Quizzes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.this_week.avg_score || 0}%</Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </View>
          </View>

          {/* Streak & Points */}
          <View style={styles.section}>
            <View style={[styles.card, styles.streakCard]}>
              <Text style={styles.flame}>🔥</Text>
              <View style={styles.streakContent}>
                <Text style={styles.streakNumber}>{stats?.streak || 0}</Text>
                <Text style={styles.streakLabel}>Day Streak</Text>
              </View>
            </View>

            <View style={[styles.card, styles.pointsCard]}>
              <Text style={styles.star}>⭐</Text>
              <View style={styles.pointsContent}>
                <Text style={styles.pointsNumber}>{stats?.total_points || 0}</Text>
                <Text style={styles.pointsLabel}>Total Points</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Learning</Text>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionIcon}>📚</Text>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Resume Path</Text>
                <Text style={styles.actionSubtitle}>Biology Basics - Video 3</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionIcon}>📝</Text>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Pending Quiz</Text>
                <Text style={styles.actionSubtitle}>Genetics Chapter Review</Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Offline Status */}
          {!isOnline && (
            <View style={styles.offlineWarning}>
              <Text style={styles.offlineTitle}>You're offline</Text>
              <Text style={styles.offlineMessage}>
                Changes will sync when you're back online
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  offlineIndicator: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 8,
  },
  loader: {
    marginTop: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00ff88',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  pointsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffeb3b',
  },
  flame: {
    fontSize: 32,
    marginRight: 16,
  },
  star: {
    fontSize: 32,
    marginRight: 16,
  },
  streakContent: {
    flex: 1,
  },
  pointsContent: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  streakLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  pointsNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 20,
    color: '#00ff88',
  },
  offlineWarning: {
    backgroundColor: '#ff9800',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  offlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  offlineMessage: {
    fontSize: 12,
    color: '#f5f5f5',
    marginTop: 4,
  },
});
