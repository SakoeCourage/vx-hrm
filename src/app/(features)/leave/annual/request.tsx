import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

import { AppButton, AppSnackbar, FormDateField, FormTextField, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  createLeaveRequest,
  getLeaveTypes,
  previewLeaveDates,
  LeaveRequestPayload,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

type AnnualRequestForm = {
  startDate: string;
  endDate: string;
  relievingOfficer: string;
  reason: string;
  contactAddressOnLeave: string;
  contactPhone: string;
  contactEmail: string;
  nextOfKinContact: string;
  supportingDocumentUrl: string;
};

export default function AnnualLeaveRequestScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();
  const leaveYear = new Date().getFullYear();
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'success' | 'danger';
  }>({
    visible: false,
    message: '',
    tone: 'success',
  });

  const { control, handleSubmit } = useForm<AnnualRequestForm>({
    defaultValues: {
      startDate: '',
      endDate: '',
      relievingOfficer: '',
      reason: 'Annual leave',
      contactAddressOnLeave: '',
      contactPhone: session?.phone ?? '',
      contactEmail: session?.email ?? '',
      nextOfKinContact: '',
      supportingDocumentUrl: '',
    },
  });

  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  const leaveTypesQuery = useQuery({
    queryKey: ['leave-types', session?.tenantId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getLeaveTypes({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  const annualType = useMemo(
    () =>
      (leaveTypesQuery.data?.data ?? []).find(
        (type) => type.leaveCategory?.toUpperCase() === 'ANNUAL' || type.leaveName?.toLowerCase().includes('annual')
      ),
    [leaveTypesQuery.data?.data]
  );

  const previewQuery = useQuery({
    queryKey: ['leave-date-preview', session?.tenantId, annualType?.id, startDate, endDate],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        previewLeaveDates({
          leaveTypeId: annualType!.id,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          startDate,
          endDate,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && annualType?.id && startDate && endDate),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: LeaveRequestPayload) =>
      authenticatedRequest((activeSession) =>
        createLeaveRequest({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload,
        })
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-leave-dashboard', session?.tenantId, leaveYear] }),
        queryClient.invalidateQueries({ queryKey: ['staff-leave-requests', session?.tenantId, session?.staffIdentificationNumber, leaveYear] }),
      ]);
      setToast({
        visible: true,
        message: 'Leave request submitted successfully.',
        tone: 'success',
      });
      setTimeout(() => router.back(), 700);
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Could not submit leave request.',
        tone: 'danger',
      });
    },
  });

  const onSubmit = (values: AnnualRequestForm) => {
    if (!annualType) {
      setToast({
        visible: true,
        message: 'Annual leave type is not available.',
        tone: 'danger',
      });
      return;
    }

    const numberOfDays = previewQuery.data?.effectiveDays ?? 0;
    if (!numberOfDays) {
      setToast({
        visible: true,
        message: 'Preview the leave dates before submitting.',
        tone: 'danger',
      });
      return;
    }

    submitMutation.mutate({
      leaveTypeId: annualType.id,
      startDate: values.startDate,
      endDate: values.endDate,
      year: leaveYear,
      numberOfDays,
      relievingOfficer: values.relievingOfficer,
      contactWhenAway: true,
      reason: values.reason,
      contactAddressOnLeave: values.contactAddressOnLeave,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
      nextOfKinContact: values.nextOfKinContact,
      supportingDocumentUrl: values.supportingDocumentUrl || null,
    });
  };

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      contentStyle={styles.content}
      header={
        <View style={styles.appBar}>
          <Pressable style={styles.appBarButton} onPress={() => router.back()}>
            <Icon source="chevron-left" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.appBarTitle}>Leave request</Text>
          <View style={styles.appBarSpacer} />
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Icon source="send-outline" size={24} color={Colors.light.primary} />
        </View>
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>Submit annual leave</Text>
          <Text style={styles.infoCaption}>This request requires an approved annual leave plan for the selected year.</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <FormDateField control={control} name="startDate" label="Start date" rules={{ required: 'Start date is required.' }} />
        <FormDateField control={control} name="endDate" label="End date" rules={{ required: 'End date is required.' }} />
        <FormTextField control={control} name="relievingOfficer" label="Relieving officer" placeholder="Staff ID e.g. KBA000001" rules={{ required: 'Relieving officer is required.' }} />
        <FormTextField control={control} name="reason" label="Reason" rules={{ required: 'Reason is required.' }} />
        <FormTextField control={control} name="contactAddressOnLeave" label="Contact address on leave" rules={{ required: 'Contact address is required.' }} />
        <FormTextField control={control} name="contactPhone" label="Contact phone" keyboardType="phone-pad" rules={{ required: 'Contact phone is required.' }} />
        <FormTextField control={control} name="contactEmail" label="Contact email" keyboardType="email-address" autoCapitalize="none" rules={{ required: 'Contact email is required.' }} />
        <FormTextField control={control} name="nextOfKinContact" label="Next of kin contact" keyboardType="phone-pad" rules={{ required: 'Next of kin contact is required.' }} />
        <FormTextField control={control} name="supportingDocumentUrl" label="Supporting document URL" placeholder="Optional" autoCapitalize="none" />
      </View>

      {(previewQuery.isLoading || previewQuery.data) && (
        <View style={styles.previewCard}>
          <Text style={styles.sectionTitle}>Date preview</Text>
          {previewQuery.isLoading ? (
            <View style={styles.inlineState}>
              <ActivityIndicator size={18} color={Colors.light.primary} />
              <Text style={styles.mutedText}>Checking selected dates</Text>
            </View>
          ) : previewQuery.data ? (
            <>
              <View style={styles.previewSummary}>
                <Text style={styles.previewDays}>{previewQuery.data.effectiveDays}</Text>
                <Text style={styles.mutedText}>effective days</Text>
              </View>
              {previewQuery.data.days.slice(0, 7).map((day) => (
                <View key={day.date} style={styles.previewDay}>
                  <Text style={styles.previewDayDate}>{formatDate(day.date)}</Text>
                  <Text style={[styles.previewDayStatus, { color: getPreviewColor(day.status) }]}>{formatLabel(day.status)}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      )}

      <AppButton
        icon="send-outline"
        loading={submitMutation.isPending}
        disabled={submitMutation.isPending || !annualType || !previewQuery.data}
        onPress={handleSubmit(onSubmit)}>
        Submit request
      </AppButton>

      <AppSnackbar
        visible={toast.visible}
        message={toast.message}
        tone={toast.tone}
        position="top"
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );
}

function getPreviewColor(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ELIGIBLE') return Colors.light.success;
  if (normalized === 'HOLIDAY') return '#c48118';
  if (normalized === 'WEEKEND') return Colors.light.textSecondary;
  return Colors.light.danger;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  appBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  appBarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  appBarSpacer: {
    width: 38,
    height: 38,
  },
  appBarTitle: {
    ...Typography.md,
    flex: 1,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  infoIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
  infoCaption: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  formCard: {
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  previewCard: {
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  sectionTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mutedText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  previewSummary: {
    borderRadius: 16,
    backgroundColor: Colors.light.appBgLight,
    padding: Spacing.three,
  },
  previewDays: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  previewDay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: Spacing.two,
  },
  previewDayDate: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '500',
  },
  previewDayStatus: {
    ...Typography.xs,
    fontWeight: '700',
  },
});
