import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { Dialog, HelperText, Portal, TextInput } from 'react-native-paper';

import { AppButton } from './app-button';
import { AppLabel } from './app-label';

const inputIconColor = 'rgba(96, 100, 108, 0.55)';

type FormDateFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  maximumDate?: Date;
  minimumDate?: Date;
  mode?: 'date' | 'time';
  required?: boolean;
  rules?: RegisterOptions<T, FieldPath<T>>;
};

function parseValue(value: unknown, mode: 'date' | 'time') {
  if (typeof value === 'string' && value) {
    if (mode === 'time') {
      const [hours = '0', minutes = '0'] = value.split(':');
      const date = new Date();
      date.setHours(Number(hours), Number(minutes), 0, 0);
      return date;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function formatValue(date: Date, mode: 'date' | 'time') {
  if (mode === 'time') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toISOString().slice(0, 10);
}

function formatStorageValue(date: Date, mode: 'date' | 'time') {
  if (mode === 'time') {
    return date.toTimeString().slice(0, 5);
  }

  return date.toISOString().slice(0, 10);
}

function clampDate(date: Date, minimumDate?: Date, maximumDate?: Date) {
  if (minimumDate && date < minimumDate) {
    return minimumDate;
  }

  if (maximumDate && date > maximumDate) {
    return maximumDate;
  }

  return date;
}

export function FormDateField<T extends FieldValues>({
  control,
  name,
  label,
  maximumDate,
  minimumDate,
  mode = 'date',
  required,
  rules,
}: FormDateFieldProps<T>) {
  const [visible, setVisible] = useState(false);
  const [pickerValue, setPickerValue] = useState<Date | null>(null);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange }, fieldState: { error } }) => {
        const date = parseValue(value, mode);
        const activeDate = pickerValue ?? date;
        const boundedActiveDate = mode === 'date' ? clampDate(activeDate, minimumDate, maximumDate) : activeDate;
        const displayValue = typeof value === 'string' && value ? formatValue(date, mode) : '';
        const openPicker = () => {
          setPickerValue(mode === 'date' ? clampDate(date, minimumDate, maximumDate) : date);
          setVisible(true);
        };

        const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (Platform.OS !== 'ios') {
            setVisible(false);
          }

          if (event.type === 'dismissed' || !selectedDate) {
            return;
          }

          if (Platform.OS === 'ios') {
            setPickerValue(selectedDate);
            return;
          }

          onChange(formatStorageValue(selectedDate, mode));
        };

        return (
          <View style={styles.field}>
            <AppLabel required={required}>{label}</AppLabel>
            <Pressable onPress={openPicker}>
              <TextInput
                mode="outlined"
                placeholder={mode === 'time' ? 'Select time' : 'Select date'}
                placeholderTextColor="rgba(69, 97, 106, 0.48)"
                value={displayValue}
                editable={false}
                pointerEvents="none"
                error={Boolean(error)}
                outlineStyle={styles.input}
                textColor="#123943"
                dense
                right={
                  <TextInput.Icon
                    icon={mode === 'time' ? 'clock-outline' : 'calendar-month-outline'}
                    color={inputIconColor}
                    onPress={openPicker}
                  />
                }
              />
            </Pressable>
            {visible && Platform.OS !== 'ios' && (
              <DateTimePicker
                value={boundedActiveDate}
                mode={mode}
                display="default"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleChange}
              />
            )}
            {Platform.OS === 'ios' && (
              <Portal>
                <Dialog visible={visible} onDismiss={() => setVisible(false)} style={styles.dialog}>
                  <Dialog.Title>{label}</Dialog.Title>
                  <Dialog.Content style={styles.dialogContent}>
                    <DateTimePicker
                      value={boundedActiveDate}
                      mode={mode}
                      display="spinner"
                      minimumDate={minimumDate}
                      maximumDate={maximumDate}
                      onChange={handleChange}
                      themeVariant="light"
                      textColor="#123943"
                      style={styles.iosPicker}
                    />
                  </Dialog.Content>
                  <Dialog.Actions>
                    <AppButton variant="ghost" onPress={() => setVisible(false)}>
                      Cancel
                    </AppButton>
                    <AppButton
                      onPress={() => {
                        onChange(formatStorageValue(boundedActiveDate, mode));
                        setVisible(false);
                      }}>
                      Done
                    </AppButton>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
            )}
            {error?.message && <HelperText type="error">{error.message}</HelperText>}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  input: {
    borderRadius: 8,
  },
  dialog: {
    borderRadius: 8,
    backgroundColor: '#f7fcfd',
  },
  dialogContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
    maxHeight: 190,
    overflow: 'hidden',
  },
  iosPicker: {
    width: '100%',
    height: 190,
    transform: [{ scale: 0.86 }],
  },
});
