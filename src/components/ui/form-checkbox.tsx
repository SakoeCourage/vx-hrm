import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { Checkbox, HelperText } from 'react-native-paper';

import { Colors, Typography } from '@/constants/theme';

type FormCheckboxProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  rules?: RegisterOptions<T, FieldPath<T>>;
};

export function FormCheckbox<T extends FieldValues>({
  control,
  name,
  label,
  rules,
}: FormCheckboxProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <>
          <Checkbox.Item
            label={label}
            status={value ? 'checked' : 'unchecked'}
            onPress={() => onChange(!value)}
            mode="android"
            position="leading"
            color={Colors.light.primary}
            uncheckedColor={Colors.light.border}
            labelStyle={{
              ...Typography.sm,
              color: Colors.light.text,
              textAlign: 'left',
            }}
            style={{ paddingHorizontal: 0, paddingVertical: 0 }}
          />
          {error?.message && <HelperText type="error">{error.message}</HelperText>}
        </>
      )}
    />
  );
}
