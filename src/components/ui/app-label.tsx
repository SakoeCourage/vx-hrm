import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { Colors } from '@/constants/theme';

type AppLabelProps = {
  children: React.ReactNode;
  required?: boolean;
  helper?: string;
};

export function AppLabel({ children, required, helper }: AppLabelProps) {
  return (
    <>
      <Text style={styles.label}>
        {children}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {helper && <Text style={styles.helper}>{helper}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    color: Colors.light.text,
    fontSize: 12,
    fontWeight: '500',
  },
  required: {
    color: Colors.light.danger,
  },
  helper: {
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
});
