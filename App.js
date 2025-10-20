import 'react-native-gesture-handler';
import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme as NavDefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme, Appbar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import HomeScreen from './src/screens/HomeScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import { applyRecurringTransactionsIfDue } from './src/utils/storage';

const THEME_KEY = 'ETP_THEME';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.centered}> 
          <Appbar.Content title="Something went wrong" subtitle={String(this.state.error)} />
        </View>
      );
    }
    return this.props.children;
  }
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HeaderGradient() {
  return (
    <LinearGradient
      colors={['#00C851', '#2196F3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    />
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerBackground: HeaderGradient,
        headerTitleStyle: { color: 'white' },
        tabBarStyle: {
          position: 'absolute',
          margin: 12,
          borderRadius: 24,
          height: 64,
          paddingBottom: 8
        },
        tabBarActiveTintColor: '#00C851',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const themePref = await AsyncStorage.getItem(THEME_KEY);
        if (themePref) setIsDark(themePref === 'dark');
        await applyRecurringTransactionsIfDue();
      } catch (e) {
        console.warn('Init error', e);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: '#00C851',
        secondary: '#2196F3',
        tertiary: '#FF6B35',
        accent: '#FF6B35',
      },
    };
  }, [isDark]);

  const navTheme = useMemo(() => ({
    ...(isDark ? NavDarkTheme : NavDefaultTheme),
    colors: {
      ...(isDark ? NavDarkTheme.colors : NavDefaultTheme.colors),
      primary: '#00C851',
      card: isDark ? '#121212' : '#ffffff',
      text: isDark ? '#ffffff' : '#111111',
      border: isDark ? '#333' : '#eee'
    }
  }), [isDark]);

  if (!isReady) {
    return (
      <LinearGradient colors={["#00C851", "#2196F3"]} style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <NavigationContainer theme={navTheme}>
          <ErrorBoundary>
            <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1 }}>
              <Stack.Navigator
                screenOptions={{
                  headerBackground: HeaderGradient,
                  headerTitleStyle: { color: 'white' },
                  ...(Platform.OS === 'ios' ? TransitionPresets.SlideFromRightIOS : TransitionPresets.FadeFromBottomAndroid),
                }}
              >
                <Stack.Screen name="Root" component={Tabs} options={{ headerShown: false }} />
                <Stack.Screen name="AddTransaction" component={AddExpenseScreen} options={{ title: 'Add Transaction' }} />
              </Stack.Navigator>
          </Animated.View>
          </ErrorBoundary>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
