import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleCallNotification(triggerDate, data = {}) {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: data.title ?? 'Fake Call Scheduled',
      body: data.body ?? 'Tap to open incoming call screen',
      data: { type: 'call', ...data },
      sound: true,
    },
    trigger: { date: new Date(triggerDate) },
  });
  return id;
}

export { Notifications };
