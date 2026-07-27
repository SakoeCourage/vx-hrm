import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Colors, Spacing } from '@/constants/theme';

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helper && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 132,
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  label: {
    color: Colors.light.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  value: {
    color: Colors.light.text,
    fontSize: 24,
    fontWeight: '600',
  },
  helper: {
    color: Colors.light.primary,
    fontSize: 11,
    fontWeight: '500',
  },
});
