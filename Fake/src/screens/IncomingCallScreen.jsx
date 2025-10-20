import React, { useEffect, useRef, useState } from 'react';
import { View, ImageBackground, Image, Platform } from 'react-native';
import { Button, Text, Avatar } from 'react-native-paper';
import { Audio } from 'expo-av';
import Shake from 'react-native-shake';
import { isArmed, loadSettings, setArmed } from '../utils/storage';
import { Notifications } from '../utils/notifications';

export default function IncomingCallScreen({ route, navigation }) {
  const params = route?.params ?? {};
  const [callerName, setCallerName] = useState(params.callerName ?? 'Unknown');
  const [imageUri, setImageUri] = useState(params.imageUri);
  const soundRef = useRef(null);
  const [ringing, setRinging] = useState(false);

  // Comments: We arm shake/secret triggers via storage. If armed, shaking will navigate here.
  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (!params.callerName && saved) {
        setCallerName(saved.callerPreset === 'Custom' ? (saved.customCallerName || 'Unknown') : (saved.callerPreset || 'Unknown'));
        setImageUri(saved.imageUri || undefined);
      }
    })();
  }, []);

  useEffect(() => {
    // Start ringtone on appear (requires a bundled audio asset)
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/ringtone.mp3'),
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
        setRinging(true);
      } catch {
        setRinging(false);
      }
    })();

    return () => {
      (async () => {
        try {
          if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          }
        } catch {}
      })();
    };
  }, []);

  useEffect(() => {
    // Handle notification taps to open this screen
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Already on incoming screen; ensure ringing state
      setRinging(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Shake trigger
    let sub;
    (async () => {
      const armed = await isArmed();
      if (armed) {
        sub = Shake.addListener(() => {
          navigation.replace('IncomingCall', { callerName, imageUri });
        });
      }
    })();
    return () => {
      if (sub) sub.remove();
    };
  }, [callerName, imageUri]);

  const accept = async () => {
    await setArmed(false);
    setRinging(false);
    navigation.replace('Speaking', { callerName, imageUri });
  };

  const decline = async () => {
    await setArmed(false);
    setRinging(false);
    navigation.replace('Home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#101010', padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      <Avatar.Image size={96} source={imageUri ? { uri: imageUri } : undefined} style={{ marginBottom: 16, backgroundColor: '#303030' }} />
      <Text variant="titleLarge" style={{ color: 'white', marginBottom: 24 }}>{callerName}</Text>
      <Text style={{ color: 'white', opacity: 0.7, marginBottom: 48 }}>Incoming call</Text>

      <View style={{ flexDirection: 'row', gap: 24 }}>
        <Button mode="contained" buttonColor="#2ecc71" textColor="white" onPress={accept}>
          Accept
        </Button>
        <Button mode="contained" buttonColor="#e74c3c" textColor="white" onPress={decline}>
          Decline
        </Button>
      </View>
    </View>
  );
}
