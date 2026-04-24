import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import petService, { type Pet } from '../services/petService';
import { getPhoto } from '../utils/petPhotoStore';

interface Props {
  petId: string;
  onBack: () => void;
  onEdit: (pet: Pet) => void;
}

const PetDetailScreen: React.FC<Props> = ({ petId, onBack, onEdit }) => {
  const [pet, setPet] = useState<Pet | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, uri] = await Promise.all([petService.getPetById(petId), getPhoto(petId)]);
      setPet(data);
      setPhoto(uri);
    } catch {
      Alert.alert('Error', 'Failed to load pet details.');
      onBack();
    }
  }, [petId, onBack]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = () => {
    Alert.alert('Delete Pet', `Remove ${pet?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await petService.deletePet(petId);
            onBack();
          } catch {
            Alert.alert('Error', 'Failed to delete pet.');
          }
        },
      },
    ]);
  };

  if (!pet) return null;

  const fields: { label: string; value: string | undefined }[] = [
    { label: 'Species', value: pet.species },
    { label: 'Breed', value: pet.breed },
    {
      label: 'Date of Birth',
      value: pet.dateOfBirth ? new Date(pet.dateOfBirth).toLocaleDateString() : undefined,
    },
    { label: 'Microchip ID', value: pet.microchipId },
    { label: 'Added', value: new Date(pet.createdAt).toLocaleDateString() },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <TouchableOpacity onPress={() => onEdit(pet)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photo */}
        <View style={styles.photoSection}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.photoEmoji}>🐾</Text>
            </View>
          )}
          <Text style={styles.petName}>{pet.name}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          {fields
            .filter((f) => f.value)
            .map((f) => (
              <View key={f.label} style={styles.row}>
                <Text style={styles.rowLabel}>{f.label}</Text>
                <Text style={styles.rowValue}>{f.value}</Text>
              </View>
            ))}
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Pet</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17, color: '#4CAF50' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  editBtn: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: { color: '#4CAF50', fontWeight: '600' },
  content: { padding: 16 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photo: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  photoPlaceholder: { backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  photoEmoji: { fontSize: 48 },
  petName: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    maxWidth: '60%',
    textAlign: 'right',
  },
  deleteBtn: {
    backgroundColor: '#fdecea',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#e53935', fontWeight: '700', fontSize: 15 },
});

export default PetDetailScreen;
