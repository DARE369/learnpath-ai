import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import NetInfo from '@react-native-community/netinfo';
import { useDispatch } from 'react-redux';
import { setOnlineStatus } from './store/slices/offlineSlice';
import { store } from './store/store';
import RootNavigator from './navigation/RootNavigator';
import { initOfflineDB } from './services/offlineService';

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Initialize offline database
    initOfflineDB().catch(error => {
      console.error('Failed to initialize offline DB:', error);
    });

    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      dispatch(setOnlineStatus(state.isConnected === true));
    });

    return () => unsubscribe();
  }, [dispatch]);

  return <RootNavigator />;
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}
