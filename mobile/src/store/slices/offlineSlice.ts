import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SyncQueueItem {
  id: string;
  type: 'quiz_response' | 'progress_update' | 'note_create';
  payload: any;
  timestamp: number;
  retries: number;
}

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  syncQueue: SyncQueueItem[];
  lastSyncTime: number | null;
  dataUsageMB: number;
  downloadedVideos: Set<string>;
  downloadProgress: Record<string, number>; // videoId -> percentage
}

const initialState: OfflineState = {
  isOnline: true,
  isSyncing: false,
  syncQueue: [],
  lastSyncTime: null,
  dataUsageMB: 0,
  downloadedVideos: new Set(),
  downloadProgress: {},
};

export const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    addToSyncQueue: (state, action: PayloadAction<SyncQueueItem>) => {
      state.syncQueue.push(action.payload);
    },
    removeFromSyncQueue: (state, action: PayloadAction<string>) => {
      state.syncQueue = state.syncQueue.filter(item => item.id !== action.payload);
    },
    setLastSyncTime: (state, action: PayloadAction<number>) => {
      state.lastSyncTime = action.payload;
    },
    incrementDataUsage: (state, action: PayloadAction<number>) => {
      state.dataUsageMB += action.payload;
    },
    addDownloadedVideo: (state, action: PayloadAction<string>) => {
      state.downloadedVideos.add(action.payload);
    },
    removeDownloadedVideo: (state, action: PayloadAction<string>) => {
      state.downloadedVideos.delete(action.payload);
    },
    setDownloadProgress: (state, action: PayloadAction<{ videoId: string; progress: number }>) => {
      state.downloadProgress[action.payload.videoId] = action.payload.progress;
    },
    clearDownloadProgress: (state, action: PayloadAction<string>) => {
      delete state.downloadProgress[action.payload];
    },
    resetDataUsage: (state) => {
      state.dataUsageMB = 0;
    },
  },
});

export const {
  setOnlineStatus,
  setSyncing,
  addToSyncQueue,
  removeFromSyncQueue,
  setLastSyncTime,
  incrementDataUsage,
  addDownloadedVideo,
  removeDownloadedVideo,
  setDownloadProgress,
  clearDownloadProgress,
  resetDataUsage,
} = offlineSlice.actions;
export default offlineSlice.reducer;
