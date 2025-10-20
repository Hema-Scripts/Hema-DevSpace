export type RootStackParamList = {
  Home: undefined;
  IncomingCall: {
    callerName?: string;
    imageUri?: string;
    scheduleAt?: number;
    randomDelay?: boolean;
    shake?: boolean;
    secretTap?: boolean;
    viaNotification?: boolean;
    viaShortcut?: boolean;
  } | undefined;
  Speaking: {
    callerName?: string;
    imageUri?: string;
  } | undefined;
};
