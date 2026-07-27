import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Dialog, Icon, Portal, Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton, AppSnackbar, Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import {
  createStaffAccommodationRequest,
  createStaffBankUpdateRequest,
  createStaffChildrenDetailsRequest,
  createStaffFamilyDetailsRequest,
  createStaffProfessionalLicenceRequest,
  getStaffOnboardingSectionData,
} from '@/lib/auth/api';
import { StaffPrerequisiteCheck } from '@/lib/auth/types';
import { useSession } from '@/lib/auth/session-context';

import {
  getStaffOnboardingStepBySlug,
  mapChildrenResponseToValues,
  StaffOnboardingFormDefaults,
  StaffOnboardingFormPanel,
} from '@/features/staff-onboarding/components';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

export default function StaffOnboardingStepScreen() {
  const { session, isSessionLoading } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();
  const { step } = useLocalSearchParams<{ step: string }>();
  const activeStep = getStaffOnboardingStepBySlug(step);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarTone, setSnackbarTone] = useState<'danger' | 'success'>('success');
  const [formIsValid, setFormIsValid] = useState(false);
  const [reviewPromptVisible, setReviewPromptVisible] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{
    key: keyof StaffPrerequisiteCheck;
    values: StaffOnboardingFormDefaults;
  } | null>(null);
  const [submitSignal, setSubmitSignal] = useState(0);
  const { width } = useWindowDimensions();
  const loadingTranslateX = useRef(new Animated.Value(-140)).current;

  const sectionDataQuery = useQuery({
    queryKey: ['staff-onboarding-section', session?.id, activeStep?.key],
    queryFn: async () => {
      if (!session || !activeStep) {
        return null;
      }

      try {
        return await authenticatedRequest((activeSession) =>
          getStaffOnboardingSectionData({
            key: activeStep.key,
            accessToken: activeSession.accessToken,
            tenantId: activeSession.tenantId,
          })
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    enabled: Boolean(session && activeStep),
  });
  const defaultValues = useMemo(
    () =>
      activeStep
        ? mapSectionDataToFormValues(activeStep.key, sectionDataQuery.data)
        : undefined,
    [activeStep, sectionDataQuery.data]
  );
  const requestStatus = useMemo(() => readRequestStatus(sectionDataQuery.data), [sectionDataQuery.data]);
  const requestIsPending = requestStatus === 'PENDING';
  const bankUpdateMutation = useMutation({
    mutationFn: (values: StaffOnboardingFormDefaults) => {
      if (!session) {
        throw new Error('Session is required.');
      }

      return authenticatedRequest((activeSession) =>
        createStaffBankUpdateRequest({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload: {
            bankId: values.isGhipsVerified ? null : values.bankId || null,
            bankName: values.isGhipsVerified ? values.bankName || null : null,
            isGhipsVerified: Boolean(values.isGhipsVerified),
            accountType: values.accountType || 'SAVINGS',
            branch: values.branchName || '',
            accountNumber: values.accountNumber || '',
            accountName: values.accountName || '',
          },
        })
      );
    },
    onSuccess: async () => {
      setSnackbarMessage('Bank details submitted for approval.');
      setSnackbarTone('success');
      setSnackbarVisible(true);
      await queryClient.invalidateQueries({ queryKey: ['staff-onboarding-section', session?.id, 'bankData'] });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
    onError: (error) => {
      setSnackbarMessage(error instanceof Error ? error.message : 'Unable to submit bank details.');
      setSnackbarTone('danger');
      setSnackbarVisible(true);
    },
  });
  const accommodationMutation = useMutation({
    mutationFn: (values: StaffOnboardingFormDefaults) => {
      if (!session) {
        throw new Error('Session is required.');
      }

      return authenticatedRequest((activeSession) =>
        createStaffAccommodationRequest({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload: {
            source: values.source || '',
            gpsAddress: values.gpsAddress || '',
            accomodationType: values.accommodationType || '',
            flatNumber: values.flatNumber || '',
            allocationDate: values.source === 'Official' ? values.allocationDate || '' : '',
          },
        })
      );
    },
    onSuccess: async () => {
      setSnackbarMessage('Accommodation details submitted for approval.');
      setSnackbarTone('success');
      setSnackbarVisible(true);
      await queryClient.invalidateQueries({
        queryKey: ['staff-onboarding-section', session?.id, 'accomodationData'],
      });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
    onError: (error) => {
      setSnackbarMessage(error instanceof Error ? error.message : 'Unable to submit accommodation details.');
      setSnackbarTone('danger');
      setSnackbarVisible(true);
    },
  });
  const professionalLicenceMutation = useMutation({
    mutationFn: (values: StaffOnboardingFormDefaults) => {
      if (!session) {
        throw new Error('Session is required.');
      }

      return authenticatedRequest((activeSession) =>
        createStaffProfessionalLicenceRequest({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload: {
            professionalBodyId: values.professionalBodyId || '',
            pin: values.pin || '',
            issuedDate: values.issuedDate || '',
            expiryDate: values.expiryDate || '',
          },
        })
      );
    },
    onSuccess: async () => {
      setSnackbarMessage('Professional licence submitted for approval.');
      setSnackbarTone('success');
      setSnackbarVisible(true);
      await queryClient.invalidateQueries({
        queryKey: ['staff-onboarding-section', session?.id, 'professionalLicenceData'],
      });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
    onError: (error) => {
      setSnackbarMessage(error instanceof Error ? error.message : 'Unable to submit professional licence.');
      setSnackbarTone('danger');
      setSnackbarVisible(true);
    },
  });
  const familyDetailsMutation = useMutation({
    mutationFn: (values: StaffOnboardingFormDefaults) => {
      if (!session) {
        throw new Error('Session is required.');
      }

      return authenticatedRequest((activeSession) =>
        createStaffFamilyDetailsRequest({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload: {
            fathersName: values.fathersName || '',
            mothersName: values.mothersName || '',
            spouseName: values.spouseName || '',
            spousePhoneNumber: values.spousePhoneNumber || '',
            nextOfKIN: values.nextOfKIN || '',
            nextOfKINPhoneNumber: values.nextOfKINPhoneNumber || '',
            emergencyPerson: values.emergencyPerson || '',
            emergencyPersonPhoneNumber: values.emergencyPersonPhoneNumber || '',
          },
        })
      );
    },
    onSuccess: async () => {
      setSnackbarMessage('Family details submitted for approval.');
      setSnackbarTone('success');
      setSnackbarVisible(true);
      await queryClient.invalidateQueries({
        queryKey: ['staff-onboarding-section', session?.id, 'familyData'],
      });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
    onError: (error) => {
      setSnackbarMessage(error instanceof Error ? error.message : 'Unable to submit family details.');
      setSnackbarTone('danger');
      setSnackbarVisible(true);
    },
  });
  const childrenDetailsMutation = useMutation({
    mutationFn: (values: StaffOnboardingFormDefaults) => {
      if (!session) {
        throw new Error('Session is required.');
      }

      const children = (values.children ?? []).map((child) => ({
        childName: child.childName,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
      }));

      return authenticatedRequest((activeSession) =>
        createStaffChildrenDetailsRequest({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload: { children },
        })
      );
    },
    onSuccess: async () => {
      setSnackbarMessage('Children details submitted for approval.');
      setSnackbarTone('success');
      setSnackbarVisible(true);
      await queryClient.invalidateQueries({
        queryKey: ['staff-onboarding-section', session?.id, 'childrenData'],
      });
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
    },
    onError: (error) => {
      setSnackbarMessage(error instanceof Error ? error.message : 'Unable to submit children details.');
      setSnackbarTone('danger');
      setSnackbarVisible(true);
    },
  });
  const isSaving =
    bankUpdateMutation.isPending ||
    accommodationMutation.isPending ||
    professionalLicenceMutation.isPending ||
    familyDetailsMutation.isPending ||
    childrenDetailsMutation.isPending;
  const shouldShowBottomSave = !requestIsPending && formIsValid;
  const saveIsDisabled =
    !formIsValid ||
    sectionDataQuery.isLoading ||
    requestIsPending ||
    isSaving;

  useEffect(() => {
    if (!sectionDataQuery.isLoading) {
      loadingTranslateX.stopAnimation();
      loadingTranslateX.setValue(-140);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(loadingTranslateX, {
        toValue: width,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [loadingTranslateX, sectionDataQuery.isLoading, width]);

  useEffect(() => {
    setFormIsValid(false);
  }, [activeStep?.key]);

  if (isSessionLoading) {
    return (
      <Screen>
        <View style={styles.centerCanvas}>
          <ActivityIndicator color={Colors.light.primary} />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  if (!activeStep) {
    return <Redirect href="/staff-onboarding" />;
  }

  const submitSectionUpdate = (key: keyof StaffPrerequisiteCheck, values: StaffOnboardingFormDefaults) => {
    if (key === 'bankData') {
      bankUpdateMutation.mutate(values);
      return;
    }

    if (key === 'accomodationData') {
      accommodationMutation.mutate(values);
      return;
    }

    if (key === 'professionalLicenceData') {
      professionalLicenceMutation.mutate(values);
      return;
    }

    if (key === 'familyData') {
      familyDetailsMutation.mutate(values);
      return;
    }

    if (key === 'childrenData') {
      childrenDetailsMutation.mutate(values);
      return;
    }
  };

  const handleConfirmReviewedSubmission = () => {
    if (!pendingSubmission) {
      setReviewPromptVisible(false);
      return;
    }

    setReviewPromptVisible(false);
    submitSectionUpdate(pendingSubmission.key, pendingSubmission.values);
    setPendingSubmission(null);
  };

  const appBar = (
    <>
      <View style={styles.appBar}>
        <Pressable style={styles.backAction} onPress={() => router.back()} hitSlop={8}>
          <Icon source="chevron-left" size={22} color="#ffffff" />
        </Pressable>
        <Text style={styles.appBarTitle}>{activeStep.title}</Text>
        <Pressable
          disabled={saveIsDisabled}
          style={[
            styles.saveAction,
            saveIsDisabled ? styles.appBarActionDisabled : null,
          ]}
          onPress={() => setSubmitSignal((value) => value + 1)}
          hitSlop={8}>
          <Icon source="check" size={21} color="#ffffff" />
        </Pressable>
      </View>
      {sectionDataQuery.isLoading && (
        <View style={styles.loadingTrack}>
          <Animated.View
            style={[
              styles.loadingBar,
              {
                transform: [{ translateX: loadingTranslateX }],
              },
            ]}
          />
        </View>
      )}
    </>
  );
  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      header={appBar}
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <StaffOnboardingFormPanel
        activeKey={activeStep.key}
        actions={
          shouldShowBottomSave ? (
            <View style={styles.actionPanel}>
              <AppButton
                icon="check"
                disabled={saveIsDisabled}
                loading={isSaving}
                style={styles.actionButton}
                onPress={() => setSubmitSignal((value) => value + 1)}>
                Save
              </AppButton>
            </View>
          ) : null
        }
        defaultValues={defaultValues}
        disabled={sectionDataQuery.isLoading || requestIsPending}
        isSubmitting={isSaving}
        onValidityChange={setFormIsValid}
        requestStatus={requestStatus}
        sectionData={sectionDataQuery.data}
        submitSignal={submitSignal}
        tenantId={session.tenantId}
        tenantName={session.tenant?.name}
        onSubmit={(key, values) => {
          const typedValues = values as StaffOnboardingFormDefaults;

          if (requestIsPending) {
            setSnackbarMessage('This request is still pending HR approval.');
            setSnackbarTone('danger');
            setSnackbarVisible(true);
            return;
          }

          if (requestStatus === 'APPROVED') {
            setPendingSubmission({ key, values: typedValues });
            setReviewPromptVisible(true);
            return;
          }

          submitSectionUpdate(key, typedValues);
        }}
      />

      <Portal>
        <Dialog
          visible={reviewPromptVisible}
          onDismiss={() => {
            setReviewPromptVisible(false);
            setPendingSubmission(null);
          }}
          style={styles.reviewDialog}>
          <Dialog.Title>Submit update for review?</Dialog.Title>
          <Dialog.Content style={styles.reviewDialogContent}>
            <Text style={styles.reviewDialogText}>
              These details will be reviewed internally before they take effect. After submission,
              you will not be able to submit new data for this section until HR reviews the current request.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <AppButton
              variant="ghost"
              onPress={() => {
                setReviewPromptVisible(false);
                setPendingSubmission(null);
              }}>
              Cancel
            </AppButton>
            <AppButton variant="outline" icon="check" onPress={handleConfirmReviewedSubmission}>
              Submit
            </AppButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <AppSnackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        tone={snackbarTone}
        position="top"
        onDismiss={() => setSnackbarVisible(false)}
      />
    </Screen>
  );
}

function mapSectionDataToFormValues(
  key: keyof StaffPrerequisiteCheck,
  response: Record<string, unknown> | null | undefined
): StaffOnboardingFormDefaults | undefined {
  if (!response) {
    return undefined;
  }

  const data = unwrapSectionData(response);

  if (key === 'bankData') {
    const isGhipsVerified = data.isGhipsVerified === false ? false : true;

    return {
      accountType: (readText(data, ['accountType']) || 'SAVINGS').toUpperCase(),
      bankName: readText(data, ['bankName', 'bank', 'name']),
      bankCode: readText(data, ['bankCode', 'code']),
      bankId: readBankId(data),
      bankEntryMode: isGhipsVerified ? 'verified' : 'manual',
      branchName: readText(data, ['branchName', 'branch']),
      accountName: readText(data, ['accountName']),
      accountNumber: readText(data, ['accountNumber']),
      isGhipsVerified,
    };
  }

  if (key === 'professionalLicenceData') {
    return {
      professionalBodyId: readProfessionalBodyId(data),
      pin: readText(data, ['pin', 'licenceNumber', 'licenseNumber']),
      issuedDate: readDate(data, ['issuedDate', 'issueDate']),
      expiryDate: readDate(data, ['expiryDate', 'expiryDate']),
    };
  }

  if (key === 'accomodationData') {
    return {
      source: readText(data, ['source']),
      gpsAddress: readText(data, ['gpsAddress']),
      accommodationType: readText(data, ['accommodationType', 'accomodationType']),
      flatNumber: readText(data, ['flatNumber']),
      allocationDate: readDate(data, ['allocationDate']),
    };
  }

  if (key === 'familyData') {
    return {
      fathersName: readText(data, ['fathersName']),
      mothersName: readText(data, ['mothersName']),
      spouseName: readText(data, ['spouseName']),
      spousePhoneNumber: readText(data, ['spousePhoneNumber', 'spousePhone']),
      nextOfKIN: readText(data, ['nextOfKIN', 'nextOfKinName']),
      nextOfKINPhoneNumber: readText(data, ['nextOfKINPhoneNumber', 'nextOfKinPhone']),
      emergencyPerson: readText(data, ['emergencyPerson', 'emergencyContactName']),
      emergencyPersonPhoneNumber: readText(data, [
        'emergencyPersonPhoneNumber',
        'emergencyContactPhone',
      ]),
    };
  }

  return mapChildrenResponseToValues(response);
}

function unwrapSectionData(response: Record<string, unknown>) {
  const nested = response.data ?? response.result ?? response.request ?? response.current;
  return isRecord(nested) ? nested : response;
}

function readRequestStatus(response: Record<string, unknown> | null | undefined) {
  if (!response) {
    return undefined;
  }

  const data = unwrapSectionData(response);
  const status = readText(data, ['status']);
  return status ? status.toUpperCase() : undefined;
}

function readText(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }

    if (isRecord(value)) {
      const nestedName = value.name ?? value.title ?? value.label;

      if (typeof nestedName === 'string' || typeof nestedName === 'number') {
        return String(nestedName);
      }
    }
  }

  return '';
}

function readDate(data: Record<string, unknown>, keys: string[]) {
  const value = readText(data, keys);
  return value ? value.slice(0, 10) : '';
}

function readBankId(data: Record<string, unknown>) {
  const bank = data.bank;

  if (isRecord(bank)) {
    const nestedId = bank.id ?? bank.bankId;

    if (typeof nestedId === 'string' || typeof nestedId === 'number') {
      return String(nestedId);
    }
  }

  return readText(data, ['bankId']);
}

function readProfessionalBodyId(data: Record<string, unknown>) {
  const professionalBody = data.professionalBody;

  if (isRecord(professionalBody)) {
    const nestedId = professionalBody.id ?? professionalBody.professionalBodyId;

    if (typeof nestedId === 'string' || typeof nestedId === 'number') {
      return String(nestedId);
    }
  }

  return readText(data, ['professionalBodyId']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const styles = StyleSheet.create({
  centerCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.appBgLight,
  },
  appBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    backgroundColor: Colors.light.primary,
  },
  backAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  appBarActionDisabled: {
    opacity: 0.45,
  },
  appBarTitle: {
    ...Typography.lg,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  actionPanel: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  actionButton: {
    flex: 1,
  },
  loadingTrack: {
    height: 3,
    overflow: 'hidden',
    backgroundColor: '#fff4df',
  },
  loadingBar: {
    width: 140,
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#f5c451',
  },
  reviewDialog: {
    borderRadius: 16,
    backgroundColor: '#f7fcfd',
  },
  reviewDialogContent: {
    gap: Spacing.two,
  },
  reviewDialogText: {
    ...Typography.base,
    color: Colors.light.textSecondary,
  },
});
