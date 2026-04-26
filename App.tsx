import React from 'react';
import { View, StyleSheet } from 'react-native';
import './src/i18n';
import { useSplashGuard } from './src/components/SplashGuard';
import AppNavigator from './src/navigation';

export default function App() {
  const { appReady } = useSplashGuard();

  // Render nothing (splash is still visible) until critical init is done
  if (!appReady) return <View style={styles.root} />;

  return <AppNavigator />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
