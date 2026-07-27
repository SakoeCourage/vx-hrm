import {
  AttendanceCalendarDay,
  LeaveDashboardResponse,
  RosterOnDutyStaff,
  StaffRosterCell,
} from '@/lib/auth/api';
import { AuthStaff, StaffSession } from '@/lib/auth/types';

export function formatStaffName(session: AuthStaff | StaffSession) {
  const name = [session.firstName, session.lastName].filter(Boolean).join(' ');
  return name || session.staffIdentificationNumber;
}

export function formatDepartmentUnit(session: AuthStaff | StaffSession) {
  const parts = [session.department?.departmentName, session.unit?.unitName]
    .filter((value): value is string => Boolean(value))
    .map((value) => toSentenceCase(value));
  return parts.length ? parts.join(' • ') : 'Department • Unit';
}

export function toSentenceCase(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? 'U'}${words[1]?.[0] ?? ''}`.slice(0, 2).toUpperCase();
}

export function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatPunchTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatShiftTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function getPunchEvalLabel(evaluation?: string) {
  switch (evaluation) {
    case 'ON_TIME': return 'On time';
    case 'LATE': return 'Late';
    case 'EARLY': return 'Early out';
    case 'OVERTIME': return 'Overtime';
    case 'NON_WORKING_DAY': return 'Non-working day';
    case 'MISSED_CHECKOUT': return 'Missed checkout';
    default: return '';
  }
}

export function formatShortHolidayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatRosterTimeRange(cell: StaffRosterCell) {
  if (!cell.timeIn || !cell.timeOut) {
    return cell.manHours ? `${cell.manHours}` : 'Time not assigned';
  }

  return `${formatRosterTime(cell.timeIn)} - ${formatRosterTime(cell.timeOut)}`;
}

export function formatRosterStatus(value?: string) {
  return toSentenceCase((value ?? 'N/A').replace(/_/g, ' '));
}

export function findRosterCellForDate(rosters: { cells?: StaffRosterCell[] }[], date: string) {
  for (const roster of rosters) {
    const cell = roster.cells?.find((item) => item.date === date);

    if (cell) {
      return cell;
    }
  }

  return undefined;
}

export function getUpcomingHolidayRange() {
  const from = new Date();
  const to = new Date(from);
  to.setMonth(to.getMonth() + 6);

  const endOfYear = new Date(from.getFullYear(), 11, 31);
  const cappedTo = to > endOfYear ? endOfYear : to;

  return {
    fromDate: formatDateParam(from),
    toDate: formatDateParam(cappedTo),
  };
}

export function getOnDutyStaff(cell: StaffRosterCell, calendarDay?: AttendanceCalendarDay) {
  const calendarStaff = calendarDay?.otherOnDutyStaff ?? [];
  if (calendarStaff.length > 0) {
    return dedupeOnDutyStaff(calendarStaff);
  }

  return dedupeOnDutyStaff(cell.otherOnDutyStaff ?? []);
}

export function getLeaveSummary(dashboard?: LeaveDashboardResponse) {
  const plans = dashboard?.Plans ?? dashboard?.plans ?? [];
  const plan = plans[0];
  const entitledDays = readNumber(plan?.EntitledDays ?? plan?.entitledDays ?? dashboard?.EntitledDays ?? dashboard?.entitledDays);
  const carriedOver = readNumber(plan?.DaysCarriedOver ?? plan?.daysCarriedOver);
  const daysUsed = readNumber(plan?.DaysUsed ?? plan?.daysUsed);
  const daysDeferred = readNumber(plan?.DaysDeferred ?? plan?.daysDeferred);
  const explicitRemaining = plan?.DaysRemaining ?? plan?.daysRemaining;
  const remainingDays =
    explicitRemaining === undefined
      ? Math.max(entitledDays + carriedOver - daysUsed - daysDeferred, 0)
      : readNumber(explicitRemaining);

  return {
    remainingDays,
    daysUsed,
    pendingRequests: readNumber(dashboard?.PendingLeaveRequests ?? dashboard?.pendingLeaveRequests),
  };
}

function formatRosterTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function dedupeOnDutyStaff(staff: RosterOnDutyStaff[]) {
  const seen = new Set<string>();

  return staff.filter((person) => {
    const key = person.staffIdentificationNumber || person.entryId || person.staffFullName;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function readNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
