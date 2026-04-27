import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { HeaderOfflineStatus, useOfflineStatus } from '../components/OfflineIndicator';
import { OptimizedImage } from '../components/OptimizedImage';
import petService, { type Pet } from '../services/petService';

interface Props {
  onSelectPet: (pet: Pet) => void;
  onAddPet: () => void;
}

const PetListScreen: React.FC<Props> = ({ onSelectPet, onAddPet }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const offlineStatus = useOfflineStatus();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await petService.getAllPets();
      setPets(data);
    } catch {
      Alert.alert('Error', 'Failed to load pets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const renderItem = ({ item }: { item: Pet }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onSelectPet(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.species}`}
      accessibilityHint="Opens pet details"
    >
      {item.photoUrl || item.thumbnailUrl ? (
        <OptimizedImage
          uri={item.thumbnailUrl || item.photoUrl || ''}
          style={styles.avatar}
          accessibilityLabel={`${item.name} photo`}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarEmoji}>🐾</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.petName}>{item.name}</Text>
        <Text style={styles.petMeta}>
          {item.species}
          {item.breed ? ` · ${item.breed}` : ''}
        </Text>
        {item.dateOfBirth && (
          <Text style={styles.petMeta}>
            Born: {new Date(item.dateOfBirth).toLocaleDateString()}
          </Text>
        )}
        {!offlineStatus?.isOnline ? <Text style={styles.cachedChip}>Cached</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Pets</Text>
          <HeaderOfflineStatus />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onAddPet}
          accessibilityRole="button"
          accessibilityLabel="Add pet"
          accessibilityHint="Adds a new pet"
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {!offlineStatus?.isOnline ? (
        <View style={styles.cachedBanner}>
          <Text style={styles.cachedBannerText}>Showing cached pets while offline.</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty} accessibilityLiveRegion="polite">
              No pets yet. Add one!
            </Text>
          }
          onRefresh={load}
          refreshing={loading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  loader: { marginTop: 40 },
  list: { padding: 12 },
  cachedBanner: {
    backgroundColor: '#fff3e0',
    borderBottomWidth: 1,
    borderBottomColor: '#ffe0b2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cachedBannerText: { color: '#a54900', fontSize: 12, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  petName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  petMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  cachedChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: '#a54900',
    backgroundColor: '#fff3e0',
    borderColor: '#ed6c02',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chevron: { fontSize: 22, color: '#bbb' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
});

export default PetListScreen;
