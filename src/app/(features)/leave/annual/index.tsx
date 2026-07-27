import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

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

export default function AnnualLeaveScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const leaveYear = new Date().getFullYear();
  const staffIdentificationNumber = session?.staffIdentificationNumber ?? '';

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
        <StateCard icon="calendar-sync-outline" title="Loading annual leave" description="Checking your plan and balance." loading />
      ) : isError ? (
        <StateCard icon="alert-circle-outline" title="Could not load leave" description="Please try again shortly." />
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
      )}
    </Screen>
  );
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
