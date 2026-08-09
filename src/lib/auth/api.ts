import { File, Paths } from 'expo-file-system';

import { apiRequest, GATEWAY_URL } from '@/lib/api/client';
import { AuthStaff, StaffPrerequisiteCheck, StaffSession } from '@/lib/auth/types';

export type StaffLoginPayload = {
  staffIdentificationNumber: string;
  password: string;
};

export type StaffLoginResponse = {
  message: string;
  otp?: string;
};

export type VerifyOtpPayload = {
  staffIdentificationNumber: string;
  otp: string;
};

export type PaymentBank = {
  name: string;
  code: string;
  type?: string;
};

export type SetupBank = {
  id: string;
  name?: string;
  bankName?: string;
};

export type ProfessionalBody = {
  id: string;
  name?: string;
  professionalBodyName?: string;
};

export type ResolvedBankAccount = {
  accountName: string;
  accountNumber: string;
};

export type StaffBankUpdatePayload = {
  bankId: string | null;
  bankName: string | null;
  isGhipsVerified: boolean;
  accountType: string;
  branch: string;
  accountNumber: string;
  accountName: string;
};

export type StaffAccommodationPayload = {
  source: string;
  gpsAddress: string;
  accomodationType: string;
  flatNumber: string;
  allocationDate: string;
};

export type StaffProfessionalLicencePayload = {
  professionalBodyId: string;
  pin: string;
  issuedDate: string;
  expiryDate: string;
};

export type StaffFamilyDetailsPayload = {
  fathersName: string;
  mothersName: string;
  spouseName: string;
  spousePhoneNumber: string;
  nextOfKIN: string;
  nextOfKINPhoneNumber: string;
  emergencyPerson: string;
  emergencyPersonPhoneNumber: string;
};

export type StaffChildPayload = {
  childName: string;
  dateOfBirth: string;
  gender: string;
};

export type StaffChildrenDetailsPayload = {
  children: StaffChildPayload[];
};

export type StaffChildDetail = StaffChildPayload & {
  id?: string;
  staffId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffChildrenDetailResponse = {
  id: string;
  staffId?: string;
  createdAt?: string;
  updatedAt?: string;
  isApproved?: boolean;
  isAlterable?: boolean;
  status?: string;
  children?: StaffChildDetail[];
};

export type Holiday = {
  date: string;
  name: string;
};

export type RosterOnDutyStaff = {
  staffIdentificationNumber: string;
  staffFullName: string;
  entryId: string;
  shiftId?: string;
  shiftName?: string;
};

export type AttendancePunch = {
  id: string;
  status: 'CHECKIN' | 'CHECKOUT';
  evaluation: 'ON_TIME' | 'LATE' | 'EARLY' | 'OVERTIME' | 'NON_WORKING_DAY' | 'MISSED_CHECKOUT';
  minutesVariance: number;
  timestamp: string;
  deviceId: string;
};

export type AttendanceShift = {
  shiftId: string | null;
  shiftName: string | null;
  expectedStart: string | null;
  expectedEnd: string | null;
  spansMidnight: boolean;
  isWorkingDayToday: boolean;
  assignmentType: string | null;
  rotationName: string | null;
};

export type AttendanceStatus = {
  staffIdentificationNumber: string;
  staffFullName: string;
  staffPhoto: string | null;
  isEnrolled: boolean;
  currentStatus: 'CHECKIN' | 'CHECKOUT' | 'NEVER' | 'MISSED_CHECKOUT';
  nextAction: 'CHECKIN' | 'CHECKOUT';
  hasMissedCheckout: boolean;
  checkedInAt: string | null;
  activeSessionDuration: string | null;
  lastCheckOutAt: string | null;
  todaysPunches: AttendancePunch[];
  todaysTotalWorkedTime: string | null;
  todaysShift: AttendanceShift | null;
};

export type AttendanceLogPayload = {
  staffIdentificationNumber: string;
  deviceId?: string;
  source?: 'KIOSK' | 'MOBILE';
  deviceKeyId?: string;
  challengeId?: string;
  signature?: string;
  forceCheckIn?: boolean;
};

export type AttendanceLogResponse = {
  status: 'CHECKIN' | 'CHECKOUT';
  evaluation: string;
  minutesVariance: number;
  staffIdentificationNumber: string;
  staffFullName: string;
  staffPhoto: string | null;
  timestamp: string;
  deviceId: string;
  missedCheckoutAutoClosed: boolean;
};

export type AttendanceRecord = {
  id: string;
  staffIdentificationNumber: string;
  staffFullName: string;
  staffPhoto: string | null;
  timestamp: string;
  status: 'CHECKIN' | 'CHECKOUT';
  deviceId: string;
};

export type AttendanceRecordsResponse = {
  data: AttendanceRecord[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
};

export type AttendanceReportType = 'individual' | 'summary';

export type StaffRosterCell = {
  entryId: string;
  date: string;
  dutyStatus?: string;
  attendanceStatus?: string;
  rosterId?: string;
  rosterEntryId?: string;
  shiftId?: string;
  shiftName?: string;
  timeIn?: string;
  timeOut?: string;
  manHours?: string;
  isLate?: boolean;
  isEarlyCheckout?: boolean;
  isOvertime?: boolean;
  isMissedCheckout?: boolean;
  isNonWorkingDayPunch?: boolean;
  otherOnDutyCount?: number;
  otherOnDutyStaff?: RosterOnDutyStaff[];
};

export type StaffRoster = {
  rosterId: string;
  rosterName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  cells?: StaffRosterCell[];
};

export type AttendanceCalendarDay = {
  date: string;
  day?: string;
  dutyStatus?: string;
  attendanceStatus?: string;
  rosterId?: string;
  rosterEntryId?: string;
  shiftId?: string;
  shiftName?: string;
  timeIn?: string;
  timeOut?: string;
  manHours?: string;
  isLate?: boolean;
  isEarlyCheckout?: boolean;
  isOvertime?: boolean;
  isMissedCheckout?: boolean;
  isNonWorkingDayPunch?: boolean;
  otherOnDutyCount?: number;
  otherOnDutyStaff?: RosterOnDutyStaff[];
};

export type StaffAttendanceCalendar = {
  staffIdentificationNumber: string;
  staffFullName?: string;
  fromDate: string;
  toDate: string;
  days: AttendanceCalendarDay[];
};

export type LeaveDashboardPlan = {
  id?: string;
  leaveTypeId?: string;
  leaveName?: string;
  leaveCategory?: string;
  planStatus?: string;
  periods?: LeavePlanPeriod[];
  entitledDays?: number;
  EntitledDays?: number;
  daysCarriedOver?: number;
  DaysCarriedOver?: number;
  totalEntitledDays?: number;
  TotalEntitledDays?: number;
  totalDaysPlanned?: number;
  TotalDaysPlanned?: number;
  daysUsed?: number;
  DaysUsed?: number;
  daysDeferred?: number;
  DaysDeferred?: number;
  daysRemaining?: number;
  DaysRemaining?: number;
};

export type LeaveDashboardResponse = {
  staffId?: string;
  leaveYear?: number;
  entitledDays?: number;
  EntitledDays?: number;
  plans?: LeaveDashboardPlan[];
  Plans?: LeaveDashboardPlan[];
  pendingLeaveRequests?: number;
  PendingLeaveRequests?: number;
  pendingDeferments?: number;
  PendingDeferments?: number;
  leaveStatusCounts?: Record<string, number>;
  LeaveStatusCounts?: Record<string, number>;
  leaveHistory?: unknown[];
  LeaveHistory?: unknown[];
};

export type LeaveType = {
  id: string;
  leaveName: string;
  leaveCategory?: string;
  daysCount?: number;
  mustExhaustAnnualLeave?: boolean;
  maximumNumberOfDays?: number;
  maximumSpecialCaseDays?: number;
  allowSpecialCase?: boolean;
  requiresDocument?: boolean;
  documentLabel?: string | null;
  allowCarryOver?: boolean;
  excludeWeekends?: boolean;
  isActive?: boolean;
};

export type LeavePreviewDay = {
  date: string;
  status: 'ELIGIBLE' | 'WEEKEND' | 'HOLIDAY' | 'ALREADY_ON_LEAVE' | string;
  label?: string | null;
};

export type LeaveDatePreview = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  effectiveDays: number;
  entitledDays?: number;
  remainingBalance?: number;
  days: LeavePreviewDay[];
};

export type LeavePlanPeriod = {
  periodNumber: number;
  start: string;
  end: string;
  days: number;
};

export type LeavePlan = {
  id: string;
  leaveTypeId?: string;
  leaveTypeName?: string;
  leaveName?: string;
  leaveCategory?: string;
  year?: number;
  entitledDays?: number;
  daysCarriedOver?: number;
  daysUsed?: number;
  daysDeferred?: number;
  totalDaysPlanned?: number;
  remainingDays?: number;
  isApproved?: boolean;
  isExhausted?: boolean;
  status?: string;
  periods?: LeavePlanPeriod[];
  createdAt?: string;
  updatedAt?: string;
};

export type LeavePlanEligibilityPeriod = LeavePlanPeriod & {
  peakAbsentCount?: number;
  totalStaffInUnit?: number;
  availabilityPercentage?: number;
  isEligible: boolean;
  conflictingDates?: string[];
  dates?: LeavePreviewDay[];
  daysPreview?: LeavePreviewDay[];
  dateStatuses?: LeavePreviewDay[];
  leaveDates?: LeavePreviewDay[];
};

export type LeavePlanEligibilityResponse = {
  isEligible: boolean;
  totalStaffInUnit?: number;
  periods: LeavePlanEligibilityPeriod[];
  dates?: LeavePreviewDay[];
  days?: LeavePreviewDay[];
  dateStatuses?: LeavePreviewDay[];
  leaveDates?: LeavePreviewDay[];
};

export type LeavePlanPayload = {
  leaveTypeId?: string | null;
  firstPeriodStart: string;
  firstPeriodEnd: string;
  secondPeriodStart?: string | null;
  secondPeriodEnd?: string | null;
  thirdPeriodStart?: string | null;
  thirdPeriodEnd?: string | null;
};

export type LeaveRequestPayload = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  year: number;
  numberOfDays: number;
  relievingOfficer: string;
  contactWhenAway: boolean;
  reason: string;
  contactAddressOnLeave: string;
  contactPhone: string;
  contactEmail: string;
  nextOfKinContact: string;
  supportingDocumentUrl?: string | null;
};

export type LeaveRequest = {
  id: string;
  staffId?: string;
  staffIdentificationNumber?: string;
  staffName?: string;
  leaveTypeId?: string;
  leaveName?: string;
  leaveCategory?: string;
  startDate?: string;
  endDate?: string;
  year?: number;
  numberOfDays?: number;
  status?: string;
  reason?: string;
  relievingOfficer?: string;
  rejectionReason?: string | null;
  supportingDocumentUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: string | null;
  createdAt: string;
  readAt?: string | null;
  isRead: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
};

export type StaffProfileResponse = {
  tenant?: {
    id?: string | null;
    name?: string | null;
    logoUrl?: string | null;
  } | null;
  identity?: Record<string, unknown> | null;
  statutory?: Record<string, unknown> | null;
  currentPosting?: Record<string, unknown> | null;
  currentAppointment?: Record<string, unknown> | null;
  firstAppointment?: Record<string, unknown> | null;
  approvedBankDetail?: Record<string, unknown> | null;
  approvedProfessionalLicence?: Record<string, unknown> | null;
  approvedAccommodation?: Record<string, unknown> | null;
  approvedFamilyDetail?: Record<string, unknown> | null;
  approvedChildren?: Record<string, unknown>[];
  separation?: Record<string, unknown> | null;
  generatedAt?: string | null;
};

export type MobileAttendanceDeviceTrustStatus =
  | 'NO_TRUSTED_DEVICE'
  | 'SAME_DEVICE'
  | 'DIFFERENT_DEVICE'
  | 'DEVICE_USED_BY_ANOTHER_STAFF';

export type MobileAttendanceDeviceChallengePurpose =
  | 'TRUST'
  | 'VALIDATE'
  | 'ATTENDANCE_LOG'
  | 'TRANSFER'
  | 'REMOVE';

export type MobileAttendanceDeviceMetadata = {
  platform: string;
  deviceName?: string;
  appVersion?: string;
};

export type MobileAttendanceDeviceChallenge = {
  challengeId: string;
  nonce: string;
  purpose: MobileAttendanceDeviceChallengePurpose;
  expiresAt: string;
  messageToSign: string;
};

export type MobileAttendanceDeviceTrustPayload = {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  publicKey: string;
  challengeId: string;
  signature: string;
  metadata: MobileAttendanceDeviceMetadata;
};

export type MobileAttendanceDeviceRemoveCurrentPayload = {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  challengeId: string;
  signature: string;
  reason: string;
};

export type MobileAttendanceDeviceRemoveCurrentResponse = {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  removed: boolean;
};

export type MobileAttendanceTrustedDevice = {
  id: string;
  staffIdentificationNumber: string;
  deviceKeyId?: string;
  maskedDeviceKeyId?: string;
  platform: string;
  deviceName: string;
  appVersion?: string | null;
  isActive?: boolean;
  trustedAt: string;
  lastVerifiedAt?: string | null;
  revokedAt?: string | null;
  isCurrentDevice?: boolean;
};

export type MobileAttendanceTrustedDeviceSummary = {
  status: MobileAttendanceDeviceTrustStatus;
  activeTrustedDevice: MobileAttendanceTrustedDevice | null;
  recentDevices: MobileAttendanceTrustedDevice[];
};

export type MobileAttendanceDeviceCurrentPayload = {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  challengeId: string;
  signature: string;
};

export function staffLogin(payload: StaffLoginPayload) {
  return apiRequest<StaffLoginResponse>('/hrm/api/staff/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyStaffOtp(payload: VerifyOtpPayload) {
  return apiRequest<StaffSession>('/hrm/api/staff/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAuthStaff(accessToken: string, tenantId: string) {
  return apiRequest<AuthStaff>('/hrm/api/staff/auth-staff', {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function getUpcomingHolidays({
  accessToken,
  tenantId,
  fromDate,
  toDate,
}: {
  accessToken: string;
  tenantId: string;
  fromDate: string;
  toDate: string;
}) {
  const params = new URLSearchParams({ fromDate, toDate });

  return apiRequest<Holiday[]>(`/hrm/api/leave-year/holidays?${params.toString()}`, {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function getCurrentStaffRoster({
  staffIdentificationNumber,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<StaffRoster[]>(
    `/attendance/api/staff-roster/${encodeURIComponent(staffIdentificationNumber)}?filter=current`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export function getUpcomingStaffRoster({
  staffIdentificationNumber,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<StaffRoster[]>(
    `/attendance/api/staff-roster/${encodeURIComponent(staffIdentificationNumber)}?filter=upcoming`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export function getStaffAttendanceCalendar({
  staffIdentificationNumber,
  accessToken,
  tenantId,
  fromDate,
  toDate,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
  fromDate: string;
  toDate: string;
}) {
  const params = new URLSearchParams({ fromDate, toDate });
  return apiRequest<StaffAttendanceCalendar>(
    `/attendance/api/staff-attendance-calendar/${encodeURIComponent(staffIdentificationNumber)}?${params.toString()}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export function getAttendanceStatus({
  staffIdentificationNumber,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<AttendanceStatus>(
    `/attendance/api/attendance/status/${encodeURIComponent(staffIdentificationNumber)}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export function validateMobileAttendanceDevice({
  staffIdentificationNumber,
  deviceKeyId,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<{ status: MobileAttendanceDeviceTrustStatus }>(
    '/attendance/api/mobile-attendance-device/validate',
    {
      method: 'POST',
      body: JSON.stringify({ staffIdentificationNumber, deviceKeyId }),
      accessToken,
      tenantId,
    }
  );
}

export function getMobileAttendanceTrustedDeviceSummary({
  staffIdentificationNumber,
  deviceKeyId,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<MobileAttendanceTrustedDeviceSummary>(
    '/attendance/api/mobile-attendance-device/trusted-summary',
    {
      method: 'POST',
      body: JSON.stringify({ staffIdentificationNumber, deviceKeyId }),
      accessToken,
      tenantId,
    }
  );
}

export function createMobileAttendanceDeviceChallenge({
  staffIdentificationNumber,
  deviceKeyId,
  purpose,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  deviceKeyId: string;
  purpose: MobileAttendanceDeviceChallengePurpose;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<MobileAttendanceDeviceChallenge>(
    '/attendance/api/mobile-attendance-device/challenge',
    {
      method: 'POST',
      body: JSON.stringify({ staffIdentificationNumber, deviceKeyId, purpose }),
      accessToken,
      tenantId,
    }
  );
}

export function trustMobileAttendanceDevice({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: MobileAttendanceDeviceTrustPayload;
}) {
  return apiRequest<unknown>('/attendance/api/mobile-attendance-device/trust', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function transferMobileAttendanceDevice({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: MobileAttendanceDeviceTrustPayload;
}) {
  return apiRequest<unknown>('/attendance/api/mobile-attendance-device/transfer', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function removeCurrentMobileAttendanceDevice({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: MobileAttendanceDeviceRemoveCurrentPayload;
}) {
  return apiRequest<MobileAttendanceDeviceRemoveCurrentResponse>(
    '/attendance/api/mobile-attendance-device/remove-current',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      accessToken,
      tenantId,
    }
  );
}

export function getCurrentMobileAttendanceTrustedDevice({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: MobileAttendanceDeviceCurrentPayload;
}) {
  return apiRequest<MobileAttendanceTrustedDevice>(
    '/attendance/api/mobile-attendance-device/current',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      accessToken,
      tenantId,
    }
  );
}

export function logAttendance({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: AttendanceLogPayload;
}) {
  return apiRequest<AttendanceLogResponse>('/attendance/api/attendance/log', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function getAttendanceRecords({
  staffIdentificationNumber,
  accessToken,
  tenantId,
  pageNumber = 1,
  pageSize = 20,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({
    staffIdentificationNumber,
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });
  return apiRequest<AttendanceRecordsResponse>(
    `/attendance/api/attendance/records?${params.toString()}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export async function downloadStaffAttendancePdf({
  staffIdentificationNumber,
  accessToken,
  tenantId,
  fromDate,
  toDate,
  type,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
  fromDate: string;
  toDate: string;
  type: AttendanceReportType;
}) {
  const params = new URLSearchParams({ fromDate, toDate });
  const reportPath =
    type === 'summary'
      ? `/attendance/api/reports/attendance/staff/${encodeURIComponent(staffIdentificationNumber)}/summary/pdf`
      : `/attendance/api/reports/attendance/staff/${encodeURIComponent(staffIdentificationNumber)}/pdf`;
  const filename = `attendance-${type}-${staffIdentificationNumber}-${fromDate}-to-${toDate}.pdf`;
  const destination = new File(Paths.cache, filename);

  const file = await File.downloadFileAsync(
    `${GATEWAY_URL}${reportPath}?${params.toString()}`,
    destination,
    {
      idempotent: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
    }
  );

  return file.uri;
}

export async function downloadRosterPdf({
  rosterId,
  accessToken,
  tenantId,
}: {
  rosterId: string;
  accessToken: string;
  tenantId: string;
}) {
  const filename = `roster-${rosterId}.pdf`;
  const destination = new File(Paths.cache, filename);

  const file = await File.downloadFileAsync(
    `${GATEWAY_URL}/attendance/api/rosters/${encodeURIComponent(rosterId)}/pdf`,
    destination,
    {
      idempotent: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
    }
  );

  return file.uri;
}

export function getMyLeaveDashboard({
  accessToken,
  tenantId,
  leaveYear,
}: {
  accessToken: string;
  tenantId: string;
  leaveYear: number;
}) {
  return apiRequest<LeaveDashboardResponse>(`/hrm/api/leave/dashboard/my?leaveYear=${leaveYear}`, {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function getLeaveTypes({
  accessToken,
  tenantId,
  pageNumber = 1,
  pageSize = 100,
}: {
  accessToken: string;
  tenantId: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });

  return apiRequest<PaginatedResponse<LeaveType>>(`/hrm/api/leave-type/all?${params.toString()}`, {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function previewLeaveDates({
  leaveTypeId,
  accessToken,
  tenantId,
  startDate,
  endDate,
  eligibleDaysCount,
}: {
  leaveTypeId: string;
  accessToken: string;
  tenantId: string;
  startDate: string;
  endDate?: string;
  eligibleDaysCount?: number;
}) {
  const params = new URLSearchParams({ startDate });

  if (endDate) {
    params.set('endDate', endDate);
  }

  if (eligibleDaysCount) {
    params.set('eligibleDaysCount', String(eligibleDaysCount));
  }

  return apiRequest<LeaveDatePreview>(
    `/hrm/api/leave-type/${encodeURIComponent(leaveTypeId)}/date-preview?${params.toString()}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export function checkLeavePlanEligibility({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: LeavePlanPayload;
}) {
  return apiRequest<LeavePlanEligibilityResponse>('/hrm/api/staff-request/leave-plan/check-eligibility', {
    method: 'POST',
    accessToken,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export function createLeavePlan({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: LeavePlanPayload;
}) {
  return apiRequest<string>('/hrm/api/staff-request/leave-plan/create', {
    method: 'POST',
    accessToken,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export function getLeavePlans({
  accessToken,
  tenantId,
  year,
  status,
  pageNumber = 1,
  pageSize = 20,
}: {
  accessToken: string;
  tenantId: string;
  year: number;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({
    year: String(year),
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });

  if (status) {
    params.set('status', status);
  }

  return apiRequest<PaginatedResponse<LeavePlan>>(`/hrm/api/staff-request/leave-plan/list?${params.toString()}`, {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function createLeaveRequest({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: LeaveRequestPayload;
}) {
  return apiRequest<string>('/hrm/api/staff-request/leave', {
    method: 'POST',
    accessToken,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export function getStaffLeaveRequests({
  staffIdentificationNumber,
  accessToken,
  tenantId,
  year,
  pageNumber = 1,
  pageSize = 20,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
  year: number;
  pageNumber?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({
    staffIdentificationNumber,
    year: String(year),
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });

  return apiRequest<PaginatedResponse<LeaveRequest>>(`/hrm/api/staff-request/leave?${params.toString()}`, {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function getStaffNotifications({
  accessToken,
  tenantId,
  pageNumber = 1,
  pageSize = 20,
  sort = 'createdAt desc',
  filter = 'ALL',
}: {
  accessToken: string;
  tenantId: string;
  pageNumber?: number;
  pageSize?: number;
  sort?: string;
  filter?: 'ALL' | 'UNREAD' | 'READ';
}) {
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
    filter,
  });
  return apiRequest<PaginatedResponse<NotificationDto>>(`/hrm/api/auth/staff/notification?${params.toString()}`, {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export function markNotificationAsRead({
  id,
  accessToken,
  tenantId,
}: {
  id: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<string>(`/hrm/api/auth/notification/mark-as-read/${id}`, {
    method: 'POST',
    accessToken,
    tenantId,
  });
}

export function markAllStaffNotificationsAsRead({
  accessToken,
  tenantId,
}: {
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<string>('/hrm/api/auth/staff/notification/mark-as-read/all', {
    method: 'POST',
    accessToken,
    tenantId,
  });
}

export function getStaffProfile({
  staffIdentificationNumber,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<StaffProfileResponse>(
    `/hrm/api/staff/${encodeURIComponent(staffIdentificationNumber)}/profile`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );
}

export async function downloadStaffProfilePdf({
  staffIdentificationNumber,
  accessToken,
  tenantId,
}: {
  staffIdentificationNumber: string;
  accessToken: string;
  tenantId: string;
}) {
  const filename = `staff-profile-${staffIdentificationNumber}.pdf`;
  const destination = new File(Paths.cache, filename);

  const file = await File.downloadFileAsync(
    `${GATEWAY_URL}/hrm/api/staff/${encodeURIComponent(staffIdentificationNumber)}/profile/pdf`,
    destination,
    {
      idempotent: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
      },
    }
  );

  return file.uri;
}

const onboardingSectionFetchPaths: Record<keyof StaffPrerequisiteCheck, string> = {
  bankData: '/hrm/api/staff-request/auth-staff/bank-update',
  professionalLicenceData: '/hrm/api/staff-request/auth-staff/professional-licence',
  accomodationData: '/hrm/api/staff-request/auth-staff/accommodation-detail',
  familyData: '/hrm/api/staff-request/auth-staff/family-details',
  childrenData: '/hrm/api/staff-request/auth-staff/children-detail',
};

export function getStaffOnboardingSectionData({
  key,
  accessToken,
  tenantId,
}: {
  key: keyof StaffPrerequisiteCheck;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<Record<string, unknown>>(onboardingSectionFetchPaths[key], {
    method: 'GET',
    accessToken,
    tenantId,
  });
}

export async function getPaymentBanks(accessToken: string, tenantId: string) {
  const response = await apiRequest<{ status?: boolean; data?: PaymentBank[] }>('/hrm/api/payments/banks', {
    method: 'GET',
    accessToken,
    tenantId,
  });

  return response.data ?? [];
}

export async function getSetupBanks({
  accessToken,
  tenantId,
  search = '',
}: {
  accessToken: string;
  tenantId: string;
  search?: string;
}) {
  const params = new URLSearchParams({
    pageNumber: '1',
    pageSize: '100',
  });

  if (search.trim()) {
    params.set('search', search.trim());
  }

  const response = await apiRequest<SetupBank[] | { data?: SetupBank[]; items?: SetupBank[] }>(
    `/hrm/api/bank/all?${params.toString()}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );

  return Array.isArray(response) ? response : response.data ?? response.items ?? [];
}

export async function getProfessionalBodies({
  accessToken,
  tenantId,
  search = '',
}: {
  accessToken: string;
  tenantId: string;
  search?: string;
}) {
  const params = new URLSearchParams({
    pageNumber: '1',
    pageSize: '100',
  });

  if (search.trim()) {
    params.set('search', search.trim());
  }

  const response = await apiRequest<ProfessionalBody[] | { data?: ProfessionalBody[]; items?: ProfessionalBody[] }>(
    `/hrm/api/professional-body/all?${params.toString()}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );

  return Array.isArray(response) ? response : response.data ?? response.items ?? [];
}

export async function resolveBankAccount({
  accessToken,
  tenantId,
  accountNumber,
  code,
}: {
  accessToken: string;
  tenantId: string;
  accountNumber: string;
  code: string;
}) {
  const params = new URLSearchParams({ accountNumber, code });
  const response = await apiRequest<{ status?: boolean; data?: ResolvedBankAccount }>(
    `/hrm/api/payments/resolve-account?${params.toString()}`,
    {
      method: 'GET',
      accessToken,
      tenantId,
    }
  );

  return response.data;
}

export function createStaffBankUpdateRequest({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: StaffBankUpdatePayload;
}) {
  return apiRequest<void>('/hrm/api/staff-request/bank-update', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function createStaffAccommodationRequest({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: StaffAccommodationPayload;
}) {
  return apiRequest<void>('/hrm/api/staff-request/accommodation', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function createStaffProfessionalLicenceRequest({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: StaffProfessionalLicencePayload;
}) {
  return apiRequest<void>('/hrm/api/staff-request/professional-licence', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function createStaffFamilyDetailsRequest({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: StaffFamilyDetailsPayload;
}) {
  return apiRequest<void>('/hrm/api/staff-request/family-details', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function createStaffChildrenDetailsRequest({
  accessToken,
  tenantId,
  payload,
}: {
  accessToken: string;
  tenantId: string;
  payload: StaffChildrenDetailsPayload;
}) {
  return apiRequest<StaffChildrenDetailResponse>('/hrm/api/staff-request/children-details', {
    method: 'POST',
    body: JSON.stringify(payload),
    accessToken,
    tenantId,
  });
}

export function addPendingStaffChild({
  childrenRequestId,
  accessToken,
  tenantId,
  payload,
}: {
  childrenRequestId: string;
  accessToken: string;
  tenantId: string;
  payload: StaffChildPayload;
}) {
  return apiRequest<StaffChildrenDetailResponse>(
    `/hrm/api/staff-request/pending-children-detail/add-child/${encodeURIComponent(childrenRequestId)}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      accessToken,
      tenantId,
    }
  );
}

export function updatePendingStaffChild({
  childId,
  accessToken,
  tenantId,
  payload,
}: {
  childId: string;
  accessToken: string;
  tenantId: string;
  payload: StaffChildPayload;
}) {
  return apiRequest<StaffChildrenDetailResponse>(
    `/hrm/api/staff-request/pending-children-detail/update-child/${encodeURIComponent(childId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
      accessToken,
      tenantId,
    }
  );
}

export function removePendingStaffChild({
  childId,
  accessToken,
  tenantId,
}: {
  childId: string;
  accessToken: string;
  tenantId: string;
}) {
  return apiRequest<void>(
    `/hrm/api/staff-request/pending-children-detail/remove-child/${encodeURIComponent(childId)}`,
    {
      method: 'DELETE',
      accessToken,
      tenantId,
    }
  );
}

export function updateStaffPassportPicture({
  staffId,
  file,
  accessToken,
  tenantId,
}: {
  staffId: string;
  file: {
    uri: string;
    name: string;
    type: string;
  };
  accessToken: string;
  tenantId: string;
}) {
  const formData = new FormData();
  formData.append('passportPicture', file as unknown as Blob);

  return apiRequest<void>(`/hrm/api/staff/${staffId}/update-passportpic`, {
    method: 'PATCH',
    body: formData,
    accessToken,
    tenantId,
  });
}

export function refreshStaffToken({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}) {
  return apiRequest<StaffSession>('/hrm/api/staff/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ accessToken, refreshToken }),
  });
}
