import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { AppButton } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';

type FaceVerificationNativeUnavailableProps = {
  error?: Error | null;
};

export function FaceVerificationNativeUnavailable({
  error,
}: FaceVerificationNativeUnavailableProps) {
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <Icon source="cellphone-cog" size={42} color={Colors.light.warning} />
      </View>
      <Text style={styles.title}>Face verification build required</Text>
      <Text style={styles.body}>
        This build does not include the native camera face-verification modules yet. Install a new
        development or preview build, then open the scanner again.
      </Text>
      {error ? <Text style={styles.error}>{error.message}</Text> : null}
      <AppButton icon="tools" disabled>
        Rebuild app required
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
  icon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.warningMuted,
  },
  title: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    ...Typography.base,
    maxWidth: 340,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...Typography.xs,
    maxWidth: 340,
    color: Colors.light.danger,
    textAlign: 'center',
  },
});
