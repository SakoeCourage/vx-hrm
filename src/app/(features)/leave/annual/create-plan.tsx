import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { AppBottomSheet, AppButton, AppSnackbar, FormDateField, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  createLeavePlan,
  getLeaveTypes,
  getMyLeaveDashboard,
  previewLeaveDates,
  LeaveDashboardResponse,
  LeaveDatePreview,
  LeavePlanEligibilityPeriod,
  LeavePlanEligibilityResponse,
  LeavePlanPayload,
  LeavePreviewDay,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

type AnnualPlanForm = {
  firstPeriodStart: string;
  firstPeriodEnd: string;
  secondPeriodStart: string;
  secondPeriodEnd: string;
  thirdPeriodStart: string;
  thirdPeriodEnd: string;
};

type RemainingPlanPeriod = {
  start: string;
  end: string;
  eligibilityPeriod?: LeavePlanEligibilityPeriod;
};

const periodConfigs: {
  number: 1 | 2 | 3;
  startName: keyof AnnualPlanForm;
  endName: keyof AnnualPlanForm;
}[] = [
  { number: 1, startName: 'firstPeriodStart', endName: 'firstPeriodEnd' },
  { number: 2, startName: 'secondPeriodStart', endName: 'secondPeriodEnd' },
  { number: 3, startName: 'thirdPeriodStart', endName: 'thirdPeriodEnd' },
];

export default function CreateAnnualLeavePlanScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();
  const leaveYear = new Date().getFullYear();
  const [eligibility, setEligibility] = useState<LeavePlanEligibilityResponse | null>(null);
  const [verifiedPlanSignature, setVerifiedPlanSignature] = useState<string | null>(null);
  const [pendingEligibility, setPendingEligibility] = useState<LeavePlanEligibilityResponse | null>(null);
  const [pendingPlanSignature, setPendingPlanSignature] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'success' | 'danger';
  }>({
    visible: false,
    message: '',
    tone: 'success',
  });
  const [visiblePeriods, setVisiblePeriods] = useState(0);
  const [sheetPeriodNumber, setSheetPeriodNumber] = useState<1 | 2 | 3 | null>(null);
  const periodSheetRef = useRef<BottomSheetModal>(null);
  const periodSheetVerifiedDismissRef = useRef(false);

  const { control, getValues, handleSubmit, setValue } = useForm<AnnualPlanForm>({
    defaultValues: {
      firstPeriodStart: '',
      firstPeriodEnd: '',
      secondPeriodStart: '',
      secondPeriodEnd: '',
      thirdPeriodStart: '',
      thirdPeriodEnd: '',
    },
  });

  const firstPeriodStart = useWatch({ control, name: 'firstPeriodStart' });
  const firstPeriodEnd = useWatch({ control, name: 'firstPeriodEnd' });
  const secondPeriodStart = useWatch({ control, name: 'secondPeriodStart' });
  const secondPeriodEnd = useWatch({ control, name: 'secondPeriodEnd' });
  const thirdPeriodStart = useWatch({ control, name: 'thirdPeriodStart' });
  const thirdPeriodEnd = useWatch({ control, name: 'thirdPeriodEnd' });

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

  const leaveDashboardQuery = useQuery({
    queryKey: ['my-leave-dashboard', session?.tenantId, leaveYear],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getMyLeaveDashboard({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          leaveYear,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  const activePeriodCount = sheetPeriodNumber ?? visiblePeriods;
  const currentPlanSignature = useMemo(
    () =>
      JSON.stringify({
        periodCount: activePeriodCount,
        firstPeriodStart,
        firstPeriodEnd,
        secondPeriodStart,
        secondPeriodEnd,
        thirdPeriodStart,
        thirdPeriodEnd,
      }),
    [
      firstPeriodEnd,
      firstPeriodStart,
      secondPeriodEnd,
      secondPeriodStart,
      thirdPeriodEnd,
      thirdPeriodStart,
      activePeriodCount,
    ]
  );
  const isCurrentPlanVerified =
    Boolean(eligibility?.isEligible) && verifiedPlanSignature === currentPlanSignature;
  const verifiedDaysCount = eligibility?.periods.reduce((total, period) => total + readNumber(period.days), 0) ?? 0;
  const entitledDays = readAnnualEntitledDays(leaveDashboardQuery.data);
  const remainingEntitledDays = Math.max(entitledDays - verifiedDaysCount, 0);
  const visiblePeriodsAreValid = useMemo(
    () =>
      periodConfigs
        .slice(0, activePeriodCount)
        .every((period) =>
          isPeriodRangeValid(
            getWatchedPeriodValue(period.startName, {
              firstPeriodStart,
              firstPeriodEnd,
              secondPeriodStart,
              secondPeriodEnd,
              thirdPeriodStart,
              thirdPeriodEnd,
            }),
            getWatchedPeriodValue(period.endName, {
              firstPeriodStart,
              firstPeriodEnd,
              secondPeriodStart,
              secondPeriodEnd,
              thirdPeriodStart,
              thirdPeriodEnd,
            })
          )
        ),
    [
      firstPeriodEnd,
      firstPeriodStart,
      secondPeriodEnd,
      secondPeriodStart,
      thirdPeriodEnd,
      thirdPeriodStart,
      activePeriodCount,
    ]
  );
  const hasPlanDaysAvailable = entitledDays > 0 && remainingEntitledDays > 0;
  const shouldOfferAnotherPeriod = isCurrentPlanVerified && hasPlanDaysAvailable && visiblePeriods < periodConfigs.length;
  const shouldShowAddPeriodFab = hasPlanDaysAvailable && (visiblePeriods === 0 || shouldOfferAnotherPeriod);

  useEffect(() => {
    if (!sheetPeriodNumber && verifiedPlanSignature && verifiedPlanSignature !== currentPlanSignature) {
      setEligibility(null);
      setVerifiedPlanSignature(null);
    }
  }, [currentPlanSignature, sheetPeriodNumber, verifiedPlanSignature]);

  useEffect(() => {
    if (pendingPlanSignature && pendingPlanSignature !== currentPlanSignature) {
      setPendingEligibility(null);
      setPendingPlanSignature(null);
    }
  }, [currentPlanSignature, pendingPlanSignature]);

  const verifyMutation = useMutation({
    mutationFn: async ({
      endDate,
      periodNumber,
      startDate,
    }: {
      endDate: string;
      periodNumber: 1 | 2 | 3;
      startDate: string;
    }) => {
      if (!annualType?.id) {
        throw new Error('Annual leave type is not available.');
      }

      const preview = await authenticatedRequest((activeSession) =>
        previewLeaveDates({
          leaveTypeId: annualType.id,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          startDate,
          endDate,
        })
      );

      return buildEligibilityFromDatePreview({
        entitledDays,
        existingEligibility: eligibility,
        periodNumber,
        preview,
        startDate,
        endDate,
      });
    },
    onSuccess: (eligibilityResult) => {
      const exceedsEntitlement =
        sheetPeriodNumber ? doesEligibilityExceedEntitlement(eligibility, eligibilityResult, sheetPeriodNumber, entitledDays) : false;
      setPendingEligibility(eligibilityResult);
      setPendingPlanSignature(currentPlanSignature);
      setToast({
        visible: true,
        message: eligibilityResult.isEligible
          ? 'Eligibility checked. Confirm the dates to add this period.'
          : exceedsEntitlement
            ? 'This period exceeds your remaining entitled days.'
            : 'This leave plan does not pass date availability checks.',
        tone: eligibilityResult.isEligible ? 'success' : 'danger',
      });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Could not verify leave plan.',
        tone: 'danger',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: LeavePlanPayload) => {
      return authenticatedRequest((activeSession) =>
        createLeavePlan({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload,
        })
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-leave-dashboard', session?.tenantId, leaveYear] }),
        queryClient.invalidateQueries({ queryKey: ['leave-plans', session?.tenantId, leaveYear] }),
      ]);
      setToast({
        visible: true,
        message: 'Annual leave plan created successfully.',
        tone: 'success',
      });
      setTimeout(() => router.back(), 700);
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Could not create leave plan.',
        tone: 'danger',
      });
    },
  });

  const buildPayload = (values: AnnualPlanForm, periodCount = activePeriodCount): LeavePlanPayload => ({
    leaveTypeId: annualType?.id ?? null,
    firstPeriodStart: values.firstPeriodStart,
    firstPeriodEnd: values.firstPeriodEnd,
    secondPeriodStart: periodCount >= 2 ? values.secondPeriodStart || null : null,
    secondPeriodEnd: periodCount >= 2 ? values.secondPeriodEnd || null : null,
    thirdPeriodStart: periodCount >= 3 ? values.thirdPeriodStart || null : null,
    thirdPeriodEnd: periodCount >= 3 ? values.thirdPeriodEnd || null : null,
  });

  const verifyPlan = (values: AnnualPlanForm) => {
    if (!sheetPeriodNumber) {
      return;
    }

    const period = periodConfigs[sheetPeriodNumber - 1];
    verifyMutation.mutate({
      periodNumber: period.number,
      startDate: values[period.startName],
      endDate: values[period.endName],
    });
  };

  const confirmVerifiedPeriod = () => {
    if (!sheetPeriodNumber || !pendingEligibility || !pendingPlanSignature) {
      return;
    }

    if (!pendingEligibility.isEligible) {
      setToast({
        visible: true,
        message: 'Resolve the unavailable dates before adding this period.',
        tone: 'danger',
      });
      return;
    }

    if (doesEligibilityExceedEntitlement(eligibility, pendingEligibility, sheetPeriodNumber, entitledDays)) {
      setToast({
        visible: true,
        message: 'This period exceeds your remaining entitled days.',
        tone: 'danger',
      });
      return;
    }

    setEligibility((currentEligibility) =>
      mergeEligibilityPeriods(currentEligibility, pendingEligibility, sheetPeriodNumber)
    );
    setVerifiedPlanSignature(pendingPlanSignature);
    periodSheetVerifiedDismissRef.current = true;
    setVisiblePeriods(sheetPeriodNumber);
    setSheetPeriodNumber(null);
    setPendingEligibility(null);
    setPendingPlanSignature(null);
    periodSheetRef.current?.dismiss();
    setToast({
      visible: true,
      message: 'Period added. You can create the plan or add an optional split period.',
      tone: 'success',
    });
  };

  const createVerifiedPlan = (values: AnnualPlanForm) => {
    if (!isCurrentPlanVerified) {
      setToast({
        visible: true,
        message: 'Verify the current leave plan before creating it.',
        tone: 'danger',
      });
      return;
    }

    createMutation.mutate(buildPayload(values, visiblePeriods));
  };

  const openPeriodSheet = (periodNumber: 1 | 2 | 3) => {
    setPendingEligibility(null);
    setPendingPlanSignature(null);
    setSheetPeriodNumber(periodNumber);
    periodSheetRef.current?.present();
  };

  const dismissPeriodSheet = () => {
    if (periodSheetVerifiedDismissRef.current) {
      periodSheetVerifiedDismissRef.current = false;
      return;
    }

    if (sheetPeriodNumber && sheetPeriodNumber > visiblePeriods) {
      const period = periodConfigs[sheetPeriodNumber - 1];
      setValue(period.startName, '');
      setValue(period.endName, '');
    }

    setPendingEligibility(null);
    setPendingPlanSignature(null);
    setSheetPeriodNumber(null);
  };

  const deletePeriod = (periodNumber: 1 | 2 | 3) => {
    const currentValues = getValues();
    const remainingPeriods = periodConfigs
      .slice(0, visiblePeriods)
      .filter((period) => period.number !== periodNumber)
      .map((period) => ({
        start: currentValues[period.startName],
        end: currentValues[period.endName],
        eligibilityPeriod: eligibility?.periods.find((item) => item.periodNumber === period.number),
      }));

    periodConfigs.forEach((period, index) => {
      const remainingPeriod = remainingPeriods[index];
      setValue(period.startName, remainingPeriod?.start ?? '');
      setValue(period.endName, remainingPeriod?.end ?? '');
    });

    const nextVisiblePeriods = remainingPeriods.length;
    const nextEligibility = rebuildEligibilityAfterDelete(eligibility, remainingPeriods);
    setVisiblePeriods(nextVisiblePeriods);
    setEligibility(nextEligibility);
    setVerifiedPlanSignature(nextEligibility ? buildPlanSignatureFromPeriods(remainingPeriods) : null);
    setPendingEligibility(null);
    setPendingPlanSignature(null);
  };

  const validatePeriodStart = (value: string, periodNumber: 1 | 2 | 3) => {
    if (!value) {
      return 'Start date is required.';
    }

    const selectedDate = parseDateValue(value);
    if (!selectedDate) {
      return 'Select a valid start date.';
    }

    if (selectedDate <= getTodayDate()) {
      return 'Start date must be after today.';
    }

    const previousPeriod = periodConfigs.find((period) => period.number === periodNumber - 1);
    const previousPeriodEnd = previousPeriod ? parseDateValue(getValues(previousPeriod.endName)) : null;

    if (previousPeriodEnd && selectedDate <= previousPeriodEnd) {
      return 'Start date must be after the previous period ends.';
    }

    return true;
  };

  const validatePeriodEnd = (value: string, startName: keyof AnnualPlanForm) => {
    if (!value) {
      return 'End date is required.';
    }

    const startDate = parseDateValue(getValues(startName));
    const endDate = parseDateValue(value);

    if (!startDate || !endDate) {
      return 'Select a valid date range.';
    }

    if (daysBetween(startDate, endDate) < 2) {
      return 'End date must be more than one day after the start date.';
    }

    return true;
  };

  return (
    <View style={styles.screenRoot}>
      <Screen
        backgroundColor={Colors.light.appBgLight}
        contentStyle={styles.content}
        header={
          <View style={styles.appBar}>
            <Pressable style={styles.appBarButton} onPress={() => router.back()}>
              <Icon source="chevron-left" size={24} color="#ffffff" />
            </Pressable>
            <Text style={styles.appBarTitle}>Create leave plan</Text>
            <View style={styles.appBarSpacer} />
          </View>
        }
        statusBarBackgroundColor={Colors.light.primary}
        statusBarStyle="light">
      {visiblePeriods > 0 && eligibility ? (
        <View style={styles.planSummaryCard}>
          <View style={styles.eligibilityHeader}>
            <Text style={styles.sectionTitle}>Plan summary</Text>
            <StatusPill isEligible={eligibility.isEligible} />
          </View>
          <View style={styles.planSummaryGrid}>
            <SummaryMetric label="Planned" value={`${verifiedDaysCount}`} />
            <SummaryMetric label="Entitled" value={entitledDays ? `${entitledDays}` : '--'} />
            <SummaryMetric label="Remaining" value={entitledDays ? `${remainingEntitledDays}` : '--'} />
          </View>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Icon source="calendar-edit" size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Annual leave plan</Text>
            <Text style={styles.infoCaption}>Tell us how you plan to take your annual leave. Once HR approves the plan, we will alert you to submit an official leave request.</Text>
          </View>
        </View>
      )}

      {visiblePeriods === 0 ? (
        <View style={styles.emptyPlanState}>
          <View style={styles.emptyPlanIcon}>
            <Icon source="block-helper" size={28} color={Colors.light.primary} />
          </View>
          <Text style={styles.emptyPlanTitle}>No planned period yet</Text>
          <Text style={styles.emptyPlanText}>Use the plus button below to add your first plan.</Text>
        </View>
      ) : (
        <View style={styles.periodList}>
          <Text style={styles.sectionTitle}>Planned periods</Text>
          <View style={styles.periodHeaderDivider} />
          {periodConfigs.slice(0, visiblePeriods).map((period, index) => {
            const startValue = getWatchedPeriodValue(period.startName, {
              firstPeriodStart,
              firstPeriodEnd,
              secondPeriodStart,
              secondPeriodEnd,
              thirdPeriodStart,
              thirdPeriodEnd,
            });
            const endValue = getWatchedPeriodValue(period.endName, {
              firstPeriodStart,
              firstPeriodEnd,
              secondPeriodStart,
              secondPeriodEnd,
              thirdPeriodStart,
              thirdPeriodEnd,
            });
            const periodEligibility = eligibility?.periods.find((item) => item.periodNumber === period.number);

            return (
              <View key={period.number}>
                <View style={styles.periodRow}>
                  <View style={styles.periodRowHeader}>
                    <Text style={styles.periodRowTitle}>Period {period.number}</Text>
                    <Pressable style={styles.removePeriodButton} onPress={() => deletePeriod(period.number)}>
                      <Icon source="trash-can-outline" size={18} color={Colors.light.danger} />
                    </Pressable>
                  </View>
                  <View style={styles.periodMetaGrid}>
                    <PeriodMeta label="Start date" value={startValue ? formatDate(startValue) : '--'} />
                    <PeriodMeta label="End date" value={endValue ? formatDate(endValue) : '--'} />
                    <PeriodMeta label="Days" value={periodEligibility ? `${periodEligibility.days}` : '--'} />
                  </View>
                </View>
                {index < visiblePeriods - 1 ? <View style={styles.periodDivider} /> : null}
              </View>
            );
          })}
        </View>
      )}

      <AppBottomSheet
        ref={periodSheetRef}
        snapPoints={pendingEligibility && pendingPlanSignature === currentPlanSignature ? ['82%'] : ['58%']}
        title={`Period ${sheetPeriodNumber ?? visiblePeriods + 1}`}
        scrollable
        onDismiss={dismissPeriodSheet}>
        <View style={styles.formCard}>
          <View style={styles.sheetDivider} />
          {sheetPeriodNumber ? (() => {
            const period = periodConfigs[sheetPeriodNumber - 1];
            const index = sheetPeriodNumber - 1;
            const startValue = getWatchedPeriodValue(period.startName, {
              firstPeriodStart,
              firstPeriodEnd,
              secondPeriodStart,
              secondPeriodEnd,
              thirdPeriodStart,
              thirdPeriodEnd,
            });
            const previousPeriod = periodConfigs[index - 1];
            const previousPeriodEnd = previousPeriod
              ? getWatchedPeriodValue(previousPeriod.endName, {
                  firstPeriodStart,
                  firstPeriodEnd,
                  secondPeriodStart,
                  secondPeriodEnd,
                  thirdPeriodStart,
                  thirdPeriodEnd,
                })
              : '';
            const dateLimits = getPeriodDateLimits({
              startValue,
              previousPeriodEnd,
            });
            return (
              <View key={period.number} style={styles.periodBlock}>
                {pendingEligibility && pendingPlanSignature === currentPlanSignature ? (
                  <View style={styles.confirmBlock}>
                    <EligibilityPeriodsConfirmation eligibility={pendingEligibility} />
                    <View style={styles.confirmActions}>
                      <AppButton
                        variant="ghost"
                        style={styles.confirmActionButton}
                        disabled={verifyMutation.isPending}
                        onPress={() => {
                          setPendingEligibility(null);
                          setPendingPlanSignature(null);
                        }}>
                        Edit dates
                      </AppButton>
                      <AppButton
                        icon="check"
                        style={styles.confirmActionButton}
                        disabled={!pendingEligibility.isEligible}
                        onPress={confirmVerifiedPeriod}>
                        Confirm period
                      </AppButton>
                    </View>
                  </View>
                ) : (
                  <View style={styles.sheetDateForm}>
                    <FormDateField
                      control={control}
                      name={period.startName}
                      label="Start date"
                      minimumDate={dateLimits.startMinimumDate}
                      required
                      rules={{ validate: (value) => validatePeriodStart(value, period.number) }}
                    />
                    <FormDateField
                      control={control}
                      name={period.endName}
                      label="End date"
                      minimumDate={dateLimits.endMinimumDate}
                      required
                      rules={{ validate: (value) => validatePeriodEnd(value, period.startName) }}
                    />
                  </View>
                )}
              </View>
            );
          })() : null}
          {visiblePeriodsAreValid && !(pendingEligibility && pendingPlanSignature === currentPlanSignature) ? (
            <AppButton
              icon="calendar-search"
              loading={verifyMutation.isPending}
              disabled={verifyMutation.isPending || createMutation.isPending || !annualType}
              onPress={handleSubmit(verifyPlan)}>
              Verify and add period
            </AppButton>
          ) : null}
        </View>
      </AppBottomSheet>

      {isCurrentPlanVerified ? (
        <AppButton
          icon="check"
          loading={createMutation.isPending}
          disabled={createMutation.isPending || verifyMutation.isPending || !annualType}
          onPress={handleSubmit(createVerifiedPlan)}>
          Create verified plan
        </AppButton>
      ) : null}

      <AppSnackbar
        visible={toast.visible}
        message={toast.message}
        tone={toast.tone}
        position="top"
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
      </Screen>
      {shouldShowAddPeriodFab ? (
        <Pressable style={styles.fab} onPress={() => openPeriodSheet((visiblePeriods + 1) as 1 | 2 | 3)}>
          <Icon source="plus" size={26} color="#ffffff" />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusPill({ isEligible }: { isEligible: boolean }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: isEligible ? Colors.light.successMuted : Colors.light.dangerMuted }]}>
      <Text style={[styles.statusText, { color: isEligible ? Colors.light.success : Colors.light.danger }]}>
        {isEligible ? 'Eligible' : 'Not eligible'}
      </Text>
    </View>
  );
}

function EligibilityPeriodsConfirmation({ eligibility }: { eligibility: LeavePlanEligibilityResponse }) {
  return (
    <View style={styles.confirmPeriodList}>
      {eligibility.periods.map((period) => {
        const dates = getEligibilityDates(period, eligibility);

        return (
          <View key={period.periodNumber} style={styles.confirmPeriodCard}>
            <View style={styles.confirmPeriodHeader}>
              <View style={styles.confirmPeriodTitleBlock}>
                <Text style={styles.sectionTitle}>
                  {period.days} day{period.days === 1 ? '' : 's'}
                </Text>
                <Text style={styles.periodCaption}>
                  {formatDate(period.start)} - {formatDate(period.end)}
                </Text>
              </View>
            </View>

            <View style={styles.confirmDateList}>
              {dates.length > 0 ? (
                dates.map((day, index) => (
                  <View
                    key={`${period.periodNumber}-${day.date}-${index}`}
                    style={[styles.confirmDateRow, getPreviewRowTint(day.status)]}>
                    <Text style={styles.confirmDateText}>{formatDate(day.date)}</Text>
                    <Text style={[styles.confirmStatusText, { color: getPreviewColor(day.status) }]}>
                      {formatLabel(day.label ?? day.status)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>No daily status details were returned for this period.</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricValue}>{value}</Text>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
    </View>
  );
}

function PeriodMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.periodMeta}>
      <Text style={styles.periodMetaLabel}>{label}</Text>
      <Text style={styles.periodMetaValue}>{value}</Text>
    </View>
  );
}

function buildEligibilityFromDatePreview({
  endDate,
  entitledDays,
  existingEligibility,
  periodNumber,
  preview,
  startDate,
}: {
  endDate: string;
  entitledDays: number;
  existingEligibility: LeavePlanEligibilityResponse | null;
  periodNumber: 1 | 2 | 3;
  preview: LeaveDatePreview;
  startDate: string;
}) {
  const period: LeavePlanEligibilityPeriod = {
    periodNumber,
    start: preview.startDate || startDate,
    end: preview.endDate || endDate,
    days: readNumber(preview.effectiveDays),
    availabilityPercentage: 100,
    isEligible:
      isDatePreviewEligible(preview) &&
      !doesPreviewExceedEntitlement(existingEligibility, periodNumber, readNumber(preview.effectiveDays), entitledDays),
    dates: preview.days ?? [],
  };

  return {
    isEligible: period.isEligible,
    periods: [period],
    dates: preview.days ?? [],
  };
}

function mergeEligibilityPeriods(
  currentEligibility: LeavePlanEligibilityResponse | null,
  pendingEligibility: LeavePlanEligibilityResponse,
  periodNumber: 1 | 2 | 3
) {
  const nextPeriods = [
    ...(currentEligibility?.periods ?? []).filter((period) => period.periodNumber < periodNumber),
    ...pendingEligibility.periods,
  ].sort((first, second) => first.periodNumber - second.periodNumber);

  return {
    ...pendingEligibility,
    isEligible: nextPeriods.every((period) => period.isEligible),
    periods: nextPeriods,
    dates: nextPeriods.flatMap((period) => getEligibilityDates(period, pendingEligibility)),
  };
}

function rebuildEligibilityAfterDelete(
  currentEligibility: LeavePlanEligibilityResponse | null,
  remainingPeriods: RemainingPlanPeriod[]
) {
  if (!currentEligibility || remainingPeriods.length === 0) {
    return null;
  }

  const periods = remainingPeriods.flatMap((period, index) => {
    if (!period.eligibilityPeriod) {
      return [];
    }

    return {
      ...period.eligibilityPeriod,
      periodNumber: index + 1,
      start: period.start,
      end: period.end,
    };
  });

  if (periods.length !== remainingPeriods.length) {
    return null;
  }

  return {
    ...currentEligibility,
    isEligible: periods.every((period) => period.isEligible),
    periods,
    dates: periods.flatMap((period) => getEligibilityDates(period, currentEligibility)),
  };
}

function buildPlanSignatureFromPeriods(remainingPeriods: RemainingPlanPeriod[]) {
  return JSON.stringify({
    periodCount: remainingPeriods.length,
    firstPeriodStart: remainingPeriods[0]?.start ?? '',
    firstPeriodEnd: remainingPeriods[0]?.end ?? '',
    secondPeriodStart: remainingPeriods[1]?.start ?? '',
    secondPeriodEnd: remainingPeriods[1]?.end ?? '',
    thirdPeriodStart: remainingPeriods[2]?.start ?? '',
    thirdPeriodEnd: remainingPeriods[2]?.end ?? '',
  });
}

function doesEligibilityExceedEntitlement(
  currentEligibility: LeavePlanEligibilityResponse | null,
  pendingEligibility: LeavePlanEligibilityResponse,
  periodNumber: 1 | 2 | 3,
  entitledDays: number
) {
  const pendingDays = pendingEligibility.periods.reduce((total, period) => total + readNumber(period.days), 0);
  return doesPreviewExceedEntitlement(currentEligibility, periodNumber, pendingDays, entitledDays);
}

function doesPreviewExceedEntitlement(
  currentEligibility: LeavePlanEligibilityResponse | null,
  periodNumber: 1 | 2 | 3,
  previewDays: number,
  entitledDays: number
) {
  if (!entitledDays) {
    return false;
  }

  const usedBeforePeriod =
    currentEligibility?.periods
      .filter((period) => period.periodNumber < periodNumber)
      .reduce((total, period) => total + readNumber(period.days), 0) ?? 0;

  return usedBeforePeriod + previewDays > entitledDays;
}

function isDatePreviewEligible(preview: LeaveDatePreview) {
  const hasBlockingStatus = (preview.days ?? []).some((day) => isBlockingPreviewStatus(day.status));
  return readNumber(preview.effectiveDays) > 0 && !hasBlockingStatus;
}

function isBlockingPreviewStatus(status: string) {
  const normalized = status.toUpperCase();
  return ['ALREADY_ON_LEAVE', 'UNAVAILABLE', 'INELIGIBLE', 'CONFLICT', 'BLOCKED'].includes(normalized);
}

function getEligibilityDates(
  period: LeavePlanEligibilityPeriod | undefined,
  response: LeavePlanEligibilityResponse
) {
  const periodDateItems =
    period?.dates ??
    period?.daysPreview ??
    period?.dateStatuses ??
    period?.leaveDates;
  const dateItems =
    periodDateItems ??
    response.dates ??
    response.days ??
    response.dateStatuses ??
    response.leaveDates ??
    [];

  const normalizedDates = dateItems.reduce<LeavePreviewDay[]>((items, day) => {
    const normalizedDay = normalizeEligibilityDay(day);
    if (normalizedDay) {
      items.push(normalizedDay);
    }
    return items;
  }, []);

  if (periodDateItems || !period) {
    return normalizedDates;
  }

  return normalizedDates.filter((day) => isDateWithinRange(day.date, period.start, period.end));
}

function normalizeEligibilityDay(day: unknown): LeavePreviewDay | null {
  if (!day || typeof day !== 'object') {
    return null;
  }

  const item = day as Record<string, unknown>;
  const date =
    readString(item.date) ??
    readString(item.Date) ??
    readString(item.day) ??
    readString(item.Day);
  const status =
    readString(item.status) ??
    readString(item.Status) ??
    readString(item.availabilityStatus) ??
    readString(item.AvailabilityStatus) ??
    readString(item.leaveStatus) ??
    readString(item.LeaveStatus);

  if (!date || !status) {
    return null;
  }

  return {
    date,
    status,
    label: readString(item.label) ?? readString(item.Label) ?? null,
  };
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readAnnualEntitledDays(dashboard?: LeaveDashboardResponse) {
  const plans = dashboard?.Plans ?? dashboard?.plans ?? [];
  const annualPlan = plans.find(
    (plan) => plan.leaveCategory?.toUpperCase() === 'ANNUAL' || plan.leaveName?.toLowerCase().includes('annual')
  );

  return readNumber(
    annualPlan?.totalEntitledDays ??
      annualPlan?.TotalEntitledDays ??
      annualPlan?.entitledDays ??
      annualPlan?.EntitledDays ??
      dashboard?.entitledDays ??
      dashboard?.EntitledDays
  );
}

function isDateWithinRange(value: string, startValue: string, endValue: string) {
  const date = parseDateValue(value);
  const startDate = parseDateValue(startValue);
  const endDate = parseDateValue(endValue);

  if (!date || !startDate || !endDate) {
    return true;
  }

  return date >= startDate && date <= endDate;
}

function parseDateValue(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTodayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysBetween(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function isPeriodRangeValid(startValue: string, endValue: string) {
  const startDate = parseDateValue(startValue);
  const endDate = parseDateValue(endValue);

  if (!startDate || !endDate) {
    return false;
  }

  return startDate > getTodayDate() && daysBetween(startDate, endDate) >= 2;
}

function getPeriodDateLimits({
  startValue,
  previousPeriodEnd,
}: {
  startValue: string;
  previousPeriodEnd: string;
}) {
  const tomorrow = addDays(getTodayDate(), 1);
  const previousEndDate = parseDateValue(previousPeriodEnd);
  const startMinimumDate = previousEndDate ? maxDate(tomorrow, addDays(previousEndDate, 1)) : tomorrow;
  const selectedStartDate = parseDateValue(startValue);
  const endMinimumDate = selectedStartDate ? addDays(selectedStartDate, 2) : addDays(startMinimumDate, 2);

  return {
    startMinimumDate,
    endMinimumDate,
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function maxDate(firstDate: Date, secondDate: Date) {
  return firstDate > secondDate ? firstDate : secondDate;
}

function getWatchedPeriodValue(
  name: keyof AnnualPlanForm,
  values: Pick<
    AnnualPlanForm,
    | 'firstPeriodStart'
    | 'firstPeriodEnd'
    | 'secondPeriodStart'
    | 'secondPeriodEnd'
    | 'thirdPeriodStart'
    | 'thirdPeriodEnd'
  >
) {
  return values[name];
}

function readNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getPreviewColor(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ELIGIBLE' || normalized === 'AVAILABLE') return Colors.light.success;
  if (normalized === 'WEEKEND' || normalized === 'HOLIDAY') return Colors.light.textSecondary;
  return Colors.light.danger;
}

function getPreviewRowTint(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ELIGIBLE' || normalized === 'AVAILABLE') {
    return null;
  }

  if (normalized === 'WEEKEND' || normalized === 'HOLIDAY') {
    return styles.confirmDateWarningRow;
  }

  return styles.confirmDateDangerRow;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
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
    paddingTop: Spacing.two,
  },
  emptyPlanState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.five,
  },
  emptyPlanIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  emptyPlanTitle: {
    ...Typography.lg,
    color: Colors.light.text,
    textAlign: 'center',
  },
  emptyPlanText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  periodList: {
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  periodRow: {
    gap: Spacing.three,
  },
  periodRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  periodRowTitle: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '700',
  },
  periodDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: Spacing.three,
  },
  periodHeaderDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  periodMetaGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  periodMeta: {
    flex: 1,
    minWidth: 0,
  },
  periodMetaLabel: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  periodMetaValue: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '700',
  },
  periodBlock: {
    gap: Spacing.three,
  },
  sheetDateForm: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  confirmBlock: {
    gap: Spacing.three,
  },
  confirmPeriodList: {
    gap: Spacing.three,
  },
  confirmPeriodCard: {
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: Spacing.three,
    marginBottom: Spacing.three,
  },
  confirmPeriodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  confirmPeriodTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  confirmDateList: {
    gap: Spacing.one,
  },
  confirmDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  confirmDateWarningRow: {
    backgroundColor: Colors.light.warningMuted,
    borderTopColor: '#f7d9a8',
  },
  confirmDateDangerRow: {
    backgroundColor: Colors.light.dangerMuted,
    borderTopColor: '#f4b8b3',
  },
  confirmDateText: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '500',
  },
  confirmStatusText: {
    ...Typography.xs,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  confirmActionButton: {
    flex: 1,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sectionTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
  periodCaption: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  removePeriodButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.dangerMuted,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: Spacing.one,
  },
  splitPrompt: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: 14,
    backgroundColor: Colors.light.primaryMuted,
    padding: Spacing.three,
  },
  splitPromptIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  splitPromptText: {
    flex: 1,
    minWidth: 0,
  },
  splitPromptTitle: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '600',
  },
  planSummaryCard: {
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  mutedText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  planSummaryGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryMetric: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Colors.light.appBgLight,
    padding: Spacing.three,
  },
  summaryMetricValue: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '700',
  },
  summaryMetricLabel: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  eligibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  statusText: {
    ...Typography.xs,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.five,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
});
