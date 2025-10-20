import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'settings';
const ARMED_KEY = 'armed';

export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings ?? {}));
}

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setArmed(value) {
  await AsyncStorage.setItem(ARMED_KEY, JSON.stringify(!!value));
}

export async function isArmed() {
  try {
    const raw = await AsyncStorage.getItem(ARMED_KEY);
    return raw ? JSON.parse(raw) : false;
  } catch {
    return false;
  }
}
