import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Text, Alert } from 'react-native';
import petService from '../services/petService';

interface PetPhotoUploaderProps {
  petId: string;
  currentPhotoUrl?: string;
  onPhotoUploaded?: (url: string) => void;
}

export const PetPhotoUploader: React.FC<PetPhotoUploaderProps> = ({
  return (
    <TouchableOpacity
      onPress={handleUpload}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={photoUrl ? 'Change pet photo' : 'Add pet photo'}
      accessibilityHint={uploading ? 'Uploading photo' : 'Opens photo picker'}
    >
      <View style={{ width: 120, height: 120, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: '100%', height: '100%', borderRadius: 8 }}
            resizeMode="cover"
            accessible
            accessibilityLabel="Pet photo"
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>{uploading ? 'Uploading...' : 'Add Photo'}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <TouchableOpacity onPress={handleUpload} disabled={uploading}>
      <View style={{ width: 120, height: 120, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        {photoUrl ? (
          <Image 
            source={{ uri: photoUrl }} 
            style={{ width: '100%', height: '100%', borderRadius: 8 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>{uploading ? 'Uploading...' : 'Add Photo'}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
