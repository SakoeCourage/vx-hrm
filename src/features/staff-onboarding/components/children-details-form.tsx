import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { FAB, Icon, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBottomSheet,
  AppButton,
  FormDateField,
  FormSelect,
  FormTextField,
} from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  addPendingStaffChild,
  removePendingStaffChild,
  StaffChildDetail,
  StaffChildPayload,
  StaffChildrenDetailResponse,
  updatePendingStaffChild,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

import { OnboardingFormShell } from './onboarding-form-shell';
import { ChildrenDetailsFormValues, StaffOnboardingFormProps } from './types';

type ChildFormValues = {
  childName: string;
  dateOfBirth: string;
  gender: string;
};

type EditableChild = ChildFormValues & {
  id?: string;
};

const initialChildValues: ChildFormValues = {
  childName: '',
  dateOfBirth: '',
  gender: '',
};

const genderOptions = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
];

export function ChildrenDetailsForm({
  defaultValues,
  isSubmitting,
  onValidityChange,
  requestStatus,
  sectionData,
  submitSignal,
  onSubmit,
}: StaffOnboardingFormProps<ChildrenDetailsFormValues> & {
  requestStatus?: string;
  sectionData?: Record<string, unknown> | null;
}) {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);
  const lastSubmitSignalRef = useRef(0);
  const [children, setChildren] = useState<EditableChild[]>(() =>
    normalizeChildren(defaultValues?.children)
  );
  const [editingChild, setEditingChild] = useState<EditableChild | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isRequestChangesMode, setIsRequestChangesMode] = useState(false);

  const data = useMemo(() => unwrapSectionData(sectionData), [sectionData]);
  const childrenRequestId = readString(data?.id);
  const normalizedStatus = requestStatus?.trim().toUpperCase();
  const isPending = normalizedStatus === 'PENDING';
  const isApproved = normalizedStatus === 'APPROVED';
  const isReadOnlyApproved = isApproved && !isRequestChangesMode;
  const isEditable = !isPending && !isReadOnlyApproved;

  const form = useForm<ChildFormValues>({
    defaultValues: initialChildValues,
    mode: 'onChange',
  });

  const pendingMutationOptions = {
    onSuccess: async () => {
      sheetRef.current?.dismiss();
      setEditingChild(null);
      setEditingIndex(null);
      await queryClient.invalidateQueries({
        queryKey: ['staff-onboarding-section', session?.id, 'childrenData'],
      });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
  };

  const addPendingChildMutation = useMutation({
    mutationFn: (payload: StaffChildPayload) => {
      if (!childrenRequestId) {
        throw new Error('Children request is missing.');
      }

      return authenticatedRequest((activeSession) =>
        addPendingStaffChild({
          childrenRequestId,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload,
        })
      );
    },
    ...pendingMutationOptions,
  });

  const updatePendingChildMutation = useMutation({
    mutationFn: ({ childId, payload }: { childId: string; payload: StaffChildPayload }) =>
      authenticatedRequest((activeSession) =>
        updatePendingStaffChild({
          childId,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload,
        })
      ),
    ...pendingMutationOptions,
  });

  const removePendingChildMutation = useMutation({
    mutationFn: (childId: string) =>
      authenticatedRequest((activeSession) =>
        removePendingStaffChild({
          childId,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['staff-onboarding-section', session?.id, 'childrenData'],
      });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
  });

  const isChildMutationPending =
    addPendingChildMutation.isPending ||
    updatePendingChildMutation.isPending ||
    removePendingChildMutation.isPending;

  useEffect(() => {
    setChildren(normalizeChildren(defaultValues?.children));
    setIsRequestChangesMode(false);
  }, [defaultValues?.children]);

  useEffect(() => {
    onValidityChange?.(isPending ? false : isEditable && children.length > 0);
  }, [children.length, isEditable, isPending, onValidityChange]);

  useEffect(() => {
    if (
      submitSignal === undefined ||
      submitSignal <= 0 ||
      submitSignal === lastSubmitSignalRef.current ||
      isPending ||
      !isEditable
    ) {
      return;
    }

    lastSubmitSignalRef.current = submitSignal;
    onSubmit({
      children: children.map((child) => ({
        childName: child.childName.trim(),
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
      })),
    });
  }, [children, isEditable, isPending, onSubmit, submitSignal]);

  const openAddSheet = () => {
    if (!isEditable) {
      return;
    }

    setEditingChild(null);
    setEditingIndex(null);
    form.reset(initialChildValues);
    setIsSheetOpen(true);
    sheetRef.current?.present();
  };

  const openEditSheet = (child: EditableChild, index: number) => {
    if (!isEditable) {
      return;
    }

    setEditingChild(child);
    setEditingIndex(index);
    form.reset({
      childName: child.childName,
      dateOfBirth: child.dateOfBirth,
      gender: child.gender,
    });
    setIsSheetOpen(true);
    sheetRef.current?.present();
  };

  const saveChild = (values: ChildFormValues) => {
    const payload = {
      childName: values.childName.trim(),
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
    };

    if (isPending) {
      if (editingChild?.id) {
        updatePendingChildMutation.mutate({ childId: editingChild.id, payload });
        return;
      }

      addPendingChildMutation.mutate(payload);
      return;
    }

    setChildren((current) => {
      if (editingIndex === null) {
        return [...current, payload];
      }

      return current.map((child, index) =>
        index === editingIndex ? { ...child, ...payload } : child
      );
    });
    setIsSheetOpen(false);
    sheetRef.current?.dismiss();
  };

  const confirmRemoveChild = (child: EditableChild, index: number) => {
    if (!isEditable) {
      return;
    }

    Alert.alert('Remove child?', 'This child will be removed from the current children details.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (isPending && child.id) {
            removePendingChildMutation.mutate(child.id);
            return;
          }

          setChildren((current) => current.filter((_, childIndex) => childIndex !== index));
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <OnboardingFormShell
        icon="human-child"
        subtitle="Add each child once, then submit the complete list for HR review. Pending requests can be adjusted before approval.">
        {isReadOnlyApproved ? (
          <AppButton icon="pencil" variant="outline" onPress={() => setIsRequestChangesMode(true)}>
            Request changes
          </AppButton>
        ) : null}

        <View style={[styles.list, isEditable ? styles.listWithFab : null]}>
          {children.length > 0 ? (
            children.map((child, index) => (
              <View key={child.id ?? `${child.childName}-${index}`} style={styles.childRow}>
                <View style={styles.childIcon}>
                  <Icon source="human-child" size={22} color={Colors.light.warning} />
                </View>
                <View style={styles.childContent}>
                  <Text style={styles.childName}>{child.childName || 'Unnamed child'}</Text>
                  <Text style={styles.childMeta}>
                    {[child.gender, formatDisplayDate(child.dateOfBirth)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {isEditable ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => openEditSheet(child, index)}
                      hitSlop={8}>
                      <Icon source="pencil-outline" size={20} color={Colors.light.primary} />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => confirmRemoveChild(child, index)}
                      hitSlop={8}>
                      <Icon source="trash-can-outline" size={20} color={Colors.light.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon source="human-child" size={28} color={Colors.light.textSecondary} />
              <Text style={styles.emptyTitle}>No children added</Text>
              <Text style={styles.emptyText}>Use the add button to include each child before submitting.</Text>
            </View>
          )}
        </View>
      </OnboardingFormShell>

      {isEditable && !isSheetOpen ? (
        <Portal>
          <FAB
            icon="plus"
            label="Add a child"
            color="#ffffff"
            style={[
              styles.fab,
              {
                right: Spacing.four,
                bottom: Math.max(insets.bottom + Spacing.five, Spacing.five),
              },
            ]}
            disabled={isSubmitting || isChildMutationPending}
            loading={isChildMutationPending && !editingChild}
            onPress={openAddSheet}
          />
        </Portal>
      ) : null}

      <AppBottomSheet
        ref={sheetRef}
        title={editingChild ? 'Edit child' : 'Add child'}
        subtitle="Enter the child details exactly as they should appear on staff records."
        snapPoints={['58%', '84%']}
        onDismiss={() => {
          setIsSheetOpen(false);
          setEditingChild(null);
          setEditingIndex(null);
        }}>
        <FormTextField
          control={form.control}
          name="childName"
          label="Child name *"
          placeholder="Child full name"
          rules={{ required: 'Child name is required.' }}
        />
        <FormDateField
          control={form.control}
          name="dateOfBirth"
          label="Date of birth *"
          rules={{ required: 'Date of birth is required.' }}
        />
        <FormSelect
          control={form.control}
          name="gender"
          label="Gender *"
          options={genderOptions}
          rules={{ required: 'Gender is required.' }}
        />
        <View style={styles.sheetActions}>
          <AppButton
            variant="ghost"
            onPress={() => {
              setIsSheetOpen(false);
              sheetRef.current?.dismiss();
            }}>
            Cancel
          </AppButton>
          <AppButton
            icon="check"
            loading={isChildMutationPending}
            disabled={isChildMutationPending}
            onPress={form.handleSubmit(saveChild)}>
            Save child
          </AppButton>
        </View>
      </AppBottomSheet>
    </View>
  );
}

function normalizeChildren(children: ChildrenDetailsFormValues['children'] | undefined) {
  return (children ?? [])
    .map((child) => ({
      id: child.id,
      childName: child.childName ?? '',
      dateOfBirth: child.dateOfBirth ?? '',
      gender: child.gender ?? '',
    }))
    .filter((child) => child.childName || child.dateOfBirth || child.gender);
}

function unwrapSectionData(response: Record<string, unknown> | null | undefined) {
  if (!response) {
    return null;
  }

  const nested = response.data ?? response.result ?? response.request ?? response.current;
  return isRecord(nested) ? nested : response;
}

function readString(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function formatDisplayDate(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function mapChildrenResponseToValues(
  response: Record<string, unknown> | null | undefined
): ChildrenDetailsFormValues {
  const data = unwrapSectionData(response);
  const rawChildren = Array.isArray(data?.children) ? data.children : [];

  return {
    children: rawChildren
      .filter((child): child is StaffChildDetail => isRecord(child))
      .map((child) => ({
        id: readString(child.id) || undefined,
        childName: readString(child.childName),
        dateOfBirth: readString(child.dateOfBirth),
        gender: readString(child.gender),
      })),
  };
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    minHeight: 240,
  },
  list: {
    gap: Spacing.three,
  },
  listWithFab: {
    paddingBottom: 76,
  },
  childRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2f2f5',
    backgroundColor: '#ffffff',
    padding: Spacing.three,
  },
  childIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8e7',
  },
  childContent: {
    flex: 1,
    gap: 2,
  },
  childName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  childMeta: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  emptyTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  emptyText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: Colors.light.primary,
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
});
