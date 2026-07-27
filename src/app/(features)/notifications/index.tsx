import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Icon, Text } from 'react-native-paper';

import { Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import {
  getStaffNotifications,
  markAllStaffNotificationsAsRead,
  markNotificationAsRead,
  NotificationDto,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';
import { useEffect } from 'react';

export default function NotificationsScreen() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();
  const notificationsKey = ['staff-notifications', session?.tenantId];

  const notificationsQuery = useQuery({
    queryKey: [...notificationsKey, 'ALL'],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getStaffNotifications({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          pageNumber: 1,
          pageSize: 20,
          filter: 'ALL',
        })
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId)
    
  });

  useEffect(() => {
     console.log(notificationsQuery.data?.data);
  }, [notificationsQuery.data?.data]);
  
  


  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      authenticatedRequest((activeSession) =>
        markNotificationAsRead({
          id,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      authenticatedRequest((activeSession) =>
        markAllStaffNotificationsAsRead({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });

  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      contentStyle={styles.content}
      header={
        <View style={styles.appBar}>
          <Pressable style={styles.appBarButton} onPress={() => router.back()}>
            <Icon source="chevron-left" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.appBarTitle}>Notifications</Text>
          <Button
            compact
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            loading={markAllReadMutation.isPending}
            mode="text"
            textColor="#ffffff"
            onPress={() => markAllReadMutation.mutate()}>
            Mark all
          </Button>
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      {notificationsQuery.isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size={22} color={Colors.light.primary} />
          <Text style={styles.stateText}>Loading notifications</Text>
        </View>
      ) : notificationsQuery.isError ? (
        <View style={styles.stateCard}>
          <Icon source="alert-circle-outline" size={26} color={Colors.light.warning} />
          <Text style={styles.stateTitle}>Could not load notifications</Text>
          <Text style={styles.stateText}>Please try again shortly.</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.stateCard}>
          <Icon source="bell-check-outline" size={30} color={Colors.light.primary} />
          <Text style={styles.stateTitle}>No notifications yet</Text>
          <Text style={styles.stateText}>New HR updates and approvals will appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              isMarking={markReadMutation.variables === notification.id}
              onPress={() => {
                if (!notification.isRead && !markReadMutation.isPending) {
                  markReadMutation.mutate(notification.id);
                }
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationRow({
  notification,
  isMarking,
  onPress,
}: {
  notification: NotificationDto;
  isMarking: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.notificationRow, !notification.isRead && styles.notificationRowUnread]}>
      <View style={styles.notificationIcon}>
        {isMarking ? (
          <ActivityIndicator size={16} color={Colors.light.primary} />
        ) : (
          <Icon
            source={notification.isRead ? 'bell-outline' : 'bell-badge-outline'}
            size={18}
            color={Colors.light.primary}
          />
        )}
      </View>
      <View style={styles.notificationRowText}>
        <View style={styles.notificationRowTitleLine}>
          <Text style={styles.notificationRowTitle}>{notification.title}</Text>
          {!notification.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationMessage}>{notification.message}</Text>
        <Text style={styles.notificationDate}>{formatNotificationDate(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
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
  appBarTitle: {
    ...Typography.md,
    flex: 1,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  stateCard: {
    minHeight: 220,
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
  notificationRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: 18,
    backgroundColor: Colors.light.surface,
    padding: Spacing.three,
    shadowColor: '#74d6e8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  notificationRowUnread: {
    backgroundColor: Colors.light.primaryMuted,
  },
  notificationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  notificationRowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  notificationRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  notificationRowTitle: {
    ...Typography.base,
    flex: 1,
    color: Colors.light.text,
    fontWeight: '600',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  notificationMessage: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  notificationDate: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
});
