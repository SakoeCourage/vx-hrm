export type Tenant = {
  id: string;
  name: string;
  contactEmail?: string;
  logoUrl?: string;
  isActive?: boolean;
};

export type StaffPrerequisiteCheck = {
  bankData: boolean;
  professionalLicenceData: boolean;
  accomodationData: boolean;
  familyData: boolean;
  childrenData: boolean;
};

export type StaffSession = {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  staffIdentificationNumber: string;
  firstName?: string;
  lastName?: string;
  otherNames?: string;
  email?: string;
  phone?: string;
  passportPicture?: string;
  department?: {
    id?: string;
    departmentName?: string;
  };
  unit?: {
    id?: string;
    unitName?: string;
  };
  newStaffPrerequisiteCheck?: StaffPrerequisiteCheck;
  accessToken: string;
  refreshToken: string;
};

export type AuthStaff = Omit<StaffSession, 'accessToken' | 'refreshToken'>;

export type MissingPrerequisite = {
  key: keyof StaffPrerequisiteCheck;
  title: string;
  description: string;
  routeName: string;
};
