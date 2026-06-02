import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface VideoProgress {
  videoId: string;
  currentTimeSeconds: number;
  totalDurationSeconds: number;
  isWatched: boolean;
}

interface QuizResponse {
  questionId: string;
  answer: string;
  isCorrect: boolean;
}

interface LearningState {
  currentPathId: string | null;
  currentVideoIndex: number;
  videoProgress: Record<string, VideoProgress>;
  quizResponses: QuizResponse[];
  isLoadingVideo: boolean;
  videoQuality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  playbackSpeed: 1 | 1.25 | 1.5 | 1.75 | 2;
}

const initialState: LearningState = {
  currentPathId: null,
  currentVideoIndex: 0,
  videoProgress: {},
  quizResponses: [],
  isLoadingVideo: false,
  videoQuality: 'auto',
  playbackSpeed: 1,
};

export const learningSlice = createSlice({
  name: 'learning',
  initialState,
  reducers: {
    setCurrentPath: (state, action: PayloadAction<{ pathId: string; videoIndex: number }>) => {
      state.currentPathId = action.payload.pathId;
      state.currentVideoIndex = action.payload.videoIndex;
    },
    updateVideoProgress: (state, action: PayloadAction<VideoProgress>) => {
      state.videoProgress[action.payload.videoId] = action.payload;
    },
    addQuizResponse: (state, action: PayloadAction<QuizResponse>) => {
      state.quizResponses.push(action.payload);
    },
    setVideoLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingVideo = action.payload;
    },
    setVideoQuality: (state, action: PayloadAction<'auto' | '1080p' | '720p' | '480p' | '360p'>) => {
      state.videoQuality = action.payload;
    },
    setPlaybackSpeed: (state, action: PayloadAction<1 | 1.25 | 1.5 | 1.75 | 2>) => {
      state.playbackSpeed = action.payload;
    },
    clearQuizResponses: (state) => {
      state.quizResponses = [];
    },
  },
});

export const {
  setCurrentPath,
  updateVideoProgress,
  addQuizResponse,
  setVideoLoading,
  setVideoQuality,
  setPlaybackSpeed,
  clearQuizResponses,
} = learningSlice.actions;
export default learningSlice.reducer;
