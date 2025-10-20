import React, { useEffect, useRef, useState } from 'react';
import { View, Image } from 'react-native';
import { Button, Text, Avatar } from 'react-native-paper';

export default function SpeakingScreen({ route, navigation }) {
  const { callerName = 'Unknown', imageUri } = route?.params ?? {};
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const endCall = () => {
    navigation.replace('Home');
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#101010', padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      <Avatar.Image size={96} source={imageUri ? { uri: imageUri } : undefined} style={{ marginBottom: 16, backgroundColor: '#303030' }} />
      <Text variant="titleLarge" style={{ color: 'white', marginBottom: 24 }}>{callerName}</Text>
      <Text style={{ color: 'white', opacity: 0.7, marginBottom: 48 }}>{formatTime(seconds)}</Text>
      <Button mode="contained" buttonColor="#e74c3c" textColor="white" onPress={endCall}>
        End Call
      </Button>
    </View>
  );
}
