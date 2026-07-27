import { StyleSheet, View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { Colors, Spacing } from '@/constants/theme';
import { AppStatusBadge } from '@/components/ui/app-status-badge';

type RequestCardProps = {
  title: string;
  dateRange: string;
  staffName: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};

export function RequestCard({ title, dateRange, staffName, reason, status }: RequestCardProps) {
  const tone = status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{dateRange}</Text>
        </View>
        <AppStatusBadge label={status} tone={tone} />
      </View>
      <Divider />
      <View style={styles.body}>
        <View style={styles.column}>
          <Text style={styles.label}>Staff</Text>
          <Text style={styles.value}>{staffName}</Text>
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Reason</Text>
          <Text style={styles.value}>{reason}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    color: Colors.light.text,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    color: Colors.light.textSecondary,
    fontSize: 12,
  },
  body: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: Colors.light.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  value: {
    color: Colors.light.text,
    fontSize: 12,
    lineHeight: 17,
  },
});
