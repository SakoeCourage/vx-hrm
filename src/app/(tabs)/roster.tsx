import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, Pressable, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Avatar, Card, Icon, Text } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import PagerView from 'react-native-pager-view';
import * as Sharing from 'expo-sharing';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useEvent,
  useHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppSnackbar, AppStatusBadge } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  getCurrentStaffRoster,
  getUpcomingStaffRoster,
  getStaffAttendanceCalendar,
  downloadRosterPdf,
  StaffRosterCell,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

type RosterFilter = 'current' | 'upcoming';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

type PagerScrollEvent = {
  eventName: string;
  position: number;
  offset: number;
};

function getSortedRosterCells(roster?: { cells?: StaffRosterCell[] }) {
  if (!roster?.cells) {
    return [];
  }

  return [...roster.cells].sort((a, b) => a.date.localeCompare(b.date));
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? 'S'}${words[1]?.[0] ?? ''}`.slice(0, 2).toUpperCase();
}

export default function RosterTab() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const [filter, setFilter] = useState<RosterFilter>('current');
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [showSimulatedCoworkers, setShowSimulatedCoworkers] = useState(false);
  const [exportToast, setExportToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'success' | 'danger';
  }>({ visible: false, message: '', tone: 'success' });
  const pagerRef = useRef<PagerView>(null);
  const tabProgress = useSharedValue(0);
  const { width: screenWidth } = useWindowDimensions();
  const indicatorWidth = screenWidth / 2;
  const tabIndicatorStyle = useRosterTabIndicatorStyle(tabProgress, indicatorWidth);
  const pageScrollHandler = useRosterPageScrollHandler({
    onPageScroll: (event) => {
      'worklet';
      tabProgress.value = event.position + event.offset;
    },
  });

  const handleChangeFilter = (value: RosterFilter) => {
    const page = value === 'current' ? 0 : 1;
    setFilter(value);
    setSelectedCellId(null);
    tabProgress.value = withTiming(page, { duration: 180 });
    pagerRef.current?.setPage(page);
  };

  // Queries
  const currentRosterQuery = useQuery({
    queryKey: ['current-staff-roster', session?.tenantId, session?.id],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getCurrentStaffRoster({
          staffIdentificationNumber: activeSession.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && session?.staffIdentificationNumber),
  });

  const upcomingRosterQuery = useQuery({
    queryKey: ['upcoming-staff-roster', session?.tenantId, session?.id],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getUpcomingStaffRoster({
          staffIdentificationNumber: activeSession.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && session?.staffIdentificationNumber),
  });

  const activeQuery = filter === 'current' ? currentRosterQuery : upcomingRosterQuery;
  const rosterData = activeQuery.data ?? [];
  const currentRoster = rosterData[0]; // Fetch first active roster period
  const currentPageRoster = currentRosterQuery.data?.[0];
  const upcomingPageRoster = upcomingRosterQuery.data?.[0];
  const currentPageCells = getSortedRosterCells(currentPageRoster);
  const upcomingPageCells = getSortedRosterCells(upcomingPageRoster);

  const exportRosterMutation = useMutation({
    mutationFn: async (rosterId: string) => {
      if (!session?.accessToken || !session.tenantId) {
        throw new Error('Your session is not ready. Please try again.');
      }

      const fileUri = await authenticatedRequest((activeSession) =>
        downloadRosterPdf({
          rosterId,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      );

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Duty roster',
        UTI: 'com.adobe.pdf',
      });
    },
    onSuccess: () => {
      setExportToast({
        visible: true,
        message: 'Roster PDF ready.',
        tone: 'success',
      });
    },
    onError: (error) => {
      setExportToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Could not export roster.',
        tone: 'danger',
      });
    },
  });

  // Fetch attendance calendar for the current roster period (contains coworker data)
  const calendarQuery = useQuery({
    queryKey: [
      'staff-attendance-calendar',
      session?.tenantId,
      session?.id,
      currentRoster?.startDate,
      currentRoster?.endDate,
    ],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffAttendanceCalendar({
          staffIdentificationNumber: activeSession.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          fromDate: currentRoster!.startDate!,
          toDate: currentRoster!.endDate!,
        })
      ),
    enabled: Boolean(
      session?.accessToken &&
        session?.tenantId &&
        session?.staffIdentificationNumber &&
        currentRoster?.startDate &&
        currentRoster?.endDate
    ),
  });

  // Build a date-keyed map from the attendance calendar for fast lookup
  const calendarDayMap = useMemo(() => {
    const days = calendarQuery.data?.days ?? [];
    return Object.fromEntries(days.map((d) => [d.date, d]));
  }, [calendarQuery.data]);

  // Extract all calendar cells
  const cells = useMemo(() => {
    return getSortedRosterCells(currentRoster);
  }, [currentRoster]);

  // Set default selected cell when cells load
  const selectedCell = useMemo(() => {
    if (!cells.length) {
      return undefined;
    }
    // If the user has tapped a cell, show that one
    if (selectedCellId) {
      const tapped = cells.find((item) => item.entryId === selectedCellId);
      if (tapped) return tapped;
    }
    // Otherwise default to today's cell, or the first one
    const todayStr = new Date().toISOString().split('T')[0];
    return cells.find((item) => item.date === todayStr) ?? cells[0];
  }, [cells, selectedCellId]);

  const getStatusTone = (status?: string): 'success' | 'neutral' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'ON_DUTY':
        return 'success';
      case 'DAY_OFF':
        return 'neutral';
      case 'HOLIDAY_OFF':
        return 'info';
      case 'ANNUAL_LEAVE':
      case 'STUDY_LEAVE':
        return 'warning';
      case 'EXCUSE_DUTY':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getStatusLabel = (status?: string) => {
    if (!status) return 'Off Duty';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatRosterDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
      const dayMonth = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return { weekday, dayMonth };
    } catch {
      return { weekday: 'Day', dayMonth: dateStr };
    }
  };

  const formatRosterMonth = (dateStr?: string) => {
    if (!dateStr) return 'Roster';

    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return 'Roster';
    }
  };

  const formatRosterDayNumber = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric' });
    } catch {
      return dateStr.slice(-2);
    }
  };

  const formatCellTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const displayCoworkersList = useMemo(() => {
    const date = selectedCell?.date ?? '';

    // 1. Check attendance calendar (most complete source)
    const calendarDay = calendarDayMap[date];
    if (calendarDay?.otherOnDutyStaff && calendarDay.otherOnDutyStaff.length > 0) {
      return calendarDay.otherOnDutyStaff;
    }

    // 2. Check the raw roster cell (API may embed coworkers here too)
    if (selectedCell?.otherOnDutyStaff && selectedCell.otherOnDutyStaff.length > 0) {
      return selectedCell.otherOnDutyStaff;
    }

    // 3. Check the unfiltered query data directly (in case memoized cell missed a field)
    const rawCell = currentRoster?.cells?.find((c) => c.date === date);
    if (rawCell?.otherOnDutyStaff && rawCell.otherOnDutyStaff.length > 0) {
      return rawCell.otherOnDutyStaff;
    }

    // 4. Preview mode for UI verification when live data has no coworkers
    if (showSimulatedCoworkers) {
      return [
        { staffIdentificationNumber: 'KBA000001', staffFullName: 'Ama Mensah', entryId: 'sim-1', shiftName: selectedCell?.shiftName || 'Standard' },
        { staffIdentificationNumber: 'KBA000002', staffFullName: 'Jay Sakoe', entryId: 'sim-2', shiftName: selectedCell?.shiftName || 'Standard' },
        { staffIdentificationNumber: 'KBA000003', staffFullName: 'Kofi Agyeman', entryId: 'sim-3', shiftName: selectedCell?.shiftName || 'Standard' },
      ];
    }
    return [];
  }, [showSimulatedCoworkers, selectedCell, calendarDayMap, currentRoster]);


  const renderRosterState = (
    query: typeof currentRosterQuery | typeof upcomingRosterQuery,
    roster: typeof currentPageRoster
  ) => {
    if (query.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Fetching published schedule...</Text>
        </View>
      );
    }

    if (query.isError) {
      return (
        <Card style={styles.errorCard}>
          <Card.Content style={styles.centerContent}>
            <Icon source="alert-circle-outline" size={48} color={Colors.light.danger} />
            <Text style={styles.errorTitle}>Failed to Load Roster</Text>
            <Text style={styles.errorSubtitle}>Could not retrieve roster details from server.</Text>
            <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </Card.Content>
        </Card>
      );
    }

    if (!roster) {
      return (
        <View style={styles.emptyState}>
          <Icon source="block-helper" size={34} color="rgba(69, 97, 106, 0.42)" />
          <Text style={styles.emptyTitle}>No Published Roster</Text>
          <Text style={styles.emptySubtitle}>There are no published rosters for this period.</Text>
        </View>
      );
    }

    return null;
  };

  const renderRosterPage = (
    query: typeof currentRosterQuery | typeof upcomingRosterQuery,
    roster: typeof currentPageRoster,
    pageCells: StaffRosterCell[],
    pageFilter: RosterFilter
  ) => {
    const state = renderRosterState(query, roster);
    const pageSelectedCell =
      pageCells.find((item) => item.entryId === selectedCellId) ??
      pageCells.find((item) => item.date === new Date().toISOString().split('T')[0]) ??
      pageCells[0];
    const ownShiftTime =
      pageSelectedCell?.timeIn && pageSelectedCell?.timeOut
        ? `${formatCellTime(pageSelectedCell.timeIn)} - ${formatCellTime(pageSelectedCell.timeOut)}`
        : pageSelectedCell?.dutyStatus === 'ON_DUTY'
          ? 'Flexible hours'
          : 'No hours scheduled';
    const staffName =
      [session?.firstName, session?.lastName].filter(Boolean).join(' ') ||
      session?.staffIdentificationNumber ||
      'You';
    const authStaffId = session?.staffIdentificationNumber ?? '';
    const coworkerRows =
      pageFilter === filter
        ? displayCoworkersList
            .filter((person) => person.staffIdentificationNumber !== authStaffId)
            .map((person) => ({
              key: person.entryId,
              name: person.staffFullName,
              assignment: person.staffIdentificationNumber,
              status: 'On Duty',
              tone: 'success' as const,
              initials: getInitials(person.staffFullName),
            }))
        : [];
    const staffRows = pageSelectedCell
      ? [
          {
            key: 'self',
            name: staffName,
            assignment: ownShiftTime,
            status: getStatusLabel(pageSelectedCell.dutyStatus),
            tone: getStatusTone(pageSelectedCell.dutyStatus),
            initials: getInitials(staffName),
          },
          ...coworkerRows,
        ]
      : [];

    return (
      <ScrollView
        contentContainerStyle={styles.rosterPageContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}>
        {state ??
          (roster && pageSelectedCell ? (
            <>
              <View style={styles.rosterBoardHeader}>
                <View>
                  <Text style={styles.rosterMonthTitle}>{formatRosterMonth(pageSelectedCell.date)}</Text>
                  <Text style={styles.rosterCycleText}>
                    {roster.startDate && roster.endDate
                      ? `${formatRosterDate(roster.startDate).dayMonth} - ${formatRosterDate(roster.endDate).dayMonth}`
                      : roster.rosterName ?? 'Published roster'}
                  </Text>
                </View>
                <Pressable
                  disabled={!roster.rosterId || exportRosterMutation.isPending}
                  style={[styles.exportButton, (!roster.rosterId || exportRosterMutation.isPending) && styles.exportButtonDisabled]}
                  onPress={() => exportRosterMutation.mutate(roster.rosterId)}>
                  {exportRosterMutation.isPending ? (
                    <ActivityIndicator size={14} color={Colors.light.primary} />
                  ) : (
                    <Icon source="tray-arrow-down" size={16} color={Colors.light.primary} />
                  )}
                  <Text style={styles.exportButtonText}>Export</Text>
                </Pressable>
              </View>

              <View style={styles.dayStripSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayStripContent}>
                  {pageCells.map((item) => {
                    const { weekday } = formatRosterDate(item.date);
                    const selected = pageSelectedCell.entryId === item.entryId;

                    return (
                      <Pressable
                        key={item.entryId}
                        onPress={() => setSelectedCellId(item.entryId)}
                        style={[styles.dayPill, selected && styles.dayPillSelected]}>
                        <Text style={[styles.dayPillWeekday, selected && styles.dayPillTextSelected]}>{weekday}</Text>
                        <Text style={[styles.dayPillDate, selected && styles.dayPillTextSelected]}>
                          {formatRosterDayNumber(item.date)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.staffRosterCard}>
                <View style={styles.staffRosterHeader}>
                  <View>
                    <Text style={styles.staffRosterTitle}>Staff on duty</Text>
                  </View>
                  {pageFilter === filter && calendarQuery.isLoading ? (
                    <ActivityIndicator size={16} color={Colors.light.primary} />
                  ) : (
                    pageFilter === filter &&
                    displayCoworkersList.length === 0 && (
                      <Pressable
                        style={styles.demoToggle}
                        onPress={() => setShowSimulatedCoworkers(!showSimulatedCoworkers)}>
                        <Text style={styles.demoToggleText}>
                          {showSimulatedCoworkers ? 'Live' : 'Preview'}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>

                {staffRows.map((person, index) => (
                  <View key={person.key}>
                    <View style={styles.staffRosterRow}>
                      <Avatar.Text
                        size={48}
                        label={person.initials}
                        style={styles.staffAvatar}
                        labelStyle={styles.staffAvatarText}
                      />
                      <View style={styles.staffRosterInfo}>
                        <Text style={styles.staffRosterName}>{person.name}</Text>
                        <Text style={styles.staffRosterAssignment}>{person.assignment}</Text>
                      </View>
                      <View style={styles.staffRosterAction}>
                        <AppStatusBadge label={person.status} tone={person.tone} />
                      </View>
                    </View>
                    {index < staffRows.length - 1 && <View style={styles.staffRowDivider} />}
                  </View>
                ))}
              </View>
            </>
          ) : null)}
      </ScrollView>
    );
  };

  return (
    <View
      style={[styles.safeArea]}
    >
      <StatusBar backgroundColor={Colors.light.primary} style="light" />

      <View style={styles.tabContainer}>
        <Pressable style={styles.tabButton} onPress={() => handleChangeFilter('current')}>
          <Text style={[styles.tabButtonText, filter === 'current' && styles.activeTabButtonText]}>
            Current Schedule
          </Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => handleChangeFilter('upcoming')}>
          <Text style={[styles.tabButtonText, filter === 'upcoming' && styles.activeTabButtonText]}>
            Upcoming Schedule
          </Text>
        </Pressable>
        <Animated.View style={[styles.indicatorBar, tabIndicatorStyle]} />
      </View>

      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageScroll={pageScrollHandler as unknown as React.ComponentProps<typeof AnimatedPagerView>['onPageScroll']}
        onPageSelected={(event) => {
          const nextPosition = event.nativeEvent.position;
          const nextFilter = nextPosition === 0 ? 'current' : 'upcoming';
          tabProgress.value = nextPosition;
          setFilter(nextFilter);
          setSelectedCellId(null);
        }}>
        <View key="current" style={styles.pageStyle}>
          {renderRosterPage(currentRosterQuery, currentPageRoster, currentPageCells, 'current')}
        </View>
        <View key="upcoming" style={styles.pageStyle}>
          {renderRosterPage(upcomingRosterQuery, upcomingPageRoster, upcomingPageCells, 'upcoming')}
        </View>
      </AnimatedPagerView>
      <AppSnackbar
        visible={exportToast.visible}
        message={exportToast.message}
        tone={exportToast.tone}
        position="top"
        onDismiss={() => setExportToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

function useRosterTabIndicatorStyle(progress: SharedValue<number>, indicatorWidth: number) {
  return useAnimatedStyle(() => ({
    width: indicatorWidth,
    transform: [{ translateX: progress.value * indicatorWidth }],
  }));
}

function useRosterPageScrollHandler(
  handlers: {
    onPageScroll: (event: PagerScrollEvent, context: Record<string, unknown>) => void;
  }
) {
  const { context, doDependenciesDiffer } = useHandler<PagerScrollEvent, Record<string, unknown>>(
    handlers,
    []
  );

  return useEvent<PagerScrollEvent, Record<string, unknown>>(
    (event) => {
      'worklet';

      if (event.eventName.endsWith('onPageScroll')) {
        handlers.onPageScroll(event, context);
      }
    },
    ['onPageScroll'],
    doDependenciesDiffer
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.appBgLight,
  },
  statusBarStrip: {
    backgroundColor: Colors.light.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 0,
    paddingTop: Spacing.one,
    paddingBottom: 0,
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  indicatorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: '#facc15',
    borderRadius: 2,
  },
  tabButtonText: {
    ...Typography.sm,
    color: 'rgba(255, 255, 255, 0.68)',
    fontWeight: '600',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  pagerView: {
    flex: 1,
  },
  pageStyle: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.base,
    color: Colors.light.textSecondary,
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  rosterPageContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.eight,
    gap: Spacing.four,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.eight,
    gap: Spacing.three,
  },
  loadingText: {
    ...Typography.base,
    color: Colors.light.textSecondary,
  },
  errorCard: {
    margin: Spacing.four,
    borderRadius: 16,
    backgroundColor: '#fff4f4',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  errorTitle: {
    ...Typography.md,
    color: Colors.light.danger,
    fontWeight: '600',
  },
  errorSubtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.danger,
    borderRadius: 8,
  },
  retryText: {
    ...Typography.sm,
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  rosterMetaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#e8f5f8',
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  rosterMetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  rosterNameText: {
    ...Typography.md,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  rosterDateRange: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginLeft: 30,
  },
  rosterBoardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  rosterMonthTitle: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  rosterCycleText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  exportButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.light.primary,
    paddingHorizontal: Spacing.three,
  },
  exportButtonDisabled: {
    opacity: 0.56,
  },
  exportButtonText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  dayStripSection: {
    gap: Spacing.two,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    gap: Spacing.two,
  },
  sectionTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '700',
  },
  sectionCaption: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  dayStripContent: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  dayPill: {
    width: 44,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#edf5f7',
    gap: 4,
  },
  dayPillSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  dayPillWeekday: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayPillDate: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  dayPillTextSelected: {
    color: '#ffffff',
  },
  staffRosterCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#edf5f7',
    overflow: 'hidden',
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  staffRosterHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  staffRosterTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '700',
  },
  staffRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  staffAvatar: {
    backgroundColor: '#eab308',
  },
  staffAvatarText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#ffffff',
    fontWeight: '700',
  },
  staffRosterInfo: {
    flex: 1,
    minWidth: 0,
  },
  staffRosterName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  staffRosterAssignment: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  staffRosterAction: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  staffRowDivider: {
    height: 1,
    backgroundColor: '#edf2f4',
    marginLeft: 66,
  },
  demoToggle: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(18, 132, 154, 0.1)',
  },
  demoToggleText: {
    ...Typography.xs,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
