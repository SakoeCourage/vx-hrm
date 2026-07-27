import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { Dialog, HelperText, List, Portal, TextInput } from 'react-native-paper';

import { Colors, Spacing, Typography } from '@/constants/theme';

import { AppLabel } from './app-label';

const inputIconColor = 'rgba(96, 100, 108, 0.55)';

type SelectOption = {
  label: string;
  value: string;
};

type FormSelectProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SelectOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
  rules?: RegisterOptions<T, FieldPath<T>>;
};

export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  searchable,
  searchPlaceholder,
  rules,
}: FormSelectProps<T>) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const filteredOptions = searchable
    ? options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;
  const closeMenu = () => {
    setVisible(false);
    setSearch('');
  };

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange }, fieldState: { error } }) => {
        const selected = options.find((option) => option.value === value);
        const openMenu = () => setVisible(true);

        return (
          <View style={styles.field}>
            <AppLabel>{label}</AppLabel>
            <Pressable onPress={openMenu}>
              <TextInput
                mode="outlined"
                placeholder={label}
                value={selected?.label ?? ''}
                editable={false}
                pointerEvents="none"
                error={Boolean(error)}
                outlineStyle={styles.input}
                dense
                right={<TextInput.Icon icon="chevron-down" color={inputIconColor} onPress={openMenu} />}
              />
            </Pressable>
            <Portal>
              <Dialog visible={visible} onDismiss={closeMenu} style={styles.dialog}>
                <Dialog.Title style={styles.dialogTitle}>{label}</Dialog.Title>
                {searchable && (
                  <Dialog.Content style={styles.searchContent}>
                    <TextInput
                      mode="outlined"
                      value={search}
                      onChangeText={setSearch}
                      placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                      dense
                      outlineStyle={styles.input}
                      left={<TextInput.Icon icon="magnify" color={inputIconColor} />}
                      right={
                        search ? (
                          <TextInput.Icon icon="close" color={inputIconColor} onPress={() => setSearch('')} />
                        ) : undefined
                      }
                    />
                  </Dialog.Content>
                )}
                <Dialog.ScrollArea style={styles.scrollArea}>
                  <ScrollView
                    style={styles.optionsScroll}
                    contentContainerStyle={styles.optionsContent}
                    showsVerticalScrollIndicator>
                    {filteredOptions.map((option) => (
                      <List.Item
                        key={option.value}
                        title={option.label}
                        titleNumberOfLines={2}
                        style={styles.option}
                        titleStyle={styles.optionTitle}
                        right={() =>
                          option.value === value ? (
                            <List.Icon icon="check" color={Colors.light.primary} />
                          ) : null
                        }
                        onPress={() => {
                          onChange(option.value);
                          closeMenu();
                        }}
                      />
                    ))}
                    {filteredOptions.length === 0 && (
                      <List.Item
                        title="No results found"
                        titleStyle={[styles.optionTitle, styles.emptyOptionTitle]}
                      />
                    )}
                  </ScrollView>
                </Dialog.ScrollArea>
              </Dialog>
            </Portal>
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
    backgroundColor: '#f7fcfd',
    borderRadius: 16,
  },
  dialogTitle: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  searchContent: {
    paddingBottom: Spacing.two,
  },
  scrollArea: {
    maxHeight: 420,
    paddingHorizontal: 0,
  },
  optionsScroll: {
    maxHeight: 420,
  },
  optionsContent: {
    paddingVertical: Spacing.one,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: Spacing.two,
  },
  optionTitle: {
    ...Typography.base,
    color: Colors.light.text,
  },
  emptyOptionTitle: {
    color: Colors.light.textSecondary,
  },
});
