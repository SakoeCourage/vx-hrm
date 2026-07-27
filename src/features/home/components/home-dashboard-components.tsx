import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  AttendanceCalendarDay,
  Holiday,
  LeaveDashboardResponse,
  StaffRosterCell,
} from '@/lib/auth/api';

import {
  formatRosterStatus,
  formatRosterTimeRange,
  formatShortHolidayDate,
  getInitials,
  getLeaveSummary,
  getOnDutyStaff,
  toSentenceCase,
} from '../home-formatters';

export function QuickAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: string;
  label: string;
  tone: 'primary' | 'info' | 'warning' | 'success';
  onPress?: () => void;
}) {
  const colors = {
    primary: { bg: Colors.light.surface, fg: Colors.light.primary },
    info: { bg: Colors.light.surface, fg: '#12849a' },
    warning: { bg: Colors.light.surface, fg: '#c48118' },
    success: { bg: Colors.light.surface, fg: Colors.light.success },
  }[tone];

  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: colors.bg }]}>
        <Icon source={icon} size={25} color={colors.fg} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export function AttendanceActionLoading({ label }: { label: string }) {
  return (
    <View style={styles.actionLoading}>
      <ActivityIndicator size={16} color="#ffffff" />
      <Text style={styles.actionButtonLabel}>{label}</Text>
    </View>
  );
}

export function HolidayList({
  holidays,
  isLoading,
  isError,
}: {
  holidays: Holiday[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.infoInlineState}>
        <ActivityIndicator size={18} color={Colors.light.primary} />
        <Text style={styles.infoInlineText}>Loading holidays</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <InfoRow
        icon="alert-circle-outline"
        title="Could not load holidays"
        subtitle="Pull to refresh or try again shortly."
        tone="warning"
      />
    );
  }

  if (holidays.length === 0) {
    return (
      <InfoRow
        icon="calendar-star"
        title="No upcoming holiday"
        subtitle="Holiday schedules will appear here when published."
        tone="warning"
      />
    );
  }

  return (
    <View style={styles.holidayList}>
      {holidays.slice(0, 3).map((holiday) => (
        <View key={`${holiday.date}-${holiday.name}`} style={styles.holidayRow}>
          <View style={styles.holidayIcon}>
            <Icon source="calendar-star" size={20} color="#c48118" />
          </View>
          <View style={styles.holidayText}>
            <Text style={styles.holidayName}>{holiday.name}</Text>
            <Text style={styles.holidayType}>Public holiday</Text>
          </View>
          <Text style={styles.holidayDate}>{formatShortHolidayDate(holiday.date)}</Text>
        </View>
      ))}
    </View>
  );
}

export function CurrentRosterDetails({
  cell,
  isLoading,
  isError,
  calendarDay,
  isCoworkersLoading,
}: {
  cell?: StaffRosterCell;
  isLoading: boolean;
  isError: boolean;
  calendarDay?: AttendanceCalendarDay;
  isCoworkersLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.infoInlineState}>
        <ActivityIndicator size={18} color={Colors.light.primary} />
        <Text style={styles.infoInlineText}>Loading current roster</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <InfoRow
        icon="alert-circle-outline"
        title="Could not load roster"
        subtitle="Your duty status will appear here once the roster is available."
        tone="warning"
      />
    );
  }

  if (!cell) {
    return (
      <InfoRow
        icon="calendar-remove-outline"
        title="No roster for today"
        subtitle="You do not have a published roster entry for today."
        tone="primary"
      />
    );
  }

  const onDutyStaff = getOnDutyStaff(cell, calendarDay);

  return (
    <>
      <View style={styles.rosterSummary}>
        <View style={styles.rosterBody}>
          <Text style={styles.rosterTitle}>{toSentenceCase(cell.shiftName || 'Flexible shift')}</Text>
          <Text style={styles.rosterMeta}>{formatRosterTimeRange(cell)}</Text>
        </View>
        <View style={styles.dutyStatusBadge}>
          <Text style={styles.dutyStatusText}>{formatRosterStatus(cell.dutyStatus)}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />
      <Text style={styles.cardSectionLabel}>Colleagues on Duty</Text>
      {isCoworkersLoading ? (
        <View style={styles.infoInlineState}>
          <ActivityIndicator size={16} color={Colors.light.primary} />
          <Text style={styles.infoInlineText}>Loading colleagues</Text>
        </View>
      ) : onDutyStaff.length > 0 ? (
        <View style={styles.onDutyScrollWrap}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            alwaysBounceHorizontal
            scrollEnabled={onDutyStaff.length > 1}
            showsHorizontalScrollIndicator={false}
            style={styles.onDutyScroll}
            contentContainerStyle={styles.onDutyPillList}>
            {onDutyStaff.map((person) => (
              <View
                key={person.entryId || person.staffIdentificationNumber}
                style={styles.onDutyPill}>
                <View style={styles.staffInitials}>
                  <Text style={styles.staffInitialsText}>{getInitials(toSentenceCase(person.staffFullName))}</Text>
                </View>
                <View style={styles.onDutyPillText}>
                  <Text style={styles.onDutyPillName} numberOfLines={1}>
                    {toSentenceCase(person.staffFullName)}
                  </Text>
                  <Text style={styles.onDutyPillShift} numberOfLines={1}>
                    {toSentenceCase(person.shiftName ?? cell.shiftName ?? 'Shift')}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <InfoRow
          icon="account-group-outline"
          title="No staff listed yet"
          subtitle="Coworkers assigned to your current shift will appear here."
          tone="primary"
        />
      )}
    </>
  );
}

export function LeaveDetails({
  dashboard,
  isLoading,
  isError,
}: {
  dashboard?: LeaveDashboardResponse;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.infoInlineState}>
        <ActivityIndicator size={18} color={Colors.light.primary} />
        <Text style={styles.infoInlineText}>Loading leave details</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <InfoRow
        icon="alert-circle-outline"
        title="Could not load leave"
        subtitle="Your leave balance will appear here when available."
        tone="warning"
      />
    );
  }

  const summary = getLeaveSummary(dashboard);

  return (
    <View style={styles.leaveMetrics}>
      <Metric label="Remaining" value={`${summary.remainingDays} days`} />
      <Metric label="Used" value={`${summary.daysUsed} days`} />
      <Metric label="Pending" value={`${summary.pendingRequests} request${summary.pendingRequests === 1 ? '' : 's'}`} />
    </View>
  );
}

export function HomeInfoCard({
  title,
  children,
  onPress,
  actionMode = 'card',
}: {
  title: string;
  children: ReactNode;
  onPress?: () => void;
  actionMode?: 'card' | 'arrow';
}) {
  const isCardPressable = Boolean(onPress && actionMode === 'card');
  const Container = isCardPressable ? Pressable : View;

  return (
    <Container style={styles.infoCard} onPress={isCardPressable ? onPress : undefined}>
      <View style={styles.infoCardHeader}>
        <Text style={styles.infoCardTitle}>{title}</Text>
        {onPress && (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            style={styles.infoCardAction}
            onPress={onPress}>
            <Icon source="chevron-right" size={16} color={Colors.light.text} />
          </Pressable>
        )}
      </View>
      {children}
    </Container>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  title,
  subtitle,
  tone,
}: {
  icon: string;
  title: string;
  subtitle: string;
  tone: 'primary' | 'warning';
}) {
  const colors = {
    primary: { bg: Colors.light.primaryMuted, fg: Colors.light.primary },
    warning: { bg: Colors.light.warningMuted, fg: '#c48118' },
  }[tone];

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoRowIcon, { backgroundColor: colors.bg }]}>
        <Icon source={icon} size={20} color={colors.fg} />
      </View>
      <View style={styles.infoRowText}>
        <Text style={styles.infoRowTitle}>{title}</Text>
        <Text style={styles.infoRowSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  actionButtonLabel: {
    ...Typography.xs,
    color: '#ffffff',
    fontWeight: '600',
  },
  quickAction: {
    width: '23%',
    alignItems: 'center',
    gap: Spacing.two,
  },
  quickIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  quickLabel: {
    ...Typography.xs,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.light.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoCard: {
    gap: Spacing.three,
    borderRadius: 24,
    backgroundColor: Colors.light.surface,
    padding: Spacing.four,
    shadowColor: '#74d6e8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
  },
  infoCardTitle: {
    ...Typography.md,
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  infoCardAction: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f7f8',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 54,
  },
  infoRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowText: {
    flex: 1,
    minWidth: 0,
  },
  infoRowTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '500',
  },
  infoRowSubtitle: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  infoInlineState: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  infoInlineText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  holidayList: {
    gap: Spacing.three,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 58,
  },
  holidayIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8e8',
  },
  holidayText: {
    flex: 1,
    minWidth: 0,
  },
  holidayName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '500',
  },
  holidayType: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  holidayDate: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  rosterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: 14,
    backgroundColor: '#f7fcfd',
    padding: Spacing.three,
  },
  rosterBody: {
    flex: 1,
    minWidth: 0,
  },
  rosterTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  rosterMeta: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  dutyStatusBadge: {
    borderRadius: 999,
    backgroundColor: Colors.light.primaryMuted,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  dutyStatusText: {
    ...Typography.xs,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  cardSectionLabel: {
    ...Typography.xs,
    color: Colors.light.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  leaveMetrics: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  onDutyScrollWrap: {
    width: '100%',
    overflow: 'visible',
  },
  onDutyScroll: {
    width: '100%',
  },
  onDutyPillList: {
    flexGrow: 0,
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  onDutyPill: {
    width: 170,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9f3f8',
    backgroundColor: '#f7fcfd',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  staffInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  staffInitialsText: {
    ...Typography.xs,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  onDutyPillText: {
    flex: 1,
    minWidth: 0,
  },
  onDutyPillName: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '600',
  },
  onDutyPillShift: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  metric: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: Colors.light.surface,
    padding: Spacing.three,
  },
  metricLabel: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  metricValue: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
});
