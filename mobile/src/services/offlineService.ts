import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

const db = SQLite.openDatabase('learnpath.db');

// Database initialization
export const initOfflineDB = async () => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      // Quiz responses table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS quiz_responses (
          id TEXT PRIMARY KEY,
          quiz_id TEXT NOT NULL,
          question_id TEXT NOT NULL,
          answer TEXT NOT NULL,
          is_correct INTEGER,
          timestamp INTEGER NOT NULL,
          synced INTEGER DEFAULT 0
        );`
      );

      // Video progress table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS video_progress (
          id TEXT PRIMARY KEY,
          video_id TEXT NOT NULL,
          current_time_seconds INTEGER,
          total_duration_seconds INTEGER,
          is_watched INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL,
          synced INTEGER DEFAULT 0
        );`
      );

      // Downloaded videos table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS downloaded_videos (
          id TEXT PRIMARY KEY,
          video_id TEXT NOT NULL UNIQUE,
          local_path TEXT NOT NULL,
          file_size INTEGER,
          quality TEXT,
          downloaded_at INTEGER NOT NULL
        );`
      );

      // Notes table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          video_id TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          synced INTEGER DEFAULT 0
        );`
      );
    }, reject, () => resolve());
  });
};

// Save quiz response locally
export const saveQuizResponseLocally = async (
  quizId: string,
  questionId: string,
  answer: string,
  isCorrect: boolean
) => {
  const id = `response_${Date.now()}`;
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO quiz_responses (id, quiz_id, question_id, answer, is_correct, timestamp, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [id, quizId, questionId, answer, isCorrect ? 1 : 0, Date.now()],
        () => resolve(),
        (_, error) => {
          reject(error);
          return true;
        }
      );
    });
  });
};

// Save video progress locally
export const saveVideoProgressLocally = async (
  videoId: string,
  currentTimeSeconds: number,
  totalDurationSeconds: number,
  isWatched: boolean
) => {
  const id = `progress_${videoId}`;
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO video_progress
         (id, video_id, current_time_seconds, total_duration_seconds, is_watched, timestamp, synced)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [id, videoId, currentTimeSeconds, totalDurationSeconds, isWatched ? 1 : 0, Date.now()],
        () => resolve(),
        (_, error) => {
          reject(error);
          return true;
        }
      );
    });
  });
};

// Get unsynced quiz responses
export const getUnsyncedQuizResponses = async () => {
  return new Promise<any[]>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM quiz_responses WHERE synced = 0 ORDER BY timestamp ASC`,
        [],
        (_, result) => resolve(result.rows._array),
        (_, error) => {
          reject(error);
          return true;
        }
      );
    });
  });
};

// Mark responses as synced
export const markQuizResponsesSynced = async (ids: string[]) => {
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      const placeholders = ids.map(() => '?').join(',');
      tx.executeSql(
        `UPDATE quiz_responses SET synced = 1 WHERE id IN (${placeholders})`,
        ids,
        () => resolve(),
        (_, error) => {
          reject(error);
          return true;
        }
      );
    });
  });
};

// Download video for offline use
export const downloadVideoForOffline = async (
  videoId: string,
  videoUrl: string,
  quality: string,
  onProgress?: (progress: number) => void
) => {
  try {
    const fileName = `video_${videoId}_${quality}.mp4`;
    const localPath = `${FileSystem.documentDirectory}videos/${fileName}`;

    // Create directory if it doesn't exist
    const dirPath = `${FileSystem.documentDirectory}videos`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.createAsyncIterable(dirPath);
    }

    // Download file
    const downloadResumable = FileSystem.createDownloadResumable(
      videoUrl,
      localPath,
      {},
      onProgress ? ({ totalBytesWritten, totalBytesExpectedToDownload }) => {
        const progress = totalBytesWritten / totalBytesExpectedToDownload;
        onProgress(progress);
      } : undefined
    );

    const { uri } = await downloadResumable.downloadAsync();

    // Save to database
    const fileStat = await FileSystem.getInfoAsync(uri);
    return new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `INSERT OR REPLACE INTO downloaded_videos
           (id, video_id, local_path, file_size, quality, downloaded_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`dv_${videoId}_${quality}`, videoId, uri, fileStat.size || 0, quality, Date.now()],
          () => resolve(),
          (_, error) => {
            reject(error);
            return true;
          }
        );
      });
    });
  } catch (error) {
    throw new Error(`Failed to download video: ${error}`);
  }
};

// Get downloaded videos
export const getDownloadedVideos = async () => {
  return new Promise<any[]>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM downloaded_videos`,
        [],
        (_, result) => resolve(result.rows._array),
        (_, error) => {
          reject(error);
          return true;
        }
      );
    });
  });
};

// Delete downloaded video
export const deleteDownloadedVideo = async (videoId: string) => {
  try {
    // Delete from database
    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM downloaded_videos WHERE video_id = ?`,
          [videoId],
          () => resolve(),
          (_, error) => {
            reject(error);
            return true;
          }
        );
      });
    });

    // Delete physical files
    const video = await new Promise<any>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT local_path FROM downloaded_videos WHERE video_id = ?`,
          [videoId],
          (_, result) => resolve(result.rows._array[0]),
          (_, error) => {
            reject(error);
            return true;
          }
        );
      });
    });

    if (video?.local_path) {
      await FileSystem.deleteAsync(video.local_path, { idempotent: true });
    }
  } catch (error) {
    console.error(`Failed to delete video: ${error}`);
  }
};

// Check if device is online
export const checkConnectivity = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
};
