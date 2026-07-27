import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Colors } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  action?: string;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {action && <Text style={styles.action}>{action}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: '600',
  },
  action: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: '500',
  },
});
