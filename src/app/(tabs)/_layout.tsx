import { Redirect, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/theme';
import { useSession } from '@/lib/auth/session-context';

export default function TabsLayout() {
  const { session, isSessionLoading } = useSession();
  const insets = useSafeAreaInsets();

  if (isSessionLoading) {
    return (
      <View style={styles.loadingCanvas}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarIconStyle: styles.tabIcon,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarBackground: () => (
          <View pointerEvents="none" style={styles.tabBarBackground} />
        ),
        tabBarStyle: [
          styles.tabBar,
          {
            height: 70 + insets.bottom,
            paddingTop: 6,
            paddingBottom: insets.bottom + 6,
          },
        ],
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Home" />
          ),
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" size={Math.min(size, 24)} color={color} />
          ),
          tabBarItemStyle: styles.tabItem,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerShadowVisible: false,
          headerTintColor: '#ffffff',
          headerTitleStyle: { ...Typography.base, fontWeight: '700', fontSize: 18 },
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Attendance" />
          ),
          tabBarIcon: ({ color, size }) => (
            <Icon source="clock-outline" size={Math.min(size, 24)} color={color} />
          ),
          tabBarItemStyle: styles.tabItem,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.scanButton}>
              <Icon source="qrcode-scan" size={29} color={Colors.light.text} />
            </View>
          ),
          tabBarButton: (props) => <TabButton {...props} variant="scan" />,
          tabBarItemStyle: styles.scanTabItem,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'Duty Roster',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerShadowVisible: false,
          headerTintColor: '#ffffff',
          headerTitleStyle: { ...Typography.base, fontWeight: '700', fontSize: 18 },
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Roster" />
          ),
          tabBarIcon: ({ color, size }) => (
            <Icon source="timer-sand" size={Math.min(size, 24)} color={color} />
          ),
          tabBarItemStyle: styles.tabItem,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Profile" />
          ),
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-outline" size={Math.min(size, 24)} color={color} />
          ),
          tabBarItemStyle: styles.tabItem,
        }}
      />
    </Tabs>
  );
}

function TabLabel({ color, focused, label }: { color: string; focused: boolean; label: string }) {
  return <Text style={[styles.tabLabel, focused && styles.activeTabLabel, { color }]}>{label}</Text>;
}

function TabButton({
  ref: _ref,
  style,
  variant = 'default',
  ...props
}: any) {
  return (
    <Pressable
      {...props}
      style={[
        style,
        styles.tabButton,
        variant === 'scan' && styles.scanTabButton,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  loadingCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.appBgLight,
  },
  tabBar: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    position: 'absolute',
  },
  tabBarBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#ffffff',
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 6,
  },
  tabButton: {
    height: 58,
    backgroundColor: 'transparent',
  },
  scanTabButton: {
    backgroundColor: 'transparent',
  },
  tabItem: {
    flex: 1,
    height: 58,
    minWidth: 70,
  },
  scanTabItem: {
    flex: 1.05,
    width: 104,
    height: 58,
  },
  tabIcon: {
    marginBottom: 3,
  },
  tabLabel: {
    ...Typography.xs,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '300' as const,
    paddingBottom: 0,
  },
  activeTabLabel: {
    fontWeight: '400' as const,
  },
  scanButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eab308',
    borderWidth: 4,
    borderColor: '#ffffff',
    transform: [{ translateY: -20 }],
  },
});
