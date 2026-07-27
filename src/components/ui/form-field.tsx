import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

import { AppLabel } from './app-label';

type FormTextFieldProps<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  rules?: RegisterOptions<T, FieldPath<T>>;
  canToggleSecureText?: boolean;
};

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  rules,
  canToggleSecureText,
  ...props
}: FormTextFieldProps<T>) {
  const [secureTextVisible, setSecureTextVisible] = useState(false);
  const isSecureField = Boolean(props.secureTextEntry);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onBlur, onChange }, fieldState: { error } }) => (
        <View style={styles.field}>
          <AppLabel>{label}</AppLabel>
          <TextInput
            mode="outlined"
            placeholder={props.placeholder ?? label}
            value={String(value ?? '')}
            onBlur={onBlur}
            onChangeText={onChange}
            error={Boolean(error)}
            outlineStyle={{ borderRadius: 8 }}
            dense
            {...props}
            secureTextEntry={isSecureField && !secureTextVisible}
            right={
              canToggleSecureText && isSecureField ? (
                <TextInput.Icon
                  icon={secureTextVisible ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setSecureTextVisible((visible) => !visible)}
                />
              ) : (
                props.right
              )
            }
          />
          {error?.message && <HelperText type="error">{error.message}</HelperText>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 5,
  },
});
