export type StaffOnboardingFormProps<TValues> = {
  defaultValues?: Partial<TValues>;
  readOnly?: boolean;
  submitLabel?: string;
  isSubmitting?: boolean;
  onValidityChange?: (isValid: boolean) => void;
  submitSignal?: number;
  tenantId?: string;
  tenantName?: string;
  onSubmit: (values: TValues) => void | Promise<void>;
};

export type BankDataFormValues = {
  accountType: string;
  bankName: string;
  bankCode: string;
  bankId: string;
  bankEntryMode: 'verified' | 'manual';
  branchName: string;
  accountName: string;
  accountNumber: string;
  isGhipsVerified: boolean;
};

export type ProfessionalLicenceFormValues = {
  professionalBodyId: string;
  pin: string;
  issuedDate: string;
  expiryDate: string;
};

export type AccommodationDataFormValues = {
  source: string;
  gpsAddress: string;
  accommodationType: string;
  flatNumber: string;
  allocationDate: string;
};

export type FamilyDetailsFormValues = {
  fathersName: string;
  mothersName: string;
  spouseName: string;
  spousePhoneNumber: string;
  nextOfKIN: string;
  nextOfKINPhoneNumber: string;
  emergencyPerson: string;
  emergencyPersonPhoneNumber: string;
};

export type ChildrenDetailsFormValues = {
  children: {
    id?: string;
    childName: string;
    dateOfBirth: string;
    gender: string;
  }[];
};
