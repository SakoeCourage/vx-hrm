import { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { Colors, Spacing } from '@/constants/theme';

type AppCardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}>;

export function AppCard({ title, subtitle, right, style, children }: AppCardProps) {
  return (
    <Card mode="contained" style={[styles.card, style]}>
      {(title || subtitle || right) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      <Card.Content style={styles.content}>{children}</Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  content: {
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
});
