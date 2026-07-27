import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { AppButton, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import { useSession } from '@/lib/auth/session-context';

export default function ProfileTab() {
  const { session, setSession } = useSession();
  const queryClient = useQueryClient();
  const staffName = [session?.firstName, session?.lastName].filter(Boolean).join(' ') || session?.staffIdentificationNumber || 'Staff';
  const initials = staffName.slice(0, 2).toUpperCase();

  if (!session) {
    return <Redirect href="/" />;
  }

  const handleSignOut = async () => {
    queryClient.setQueryData(['session-bootstrap'], null);
    queryClient.removeQueries({ queryKey: ['auth-staff'] });
    await setSession(null);
  };

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      contentStyle={styles.content}
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {session?.passportPicture ? (
            <Image source={{ uri: session.passportPicture }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <Text style={styles.name}>{staffName}</Text>
        <Text style={styles.subtitle}>{session?.tenant?.name ?? 'VariableX HRM'}</Text>
      </View>
      <View style={styles.listCard}>
        <ProfileRow icon="account-cog-outline" label="Account settings" onPress={() => router.push('/profile/account-settings')} />
        <ProfileRow icon="bell-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        <ProfileRow icon="file-document-outline" label="My particulars" onPress={() => router.push('/profile/my-particulars')} />
      </View>
      <AppButton variant="ghost" icon="logout" onPress={handleSignOut}>
        Sign out
      </AppButton>
    </Screen>
  );
}

function ProfileRow({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  const Container = onPress ? Pressable : View;

  return (
    <Container style={styles.row} onPress={onPress}>
      <Icon source={icon} size={20} color={Colors.light.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Icon source="chevron-right" size={20} color={Colors.light.textSecondary} />
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  profileCard: {
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 16,
    backgroundColor: Colors.light.surface,
    padding: Spacing.five,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.light.primaryMuted,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    ...Typography.lg,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  name: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.base,
    color: Colors.light.textSecondary,
  },
  listCard: {
    borderRadius: 16,
    backgroundColor: Colors.light.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  rowLabel: {
    ...Typography.base,
    flex: 1,
    color: Colors.light.text,
  },
});
