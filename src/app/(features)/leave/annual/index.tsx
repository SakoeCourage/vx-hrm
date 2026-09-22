import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import { useEffect, useMemo, useRef, useState } from 'react';
import PagerView from 'react-native-pager-view';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppButton, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  getLeavePlans,
  getLeaveTypes,
  getMyLeaveDashboard,
  getStaffLeaveRequests,
  LeaveDashboardPlan,
  LeavePlan,
  LeaveType,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

const leavePlanStepImages = [
  require('@/assets/images/leave-plan-step-0.png'),
  require('@/assets/images/leave-plan-step-1.png'),
  require('@/assets/images/leave-plan-step-2.png'),
  require('@/assets/images/leave-plan-step-3.png'),
];
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function AnnualLeaveScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const leaveYear = new Date().getFullYear();
  const staffIdentificationNumber = session?.staffIdentificationNumber ?? '';
  const [introStepIndex, setIntroStepIndex] = useState(0);

  const dashboardQuery = useQuery({
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

  const plansQuery = useQuery({
    queryKey: ['leave-plans', session?.tenantId, leaveYear],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getLeavePlans({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          year: leaveYear,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  const requestsQuery = useQuery({
    queryKey: ['staff-leave-requests', session?.tenantId, staffIdentificationNumber, leaveYear],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffLeaveRequests({
          staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          year: leaveYear,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && staffIdentificationNumber),
  });

  const annualType = findAnnualLeaveType(leaveTypesQuery.data?.data ?? []);
  const dashboardPlan = findAnnualDashboardPlan(dashboardQuery.data?.plans ?? dashboardQuery.data?.Plans ?? []);
  const annualPlans = (plansQuery.data?.data ?? []).filter((plan) => isAnnualPlan(plan));
  const latestPlan = annualPlans[0];
  const approvedPlan = annualPlans.find((plan) => plan.isApproved || plan.status?.toUpperCase() === 'APPROVED');
  const pendingRequest = (requestsQuery.data?.data ?? []).find((request) => request.status?.toUpperCase() === 'PENDING');
  const isLoading = dashboardQuery.isLoading || leaveTypesQuery.isLoading || plansQuery.isLoading;
  const isError = dashboardQuery.isError || leaveTypesQuery.isError || plansQuery.isError;
  const introSteps = useMemo(
    () =>
      getLeavePlanIntroSteps({
        entitledDays: readNumber(dashboardPlan?.totalEntitledDays ?? dashboardPlan?.TotalEntitledDays ?? dashboardQuery.data?.entitledDays ?? dashboardQuery.data?.EntitledDays),
        leaveYear,
      }),
    [dashboardPlan, dashboardQuery.data?.EntitledDays, dashboardQuery.data?.entitledDays, leaveYear]
  );
  const showPlanIntro = !latestPlan;

  const handleIntroAction = () => {
    if (introStepIndex < introSteps.length - 1) {
      setIntroStepIndex((current) => current + 1);
      return;
    }

    router.push('/leave/annual/create-plan');
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
          <Text style={styles.appBarTitle}>Annual leave</Text>
          <View style={styles.appBarSpacer} />
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      {isLoading ? (
        <AnnualLeaveLoading />
      ) : isError ? (
        <StateCard icon="alert-circle-outline" title="Could not load leave" description="Please try again shortly." />
      ) : (
        showPlanIntro ? (
          <LeavePlanIntro
            steps={introSteps}
            activeIndex={introStepIndex}
            onStepChange={setIntroStepIndex}
            onNext={handleIntroAction}
          />
        ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <Icon source="calendar-check-outline" size={26} color={Colors.light.primary} />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>Annual leave plan</Text>
                <Text style={styles.summaryCaption}>Tell us how you plan to take your annual leave. Once HR approves the plan, we will alert you to submit an official leave request.</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <Metric label="Entitled" value={readNumber(dashboardPlan?.totalEntitledDays ?? dashboardPlan?.TotalEntitledDays ?? dashboardQuery.data?.entitledDays ?? dashboardQuery.data?.EntitledDays)} />
              <Metric label="Planned" value={readNumber(dashboardPlan?.totalDaysPlanned ?? dashboardPlan?.TotalDaysPlanned)} />
              <Metric label="Used" value={readNumber(dashboardPlan?.daysUsed ?? dashboardPlan?.DaysUsed)} />
              <Metric label="Remaining" value={readNumber(dashboardPlan?.daysRemaining ?? dashboardPlan?.DaysRemaining)} />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current plan</Text>
              {latestPlan?.status && <StatusPill status={latestPlan.status} />}
            </View>
            {latestPlan ? (
              <PlanSummary plan={latestPlan} />
            ) : (
              <Text style={styles.emptyText}>No annual leave plan has been created for {leaveYear}.</Text>
            )}
          </View>

          {pendingRequest && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pending request</Text>
                <StatusPill status={pendingRequest.status ?? 'PENDING'} />
              </View>
              <Text style={styles.requestTitle}>{pendingRequest.leaveName ?? 'Annual leave'}</Text>
              <Text style={styles.mutedText}>{formatDateRange(pendingRequest.startDate, pendingRequest.endDate)}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <AppButton
              icon="calendar-plus-outline"
              onPress={() => router.push('/leave/annual/create-plan')}>
              {latestPlan ? 'Create new plan' : 'Create leave plan'}
            </AppButton>
            <AppButton
              variant="outline"
              icon="send-outline"
              disabled={!annualType || !approvedPlan || Boolean(pendingRequest)}
              onPress={() => router.push('/leave/annual/request')}>
              Submit leave request
            </AppButton>
            {!approvedPlan && <Text style={styles.actionHint}>An approved annual leave plan is required before submitting a request.</Text>}
          </View>
        </>
        )
      )}
    </Screen>
  );
}

function AnnualLeaveLoading() {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size={28} color={Colors.light.primary} />
      <Text style={styles.loadingText}>Checking leave info</Text>
    </View>
  );
}

type LeavePlanIntroStep = {
  title: {
    main: string;
    accent: string;
  };
  message: string;
  image: number;
};

function LeavePlanIntro({
  activeIndex,
  onNext,
  onStepChange,
  steps,
}: {
  activeIndex: number;
  onNext: () => void;
  onStepChange: (index: number) => void;
  steps: LeavePlanIntroStep[];
}) {
  const pagerRef = useRef<PagerView>(null);
  const isLastStep = activeIndex === steps.length - 1;
  const handleNextPress = () => {
    if (isLastStep) {
      onNext();
      return;
    }

    pagerRef.current?.setPage(activeIndex + 1);
    onStepChange(activeIndex + 1);
  };

  return (
    <LinearGradient
      colors={['#ffffff', '#f5fcfd', Colors.light.primaryMuted]}
      locations={[0, 0.52, 1]}
      style={styles.introFlow}>
      <AnimatedPagerView
        ref={pagerRef}
        style={styles.introPager}
        initialPage={activeIndex}
        onPageSelected={(event) => {
          onStepChange(event.nativeEvent.position);
        }}>
        {steps.map((step, index) => (
          <View key={`${step.title.main}-${step.title.accent}`} collapsable={false} style={styles.introPage}>
            <Animated.View
              entering={FadeIn.duration(220).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
              exiting={FadeOut.duration(120)}
              style={styles.introImageWrap}>
              <Image source={step.image} style={styles.introImage} />
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(220).delay(40).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}
              exiting={FadeOut.duration(120)}
              style={styles.introCopy}>
              <Text style={styles.introTitle}>
                {step.title.main}
                <Text style={styles.introTitleAccent}>{step.title.accent}</Text>
              </Text>
              <Text style={styles.introMessage}>{step.message}</Text>
            </Animated.View>
          </View>
        ))}
      </AnimatedPagerView>

      <View style={styles.introFooter}>
        <IntroProgressButton
          activeIndex={activeIndex}
          isLastStep={isLastStep}
          totalSteps={steps.length}
          onPress={handleNextPress}
        />
      </View>
    </LinearGradient>
  );
}

function IntroProgressButton({
  activeIndex,
  isLastStep,
  onPress,
  totalSteps,
}: {
  activeIndex: number;
  isLastStep: boolean;
  onPress: () => void;
  totalSteps: number;
}) {
  const progress = useSharedValue(activeIndex + 1);

  useEffect(() => {
    progress.value = withTiming(activeIndex + 1, { duration: 260 });
  }, [activeIndex, progress]);

  return (
    <Pressable accessibilityRole="button" style={styles.introProgressButton} onPress={onPress}>
      <View style={styles.introProgressRing}>
        {[1, 2, 3, 4].map((segment) => (
          <IntroProgressSegment
            key={segment}
            progress={progress}
            segment={segment}
            totalSteps={totalSteps}
          />
        ))}
        <View style={[styles.introNextButton, isLastStep && styles.introNextButtonFinal]}>
          <Icon source={isLastStep ? 'check' : 'arrow-right'} size={22} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}

function IntroProgressSegment({
  progress,
  segment,
  totalSteps,
}: {
  progress: SharedValue<number>;
  segment: number;
  totalSteps: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [segment - 0.45, segment],
      [0, segment <= totalSteps ? 1 : 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.introProgressSegment, getIntroProgressSegmentStyle(segment), animatedStyle]}
    />
  );
}

function getIntroProgressSegmentStyle(segment: number) {
  switch (segment) {
    case 1:
      return styles.introProgressSegment1;
    case 2:
      return styles.introProgressSegment2;
    case 3:
      return styles.introProgressSegment3;
    default:
      return styles.introProgressSegment4;
  }
}

function getLeavePlanIntroSteps({
  entitledDays,
  leaveYear,
}: {
  entitledDays: string;
  leaveYear: number;
}): LeavePlanIntroStep[] {
  const entitlementText = entitledDays !== '0'
    ? `${entitledDays} days of annual leave`
    : 'your annual leave entitlement';

  return [
    {
      title: { main: 'Plan Your ', accent: 'Leave' },
      message: 'Choose when you want to take your annual leave so we can plan coverage for the days you will be away.',
      image: leavePlanStepImages[0],
    },
    {
      title: { main: 'Your Leave ', accent: 'Limit' },
      message: `You are entitled to ${entitlementText} for ${leaveYear}. Your planned leave periods must stay within this limit.`,
      image: leavePlanStepImages[1],
    },
    {
      title: { main: 'Split Your ', accent: 'Leave' },
      message: 'You can split your annual leave into up to 3 separate periods. Add one period at a time and confirm the dates before adding another.',
      image: leavePlanStepImages[2],
    },
    {
      title: { main: 'Check And ', accent: 'Submit' },
      message: 'We will check weekends, holidays, unavailable dates, and your remaining days. Submit your plan once the periods look correct. HR approval is required before you can request leave.',
      image: leavePlanStepImages[3],
    },
  ];
}

function StateCard({ icon, title, description, loading }: { icon: string; title: string; description: string; loading?: boolean }) {
  return (
    <View style={styles.stateCard}>
      {loading ? <ActivityIndicator size={22} color={Colors.light.primary} /> : <Icon source={icon} size={30} color={Colors.light.warning} />}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{description}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PlanSummary({ plan }: { plan: LeavePlan }) {
  return (
    <View style={styles.planList}>
      {(plan.periods ?? []).map((period) => (
        <View key={period.periodNumber} style={styles.planPeriod}>
          <View>
            <Text style={styles.periodTitle}>Period {period.periodNumber}</Text>
            <Text style={styles.mutedText}>{formatDateRange(period.start, period.end)}</Text>
          </View>
          <Text style={styles.periodDays}>{period.days} days</Text>
        </View>
      ))}
      {(plan.periods ?? []).length === 0 && <Text style={styles.emptyText}>No periods found for this plan.</Text>}
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const color = normalized === 'APPROVED' ? Colors.light.success : normalized === 'REJECTED' ? Colors.light.danger : '#c48118';
  const bg = normalized === 'APPROVED' ? Colors.light.successMuted : normalized === 'REJECTED' ? Colors.light.dangerMuted : Colors.light.warningMuted;

  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={[styles.statusText, { color }]}>{formatLabel(status)}</Text>
    </View>
  );
}

function findAnnualLeaveType(types: LeaveType[]) {
  return types.find((type) => type.leaveCategory?.toUpperCase() === 'ANNUAL' || type.leaveName?.toLowerCase().includes('annual'));
}

function findAnnualDashboardPlan(plans: LeaveDashboardPlan[]) {
  return plans.find((plan) => plan.leaveCategory?.toUpperCase() === 'ANNUAL' || plan.leaveName?.toLowerCase().includes('annual'));
}

function isAnnualPlan(plan: LeavePlan) {
  return plan.leaveCategory?.toUpperCase() === 'ANNUAL' || plan.leaveTypeName?.toLowerCase().includes('annual') || plan.leaveName?.toLowerCase().includes('annual');
}

function readNumber(value: unknown) {
  return typeof value === 'number' ? String(value) : '0';
}

function formatDateRange(start?: string, end?: string) {
  return [formatDate(start), formatDate(end)].filter(Boolean).join(' - ') || 'No dates provided';
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
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
  introFlow: {
    flexGrow: 1,
    minHeight: 620,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: 24,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  introPager: {
    flex: 1,
  },
  introPage: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  introImageWrap: {
    minHeight: 292,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introImage: {
    width: '100%',
    height: 292,
    resizeMode: 'contain',
  },
  introCopy: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  introTitle: {
    ...Typography.xl,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
  },
  introTitleAccent: {
    color: '#f5a400',
  },
  introMessage: {
    ...Typography.base,
    color: Colors.light.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  introFooter: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.two,
  },
  introProgressButton: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introProgressRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.light.border,
  },
  introProgressSegment: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  introProgressSegment1: {
    borderTopColor: '#f5a400',
  },
  introProgressSegment2: {
    borderRightColor: '#f5a400',
  },
  introProgressSegment3: {
    borderBottomColor: '#f5a400',
  },
  introProgressSegment4: {
    borderLeftColor: '#f5a400',
  },
  introNextButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  introNextButtonFinal: {
    backgroundColor: '#f5a400',
    shadowColor: '#f5a400',
  },
  loadingState: {
    flexGrow: 1,
    minHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    ...Typography.base,
    color: Colors.light.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
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
  summaryCard: {
    gap: Spacing.four,
    borderRadius: 24,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  summaryHeader: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  summaryCaption: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metric: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: Colors.light.appBgLight,
    padding: Spacing.three,
  },
  metricValue: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  metricLabel: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  sectionCard: {
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  sectionHeader: {
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
  planList: {
    gap: Spacing.two,
  },
  planPeriod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: 16,
    backgroundColor: Colors.light.appBgLight,
    padding: Spacing.three,
  },
  periodTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  periodDays: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  requestTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  mutedText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  emptyText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
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
  actions: {
    gap: Spacing.two,
  },
  actionHint: {
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
