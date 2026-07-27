import {
  MissingPrerequisite,
  StaffPrerequisiteCheck,
} from '@/lib/auth/types';

export const staffPrerequisiteItems: MissingPrerequisite[] = [
  {
    key: 'bankData',
    title: 'Bank Details',
    description: 'Add salary bank account information.',
    routeName: 'BankDetailsSetup',
  },
  {
    key: 'professionalLicenceData',
    title: 'Professional Licence',
    description: 'Capture licence number, issue date, and expiry details.',
    routeName: 'ProfessionalLicenceSetup',
  },
  {
    key: 'accomodationData',
    title: 'Accommodation Details',
    description: 'Provide current housing and GPS address details.',
    routeName: 'AccommodationSetup',
  },
  {
    key: 'familyData',
    title: 'Family / Emergency Details',
    description: 'Add next of kin and emergency contact details.',
    routeName: 'FamilyDetailsSetup',
  },
  {
    key: 'childrenData',
    title: 'Children Details',
    description: 'Add dependant children information where applicable.',
    routeName: 'ChildrenDetailsSetup',
  },
];

export function getMissingPrerequisites(check?: StaffPrerequisiteCheck): MissingPrerequisite[] {
  if (!check) {
    return [];
  }

  return staffPrerequisiteItems.filter((item) => !check[item.key]);
}
