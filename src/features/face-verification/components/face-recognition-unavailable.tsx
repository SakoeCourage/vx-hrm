import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { AppButton } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';

export function FaceRecognitionUnavailable() {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Icon source="shield-alert-outline" size={42} color={Colors.light.danger} />
      </View>
      <Text style={styles.title}>Face matching unavailable</Text>
      <Text style={styles.text}>
        Attendance scanning is blocked until local face matching is installed on this device.
      </Text>
      <AppButton icon="face-recognition" onPress={() => router.push('/face-enrollment')}>
        Enroll face again
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.light.appBgLight,
    paddingHorizontal: Spacing.four,
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.dangerMuted,
  },
  title: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    ...Typography.base,
    maxWidth: 320,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
