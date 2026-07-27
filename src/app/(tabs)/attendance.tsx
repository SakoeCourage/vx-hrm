import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMutation, useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
  ScrollView,
} from 'react-native';
import { ActivityIndicator, Card, Icon, Text } from 'react-native-paper';
import { Calendar, DateData } from 'react-native-calendars';
import PagerView from 'react-native-pager-view';
import * as Sharing from 'expo-sharing';

import { AppBottomSheet, AppButton, AppSnackbar, AppStatusBadge, FormDateField, FormSelect } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  AttendanceCalendarDay,
  AttendanceReportType,
  downloadStaffAttendancePdf,
  getAttendanceRecords,
  getStaffAttendanceCalendar,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

type MonthCursor = { year: number; month: number }; // month is 0-indexed
type CalendarDayPressPayload = Pick<DateData, 'dateString' | 'day' | 'month' | 'year' | 'timestamp'>;
type ExportReportForm = {
  fromDate: string;
  toDate: string;
  reportType: AttendanceReportType;
};

function getCalendarDayMark(day: AttendanceCalendarDay) {
  if (day.attendanceStatus === 'PRESENT') {
    return {
      backgroundColor: day.isLate ? Colors.light.warningMuted : Colors.light.successMuted,
      borderColor: day.isLate ? Colors.light.warning : Colors.light.success,
      borderWidth: 1,
      dotColor: day.isLate ? Colors.light.warning : Colors.light.success,
    };
  }

  if (day.attendanceStatus === 'ABSENT') {
    return {
      backgroundColor: Colors.light.dangerMuted,
      borderColor: Colors.light.danger,
      borderWidth: 1,
      dotColor: Colors.light.danger,
    };
  }

  return {
    backgroundColor: '#ffffff',
    borderColor: '#edf3f5',
    borderWidth: 0,
    dotColor: undefined,
  };
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDefaultReportRange(): ExportReportForm {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    fromDate: formatDateParam(firstDayOfMonth),
    toDate: formatDateParam(today),
    reportType: 'individual',
  };
}

function CalendarDayBubble({
  date,
  day,
  disabled,
  isLoading,
  selected,
  onPress,
}: {
  date: CalendarDayPressPayload;
  day?: AttendanceCalendarDay;
  disabled: boolean;
  isLoading: boolean;
  selected: boolean;
  onPress: (day: DateData) => void;
}) {
  const mark = day ? getCalendarDayMark(day) : undefined;
  const dotColor = mark?.dotColor;
  const isToday = new Date().toISOString().split('T')[0] === date.dateString;

  return (
    <Pressable
      disabled={disabled || isLoading}
      onPress={() => onPress(date as DateData)}
      style={[
        styles.calendarDayBubble,
        disabled && styles.calendarDayBubbleDisabled,
        isLoading && !disabled && styles.calendarDayBubbleLoading,
        isToday && !selected && styles.calendarDayBubbleToday,
        !isLoading && mark && {
          backgroundColor: mark.backgroundColor,
          borderColor: mark.borderColor,
          borderWidth: mark.borderWidth,
        },
        !isLoading && selected && styles.calendarDayBubbleSelected,
      ]}>
      <Text
        style={[
          styles.calendarDayBubbleText,
          disabled && styles.calendarDayBubbleTextDisabled,
          isLoading && !disabled && styles.calendarDayBubbleTextLoading,
          !isLoading && selected && styles.calendarDayBubbleTextSelected,
        ]}>
        {date.day}
      </Text>
      <View
        style={[
          styles.calendarDayDot,
          isLoading && !disabled
            ? styles.calendarDayDotLoading
            : dotColor
              ? { backgroundColor: dotColor }
              : styles.calendarDayDotEmpty,
          !isLoading && selected && dotColor ? styles.calendarDayDotSelected : null,
        ]}
      />
    </Pressable>
  );
}

function CalendarLegendItem({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.calendarLegendItem}>
      <View style={[styles.calendarLegendDot, { backgroundColor: color }]} />
      <Text style={styles.calendarLegendText}>{label}</Text>
    </View>
  );
}

export default function AttendanceTab() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0); // 0: Calendar, 1: Punches
  const [reportToast, setReportToast] = useState<{
    visible: boolean;
    message: string;
    tone: 'success' | 'danger';
  }>({ visible: false, message: '', tone: 'success' });
  const pagerRef = useRef<PagerView>(null);
  const dayDetailSheetRef = useRef<BottomSheetModal>(null);
  const monthPickerSheetRef = useRef<BottomSheetModal>(null);
  const reportSheetRef = useRef<BottomSheetModal>(null);
  const exportForm = useForm<ExportReportForm>({
    defaultValues: getDefaultReportRange(),
  });

  // Animated value tracking continuous scroll offset from PagerView (position + fractional offset)
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();
  const TAB_COUNT = 2;
  const indicatorWidth = screenWidth / TAB_COUNT;

  // Initialize month cursor to current month
  const [monthCursor, setMonthCursor] = useState<MonthCursor>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const staffId = session?.staffIdentificationNumber ?? '';
  const tenantId = session?.tenantId ?? '';
  const accessToken = session?.accessToken ?? '';

  // --- 1. Query: Monthly Calendar Data ---
  const dateRange = useMemo(() => {
    const firstDay = new Date(monthCursor.year, monthCursor.month, 1);
    const lastDay = new Date(monthCursor.year, monthCursor.month + 1, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      fromDate: `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`,
      toDate: `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`,
    };
  }, [monthCursor]);

  const calendarQuery = useQuery({
    queryKey: ['attendance-calendar', tenantId, staffId, dateRange.fromDate, dateRange.toDate],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffAttendanceCalendar({
          staffIdentificationNumber: activeSession.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        })
      ),
    enabled: Boolean(accessToken && tenantId && staffId),
  });

  // --- 2. Query: Punch Records ---
  const recordsQuery = useQuery({
    queryKey: ['attendance-records', tenantId, staffId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getAttendanceRecords({
          staffIdentificationNumber: activeSession.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          pageNumber: 1,
          pageSize: 15,
        })
      ),
    enabled: Boolean(accessToken && tenantId && staffId),
  });

  const exportReportMutation = useMutation({
    mutationFn: async (values: ExportReportForm) => {
      if (!accessToken || !tenantId || !staffId) {
        throw new Error('Your session is not ready. Please try again.');
      }

      const fileUri = await authenticatedRequest((activeSession) =>
        downloadStaffAttendancePdf({
          staffIdentificationNumber: activeSession.staffIdentificationNumber,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          fromDate: values.fromDate,
          toDate: values.toDate,
          type: values.reportType,
        })
      );

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Attendance report',
        UTI: 'com.adobe.pdf',
      });
    },
    onSuccess: () => {
      reportSheetRef.current?.dismiss();
      setReportToast({
        visible: true,
        message: 'Attendance report generated.',
        tone: 'success',
      });
    },
    onError: (error) => {
      setReportToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Could not generate attendance report.',
        tone: 'danger',
      });
    },
  });

  const handleRefresh = useCallback(() => {
    calendarQuery.refetch();
    recordsQuery.refetch();
  }, [calendarQuery, recordsQuery]);

  const handleDismissDayDetail = useCallback(() => {
    setSelectedDate(null);
  }, []);

  // --- Calculations for Stat Cards ---
  const stats = useMemo(() => {
    const days = calendarQuery.data?.days ?? [];
    let present = 0;
    let late = 0;
    let absent = 0;

    days.forEach((day) => {
      if (day.attendanceStatus === 'PRESENT') {
        present++;
        if (day.isLate) {
          late++;
        }
      } else if (day.attendanceStatus === 'ABSENT') {
        absent++;
      }
    });

    return { present, late, absent, total: days.length };
  }, [calendarQuery.data]);

  // --- Calendar Date List ---
  const calendarDays = useMemo(() => {
    const days = calendarQuery.data?.days ?? [];
    return [...days].sort((a, b) => a.date.localeCompare(b.date));
  }, [calendarQuery.data]);
  const calendarDayMap = useMemo(
    () => Object.fromEntries(calendarDays.map((day) => [day.date, day])),
    [calendarDays]
  );

  // Selected calendar day detail card
  const selectedDayDetail = useMemo(() => {
    if (!selectedDate) return null;
    return calendarDayMap[selectedDate] ?? ({ date: selectedDate } as AttendanceCalendarDay);
  }, [calendarDayMap, selectedDate]);
  const markedDates = useMemo(() => {
    const dates = calendarDays.reduce<Record<string, any>>((acc, day) => {
      const isSelected = selectedDate === day.date;
      const markStyle = getCalendarDayMark(day);

      acc[day.date] = {
        selected: isSelected,
        selectedColor: Colors.light.primary,
        selectedTextColor: '#ffffff',
        marked: Boolean(markStyle.dotColor),
        dotColor: markStyle.dotColor,
        customStyles: {
          container: {
            backgroundColor: isSelected ? Colors.light.primary : markStyle.backgroundColor,
            borderColor: markStyle.borderColor,
            borderWidth: markStyle.borderWidth,
            borderRadius: 12,
          },
          text: {
            color: isSelected ? '#ffffff' : Colors.light.text,
            fontWeight: isSelected ? '700' : '500',
          },
        },
      };

      return acc;
    }, {});

    if (selectedDate && !dates[selectedDate]) {
      dates[selectedDate] = { selected: true };
    }

    return dates;
  }, [calendarDays, selectedDate]);

  // Format Helper Functions
  function formatShortDate(isoString: string) {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
  }

  function formatPunchTime(isoString?: string) {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const statCards = [
    {
      title: 'Days Present',
      value: calendarQuery.isLoading ? '...' : String(stats.present),
      helper: 'Recorded attendance',
      tone: Colors.light.success,
    },
    {
      title: 'Days Late',
      value: calendarQuery.isLoading ? '...' : String(stats.late),
      helper: 'Needs attention',
      tone: Colors.light.warning,
    },
    {
      title: 'Days Absent',
      value: calendarQuery.isLoading ? '...' : String(stats.absent),
      helper: 'Missed attendance',
      tone: Colors.light.danger,
    },
    {
      title: 'Total Entries',
      value: calendarQuery.isLoading ? '...' : String(stats.total),
      helper: 'This month',
      tone: Colors.light.primary,
    },
  ];

  const currentMonth = new Date();
  const isViewingCurrentMonth =
    monthCursor.year === currentMonth.getFullYear() && monthCursor.month === currentMonth.getMonth();
  const monthLabel = new Date(monthCursor.year, monthCursor.month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const calendarHeader = (
    <View style={styles.calendarControlRow}>
      <Text style={styles.calendarMonthTitle}>{monthLabel}</Text>
      <Pressable
        style={styles.monthPickerButton}
        onPress={() => monthPickerSheetRef.current?.present()}>
        <Text style={styles.monthPickerText}>{isViewingCurrentMonth ? 'This Month' : monthLabel}</Text>
        <Icon source="chevron-down" size={18} color={Colors.light.textSecondary} />
      </Pressable>
    </View>
  );

  const handleCalendarDayPress = (day: DateData) => {
    if (selectedDate === day.dateString) {
      dayDetailSheetRef.current?.dismiss();
      return;
    }

    setSelectedDate(day.dateString);
    dayDetailSheetRef.current?.present();
  };

  const handleCalendarMonthChange = (month: DateData) => {
    setMonthCursor({ year: month.year, month: month.month - 1 });
    setSelectedDate(null);
  };

  const handleSelectMonth = (month: number) => {
    setMonthCursor((current) => ({ ...current, month }));
    setSelectedDate(null);
    monthPickerSheetRef.current?.dismiss();
  };

  const handleChangeYear = (amount: number) => {
    setMonthCursor((current) => ({ ...current, year: current.year + amount }));
    setSelectedDate(null);
  };

  const handleUseCurrentMonth = () => {
    const now = new Date();
    setMonthCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(null);
    monthPickerSheetRef.current?.dismiss();
  };

  const handleSubmitReport = exportForm.handleSubmit((values) => {
    exportReportMutation.mutate(values);
  });

  // Render recent punch item
  const renderPunchItem = ({ item }: { item: any }) => {
    const isCheckIn = item.status === 'CHECKIN';

    return (
      <View style={styles.punchLogItem}>
        <View style={[styles.punchLogIcon, { backgroundColor: isCheckIn ? Colors.light.successMuted : Colors.light.dangerMuted }]}>
          <Icon
            source={isCheckIn ? 'timer-plus-outline' : 'timer-off-outline'}
            size={18}
            color={isCheckIn ? Colors.light.success : Colors.light.danger}
          />
        </View>
        <View style={styles.punchLogDetails}>
          <Text style={styles.punchLogStatus}>{isCheckIn ? 'Clocked In' : 'Clocked Out'}</Text>
          <Text style={styles.punchLogTime}>{formatShortDate(item.timestamp)}</Text>
        </View>
        <View style={styles.punchLogRight}>
          <Text style={styles.punchLogHour}>{formatPunchTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar backgroundColor={Colors.light.primary} style="light" />

      {/* Top Tab Bar Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          style={styles.tabButton}
          onPress={() => {
            setActiveTab(0);
            pagerRef.current?.setPage(0);
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 0 && styles.activeTabButtonText]}>Monthly Calendar</Text>
        </Pressable>

        <Pressable
          style={styles.tabButton}
          onPress={() => {
            setActiveTab(1);
            pagerRef.current?.setPage(1);
          }}
        >
          <Text style={[styles.tabButtonText, activeTab === 1 && styles.activeTabButtonText]}>Punches</Text>
        </Pressable>

        {/* Animated sliding indicator — moves with the swipe gesture in real time */}
        <Animated.View
          style={[
            styles.indicatorBar,
            {
              width: indicatorWidth,
              transform: [
                {
                  translateX: scrollAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, indicatorWidth],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Pager Swipeable Area */}
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageScroll={(e) => {
          const { position, offset } = e.nativeEvent;
          scrollAnim.setValue(position + offset);
        }}
        onPageSelected={(e) => {
          setActiveTab(e.nativeEvent.position);
        }}
      >
        {/* Page 0: Calendar */}
        <View key="2" style={styles.pageStyle}>
          <ScrollView
            contentContainerStyle={styles.pageScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={calendarQuery.isRefetching} onRefresh={handleRefresh} />
            }
          >
            <View style={styles.calendarPageHeader}>
              <Text style={styles.calendarPageSubtitle}>Monthly attendance status and shift activity</Text>
            </View>

            {calendarQuery.isError ? (
              <Card style={styles.calendarErrorCard}>
                <Text style={styles.errorText}>Could not load attendance calendar.</Text>
              </Card>
            ) : (
              <View style={styles.calendarCard}>
                {calendarHeader}
                <View style={styles.calendarLegendRow}>
                  <CalendarLegendItem label="Present" color={Colors.light.success} />
                  <CalendarLegendItem label="Late" color={Colors.light.warning} />
                  <CalendarLegendItem label="Absent" color={Colors.light.danger} />
                  <CalendarLegendItem label="Off" color="#b9c9ce" />
                </View>
                <Calendar
                  key={`${monthCursor.year}-${monthCursor.month}`}
                  current={`${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, '0')}-01`}
                  hideArrows
                  hideExtraDays
                  dayComponent={({ date, state }) => {
                    if (!date) return null;

                    const day = calendarDayMap[date.dateString];
                    return (
                      <CalendarDayBubble
                        date={date}
                        day={day}
                        disabled={state === 'disabled'}
                        isLoading={calendarQuery.isLoading}
                        selected={selectedDate === date.dateString}
                        onPress={handleCalendarDayPress}
                      />
                    );
                  }}
                  markingType="custom"
                  markedDates={markedDates}
                  onDayPress={handleCalendarDayPress}
                  onMonthChange={handleCalendarMonthChange}
                  renderHeader={() => null}
                  style={styles.calendar}
                  theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'transparent',
                    textSectionTitleColor: Colors.light.text,
                    selectedDayBackgroundColor: Colors.light.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: Colors.light.primary,
                    dayTextColor: Colors.light.text,
                    textDisabledColor: '#b9c9ce',
                    monthTextColor: Colors.light.text,
                    textDayFontWeight: '500',
                    textMonthFontWeight: '600',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 14,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>
            )}

            <View style={styles.statsGrid}>
              {statCards.map((stat) => (
                <View key={stat.title} style={styles.statMetricCard}>
                  <View style={styles.statMetricHeader}>
                    <Text style={styles.statMetricTitle}>{stat.title}</Text>
                  </View>
                  <Text style={[styles.statMetricValue, { color: stat.tone }]}>{stat.value}</Text>
                  <Text style={styles.statMetricHelper}>{stat.helper}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Page 1: Punches */}
        <View key="3" style={styles.pageStyle}>
          <FlatList
            data={recordsQuery.data?.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderPunchItem}
            contentContainerStyle={styles.recentListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={recordsQuery.isRefetching} onRefresh={handleRefresh} />
            }
            ListHeaderComponent={
              <View style={styles.punchesHeader}>
                <View>
                  <Text style={styles.punchesTitle}>Punches</Text>
                  <Text style={styles.punchesSubtitle}>Clock in and clock out history</Text>
                </View>
                <Pressable
                  style={styles.exportButton}
                  onPress={() => reportSheetRef.current?.present()}>
                  <Icon source="tray-arrow-down" size={18} color={Colors.light.primary} />
                  <Text style={styles.exportButtonText}>Export</Text>
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              !recordsQuery.isLoading && !recordsQuery.isError ? (
                <View style={styles.emptyPunchesContainer}>
                  <Icon source="history" size={32} color={Colors.light.textSecondary} />
                  <Text style={styles.emptyPunchesText}>No punches logged in this period.</Text>
                </View>
              ) : recordsQuery.isError ? (
                <Text style={styles.errorText}>Could not load punch records.</Text>
              ) : (
                <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginTop: Spacing.four }} />
              )
            }
          />
        </View>
      </PagerView>

      <AppBottomSheet
        ref={monthPickerSheetRef}
        snapPoints={['48%']}
        title="Select month"
        subtitle={`${monthCursor.year}`}>
        <View style={styles.monthPickerSheet}>
          <View style={styles.yearControl}>
            <Pressable style={styles.yearButton} onPress={() => handleChangeYear(-1)}>
              <Icon source="chevron-left" size={22} color={Colors.light.text} />
            </Pressable>
            <Text style={styles.yearText}>{monthCursor.year}</Text>
            <Pressable style={styles.yearButton} onPress={() => handleChangeYear(1)}>
              <Icon source="chevron-right" size={22} color={Colors.light.text} />
            </Pressable>
          </View>
          <View style={styles.monthGrid}>
            {Array.from({ length: 12 }).map((_, month) => {
              const selected = monthCursor.month === month;
              const label = new Date(monthCursor.year, month).toLocaleDateString(undefined, {
                month: 'short',
              });

              return (
                <Pressable
                  key={label}
                  style={[styles.monthOption, selected && styles.monthOptionSelected]}
                  onPress={() => handleSelectMonth(month)}>
                  <Text style={[styles.monthOptionText, selected && styles.monthOptionTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.currentMonthButton} onPress={handleUseCurrentMonth}>
            <Text style={styles.currentMonthButtonText}>Use current month</Text>
          </Pressable>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        ref={reportSheetRef}
        snapPoints={['64%']}
        title="Export attendance"
        subtitle="Choose a report type and date range.">
        <View style={styles.reportSheetContent}>
          <FormSelect
            control={exportForm.control}
            name="reportType"
            label="Report type"
            options={[
              { label: 'Individual attendance', value: 'individual' },
              { label: 'Attendance summary', value: 'summary' },
            ]}
            rules={{ required: 'Select a report type.' }}
          />
          <FormDateField
            control={exportForm.control}
            name="fromDate"
            label="From date"
            rules={{ required: 'Select a start date.' }}
          />
          <FormDateField
            control={exportForm.control}
            name="toDate"
            label="To date"
            rules={{
              required: 'Select an end date.',
              validate: (value, values) =>
                !values.fromDate || value >= values.fromDate || 'To date cannot be before from date.',
            }}
          />
          <AppButton
            icon="tray-arrow-down"
            loading={exportReportMutation.isPending}
            disabled={exportReportMutation.isPending}
            onPress={handleSubmitReport}>
            Generate PDF
          </AppButton>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        ref={dayDetailSheetRef}
        snapPoints={['38%', '62%']}
        title="Attendance details"
        subtitle={
          selectedDayDetail
            ? new Date(selectedDayDetail.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })
            : undefined
        }
        onDismiss={handleDismissDayDetail}>
        {selectedDayDetail && (
          <View style={styles.dayDetailSheetContent}>
            <View style={styles.detailCardHeader}>
              <Text style={styles.detailCardDate}>Status</Text>
              <AppStatusBadge
                label={selectedDayDetail.attendanceStatus || 'Off Duty'}
                tone={
                  selectedDayDetail.attendanceStatus === 'PRESENT'
                    ? selectedDayDetail.isLate
                      ? 'warning'
                      : 'success'
                    : selectedDayDetail.attendanceStatus === 'ABSENT'
                      ? 'danger'
                      : 'neutral'
                }
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duty status</Text>
              <Text style={styles.detailValue}>
                {selectedDayDetail.dutyStatus ? selectedDayDetail.dutyStatus.replace(/_/g, ' ') : 'Off'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shift Name</Text>
              <Text style={styles.detailValue}>{selectedDayDetail.shiftName || 'Flexible'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Work Hours</Text>
              <Text style={styles.detailValue}>
                {selectedDayDetail.timeIn && selectedDayDetail.timeOut
                  ? `${formatPunchTime(selectedDayDetail.timeIn)} - ${formatPunchTime(selectedDayDetail.timeOut)}`
                  : 'Flexible'}
              </Text>
            </View>
            {selectedDayDetail.manHours && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Time Worked</Text>
                <Text style={styles.detailValue}>{selectedDayDetail.manHours}</Text>
              </View>
            )}
            {selectedDayDetail.isLate && (
              <View style={styles.detailWarningRow}>
                <Icon source="timer-alert-outline" color={Colors.light.warning} size={16} />
                <Text style={styles.detailWarningText}>This check-in was flagged as late.</Text>
              </View>
            )}
          </View>
        )}
      </AppBottomSheet>
      <AppSnackbar
        visible={reportToast.visible}
        message={reportToast.message}
        tone={reportToast.tone}
        position="top"
        onDismiss={() => setReportToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.appBgLight,
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
  activeTabButton: {},
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
  pageScrollContent: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.eight,
  },
  recentListContent: {
    paddingVertical: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.eight,
  },
  punchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  punchesTitle: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '700',
  },
  punchesSubtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  calendarPageHeader: {
    marginBottom: Spacing.three,
  },
  calendarPageSubtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  exportButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: '#d9f3f8',
  },
  exportButtonText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  loadingText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  statMetricCard: {
    width: '48%',
    minHeight: 144,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: Spacing.four,
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  statMetricHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statMetricTitle: {
    ...Typography.base,
    flex: 1,
    color: Colors.light.text,
    fontWeight: '500',
  },
  statMetricValue: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '500',
    marginTop: Spacing.five,
  },
  statMetricHelper: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  calendarCard: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    marginBottom: Spacing.four,
    shadowColor: '#123943',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  calendarControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.one,
  },
  calendarMonthTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
  monthPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  monthPickerText: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '500',
  },
  calendarLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#f7fcfd',
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  calendarLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  calendarLegendText: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  calendar: {
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
  calendarDayBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  calendarDayBubbleDisabled: {
    opacity: 0.28,
  },
  calendarDayBubbleLoading: {
    backgroundColor: '#eef6f8',
  },
  calendarDayBubbleToday: {
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  calendarDayBubbleSelected: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
    borderWidth: 1,
  },
  calendarDayBubbleText: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '500',
  },
  calendarDayBubbleTextDisabled: {
    color: Colors.light.textSecondary,
  },
  calendarDayBubbleTextLoading: {
    color: 'rgba(69, 97, 106, 0.38)',
  },
  calendarDayBubbleTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  calendarDayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 1,
  },
  calendarDayDotEmpty: {
    backgroundColor: 'transparent',
  },
  calendarDayDotLoading: {
    backgroundColor: 'rgba(69, 97, 106, 0.18)',
  },
  calendarDayDotSelected: {
    backgroundColor: '#ffffff',
  },
  calendarErrorCard: {
    backgroundColor: '#fff4f4',
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  dayDetailSheetContent: {
    gap: Spacing.two,
  },
  detailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailCardDate: {
    ...Typography.sm,
    fontWeight: '700',
    color: Colors.light.text,
  },
  divider: {
    height: 1,
    backgroundColor: '#e6eff2',
    marginVertical: Spacing.one,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  detailValue: {
    ...Typography.xs,
    color: Colors.light.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.light.warningMuted,
    borderRadius: 8,
    padding: Spacing.two,
    marginTop: Spacing.one,
  },
  detailWarningText: {
    ...Typography.xs,
    color: Colors.light.warning,
    fontWeight: '500',
  },
  punchLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: Spacing.three,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: '#f0f4f6',
  },
  punchLogIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchLogDetails: {
    flex: 1,
    marginLeft: Spacing.three,
    gap: 2,
  },
  punchLogStatus: {
    ...Typography.sm,
    fontWeight: '700',
    color: Colors.light.text,
  },
  punchLogTime: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  punchLogRight: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  punchLogHour: {
    ...Typography.sm,
    fontWeight: '700',
    color: Colors.light.text,
  },
  emptyPunchesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyPunchesText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  errorText: {
    ...Typography.sm,
    color: Colors.light.danger,
    textAlign: 'center',
  },
  monthPickerSheet: {
    gap: Spacing.four,
  },
  yearControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  yearButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  yearText: {
    ...Typography.lg,
    minWidth: 72,
    textAlign: 'center',
    color: Colors.light.text,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  monthOption: {
    width: '31%',
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.appBgLight,
  },
  monthOptionSelected: {
    backgroundColor: Colors.light.primary,
  },
  monthOptionText: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '500',
  },
  monthOptionTextSelected: {
    color: '#ffffff',
  },
  currentMonthButton: {
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  currentMonthButtonText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  reportSheetContent: {
    gap: Spacing.three,
  },
});
