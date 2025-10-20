import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Platform, TouchableOpacity } from 'react-native';
import { Button, Text, TextInput, RadioButton, List, Divider, Avatar, HelperText } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { scheduleCallNotification } from '../utils/notifications';
import { saveSettings, loadSettings, setArmed } from '../utils/storage';

const CALLERS = ['Mom', 'Dad', 'Office', 'Custom'];

export default function HomeScreen({ navigation }) {
  const [callerPreset, setCallerPreset] = useState('Mom');
  const [customCallerName, setCustomCallerName] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [trigger, setTrigger] = useState('manual');
  const [scheduleDate, setScheduleDate] = useState(new Date(Date.now() + 60_000));
  const [errors, setErrors] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const callerName = useMemo(() => (callerPreset === 'Custom' ? (customCallerName.trim() || 'Unknown') : callerPreset), [callerPreset, customCallerName]);

  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (saved) {
        setCallerPreset(saved.callerPreset ?? 'Mom');
        setCustomCallerName(saved.customCallerName ?? '');
        setImageUri(saved.imageUri ?? null);
        setTrigger(saved.trigger ?? 'manual');
        if (saved.scheduleDate) setScheduleDate(new Date(saved.scheduleDate));
      }
    })();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrors('Permission to access media library is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setErrors(null);
    const payload = {
      callerPreset,
      customCallerName,
      imageUri,
      trigger,
      scheduleDate: scheduleDate.toISOString(),
    };
    await saveSettings(payload);
  };

  const navigateToIncoming = () => {
    navigation.navigate('IncomingCall', { callerName, imageUri: imageUri ?? undefined });
  };

  // Comments: Each trigger below initiates the fake call in a different way
  // - manual: navigate immediately to IncomingCall
  // - schedule/notification/random: schedule a local notification; tapping opens IncomingCall
  // - shake: arms a global shake listener to navigate when device is shaken
  // - secret: triple tap on the title triggers call (panic mode)
  // - shortcut: Android-only; placeholder opens app settings; bare workflow can add real shortcuts
  const onTriggerSelected = async () => {
    await handleSave();

    if (trigger === 'manual') {
      navigateToIncoming();
      return;
    }

    if (trigger === 'schedule' || trigger === 'notification') {
      const id = await scheduleCallNotification(scheduleDate, { callerName, imageUri });
      if (!id) {
        setErrors('Notification permission not granted.');
      }
      return;
    }

    if (trigger === 'random') {
      const delayMs = 60_000 + Math.floor(Math.random() * 60_000);
      const date = new Date(Date.now() + delayMs);
      const id = await scheduleCallNotification(date, { callerName, imageUri });
      if (!id) setErrors('Notification permission not granted.');
      return;
    }

    if (trigger === 'shake') {
      await setArmed(true);
      return;
    }

    if (trigger === 'secret') {
      await setArmed(true);
      return;
    }

    if (trigger === 'shortcut') {
      if (Platform.OS === 'android') {
        try {
          // Open app details to allow user to add shortcut manually on some launchers
          await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS');
        } catch (e) {}
      }
      return;
    }
  };

  const onSecretTapAreaPress = async () => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }
    lastTapRef.current = now;

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      const saved = await loadSettings();
      if (saved?.trigger === 'secret') {
        navigateToIncoming();
      }
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={onSecretTapAreaPress}>
        <Text variant="headlineMedium" style={{ textAlign: 'center', marginVertical: 12 }}>
          Fake Call App
        </Text>
      </TouchableOpacity>

      <List.Section>
        <List.Subheader>Caller</List.Subheader>
        <RadioButton.Group onValueChange={setCallerPreset} value={callerPreset}>
          {CALLERS.map((c) => (
            <RadioButton.Item key={c} label={c} value={c} />
          ))}
        </RadioButton.Group>
        {callerPreset === 'Custom' && (
          <TextInput
            label="Custom caller name"
            value={customCallerName}
            onChangeText={setCustomCallerName}
            style={{ marginBottom: 8 }}
          />
        )}
        <Button mode="outlined" onPress={pickImage} style={{ marginBottom: 8 }}>
          {imageUri ? 'Change Photo' : 'Pick Photo'}
        </Button>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: 72, height: 72, borderRadius: 36, alignSelf: 'center' }} />
        ) : (
          <Avatar.Icon size={72} icon="account" style={{ alignSelf: 'center' }} />
        )}
      </List.Section>

      <Divider style={{ marginVertical: 12 }} />

      <List.Section>
        <List.Subheader>Trigger</List.Subheader>
        <RadioButton.Group onValueChange={setTrigger} value={trigger}>
          <RadioButton.Item label="Call Now (Manual)" value="manual" />
          <RadioButton.Item label="Schedule Call (Date/Time)" value="schedule" />
          <RadioButton.Item label="Random Delay (1–2 mins)" value="random" />
          <RadioButton.Item label="Shake to Trigger" value="shake" />
          <RadioButton.Item label="Secret Tap (Panic Mode)" value="secret" />
          <RadioButton.Item label="Notification Trigger" value="notification" />
          <RadioButton.Item label="Home Screen Shortcut (Android)" value="shortcut" />
        </RadioButton.Group>

        {(trigger === 'schedule' || trigger === 'notification') && (
          <View>
            <Button mode="outlined" onPress={() => setShowPicker(true)} style={{ marginBottom: 8 }}>
              Pick date & time
            </Button>
            <Text style={{ textAlign: 'center' }}>{scheduleDate.toLocaleString()}</Text>
            {showPicker && (
              <DateTimePicker
                value={scheduleDate}
                mode="datetime"
                is24Hour
                onChange={(_, date) => {
                  setShowPicker(false);
                  if (date) setScheduleDate(date);
                }}
              />
            )}
          </View>
        )}
      </List.Section>

      {errors ? <HelperText type="error">{errors}</HelperText> : null}

      <Button mode="contained" onPress={onTriggerSelected} style={{ marginTop: 16 }}>
        Save & Trigger
      </Button>
    </View>
  );
}
