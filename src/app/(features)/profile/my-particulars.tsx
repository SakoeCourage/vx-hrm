import { useMutation, useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

import { AppSnackbar, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  downloadStaffProfilePdf,
  getStaffProfile,
  StaffProfileResponse,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';
import { useState } from 'react';

type DetailItem = {
  label: string;
  value: unknown;
};

export default function MyParticularsScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'success' | 'danger';
  }>({
    visible: false,
    message: '',
    tone: 'success',
  });

  const staffIdentificationNumber = session?.staffIdentificationNumber ?? '';

  const profileQuery = useQuery({
    queryKey: ['staff-profile', session?.tenantId, staffIdentificationNumber],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffProfile({
          staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && staffIdentificationNumber),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!staffIdentificationNumber) {
        throw new Error('Staff identification number is missing.');
      }

      const fileUri = await authenticatedRequest((activeSession) =>
        downloadStaffProfilePdf({
          staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      );

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'My particulars',
        UTI: 'com.adobe.pdf',
      });
    },
    onSuccess: () => {
      setToast({
        visible: true,
        message: 'Profile PDF ready.',
        tone: 'success',
      });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Could not export profile PDF.',
        tone: 'danger',
      });
    },
  });

  const profile = profileQuery.data;

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      contentStyle={styles.content}
      header={
        <View style={styles.appBar}>
          <Pressable style={styles.appBarButton} onPress={() => router.back()}>
            <Icon source="chevron-left" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.appBarTitle}>My particulars</Text>
          <Pressable
            disabled={exportMutation.isPending || !profile}
            style={[styles.appBarButton, (!profile || exportMutation.isPending) && styles.appBarButtonDisabled]}
            onPress={() => exportMutation.mutate()}>
            {exportMutation.isPending ? (
              <ActivityIndicator size={18} color="#ffffff" />
            ) : (
              <Icon source="download-outline" size={21} color="#ffffff" />
            )}
          </Pressable>
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      {profileQuery.isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size={22} color={Colors.light.primary} />
          <Text style={styles.stateText}>Loading your particulars</Text>
        </View>
      ) : profileQuery.isError ? (
        <View style={styles.stateCard}>
          <Icon source="alert-circle-outline" size={28} color={Colors.light.warning} />
          <Text style={styles.stateTitle}>Could not load particulars</Text>
          <Text style={styles.stateText}>Please try again shortly.</Text>
        </View>
      ) : profile ? (
        <ProfileContent profile={profile} />
      ) : (
        <View style={styles.stateCard}>
          <Icon source="account-details-outline" size={30} color={Colors.light.primary} />
          <Text style={styles.stateTitle}>No profile data found</Text>
          <Text style={styles.stateText}>Your approved particulars will appear here once available.</Text>
        </View>
      )}

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

function ProfileContent({ profile }: { profile: StaffProfileResponse }) {
  const identity = profile.identity ?? {};
  const fullName = readString(identity.fullName) || 'Staff profile';
  const passportPicture = readString(identity.passportPicture);
  const tenantLogoUrl = readString(profile.tenant?.logoUrl);

  return (
    <View style={styles.sections}>
      <View style={styles.heroCard}>
        <View style={styles.heroAvatar}>
          {passportPicture ? (
            <Image source={{ uri: passportPicture }} style={styles.heroAvatarImage} />
          ) : (
            <Text style={styles.heroAvatarText}>{getInitials(fullName)}</Text>
          )}
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroName}>{formatName(fullName)}</Text>
          <Text style={styles.heroMeta}>
            {[readString(identity.staffIdentificationNumber), formatName(profile.tenant?.name)]
              .filter(Boolean)
              .join(' · ') || 'Approved staff profile'}
          </Text>
        </View>
        {tenantLogoUrl && (
          <View style={styles.tenantLogoWrap}>
            <Image source={{ uri: tenantLogoUrl }} style={styles.tenantLogo} resizeMode="contain" />
          </View>
        )}
      </View>

      <ProfileSection
        title="Identity"
        items={[
          { label: 'Title', value: identity.title },
          { label: 'First name', value: identity.firstName },
          { label: 'Other names', value: identity.otherNames },
          { label: 'Last name', value: identity.lastName },
          { label: 'Gender', value: identity.gender },
          { label: 'Date of birth', value: formatDate(identity.dateOfBirth) },
          { label: 'Phone', value: identity.phone },
          { label: 'Phone two', value: identity.phoneTwo },
          { label: 'Email', value: identity.email },
          { label: 'Status', value: identity.status },
        ]}
      />

      <ProfileSection
        title="Statutory"
        items={[
          { label: 'GPS address', value: profile.statutory?.gpsAddress },
          { label: 'SSNIT number', value: profile.statutory?.snnitNumber },
          { label: 'ECOWAS card number', value: profile.statutory?.ecowasCardNumber },
          { label: 'Disability', value: profile.statutory?.disability },
        ]}
      />

      <ProfileSection
        title="Current posting"
        items={[
          { label: 'Posting date', value: formatDate(profile.currentPosting?.postingDate) },
          { label: 'Posting option', value: profile.currentPosting?.postingOption },
          { label: 'Directorate', value: profile.currentPosting?.directorateName },
          { label: 'Department', value: profile.currentPosting?.departmentName },
          { label: 'Unit', value: profile.currentPosting?.unitName },
        ]}
      />

      <AppointmentSection title="Current appointment" data={profile.currentAppointment} />
      <AppointmentSection title="First appointment" data={profile.firstAppointment} />

      <ProfileSection
        title="Bank details"
        items={[
          { label: 'Bank', value: profile.approvedBankDetail?.bankName },
          { label: 'Account name', value: profile.approvedBankDetail?.accountName },
          { label: 'Account number', value: profile.approvedBankDetail?.accountNumber },
          { label: 'Account type', value: profile.approvedBankDetail?.accountType },
          { label: 'Branch', value: profile.approvedBankDetail?.branch },
          { label: 'GHIPSS verified', value: formatBoolean(profile.approvedBankDetail?.isGhipsVerified) },
        ]}
      />

      <ProfileSection
        title="Professional licence"
        items={[
          { label: 'Professional body', value: profile.approvedProfessionalLicence?.professionalBodyName },
          { label: 'PIN', value: profile.approvedProfessionalLicence?.pin },
          { label: 'Issued date', value: formatDate(profile.approvedProfessionalLicence?.issuedDate) },
          { label: 'Expiry date', value: formatDate(profile.approvedProfessionalLicence?.expiryDate) },
        ]}
      />

      <ProfileSection
        title="Accommodation"
        items={[
          { label: 'Source', value: profile.approvedAccommodation?.source },
          { label: 'Accommodation type', value: profile.approvedAccommodation?.accommodationType },
          { label: 'GPS address', value: profile.approvedAccommodation?.gpsAddress },
          { label: 'Flat number', value: profile.approvedAccommodation?.flatNumber },
          { label: 'Allocation date', value: formatDate(profile.approvedAccommodation?.allocationDate) },
        ]}
      />

      <ProfileSection
        title="Family and emergency"
        items={[
          { label: "Father's name", value: profile.approvedFamilyDetail?.fathersName },
          { label: "Mother's name", value: profile.approvedFamilyDetail?.mothersName },
          { label: 'Spouse name', value: profile.approvedFamilyDetail?.spouseName },
          { label: 'Spouse phone', value: profile.approvedFamilyDetail?.spousePhoneNumber },
          { label: 'Next of kin', value: profile.approvedFamilyDetail?.nextOfKIN },
          { label: 'Next of kin phone', value: profile.approvedFamilyDetail?.nextOfKINPhoneNumber },
          { label: 'Emergency contact', value: profile.approvedFamilyDetail?.emergencyPerson },
          { label: 'Emergency phone', value: profile.approvedFamilyDetail?.emergencyPersonPhoneNumber },
        ]}
      />

      <ChildrenSection childrenData={profile.approvedChildren ?? []} />

      {profile.generatedAt && (
        <Text style={styles.generatedAt}>Generated {formatDateTime(profile.generatedAt)}</Text>
      )}
    </View>
  );
}

function AppointmentSection({ title, data }: { title: string; data?: Record<string, unknown> | null }) {
  return (
    <ProfileSection
      title={title}
      items={[
        { label: 'Grade', value: data?.gradeName },
        { label: 'Grade level', value: data?.gradeLevelName },
        { label: 'Scale', value: data?.scale },
        { label: 'Speciality', value: data?.specialityName },
        { label: 'Category', value: data?.categoryName },
        { label: 'Appointment type', value: data?.appointmentType },
        { label: 'Staff type', value: data?.staffType },
        { label: 'Payment source', value: data?.paymentSource },
        { label: 'Notional date', value: formatDate(data?.notionalDate) },
        { label: 'Substantive date', value: formatDate(data?.substantiveDate) },
        { label: 'End date', value: formatDate(data?.endDate) },
        { label: 'Step', value: data?.step },
      ]}
    />
  );
}

function ProfileSection({ title, items }: { title: string; items: DetailItem[] }) {
  const visibleItems = items.filter((item) => hasValue(item.value));

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {visibleItems.length > 0 ? (
        <View style={styles.detailList}>
          {visibleItems.map((item) => (
            <DetailRow key={`${title}-${item.label}`} label={item.label} value={item.value} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptySectionText}>No approved data available.</Text>
      )}
    </View>
  );
}

function DetailRow({ label, value }: DetailItem) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{formatValue(value, label)}</Text>
    </View>
  );
}

function ChildrenSection({ childrenData }: { childrenData: Record<string, unknown>[] }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Children</Text>
      {childrenData.length > 0 ? (
        <View style={styles.childrenList}>
          {childrenData.map((child, index) => (
            <View key={readString(child.id) || `${child.childName}-${index}`} style={styles.childCard}>
              <Text style={styles.childName}>{formatValue(child.childName, 'Child name')}</Text>
              <Text style={styles.childMeta}>
                {[formatDate(child.dateOfBirth), formatValue(child.gender, 'Gender')]
                  .filter((value) => value !== 'Not provided')
                  .join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySectionText}>No approved children data available.</Text>
      )}
    </View>
  );
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function formatValue(value: unknown, label = '') {
  if (!hasValue(value)) return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const stringValue = String(value);

  if (shouldPreserveValueCase(label, stringValue)) {
    return stringValue;
  }

  return formatName(stringValue);
}

function formatBoolean(value: unknown) {
  if (typeof value !== 'boolean') return value;
  return value ? 'Yes' : 'No';
}

function formatDate(value: unknown) {
  if (!hasValue(value) || typeof value !== 'string') return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function shouldPreserveValueCase(label: string, value: string) {
  const normalizedLabel = label.toLowerCase();

  return (
    normalizedLabel.includes('email') ||
    normalizedLabel.includes('date') ||
    /\S+@\S+\.\S+/.test(value)
  );
}

function formatName(value: unknown) {
  if (!hasValue(value)) return '';

  return String(value)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return initials.toUpperCase() || 'ST';
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
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
  appBarButtonDisabled: {
    opacity: 0.55,
  },
  appBarTitle: {
    ...Typography.md,
    flex: 1,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  sections: {
    gap: Spacing.three,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  heroAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.light.primaryMuted,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroAvatarText: {
    ...Typography.md,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  tenantLogoWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    padding: Spacing.one,
  },
  tenantLogo: {
    width: '100%',
    height: '100%',
  },
  heroName: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  heroMeta: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#74d6e8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 1,
  },
  sectionTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
    marginBottom: Spacing.three,
  },
  detailList: {
    gap: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: Spacing.two,
  },
  detailLabel: {
    ...Typography.sm,
    width: 126,
    color: Colors.light.textSecondary,
  },
  detailValue: {
    ...Typography.sm,
    flex: 1,
    color: Colors.light.text,
    fontWeight: '500',
  },
  emptySectionText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  childrenList: {
    gap: Spacing.two,
  },
  childCard: {
    borderRadius: 16,
    backgroundColor: Colors.light.appBgLight,
    padding: Spacing.three,
  },
  childName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  childMeta: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  generatedAt: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  stateCard: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 24,
    backgroundColor: Colors.light.surface,
    padding: Spacing.five,
  },
  stateTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
