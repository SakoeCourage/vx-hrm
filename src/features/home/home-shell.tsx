import { useQuery } from '@tanstack/react-query';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppBottomSheet, AppSnackbar, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import { StaffOnboardingChecklist } from '@/features/staff-onboarding/components';
import {
  getAttendanceStatus,
  getCurrentStaffRoster,
  getMyLeaveDashboard,
  getStaffAttendanceCalendar,
  getStaffNotifications,
  getUpcomingHolidays,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { AuthStaff, StaffSession } from '@/lib/auth/types';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';
import { useDeviceId } from '@/lib/hooks/use-device-id';
import {
  AttendanceActionLoading,
  CurrentRosterDetails,
  HolidayList,
  HomeInfoCard,
  LeaveDetails,
  QuickAction,
} from './components';
import {
  findRosterCellForDate,
  formatDateParam,
  formatDepartmentUnit,
  formatPunchTime,
  formatShiftTime,
  formatStaffName,
  getInitials,
  getPunchEvalLabel,
  getUpcomingHolidayRange,
  toSentenceCase,
} from './home-formatters';

type HomeShellProps = {
  staff: AuthStaff | StaffSession;
  onSignOut: () => void;
};

type SlideClockState = 'idle' | 'loading' | 'success';

function triggerSelectionHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

function triggerImpactHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

function triggerErrorHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}


export function HomeShell({ staff, onSignOut }: HomeShellProps) {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const scrollY = useSharedValue(0);
  const leaveSheetRef = useRef<BottomSheetModal>(null);
  const moreSheetRef = useRef<BottomSheetModal>(null);
  const [showHeaderAttendanceAction, setShowHeaderAttendanceAction] = useState(false);
  const [attendanceToast, setAttendanceToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'success' | 'danger';
  }>({
    visible: false,
    message: '',
    tone: 'success',
  });
  const [attendanceCardWidth, setAttendanceCardWidth] = useState(0);
  const [slideClockState, setSlideClockState] = useState<SlideClockState>('idle');
  const staffName = formatStaffName(staff);
  const initials = getInitials(staffName);
  const tenantName = toSentenceCase(staff.tenant?.name ?? 'VariableX HRM');
  const departmentUnit = formatDepartmentUnit(staff);
  const currentDate = useCurrentDate();
  const currentTime = useCurrentTime();
  const holidayRange = getUpcomingHolidayRange();
  const todayParam = formatDateParam(new Date());
  const leaveYear = new Date().getFullYear();
  const holidaysQuery = useQuery({
    queryKey: ['upcoming-holidays', session?.tenantId, holidayRange.fromDate, holidayRange.toDate],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getUpcomingHolidays({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          fromDate: holidayRange.fromDate,
          toDate: holidayRange.toDate,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });
  const currentRosterQuery = useQuery({
    queryKey: ['current-staff-roster', session?.tenantId, staff.staffIdentificationNumber, todayParam],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getCurrentStaffRoster({
          staffIdentificationNumber: staff.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && staff.staffIdentificationNumber),
  });
  const currentRoster = currentRosterQuery.data?.[0];
  const rosterCalendarQuery = useQuery({
    queryKey: [
      'staff-attendance-calendar',
      session?.tenantId,
      staff.staffIdentificationNumber,
      currentRoster?.startDate,
      currentRoster?.endDate,
    ],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffAttendanceCalendar({
          staffIdentificationNumber: staff.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          fromDate: currentRoster?.startDate ?? todayParam,
          toDate: currentRoster?.endDate ?? todayParam,
        })
      ),
    enabled: Boolean(
      session?.accessToken &&
        session?.tenantId &&
        staff.staffIdentificationNumber &&
        currentRoster?.startDate &&
        currentRoster?.endDate
    ),
  });



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

  // --- Attendance status (drives card state) ---
  const deviceId = useDeviceId();
  const attendanceStatusKey = ['attendance-status', session?.tenantId, staff.staffIdentificationNumber];
  const notificationsKey = ['staff-notifications', session?.tenantId];

  const attendanceStatusQuery = useQuery({
    queryKey: attendanceStatusKey,
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getAttendanceStatus({
          staffIdentificationNumber: staff.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId && staff.staffIdentificationNumber),
    staleTime: 30_000, // treat as fresh for 30s to avoid hammering on every render
  });
  const unreadNotificationsQuery = useQuery({
    queryKey: [...notificationsKey, 'UNREAD'],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffNotifications({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          pageNumber: 1,
          pageSize: 1,
          filter: 'UNREAD',
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
    staleTime: 30_000,
  });

  const attendanceStatus = attendanceStatusQuery.data;
  const todayRosterCell = findRosterCellForDate(currentRosterQuery.data ?? [], todayParam);
  const todayCalendarDay = rosterCalendarQuery.data?.days.find((day) => day.date === todayParam);
  const hasMissingPrerequisites = Object.values(staff.newStaffPrerequisiteCheck ?? {}).some((value) => !value);
  const lastCheckIn = attendanceStatus?.todaysPunches?.filter((p) => p.status === 'CHECKIN').at(-1);
  const lastCheckOut = attendanceStatus?.todaysPunches?.filter((p) => p.status === 'CHECKOUT').at(-1);
  const clockInTime = attendanceStatus?.checkedInAt
    ? formatPunchTime(attendanceStatus.checkedInAt)
    : lastCheckIn
      ? formatPunchTime(lastCheckIn.timestamp)
      : '--:--';
  const clockOutTime = attendanceStatus?.lastCheckOutAt
    ? formatPunchTime(attendanceStatus.lastCheckOutAt)
    : lastCheckOut
      ? formatPunchTime(lastCheckOut.timestamp)
      : '--:--';
  const isClockedIn = attendanceStatus?.currentStatus === 'CHECKIN';
  const showInitialLoading = attendanceStatusQuery.isLoading && !attendanceStatus;
  const hasNoAttendanceStatusYet = !showInitialLoading && !attendanceStatus;
  const hasNeverClocked = attendanceStatus?.currentStatus === 'NEVER';
  const canClockIn =
    hasNoAttendanceStatusYet ||
    hasNeverClocked ||
    (!isClockedIn && attendanceStatus?.nextAction === 'CHECKIN');
  const unreadCount = unreadNotificationsQuery.data?.totalRecords ?? 0;
  const headerAttendanceAction =
    showHeaderAttendanceAction && !showInitialLoading && (isClockedIn || canClockIn);
  const activeClockAction = isClockedIn ? 'checkout' : canClockIn ? 'checkin' : null;
  const slideThumbSize = 54;
  const slideActionMaxTranslate = Math.max(attendanceCardWidth - slideThumbSize - Spacing.two, 0);
  const slideTranslateX = useSharedValue(0);
  const slideHintProgress = useSharedValue(0);
  const slideIsHeld = useSharedValue(0);

  const resetSlideClock = () => {
    slideIsHeld.value = 0;
    slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    setSlideClockState('idle');
  };

  const openLeaveSheet = () => {
    leaveSheetRef.current?.present();
  };

  const openAnnualLeave = () => {
    leaveSheetRef.current?.dismiss();
    router.push('/leave/annual');
  };

  const openMoreSheet = () => {
    moreSheetRef.current?.present();
  };

  const prepareAttendanceScan = async () => {
    if (!deviceId) {
      triggerErrorHaptic();
      resetSlideClock();
      setAttendanceToast({
        visible: true,
        message: 'This device is not ready for attendance verification. Please try again.',
        tone: 'danger',
      });
      return;
    }

    router.push('/scan');
    setTimeout(() => {
      slideIsHeld.value = 0;
      slideTranslateX.value = withTiming(0, { duration: 180 });
      setSlideClockState('idle');
    }, 240);
  };

  useEffect(() => {
    if (slideClockState !== 'idle') {
      return;
    }

    slideTranslateX.value = withTiming(0, { duration: 180 });
  }, [activeClockAction, slideClockState, slideTranslateX]);

  useEffect(() => {
    if (!activeClockAction || slideClockState !== 'idle') {
      slideHintProgress.value = 0;
      return;
    }

    slideHintProgress.value = withRepeat(
      withDelay(3200, withTiming(1, { duration: 950 })),
      -1,
      false
    );
  }, [activeClockAction, slideClockState, slideHintProgress]);

  const handleAttendanceCardLayout = (event: LayoutChangeEvent) => {
    setAttendanceCardWidth(event.nativeEvent.layout.width - Spacing.three * 2);
  };

  const slideActionGesture = Gesture.Pan()
    .enabled(Boolean(activeClockAction && slideClockState === 'idle' && deviceId && slideActionMaxTranslate > 0))
    .onBegin(() => {
      slideIsHeld.value = 1;
      runOnJS(triggerSelectionHaptic)();
    })
    .onUpdate((event) => {
      slideTranslateX.value = Math.min(Math.max(event.translationX, 0), slideActionMaxTranslate);
    })
    .onEnd(() => {
      if (slideTranslateX.value > slideActionMaxTranslate * 0.72) {
        slideTranslateX.value = withTiming(slideActionMaxTranslate, { duration: 120 }, (finished) => {
          if (finished) {
            runOnJS(setSlideClockState)('loading');
            runOnJS(triggerImpactHaptic)();
            runOnJS(prepareAttendanceScan)();
          }
        });
        return;
      }

      slideTranslateX.value = withSpring(0, { damping: 18, stiffness: 180 }, (finished) => {
        if (finished) {
          slideIsHeld.value = 0;
        }
      });
    })
    .onFinalize(() => {
      if (slideTranslateX.value <= 1) {
        slideIsHeld.value = 0;
      }
    });

  const slideTrackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      slideTranslateX.value,
      [0, slideActionMaxTranslate || 1],
      activeClockAction === 'checkout'
        ? [Colors.light.dangerMuted, Colors.light.danger]
        : [Colors.light.successMuted, Colors.light.success]
    ),
  }));

  const slideFillAnimatedStyle = useAnimatedStyle(() => ({
    width: slideTranslateX.value + slideThumbSize,
    backgroundColor: interpolateColor(
      slideTranslateX.value,
      [0, slideActionMaxTranslate || 1],
      activeClockAction === 'checkout'
        ? [Colors.light.dangerMuted, Colors.light.danger]
        : [Colors.light.successMuted, Colors.light.success]
    ),
    opacity: interpolate(slideTranslateX.value, [0, slideActionMaxTranslate || 1], [0.75, 1], Extrapolation.CLAMP),
  }));

  const slideThumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideTranslateX.value }],
  }));

  const slideLabelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideTranslateX.value, [0, slideActionMaxTranslate * 0.55 || 1], [1, 0.28], Extrapolation.CLAMP),
  }));

  const slideSheenAnimatedStyle = useAnimatedStyle(() => {
    const isAwayFromReset = slideTranslateX.value > 1;
    const shouldHideSheen = slideIsHeld.value > 0 || isAwayFromReset;
    const sheenStartX = Math.min(slideTranslateX.value, slideActionMaxTranslate || 0);

    return {
      opacity: shouldHideSheen
        ? 0
        : interpolate(slideHintProgress.value, [0, 0.72, 1], [0.8, 0.2, 0.04], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            slideHintProgress.value,
            [0, 1],
            [sheenStartX, slideActionMaxTranslate || sheenStartX || 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useAnimatedReaction(
    () => scrollY.value > 124,
    (isPastAttendanceCard, wasPastAttendanceCard) => {
      if (isPastAttendanceCard !== wasPastAttendanceCard) {
        runOnJS(setShowHeaderAttendanceAction)(isPastAttendanceCard);
      }
    }
  );

  const appBarAnimatedStyle = useAnimatedStyle(() => ({
    minHeight: interpolate(scrollY.value, [0, 96], [104, 72], Extrapolation.CLAMP),
    paddingTop: interpolate(scrollY.value, [0, 96], [12, 6], Extrapolation.CLAMP),
    paddingBottom: interpolate(scrollY.value, [0, 96], [16, 8], Extrapolation.CLAMP),
  }));

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    const size = interpolate(scrollY.value, [0, 96], [52, 38], Extrapolation.CLAMP);

    return {
      width: size,
      height: size,
      borderRadius: size / 2,
    };
  });

  const metaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 64], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, 96], [20, 0], Extrapolation.CLAMP),
    marginTop: interpolate(scrollY.value, [0, 96], [0, -2], Extrapolation.CLAMP),
  }));

  const tenantAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 64], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, 96], [16, 0], Extrapolation.CLAMP),
  }));

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      bounces={false}
      contentStyle={styles.content}
      header={
        <Animated.View style={[styles.homeAppBar, appBarAnimatedStyle]}>
          <Animated.View style={[styles.avatar, avatarAnimatedStyle]}>
            {staff.passportPicture ? (
              <Image source={{ uri: staff.passportPicture }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </Animated.View>

          <View style={styles.heroIdentity}>
            <Animated.View style={tenantAnimatedStyle}>
              <Text style={styles.heroEyebrow}>{tenantName}</Text>
            </Animated.View>
            <Text style={styles.heroName}>{staffName}</Text>
            <Animated.View style={metaAnimatedStyle}>
              <Text style={styles.heroMeta}>{departmentUnit}</Text>
            </Animated.View>
          </View>
          <Pressable
            disabled={headerAttendanceAction && (slideClockState === 'loading' || !deviceId)}
            style={[
              styles.notificationButton,
            ]}
            onPress={headerAttendanceAction ? prepareAttendanceScan : () => router.push('/notifications')}>
            {headerAttendanceAction && slideClockState === 'loading' ? (
              <ActivityIndicator
                size={18}
                color={isClockedIn ? Colors.light.danger : Colors.light.success}
              />
            ) : (
              <Icon
                source={headerAttendanceAction ? (isClockedIn ? 'timer-off-outline' : 'timer-plus-outline') : 'bell-outline'}
                size={20}
                color={
                  headerAttendanceAction
                    ? isClockedIn
                      ? Colors.light.danger
                      : Colors.light.success
                    : Colors.light.primary
                }
              />
            )}
            {!headerAttendanceAction && unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      }
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <View style={styles.hero}>
        <View style={styles.attendanceCard} onLayout={handleAttendanceCardLayout}>
          {showInitialLoading ? (
            <AttendanceCardSkeleton />
          ) : (
            <>
              <View style={styles.cardHeading}>
                <View style={styles.todayMetaRow}>
                  <Text style={styles.cardLabel}>Today</Text>
                  <View style={styles.todayDot} />
                  <Text style={styles.cardDate}>{currentDate}</Text>
                </View>
                {attendanceStatus?.todaysShift?.shiftName && (
                  <Text style={styles.cardShift}>
                    {toSentenceCase(attendanceStatus.todaysShift.shiftName)}
                    {attendanceStatus.todaysShift.expectedStart && attendanceStatus.todaysShift.expectedEnd
                      ? `  ·  ${formatShiftTime(attendanceStatus.todaysShift.expectedStart)} – ${formatShiftTime(attendanceStatus.todaysShift.expectedEnd)}`
                      : ''}
                  </Text>
                )}
              </View>

              <View style={styles.attendanceDivider} />

              <View style={styles.timeGrid}>
                <View style={styles.timeTile}>
                  <Text style={styles.timeLabel}>
                    {clockInTime === '--:--' ? 'Clock in' : 'Last clocked in'}
                  </Text>
                  <Text style={styles.timeValue}>{clockInTime}</Text>
                  <Text style={clockInTime === '--:--' ? styles.timePending : styles.timeSuccess}>
                    {clockInTime === '--:--' ? 'Not yet' : getPunchEvalLabel(lastCheckIn?.evaluation) || 'On time'}
                  </Text>
                </View>

                <View style={[styles.timeTile, attendanceStatus?.hasMissedCheckout && styles.timeTileDanger]}>
                  <Text style={[styles.timeLabel, attendanceStatus?.hasMissedCheckout && styles.timeLabelDanger]}>
                    {attendanceStatus?.hasMissedCheckout
                      ? 'Missed clock out'
                      : clockOutTime === '--:--'
                        ? 'Clock out'
                        : 'Last clocked out'}
                  </Text>
                  {attendanceStatus?.hasMissedCheckout ? (
                    <View style={styles.missedClockOutValue}>
                      <Icon source="alert-circle-outline" size={18} color="#ffffff" />
                      <Text style={[styles.timeValue, styles.timeValueDanger]}>Missed</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.timeValue}>{clockOutTime}</Text>
                      <Text style={clockOutTime === '--:--' ? styles.timePending : styles.timeSuccess}>
                        {clockOutTime === '--:--' ? 'Not yet' : attendanceStatus?.todaysTotalWorkedTime || 'Done'}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {activeClockAction && (
                <GestureDetector gesture={slideActionGesture}>
                  <Animated.View
                    entering={FadeIn.duration(180)}
                    exiting={FadeOut.duration(140)}
                    style={[styles.slideClockTrack, slideTrackAnimatedStyle]}>
                    <Animated.View style={[styles.slideClockFill, slideFillAnimatedStyle]} />
                    <Animated.View
                      style={[
                        styles.slideClockSheen,
                        activeClockAction === 'checkout' ? styles.slideClockSheenDanger : styles.slideClockSheenSuccess,
                        slideSheenAnimatedStyle,
                      ]}
                    />
                    <Animated.View style={[styles.slideClockLabelWrap, slideLabelAnimatedStyle]}>
                      {slideClockState === 'loading' ? (
                        <AttendanceActionLoading
                          label={activeClockAction === 'checkout' ? 'Clocking out' : 'Clocking in'}
                        />
                      ) : slideClockState === 'success' ? (
                        <Text style={styles.slideClockLabel}>Done</Text>
                      ) : (
                        <>
                          <Text style={styles.slideClockLabel}>
                            {activeClockAction === 'checkout' ? 'Slide to clock out' : 'Slide to clock in'}
                          </Text>
                          <Text style={styles.slideClockTime}>{currentTime}</Text>
                        </>
                      )}
                    </Animated.View>
                    <Animated.View
                      style={[
                        styles.slideClockThumb,
                        activeClockAction === 'checkout' ? styles.slideClockThumbDanger : styles.slideClockThumbSuccess,
                        slideThumbAnimatedStyle,
                      ]}>
                      {slideClockState === 'loading' ? (
                        <ActivityIndicator size={22} color="#ffffff" />
                      ) : slideClockState === 'success' ? (
                        <Icon source="check" size={28} color="#ffffff" />
                      ) : (
                        <Icon source="chevron-right" size={30} color="#ffffff" />
                      )}
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.quickGrid}>
        <QuickAction icon="clock-outline" label="Attendance" tone="primary" onPress={() => router.push('/attendance')} />
        <QuickAction icon="timer-sand" label="Roster" tone="info" onPress={() => router.push('/roster')} />
        <QuickAction icon="file-document-edit-outline" label="Leave" tone="warning" onPress={openLeaveSheet} />
        <QuickAction icon="dots-horizontal-circle-outline" label="More" tone="success" onPress={openMoreSheet} />
      </View>

      <View style={styles.homeSections}>
        <HomeInfoCard title="Roster Schedule" actionMode="arrow" onPress={() => router.push('/roster')}>
          <CurrentRosterDetails
            cell={todayRosterCell}
            isLoading={currentRosterQuery.isLoading}
            isError={currentRosterQuery.isError}
            calendarDay={todayCalendarDay}
            isCoworkersLoading={rosterCalendarQuery.isLoading}
          />
        </HomeInfoCard>

        <HomeInfoCard title="Upcoming holidays" onPress={() => router.push('/holidays')}>
          <HolidayList
            holidays={holidaysQuery.data ?? []}
            isLoading={holidaysQuery.isLoading}
            isError={holidaysQuery.isError}
          />
        </HomeInfoCard>

        <HomeInfoCard title="Leave details" onPress={() => router.push('/leave/annual')}>
          <LeaveDetails
            dashboard={leaveDashboardQuery.data}
            isLoading={leaveDashboardQuery.isLoading}
            isError={leaveDashboardQuery.isError}
          />
        </HomeInfoCard>
      </View>

      {hasMissingPrerequisites && (
        <View style={styles.onboardingCard}>
          <StaffOnboardingChecklist checklist={staff.newStaffPrerequisiteCheck} />
        </View>
      )}

      <AppSnackbar
        visible={attendanceToast.visible}
        message={attendanceToast.message}
        tone={attendanceToast.tone}
        position="top"
        onDismiss={() => setAttendanceToast((current) => ({ ...current, visible: false }))}
      />
      <AppBottomSheet
        ref={leaveSheetRef}
        snapPoints={['38%']}
        title="Leave request"
        subtitle="Choose the leave workflow you want to start.">
        <Pressable style={styles.leaveSheetOption} onPress={openAnnualLeave}>
          <View style={styles.leaveSheetIcon}>
            <Icon source="calendar-check-outline" size={22} color={Colors.light.primary} />
          </View>
          <View style={styles.leaveSheetText}>
            <Text style={styles.leaveSheetTitle}>Annual leave</Text>
            <Text style={styles.leaveSheetDescription}>Plan your annual leave periods, then submit a request after approval.</Text>
          </View>
          <Icon source="chevron-right" size={20} color={Colors.light.textSecondary} />
        </Pressable>
        <View style={[styles.leaveSheetOption, styles.leaveSheetOptionDisabled]}>
          <View style={[styles.leaveSheetIcon, styles.leaveSheetIconMuted]}>
            <Icon source="calendar-plus-outline" size={22} color={Colors.light.textSecondary} />
          </View>
          <View style={styles.leaveSheetText}>
            <Text style={styles.leaveSheetTitle}>Other leave types</Text>
            <Text style={styles.leaveSheetDescription}>Sick, casual, maternity, study and tenant-configured leave flows will be added next.</Text>
          </View>
        </View>
      </AppBottomSheet>
      <AppBottomSheet
        ref={moreSheetRef}
        snapPoints={['34%']}
        title="More requests"
        subtitle="These request workflows will be available later.">
        <View style={[styles.leaveSheetOption, styles.leaveSheetOptionDisabled]}>
          <View style={[styles.leaveSheetIcon, styles.leaveSheetIconMuted]}>
            <Icon source="account-clock-outline" size={22} color={Colors.light.textSecondary} />
          </View>
          <View style={styles.leaveSheetText}>
            <Text style={styles.leaveSheetTitle}>Excuse duty</Text>
            <Text style={styles.leaveSheetDescription}>Request official permission to be away from duty for a period.</Text>
          </View>
        </View>
        <View style={[styles.leaveSheetOption, styles.leaveSheetOptionDisabled]}>
          <View style={[styles.leaveSheetIcon, styles.leaveSheetIconMuted]}>
            <Icon source="calendar-arrow-right" size={22} color={Colors.light.textSecondary} />
          </View>
          <View style={styles.leaveSheetText}>
            <Text style={styles.leaveSheetTitle}>Deferment</Text>
            <Text style={styles.leaveSheetDescription}>Defer approved leave days for future use when the workflow is enabled.</Text>
          </View>
        </View>
      </AppBottomSheet>
    </Screen>
  );
}

function AttendanceCardSkeleton() {
  return (
    <>
      <View style={styles.skeletonHeading}>
        <View style={styles.skeletonMetaRow}>
          <SkeletonBlock style={styles.skeletonTodayLine} />
          <View style={styles.todayDot} />
          <SkeletonBlock style={styles.skeletonDateLine} />
        </View>
        <SkeletonBlock style={styles.skeletonShiftLine} />
      </View>

      <View style={styles.attendanceDivider} />

      <View style={styles.timeGrid}>
        <AttendanceTimeTileSkeleton />
        <AttendanceTimeTileSkeleton />
      </View>

      <View style={[styles.slideClockTrack, styles.slideClockSkeletonTrack]}>
        <SkeletonBlock style={styles.slideClockSkeletonThumb} />
        <View style={styles.slideClockSkeletonText}>
          <SkeletonBlock style={styles.slideClockSkeletonLabel} />
          <SkeletonBlock style={styles.slideClockSkeletonTime} />
        </View>
      </View>
    </>
  );
}

function AttendanceTimeTileSkeleton() {
  return (
    <View style={[styles.timeTile, styles.timeTileSkeleton]}>
      <SkeletonBlock style={styles.skeletonTimeLabel} />
      <SkeletonBlock style={styles.skeletonTimeValue} />
      <SkeletonBlock style={styles.skeletonTimeStatus} />
    </View>
  );
}

function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1250 }), -1, false);
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-110, 180], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View style={[styles.skeletonBlock, style]}>
      <Animated.View style={[styles.skeletonShimmer, shimmerStyle]} />
    </View>
  );
}

function useCurrentDate() {
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function useCurrentTime() {
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  content: {
    padding: 0,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  homeAppBar: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    ...Typography.base,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  heroIdentity: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    ...Typography.xs,
    color: 'rgba(255, 255, 255, 0.76)',
  },
  heroName: {
    ...Typography.lg,
    color: '#ffffff',
    fontWeight: '600',
  },
  heroMeta: {
    ...Typography.sm,
    color: 'rgba(255, 255, 255, 0.78)',
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.danger,
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  attendanceCard: {
    gap: Spacing.two,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  cardLabel: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  cardHeading: {
    paddingHorizontal: Spacing.one,
  },
  todayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.textSecondary,
    opacity: 0.7,
  },
  cardDate: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  cardTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
  attendanceDivider: {
    height: 1,
    backgroundColor: '#e8f1f3',
    marginHorizontal: Spacing.one,
  },
  timeGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
    position: 'relative',
  },
  timeTile: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#f7fcfd',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 86,
  },
  timeTileDanger: {
    backgroundColor: Colors.light.danger,
  },
  timeLabel: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  timeLabelDanger: {
    color: 'rgba(255, 255, 255, 0.78)',
  },
  timeValue: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  timeValueDanger: {
    color: '#ffffff',
  },
  missedClockOutValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  timeSuccess: {
    ...Typography.xs,
    color: Colors.light.success,
  },
  timePending: {
    ...Typography.xs,
    color: Colors.light.danger,
  },
  slideClockTrack: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#edf5f7',
    justifyContent: 'center',
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  slideClockFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 32,
  },
  slideClockSheen: {
    position: 'absolute',
    left: Spacing.one,
    top: Spacing.one,
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  slideClockSheenSuccess: {
    backgroundColor: Colors.light.success,
  },
  slideClockSheenDanger: {
    backgroundColor: Colors.light.danger,
  },
  slideClockLabelWrap: {
    position: 'absolute',
    left: 18,
    right: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideClockLabel: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  slideClockTime: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  slideClockThumb: {
    position: 'absolute',
    left: Spacing.one,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  slideClockThumbSuccess: {
    backgroundColor: Colors.light.success,
  },
  slideClockThumbDanger: {
    backgroundColor: Colors.light.danger,
  },
  cardShift: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  skeletonHeading: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  skeletonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  skeletonBlock: {
    overflow: 'hidden',
    backgroundColor: '#eaf4f7',
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 78,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
  skeletonTodayLine: {
    width: 42,
    height: 12,
    borderRadius: 6,
  },
  skeletonDateLine: {
    width: 156,
    height: 12,
    borderRadius: 6,
  },
  skeletonShiftLine: {
    width: '68%',
    height: 12,
    borderRadius: 6,
  },
  timeTileSkeleton: {
    justifyContent: 'center',
    gap: Spacing.two,
  },
  skeletonTimeLabel: {
    width: '58%',
    height: 12,
    borderRadius: 6,
  },
  skeletonTimeValue: {
    width: '74%',
    height: 20,
    borderRadius: 10,
  },
  skeletonTimeStatus: {
    width: '46%',
    height: 12,
    borderRadius: 6,
  },
  slideClockSkeletonTrack: {
    backgroundColor: '#f7fcfd',
    borderColor: '#edf5f7',
  },
  slideClockSkeletonThumb: {
    position: 'absolute',
    left: Spacing.one,
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  slideClockSkeletonText: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 7,
  },
  slideClockSkeletonLabel: {
    width: 128,
    height: 12,
    borderRadius: 6,
  },
  slideClockSkeletonTime: {
    width: 82,
    height: 20,
    borderRadius: 10,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  leaveSheetOption: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 18,
    backgroundColor: Colors.light.appBgLight,
    padding: Spacing.three,
  },
  leaveSheetOptionDisabled: {
    opacity: 0.72,
  },
  leaveSheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  leaveSheetIconMuted: {
    backgroundColor: Colors.light.secondaryMuted,
  },
  leaveSheetText: {
    flex: 1,
    minWidth: 0,
  },
  leaveSheetTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  leaveSheetDescription: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  onboardingCard: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  homeSections: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
});
