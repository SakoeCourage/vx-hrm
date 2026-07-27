import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { Colors, Spacing, Typography } from '@/constants/theme';

type OnboardingFormShellProps = PropsWithChildren<{
  icon: string;
  subtitle: string;
}>;

export function OnboardingFormShell({ icon, subtitle, children }: OnboardingFormShellProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.descriptionRow}>
          <View style={styles.iconBadge}>
            <Icon source={icon} size={18} color="#b7791f" />
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.one,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.warningMuted,
  },
  subtitle: {
    ...Typography.base,
    flex: 1,
    color: Colors.light.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2f2f5',
  },
  fields: {
    gap: Spacing.four,
  },
});
