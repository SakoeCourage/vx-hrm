import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { AppButton } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';

type FaceEnrollmentRequiredProps = {
  onEnrollPress: () => void;
};

export function FaceEnrollmentRequired({ onEnrollPress }: FaceEnrollmentRequiredProps) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Icon source="account-lock-outline" size={42} color={Colors.light.primary} />
      </View>
      <Text style={styles.title}>Face enrollment required</Text>
      <Text style={styles.text}>
        Enroll your face on this device before scanning attendance QR codes.
      </Text>
      <AppButton variant="outline" onPress={onEnrollPress}>
        Enroll face
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
    backgroundColor: Colors.light.primaryMuted,
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
