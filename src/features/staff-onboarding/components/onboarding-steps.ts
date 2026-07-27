import { StaffPrerequisiteCheck } from '@/lib/auth/types';

export type StaffOnboardingStepSlug =
  | 'bank-data'
  | 'professional-licence'
  | 'accommodation-data'
  | 'family-details'
  | 'children-details';

export type StaffOnboardingStep = {
  key: keyof StaffPrerequisiteCheck;
  slug: StaffOnboardingStepSlug;
  title: string;
};

export const staffOnboardingSteps: StaffOnboardingStep[] = [
  { key: 'bankData', slug: 'bank-data', title: 'Bank Details' },
  { key: 'professionalLicenceData', slug: 'professional-licence', title: 'Professional Licence' },
  { key: 'accomodationData', slug: 'accommodation-data', title: 'Accommodation Details' },
  { key: 'familyData', slug: 'family-details', title: 'Family / Emergency Details' },
  { key: 'childrenData', slug: 'children-details', title: 'Children Details' },
];

export function getStaffOnboardingStepBySlug(slug?: string | string[]) {
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  return staffOnboardingSteps.find((step) => step.slug === normalizedSlug);
}

export function getStaffOnboardingStepByKey(key: keyof StaffPrerequisiteCheck) {
  return staffOnboardingSteps.find((step) => step.key === key);
}
