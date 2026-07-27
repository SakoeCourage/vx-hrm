import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Colors, Spacing } from '@/constants/theme';
import { StaffPrerequisiteCheck } from '@/lib/auth/types';

import { AccommodationDataForm } from './accommodation-data-form';
import { BankDataForm } from './bank-data-form';
import { ChildrenDetailsForm } from './children-details-form';
import { FamilyDetailsForm } from './family-details-form';
import { ProfessionalLicenceForm } from './professional-licence-form';
import type {
  AccommodationDataFormValues,
  BankDataFormValues,
  ChildrenDetailsFormValues,
  FamilyDetailsFormValues,
  ProfessionalLicenceFormValues,
} from './types';

type StaffOnboardingFormPanelProps = {
  actions?: ReactNode;
  activeKey: keyof StaffPrerequisiteCheck;
  defaultValues?: StaffOnboardingFormDefaults;
  disabled?: boolean;
  isSubmitting?: boolean;
  onValidityChange?: (isValid: boolean) => void;
  requestStatus?: string;
  sectionData?: Record<string, unknown> | null;
  submitSignal?: number;
  tenantId?: string;
  tenantName?: string;
  onSubmit: (key: keyof StaffPrerequisiteCheck, values: unknown) => void | Promise<void>;
};

export type StaffOnboardingFormDefaults = Partial<
  BankDataFormValues &
    ProfessionalLicenceFormValues &
    AccommodationDataFormValues &
    FamilyDetailsFormValues &
    ChildrenDetailsFormValues
>;

export function StaffOnboardingFormPanel({
  actions,
  activeKey,
  defaultValues,
  disabled,
  isSubmitting,
  onValidityChange,
  requestStatus,
  sectionData,
  submitSignal,
  tenantId,
  tenantName,
  onSubmit,
}: StaffOnboardingFormPanelProps) {
  const sharedProps = {
    isSubmitting,
    onValidityChange,
    submitLabel: 'Save',
    submitSignal,
    tenantId,
    tenantName,
  };
  const normalizedStatus = requestStatus?.trim().toUpperCase();
  const statusColor = getStatusColor(normalizedStatus);
  const statusBackgroundColor = getStatusBackgroundColor(normalizedStatus);

  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={styles.panel}>
      {activeKey === 'bankData' && (
        <BankDataForm
          {...sharedProps}
          defaultValues={defaultValues}
          onSubmit={(values) => onSubmit(activeKey, values)}
        />
      )}
      {activeKey === 'professionalLicenceData' && (
        <ProfessionalLicenceForm
          {...sharedProps}
          defaultValues={defaultValues}
          onSubmit={(values) => onSubmit(activeKey, values)}
        />
      )}
      {activeKey === 'accomodationData' && (
        <AccommodationDataForm
          {...sharedProps}
          defaultValues={defaultValues}
          onSubmit={(values) => onSubmit(activeKey, values)}
        />
      )}
      {activeKey === 'familyData' && (
        <FamilyDetailsForm
          {...sharedProps}
          defaultValues={defaultValues}
          onSubmit={(values) => onSubmit(activeKey, values)}
        />
      )}
      {activeKey === 'childrenData' && (
        <ChildrenDetailsForm
          {...sharedProps}
          defaultValues={defaultValues}
          requestStatus={requestStatus}
          sectionData={sectionData}
          onSubmit={(values) => onSubmit(activeKey, values)}
        />
      )}
      {normalizedStatus ? (
        <View style={[styles.statusBlock, { backgroundColor: statusBackgroundColor }]}>
          <View style={styles.statusLine}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusDot}>•</Text>
            <Text style={[styles.statusValue, { color: statusColor }]}>
              {toTitleCase(normalizedStatus)}
            </Text>
          </View>
          {normalizedStatus === 'PENDING' && (
            <Text style={styles.statusText}>
              This request is waiting for HR approval. You cannot submit another update yet.
            </Text>
          )}
        </View>
      ) : null}
      {actions ? (
        <>
          <View style={styles.divider} />
          {actions}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#b9edf6',
    backgroundColor: Colors.light.surface,
    padding: Spacing.four,
    shadowColor: '#74d6e8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2f2f5',
  },
  statusBlock: {
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  statusLabel: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusDot: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusText: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getStatusColor(status?: string) {
  if (status === 'APPROVED') {
    return Colors.light.success;
  }

  if (status === 'REJECTED') {
    return Colors.light.danger;
  }

  if (status === 'PENDING') {
    return Colors.light.warning;
  }

  return Colors.light.text;
}

function getStatusBackgroundColor(status?: string) {
  if (status === 'APPROVED') {
    return '#f5fcf8';
  }

  if (status === 'REJECTED') {
    return '#fff7f6';
  }

  if (status === 'PENDING') {
    return '#fffaf0';
  }

  return '#f8fbfc';
}
