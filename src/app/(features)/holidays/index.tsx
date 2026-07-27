import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import PagerView from 'react-native-pager-view';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useEvent,
  useHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { formatDateParam } from '@/features/home/home-formatters';
import { getUpcomingHolidays, type Holiday } from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

type PagerScrollEvent = {
  eventName: string;
  position: number;
  offset: number;
};

export default function HolidaysScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const pagerRef = useRef<PagerView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const year = new Date().getFullYear();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    const now = new Date();
    return now.getFullYear() === year ? now.getMonth() : 0;
  });
  const monthProgress = useSharedValue(selectedMonthIndex);
  const fromDate = formatDateParam(new Date(year, 0, 1));
  const toDate = formatDateParam(new Date(year, 11, 31));

  const holidaysQuery = useQuery({
    queryKey: ['holidays', session?.tenantId, fromDate, toDate],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getUpcomingHolidays({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          fromDate,
          toDate,
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  const holidays = sortHolidays(holidaysQuery.data ?? []);
  const monthPages = getMonthPages(year, holidays);
  const selectedMonth = monthPages[selectedMonthIndex];
  const monthRailSideOffset = Math.min(Math.max(screenWidth * 0.46, 150), 190);
  const pageScrollHandler = usePageScrollHandler({
    onPageScroll: (event) => {
      'worklet';
      monthProgress.value = event.position + event.offset;
    },
  });

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      contentStyle={styles.content}
      header={
        <View style={styles.header}>
          <View style={styles.appBar}>
            <Pressable style={styles.appBarButton} onPress={() => router.back()}>
              <Icon source="chevron-left" size={24} color="#ffffff" />
            </Pressable>
            <Text style={styles.appBarTitle}>Holidays · {year}</Text>
            <View style={styles.appBarSpacer} />
          </View>

          {!holidaysQuery.isLoading && !holidaysQuery.isError && holidays.length > 0 && selectedMonth && (
            <View style={styles.headerMonthRail}>
              <MonthRail
                monthPages={monthPages}
                progress={monthProgress}
                sideOffset={monthRailSideOffset}
              />
            </View>
          )}
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      {holidaysQuery.isLoading ? (
        <StateView icon="calendar-sync-outline" title="Loading holidays" loading />
      ) : holidaysQuery.isError ? (
        <StateView icon="alert-circle-outline" title="Could not load holidays" description="Please try again shortly." />
      ) : holidays.length === 0 ? (
        <StateView icon="calendar-blank-outline" title="No holidays published" description="Published holidays for this year will appear here." />
      ) : (
        <View style={styles.monthCarousel}>
          <AnimatedPagerView
            ref={pagerRef}
            style={styles.monthPager}
            initialPage={selectedMonthIndex}
            onPageScroll={pageScrollHandler as unknown as React.ComponentProps<typeof AnimatedPagerView>['onPageScroll']}
            onPageSelected={(event) => {
              const nextPosition = event.nativeEvent.position;
              setSelectedMonthIndex(nextPosition);
              monthProgress.value = nextPosition;
            }}>
            {monthPages.map((month) => (
              <View key={month.monthKey} collapsable={false} style={styles.monthPage}>
                <ScrollView
                  style={styles.monthPageScroll}
                  contentContainerStyle={styles.monthPageContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled>
                  {month.holidays.length === 0 ? (
                    <View style={styles.emptyMonth}>
                      <Icon source="calendar-blank-outline" size={28} color={Colors.light.textSecondary} />
                      <Text style={styles.emptyMonthTitle}>No holidays</Text>
                      <Text style={styles.emptyMonthText}>There are no published holidays for {month.monthLabel}.</Text>
                    </View>
                  ) : (
                    <View style={styles.holidayRows}>
                      <Text style={styles.holidayListCaption}>
                        {month.holidays.length} holiday{month.holidays.length === 1 ? '' : 's'}
                      </Text>
                      {month.holidays.map((holiday, index) => (
                        <View key={`${holiday.date}-${holiday.name}`} style={styles.holidayRow}>
                          <View style={styles.holidayText}>
                            <Text style={styles.holidayName}>{holiday.name}</Text>
                            <Text style={styles.holidayDate}>{formatHolidayFullDate(holiday.date)}</Text>
                          </View>
                          {index < month.holidays.length - 1 && <View style={styles.rowDivider} />}
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            ))}
          </AnimatedPagerView>
        </View>
      )}
    </Screen>
  );
}

function MonthRail({
  monthPages,
  progress,
  sideOffset,
}: {
  monthPages: ReturnType<typeof getMonthPages>;
  progress: SharedValue<number>;
  sideOffset: number;
}) {
  return (
    <View style={styles.monthRailViewport}>
      {monthPages.map((month, index) => (
                <MonthRailItem
                  key={month.monthKey}
                  index={index}
                  label={month.headerLabel}
                  progress={progress}
                  sideOffset={sideOffset}
                />
      ))}
    </View>
  );
}

function MonthRailItem({
  index,
  label,
  progress,
  sideOffset,
}: {
  index: number;
  label: string;
  progress: SharedValue<number>;
  sideOffset: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [index - 2, index - 1, index, index + 1, index + 2],
      [0, 0.4, 1, 0.4, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [index - 1, index, index + 1],
          [sideOffset, 0, -sideOffset],
          Extrapolation.CLAMP
        ),
      },
      {
        scale: interpolate(
          progress.value,
          [index - 1, index, index + 1],
          [0.94, 1, 0.94],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [index - 0.35, index, index + 0.35],
      [0, 1, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.monthRailItem, animatedStyle]}>
      <Text style={styles.monthTitle} numberOfLines={1}>
        {label}
      </Text>
      <Animated.View style={[styles.monthActiveIndicator, indicatorStyle]} />
    </Animated.View>
  );
}

function usePageScrollHandler(
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

function StateView({
  icon,
  title,
  description,
  loading,
}: {
  icon: string;
  title: string;
  description?: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.stateView}>
      {loading ? (
        <ActivityIndicator size={24} color={Colors.light.primary} />
      ) : (
        <Icon source={icon} size={30} color={Colors.light.textSecondary} />
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      {description && <Text style={styles.stateText}>{description}</Text>}
    </View>
  );
}

function sortHolidays(holidays: Holiday[]) {
  return [...holidays].sort((a, b) => a.date.localeCompare(b.date));
}

function getMonthPages(year: number, holidays: Holiday[]) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthDate = new Date(year, monthIndex, 1);

    return {
      monthKey: `${year}-${monthIndex}`,
      monthLabel: new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
      }).format(monthDate),
      headerLabel: new Intl.DateTimeFormat(undefined, {
        month: 'long',
      }).format(monthDate),
      shortLabel: new Intl.DateTimeFormat(undefined, {
        month: 'short',
      }).format(monthDate),
      holidays: holidays.filter((holiday) => parseHolidayDate(holiday.date).getMonth() === monthIndex),
    };
  });
}

function parseHolidayDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatHolidayFullDate(value: string) {
  const date = parseHolidayDate(value);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
  }).format(date);
  const weekdayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
  }).format(date);

  return `${dateLabel} · ${weekdayLabel}`;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: Spacing.four,
    paddingHorizontal: 0,
    gap: Spacing.three,
  },
  header: {
    backgroundColor: Colors.light.primary,
  },
  appBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerMonthRail: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 0,
  },
  appBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  appBarTitle: {
    ...Typography.base,
    flex: 1,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  appBarSpacer: {
    width: 40,
  },
  monthCarousel: {
    flex: 1,
    gap: 0,
    overflow: 'visible',
  },
  monthRailViewport: {
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monthRailItem: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  monthTitle: {
    ...Typography.md,
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
  },
  monthActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 124,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#facc15',
  },
  monthPager: {
    flex: 1,
    overflow: 'visible',
  },
  monthPage: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  monthPageScroll: {
    flex: 1,
  },
  monthPageContent: {
    flexGrow: 1,
    paddingBottom: Spacing.two,
  },
  holidayRows: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.light.surface,
    paddingTop: Spacing.four,
    marginHorizontal: Spacing.one,
  },
  holidayListCaption: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  holidayRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    position: 'relative',
  },
  holidayText: {
    flex: 1,
    minWidth: 0,
  },
  holidayName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  holidayDate: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  rowDivider: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: 0,
    height: 1,
    backgroundColor: '#edf3f5',
  },
  emptyMonth: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.four,
    marginHorizontal: Spacing.one,
  },
  emptyMonthTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMonthText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  stateView: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  stateTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
