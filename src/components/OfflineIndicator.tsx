import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { offlineQueue, type OfflineQueueStatus } from '../services/offlineQueue';

export function useOfflineStatus(): OfflineQueueStatus | null {
  const [status, setStatus] = useState<OfflineQueueStatus | null>(null);

  useEffect(() => {
    void offlineQueue.getStatus().then(setStatus);

    const unsubscribe = offlineQueue.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  return status;
}

function getBannerState(status: OfflineQueueStatus): {
  message: string;
  bgColor: string;
} | null {
  if (!status.isOnline) {
    return {
      message: 'Offline Mode: showing cached data. New changes will sync when online.',
      bgColor: '#d32f2f',
    };
  }
  if (status.isSyncing) {
    return {
      message: 'Sync in progress: sending your offline changes.',
      bgColor: '#2e7d32',
    };
  }
  if (status.pendingCount > 0) {
    return {
      message: `${status.pendingCount} change(s) pending sync.`,
      bgColor: '#ed6c02',
    };
  }
  return null;
}

export const HeaderOfflineStatus: React.FC = () => {
  const status = useOfflineStatus();
  const label = useMemo(() => {
    if (!status) return null;
    if (!status.isOnline) return 'Offline';
    if (status.isSyncing) return 'Syncing';
    if (status.pendingCount > 0) return `Pending: ${status.pendingCount}`;
    return null;
  }, [status]);

  if (!label) return null;

  return (
    <View style={styles.headerTag}>
      <Text style={styles.headerTagText}>{label}</Text>
    </View>
  );
};

const OfflineIndicator: React.FC = () => {
  const status = useOfflineStatus();
  const [visibleAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (status && getBannerState(status)) {
      Animated.timing(visibleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(visibleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status]);

  if (!status) return null;

  const banner = getBannerState(status);
  if (!banner) return null;

  const translateY = visibleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0],
  });

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: banner.bgColor, transform: [{ translateY }] }]}
    >
      <Text style={styles.text}>{banner.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 44 : 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  headerTag: {
    backgroundColor: '#fff3e0',
    borderColor: '#ed6c02',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerTagText: {
    color: '#a54900',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default OfflineIndicator;
