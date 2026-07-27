import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { staffPrerequisiteItems } from '@/lib/auth/prerequisites';
import { StaffPrerequisiteCheck } from '@/lib/auth/types';

import { getStaffOnboardingStepByKey } from './onboarding-steps';

const onboardingItemIcons: Record<keyof StaffPrerequisiteCheck, string> = {
  bankData: 'bank-outline',
  professionalLicenceData: 'certificate-outline',
  accomodationData: 'home-city-outline',
  familyData: 'account-heart-outline',
  childrenData: 'human-child',
};

type StaffOnboardingChecklistProps = {
  checklist?: StaffPrerequisiteCheck;
};

export function StaffOnboardingChecklist({ checklist }: StaffOnboardingChecklistProps) {
  const pendingItems = staffPrerequisiteItems.filter((item) => !checklist?.[item.key]);
  const completedItems = staffPrerequisiteItems.filter((item) => checklist?.[item.key]);
  const completedCount = completedItems.length;
  const totalCount = staffPrerequisiteItems.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete onboarding</Text>
        <View style={styles.headerAction}>
          <Icon source="chevron-right" size={16} color={Colors.light.text} />
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          Step {completedCount} of {totalCount} Completed
        </Text>
        <Text style={styles.meta}>{Math.round(progress * 100)}% Completed</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.sections}>
        {pendingItems.length > 0 && (
          <OnboardingSection label="Pending" items={pendingItems} checklist={checklist} />
        )}
        {pendingItems.length > 0 && completedItems.length > 0 && <View style={styles.divider} />}
        {completedItems.length > 0 && (
          <OnboardingSection label="Completed" items={completedItems} checklist={checklist} />
        )}
      </View>
    </View>
  );
}

function OnboardingSection({
  label,
  items,
  checklist,
}: {
  label: string;
  items: typeof staffPrerequisiteItems;
  checklist?: StaffPrerequisiteCheck;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.list}>
        {items.map((item) => {
          const isComplete = Boolean(checklist?.[item.key]);
          const step = getStaffOnboardingStepByKey(item.key);
          const stepSlug = step?.slug ?? item.key;
          const itemIcon = onboardingItemIcons[item.key];

          return (
            <View key={item.key}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/staff-onboarding/[step]',
                    params: { step: stepSlug },
                  })
                }
                style={styles.row}>
                <View style={styles.iconSlot}>
                  <Icon
                    source={itemIcon}
                    size={22}
                    color={isComplete ? Colors.light.primary : '#b7791f'}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, isComplete ? styles.rowTitleComplete : null]}>
                    {item.title}
                  </Text>
                </View>
                <View style={styles.chevron}>
                  <Icon source="chevron-right" size={20} color={Colors.light.textSecondary} />
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
    borderRadius: 16,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: '#b9edf6',
    padding: Spacing.three,
    shadowColor: '#74d6e8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 2,
  },
  title: {
    ...Typography.md,
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
  },
  headerAction: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f7f8',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  meta: {
    ...Typography.xs,
    color: Colors.light.textSecondary,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff4df',
    overflow: 'hidden',
    marginBottom: Spacing.one,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#f5c451',
  },
  sections: {
    gap: Spacing.four,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    ...Typography.xs,
    color: Colors.light.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  list: {
    gap: Spacing.one,
  },
  row: {
    minHeight: 56,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  iconSlot: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '500',
  },
  rowTitleComplete: {
    color: Colors.light.textSecondary,
  },
  chevron: {
    width: 24,
    alignItems: 'flex-end',
  },
});
