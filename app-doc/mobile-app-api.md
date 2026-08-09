# HRM Mobile App API Bootstrap

This document is for bootstrapping the React Native + Expo staff mobile app.

The system is split behind the gateway:

```txt
Gateway:        https://api.variablexsolutions.com
HRM service:    https://api.variablexsolutions.com/hrm
Attendance:     https://api.variablexsolutions.com/attendance
```

All endpoint paths below are shown as gateway URLs.

## Headers

Staff login and OTP confirmation do not require `x-tenant-id`.

For authenticated HRM endpoints:

```http
Authorization: Bearer {accessToken}
x-tenant-id: {tenantId}
Content-Type: application/json
```

For attendance endpoints:

```http
x-tenant-id: {tenantId}
Content-Type: application/json
```

Some attendance endpoints are currently anonymous in code, but the mobile app should still send `x-tenant-id` consistently.

## 1. Staff Login

Starts staff login by validating staff id and password, then sends OTP to the staff email/phone.

```http
POST https://api.variablexsolutions.com/hrm/api/staff/login
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "password": "password"
}
```

Success response:

```json
{
  "message": "OTP sent to your registered email and phone number.",
  "otp": "1234"
}
```

Notes:
- The `otp` is currently returned by the API response. For production mobile UX, still treat SMS/email as the source of truth.
- No `x-tenant-id` header is required here.

Possible error response:

```json
{
  "type": "BadRequest",
  "title": "An error occurred",
  "status": 400,
  "detail": "Invalid staff ID or password"
}
```

## 2. Confirm Staff OTP

Confirms the OTP and returns the staff session.

```http
POST https://api.variablexsolutions.com/hrm/api/staff/auth/verify-otp
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "otp": "1234"
}
```

Success response shape:

```json
{
  "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "tenantId": "00000001-0000-0000-0000-000000000001",
  "tenant": {
    "id": "00000001-0000-0000-0000-000000000001",
    "name": "Default Organization",
    "contactEmail": "admin@example.com",
    "logoUrl": "https://example.com/logo.png",
    "isActive": true
  },
  "title": "Mr",
  "gpsAddress": "GA-000-0000",
  "staffIdentificationNumber": "MS987654321",
  "dateOfBirth": "1990-01-01",
  "specialityId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "phone": "0240000000",
  "snnitNumber": "P0000000",
  "firstName": "SAKOE",
  "lastName": "JAY",
  "otherNames": "",
  "gender": "Male",
  "email": "staff@example.com",
  "passportPicture": "https://example.com/photo.jpg",
  "disability": "None",
  "ecowasCardNumber": "GHA-000000000-0",
  "directorate": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "directorateName": "Medical"
  },
  "department": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "departmentName": "Women and Children"
  },
  "unit": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "unitName": "Obstetrics and Gynaecology"
  },
  "grade": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "gradeName": "Senior Staff Nurse",
    "gradeLevelName": "Level 10"
  },
  "permissions": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "LEAVE_APPROVER",
      "description": "Can approve leave",
      "isActive": true
    }
  ],
  "newStaffPrerequisiteCheck": {
    "bankData": true,
    "professionalLicenceData": false,
    "accomodationData": true,
    "familyData": true,
    "childrenData": false
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "raw-refresh-token"
}
```

Mobile should store:

```txt
accessToken
refreshToken
tenantId
tenant.name
tenant.logoUrl
staffIdentificationNumber
staff id
staff photo/name/unit/department
```

Store tokens in `expo-secure-store`.

## 3. Refresh Staff Token

Rotates the refresh token and returns a fresh login response.

```http
POST https://api.variablexsolutions.com/hrm/api/staff/auth/refresh-token
```

Payload:

```json
{
  "accessToken": "expired-or-current-jwt-access-token",
  "refreshToken": "raw-refresh-token"
}
```

Success response shape is the same as OTP confirmation:

```json
{
  "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "tenantId": "00000001-0000-0000-0000-000000000001",
  "staffIdentificationNumber": "MS987654321",
  "firstName": "SAKOE",
  "lastName": "JAY",
  "tenant": {
    "id": "00000001-0000-0000-0000-000000000001",
    "name": "Default Organization",
    "logoUrl": "https://example.com/logo.png",
    "isActive": true
  },
  "directorate": {},
  "department": {},
  "unit": {},
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-raw-refresh-token"
}
```

Important:
- Refresh token is rotated. Replace the old stored refresh token immediately.
- If refresh fails with token reuse/expired token, clear session and return to login.

## 4. Get Authenticated Staff

Use this after app restart to hydrate the current staff profile.
Also call this immediately after OTP confirmation so the mobile app can evaluate the staff prerequisite checklist.

```http
GET https://api.variablexsolutions.com/hrm/api/staff/auth-staff
```

Headers:

```http
Authorization: Bearer {accessToken}
x-tenant-id: {tenantId}
```

Success response shape:

```json
{
  "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "tenantId": "00000001-0000-0000-0000-000000000001",
  "tenant": {
    "id": "00000001-0000-0000-0000-000000000001",
    "name": "Default Organization",
    "contactEmail": "admin@example.com",
    "logoUrl": "https://example.com/logo.png",
    "isActive": true
  },
  "staffIdentificationNumber": "MS987654321",
  "firstName": "SAKOE",
  "lastName": "JAY",
  "gender": "Male",
  "email": "staff@example.com",
  "passportPicture": "https://example.com/photo.jpg",
  "directorate": {
    "id": "guid",
    "directorateName": "Medical"
  },
  "department": {
    "id": "guid",
    "departmentName": "Women and Children"
  },
  "unit": {
    "id": "guid",
    "unitName": "Obstetrics and Gynaecology"
  },
  "grade": {
    "id": "guid",
    "gradeName": "Senior Staff Nurse",
    "gradeLevelName": "Level 10"
  },
  "permissions": [],
  "newStaffPrerequisiteCheck": {
    "bankData": true,
    "professionalLicenceData": false,
    "accomodationData": false,
    "familyData": true,
    "childrenData": false
  }
}
```

## 4.1 Post-Login Prerequisite Flow

After staff OTP confirmation, the mobile app should call:

```http
GET https://api.variablexsolutions.com/hrm/api/staff/auth-staff
```

Then inspect:

```json
{
  "newStaffPrerequisiteCheck": {
    "bankData": true,
    "professionalLicenceData": true,
    "accomodationData": true,
    "familyData": true,
    "childrenData": true
  }
}
```

Each value means:

| Key | Meaning | Entry API |
|---|---|---|
| `bankData` | Staff has bank details | `POST /hrm/api/staff-request/bank-update` |
| `professionalLicenceData` | Staff has professional licence details | `POST /hrm/api/staff-request/professional-licence` |
| `accomodationData` | Staff has accommodation details | `POST /hrm/api/staff-request/accommodation` |
| `familyData` | Staff has family / emergency details | `POST /hrm/api/staff-request/family-details` |
| `childrenData` | Staff has children details | `POST /hrm/api/staff-request/children-details` |

Recommended app behavior:

1. Staff logs in and confirms OTP.
2. Store `accessToken`, `refreshToken`, `tenantId`, and staff identity.
3. Call `GET /hrm/api/staff/auth-staff`.
4. If every prerequisite value is `true`, go directly to Home.
5. If any value is `false`, show a prerequisite setup screen listing the missing sections.
6. Staff can either:
   - open a missing section and submit the data, or
   - tap **Skip for now** to enter the Home page.
7. If the staff skips, show a persistent notice/card on Home until all prerequisite values become `true`.

Suggested local UI state:

```ts
type StaffPrerequisiteCheck = {
  bankData: boolean;
  professionalLicenceData: boolean;
  accomodationData: boolean;
  familyData: boolean;
  childrenData: boolean;
};

type MissingPrerequisite = {
  key: keyof StaffPrerequisiteCheck;
  title: string;
  routeName: string;
};
```

Example missing-section resolver:

```ts
const getMissingPrerequisites = (check: StaffPrerequisiteCheck): MissingPrerequisite[] => {
  const items: MissingPrerequisite[] = [];

  if (!check.bankData) {
    items.push({ key: "bankData", title: "Bank Details", routeName: "BankDetailsSetup" });
  }

  if (!check.professionalLicenceData) {
    items.push({ key: "professionalLicenceData", title: "Professional Licence", routeName: "ProfessionalLicenceSetup" });
  }

  if (!check.accomodationData) {
    items.push({ key: "accomodationData", title: "Accommodation Details", routeName: "AccommodationSetup" });
  }

  if (!check.familyData) {
    items.push({ key: "familyData", title: "Family / Emergency Details", routeName: "FamilyDetailsSetup" });
  }

  if (!check.childrenData) {
    items.push({ key: "childrenData", title: "Children Details", routeName: "ChildrenDetailsSetup" });
  }

  return items;
};
```

Home-page reminder example:

```txt
Complete your staff profile
Some required information is still missing: Bank Details, Professional Licence.
[Continue setup] [Dismiss for now]
```

Important:
- Dismiss/skip should only hide the onboarding screen for that app session or until the next app launch, depending on product decision.
- The Home notice should continue to appear whenever `GET /hrm/api/staff/auth-staff` returns any `false` prerequisite value.
- After submitting any prerequisite form, call `GET /hrm/api/staff/auth-staff` again to refresh the checklist.
- These prerequisite submissions go through staff request approval. While a request is `PENDING`, do not allow another new submission for the same section.

## 4.2 Prerequisite Data Endpoints

All endpoints in this section require:

```http
Authorization: Bearer {accessToken}
x-tenant-id: {tenantId}
Content-Type: application/json
```

The prerequisite checklist tells you whether an approved/live record exists:

```json
{
  "bankData": true,
  "professionalLicenceData": false,
  "accomodationData": false,
  "familyData": true,
  "childrenData": false
}
```

For each section, fetch the current section endpoint first. The section fetch endpoint returns the pending request first when one exists; otherwise it returns the approved/current data. The returned object includes `status`, commonly `PENDING` or `APPROVED`.

Mobile form states:

| Fetch result | UI state | Allowed action |
|---|---|---|
| `404` / not found and no pending request | Empty form | Submit new request |
| `status = PENDING` | Pending approval | Lock new submission; optionally allow pending edit/delete endpoints |
| `status = APPROVED` | Current approved data | Show data; allow request update through the create endpoint |
| `status = REJECTED` in submitted requests | Rejected request | Allow submit again |

To check submitted requests across all sections:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/submitted?pageNumber=1&pageSize=20
```

Useful filters:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/submitted?statuses=PENDING
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/submitted?requestType=bankUpdate
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/submitted?requestTypes=bankUpdate&requestTypes=professionalLicense
```

Known prerequisite request types:

```txt
bankUpdate
professionalLicense
accomodation
familyDetails
childrenDetails
```

### Bank Details

Fetch current or pending bank details:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/bank-update
```

Create a new bank update request:

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/bank-update
```

Verified bank payload:

```json
{
  "bankId": null,
  "bankName": "ACCESS BANK",
  "isGhipsVerified": true,
  "accountType": "Savings",
  "branch": "Main Branch",
  "accountNumber": "0123456789",
  "accountName": "SAKOE JAY"
}
```

Manual HR setup bank payload:

```json
{
  "bankId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "bankName": null,
  "isGhipsVerified": false,
  "accountType": "Savings",
  "branch": "Main Branch",
  "accountNumber": "0123456789",
  "accountName": "SAKOE JAY"
}
```

Update pending bank request:

```http
PUT https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-bank-update
```

Delete pending bank request:

```http
DELETE https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-bank-update
```

Bank reference APIs:

```http
GET https://api.variablexsolutions.com/hrm/api/payments/banks
GET https://api.variablexsolutions.com/hrm/api/payments/resolve-account?accountNumber=0123456789&code=044
GET https://api.variablexsolutions.com/hrm/api/bank/all?pageNumber=1&pageSize=100&search=access
```

Bank reference response:

```json
{
  "status": true,
  "data": [
    {
      "name": "ACCESS BANK",
      "code": "044",
      "type": "nuban"
    }
  ]
}
```

Account resolution response:

```json
{
  "status": true,
  "data": {
    "accountName": "SAKOE JAY",
    "accountNumber": "0123456789"
  }
}
```

Mobile should support two bank entry modes:

| Mode | Bank source | Verification | Request values |
|---|---|---|---|
| Verified | `GET /hrm/api/payments/banks` | `GET /hrm/api/payments/resolve-account?accountNumber={accountNumber}&code={code}` | `bankId: null`, `bankName: selectedPaystackBank.name`, `accountName: resolvedAccount.accountName`, `isGhipsVerified: true` |
| Manual | `GET /hrm/api/bank/all` | Staff enters account name manually | `bankId: selectedSetupBank.id`, `bankName: null`, `accountName: enteredAccountName`, `isGhipsVerified: false` |

Branch is required in both modes.

### Professional Licence

Fetch current or pending licence:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/professional-licence
```

Create a new professional licence request:

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/professional-licence
```

Payload:

```json
{
  "professionalBodyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "pin": "PIN-12345",
  "issuedDate": "2024-01-01",
  "expiryDate": "2026-12-31"
}
```

Update pending professional licence request:

```http
PUT https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-professional-licence
```

Delete pending professional licence request:

```http
DELETE https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-professional-licence
```

Professional body reference API:

```http
GET https://api.variablexsolutions.com/hrm/api/professional-body/all?pageNumber=1&pageSize=100&search=nursing
```

### Accommodation Details

Fetch current or pending accommodation:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/accommodation-detail
```

Create a new accommodation request:

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/accommodation
```

Payload:

```json
{
  "source": "Government",
  "gpsAddress": "GA-000-0000",
  "accomodationType": "Bungalow",
  "flatNumber": "A1",
  "allocationDate": "2026-01-10"
}
```

Update pending accommodation request:

```http
PUT https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-accommodation-detail
```

Delete pending accommodation request:

```http
DELETE https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-accommodation-detail
```

### Family Details

Fetch current or pending family details:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/family-details
```

Create a new family details request:

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/family-details
```

Payload:

```json
{
  "fathersName": "KWAME SAKOE",
  "mothersName": "AMA SAKOE",
  "spouseName": "",
  "spousePhoneNumber": "",
  "nextOfKIN": "AMA SAKOE",
  "nextOfKINPhoneNumber": "0240000000",
  "emergencyPerson": "AMA SAKOE",
  "emergencyPersonPhoneNumber": "0240000000"
}
```

Update pending family request:

```http
PUT https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-family-details
```

Delete pending family request:

```http
DELETE https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-family-details
```

### Children Details

Fetch current or pending children details:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/children-detail
```

Create a new children request:

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/children-details
```

Payload:

```json
{
  "children": [
    {
      "childName": "KOFI SAKOE",
      "dateOfBirth": "2020-05-20",
      "gender": "Male"
    }
  ]
}
```

When there is a pending children request, use the pending request `id` from the fetch response as `{childrenRequestId}`.

Add child to pending request:

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/pending-children-detail/add-child/{childrenRequestId}
```

Payload:

```json
{
  "childName": "AMA SAKOE",
  "dateOfBirth": "2022-09-15",
  "gender": "Female"
}
```

Update one child on pending request:

```http
PUT https://api.variablexsolutions.com/hrm/api/staff-request/pending-children-detail/update-child/{childId}
```

Delete one child from pending request:

```http
DELETE https://api.variablexsolutions.com/hrm/api/staff-request/pending-children-detail/remove-child/{childId}
```

There is no whole pending-children delete endpoint in the current code; only individual child add/update/remove exists for the pending children request.

### Recommended Mobile Prerequisite Flow

1. After OTP, call `GET /hrm/api/staff/auth-staff`.
2. Build the missing section list from `newStaffPrerequisiteCheck`.
3. For every screen the user opens, call the section fetch endpoint first.
4. If fetch returns `PENDING`, show the pending data and lock the main submit button. Do not call the create endpoint again.
5. If product wants pending edits, expose the matching pending update/delete actions; otherwise show read-only pending data until HR approves or rejects it.
6. If fetch returns `APPROVED`, show approved data and allow the staff to submit a new update request.
7. If fetch returns not found, show an empty form and submit through the create endpoint.
8. After any submit/update/delete, refetch the section and `GET /hrm/api/staff/auth-staff`.
9. Keep the Home reminder visible until all prerequisite values are `true`.

## 5. Staff Profile Data

Raw profile data for full staff profile screens.

```http
GET https://api.variablexsolutions.com/hrm/api/staff/MS987654321/profile
```

Response shape:

```json
{
  "tenant": {
    "id": "00000001-0000-0000-0000-000000000001",
    "name": "Default Organization",
    "logoUrl": "https://example.com/logo.png"
  },
  "identity": {
    "staffIdentificationNumber": "MS987654321",
    "fullName": "SAKOE JAY",
    "gender": "Male",
    "email": "staff@example.com",
    "phone": "0240000000",
    "passportPicture": "https://example.com/photo.jpg"
  },
  "currentPosting": {
    "directorate": "Medical",
    "department": "Women and Children",
    "unit": "Obstetrics and Gynaecology",
    "postingDate": "2026-01-10",
    "postingOption": "internal"
  },
  "currentAppointment": {
    "grade": "Senior Staff Nurse",
    "gradeLevel": "Level 10",
    "speciality": "Obstetrics",
    "appointmentType": "Permanent",
    "notionalDate": "2026-01-10",
    "substantiveDate": "2026-01-10"
  },
  "bank": {},
  "professionalLicence": {},
  "accommodation": {},
  "family": {},
  "children": [],
  "separation": null
}
```

## 6. File Upload

For supporting documents.

```http
POST https://api.variablexsolutions.com/hrm/api/uploads/miscellaneous
```

Headers:

```http
Authorization: Bearer {accessToken}
x-tenant-id: {tenantId}
Content-Type: multipart/form-data
```

Form data:

```txt
file: selected file
```

Response shape:

```json
{
  "url": "https://ik.imagekit.io/.../hrm/miscellaneous/00000001-0000-0000-0000-000000000001/file.png",
  "fileName": "file.png",
  "fileType": "image/png"
}
```

Uploaded files are stored under:

```txt
/hrm/miscellaneous/{tenant-id}
```

## Mobile Attendance Device Trust

After OTP confirmation or refresh, validate the current phone before enabling mobile attendance.

The mobile app must generate and persist:

```txt
deviceKeyId
biometric-protected key pair in the device Keystore/Keychain
```

Recommended React Native package:

```txt
react-native-biometrics
```

Use `createKeys()` to generate the device key pair. It returns a base64 RSA public key that can be sent directly as `publicKey` when trusting/transferring a device.

Use `createSignature()` to sign the exact `messageToSign` returned by the challenge endpoint. Send the returned base64 signature as `signature`.

The backend accepts:

```txt
RSA 2048 public key + RSA PKCS#1 v1.5 SHA-256 signature
ECDSA public key + SHA-256 ECDSA signature
```

Public keys may be PEM or base64 DER `SubjectPublicKeyInfo`.

### Validate Current Phone

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/validate
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001"
}
```

Response:

```json
{
  "status": "SAME_DEVICE"
}
```

Possible statuses:

```txt
NO_TRUSTED_DEVICE
SAME_DEVICE
DIFFERENT_DEVICE
DEVICE_USED_BY_ANOTHER_STAFF
```

UX rules:

- `NO_TRUSTED_DEVICE`: ask "Trust this device for attendance?"
- `SAME_DEVICE`: enable attendance.
- `DIFFERENT_DEVICE`: show transfer flow.
- `DEVICE_USED_BY_ANOTHER_STAFF`: block attendance and instruct the staff to contact admin support.

### Get Staff Trusted Device Summary

Use this after login when the app needs to show the staff which attendance device is currently trusted and the last 5 devices used by that staff. This endpoint compares the staff's current phone `deviceKeyId` against the active trusted device and returns a status.

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/trusted-summary
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "current-phone-key-001"
}
```

Response when the current phone is different from the active trusted phone:

```json
{
  "status": "DIFFERENT_DEVICE",
  "activeTrustedDevice": {
    "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
    "maskedDeviceKeyId": "phon...0001",
    "platform": "ios",
    "deviceName": "iPhone 15",
    "appVersion": "1.0.0",
    "isActive": true,
    "trustedAt": "2026-08-09T10:00:00Z",
    "lastVerifiedAt": "2026-08-09T10:05:00Z",
    "revokedAt": null,
    "isCurrentDevice": false
  },
  "recentDevices": [
    {
      "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
      "maskedDeviceKeyId": "phon...0001",
      "platform": "ios",
      "deviceName": "iPhone 15",
      "appVersion": "1.0.0",
      "isActive": true,
      "trustedAt": "2026-08-09T10:00:00Z",
      "lastVerifiedAt": "2026-08-09T10:05:00Z",
      "revokedAt": null,
      "isCurrentDevice": false
    }
  ]
}
```

Possible `status` values are the same as `/validate`:

```txt
NO_TRUSTED_DEVICE
SAME_DEVICE
DIFFERENT_DEVICE
DEVICE_USED_BY_ANOTHER_STAFF
```

The response does not expose `publicKey` or the full `deviceKeyId`.

### Create Challenge

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/challenge
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "purpose": "TRUST"
}
```

Supported purposes:

```txt
TRUST
VALIDATE
ATTENDANCE_LOG
TRANSFER
REMOVE
```

Response:

```json
{
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "nonce": "base64-nonce",
  "purpose": "TRUST",
  "expiresAt": "2026-08-07T08:00:00Z",
  "messageToSign": "TRUST|tenant-id|MS987654321|phone-key-001|019d26a1-77be-78bd-86ba-d2216c5e652d|base64-nonce"
}
```

Challenges expire after 5 minutes and are consumed after successful verification.

### Trust First Phone

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/trust
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "signature": "base64-signature",
  "metadata": {
    "platform": "ios",
    "deviceName": "iPhone 15",
    "appVersion": "1.0.0"
  }
}
```

For `react-native-biometrics`, set `publicKey` to the value returned by `createKeys()` and set `signature` to the value returned by `createSignature({ payload: messageToSign })`.

### Transfer Phone

Use this only after validation returns `DIFFERENT_DEVICE`. Transfer is temporarily limited to once every 3 minutes for testing. This should return to 30 days after mobile testing is complete. If the user needs help before the cooldown expires, instruct them to contact HR support to reset the trusted attendance device.

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/transfer
```

Payload shape is the same as trust, but the challenge purpose must be `TRANSFER`.

### Get Current Trusted Phone

Use this when `/validate` returns `SAME_DEVICE` and the app needs to show the logged-in staff the phone currently trusted for attendance. This endpoint requires a signed `VALIDATE` challenge, so it only returns details to the same trusted phone.

Flow:

1. Call `/validate`.
2. Continue only if the status is `SAME_DEVICE`.
3. Create a challenge with purpose `VALIDATE`.
4. Sign the returned `messageToSign` on the trusted phone.
5. Call current trusted phone.

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/current
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "signature": "base64-signature"
}
```

Response:

```json
{
  "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "platform": "ios",
  "deviceName": "iPhone 15",
  "appVersion": "1.0.0",
  "trustedAt": "2026-08-09T10:00:00Z",
  "lastVerifiedAt": "2026-08-09T10:05:00Z"
}
```

### Remove Current Trusted Phone

Use this only when the staff is on the same phone that is currently trusted. The phone must sign a `REMOVE` challenge, so another phone cannot remove the trusted device.

Removal is temporarily limited to once every 3 minutes for testing. This should return to 30 days after mobile testing is complete. If the user needs help before the cooldown expires, instruct them to contact HR support to reset the trusted attendance device.

Flow:

1. Call `/validate`.
2. Continue only if the status is `SAME_DEVICE`.
3. Create a challenge with purpose `REMOVE`.
4. Sign the returned `messageToSign` on the trusted phone.
5. Call remove current trusted phone.

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/remove-current
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "signature": "base64-signature",
  "reason": "User removed this phone"
}
```

Response:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "removed": true
}
```

After removal, the next `/validate` call for that staff and phone should return `NO_TRUSTED_DEVICE`.

### Lost Phone Recovery

Use this when the staff cannot access the old trusted phone. This bypasses the 30-day transfer cooldown, but requires a fresh HRM OTP.

Flow:

1. Call normal staff login to send OTP:

```http
POST https://api.variablexsolutions.com/hrm/api/staff/login
```

2. Create a mobile attendance challenge with purpose `TRANSFER` for the new phone.
3. Sign the returned `messageToSign` on the new phone.
4. Call lost-phone recovery:

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/lost-phone/recover
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "otp": "1234",
  "deviceKeyId": "new-phone-key-001",
  "publicKey": "base64-public-key-from-createKeys",
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "signature": "base64-signature",
  "metadata": {
    "platform": "android",
    "deviceName": "Pixel 9",
    "appVersion": "1.0.0"
  }
}
```

Backend behavior:

- Verifies and consumes the OTP through HRM.
- Verifies the new phone signed the `TRANSFER` challenge.
- Revokes the old trusted phone.
- Trusts the new phone immediately.

If the new phone already belongs to another staff account, recovery is blocked.

### Admin / HR Support Device Reset

Use this when HR/admin wants to clear a staff member's trusted phone so the next mobile login can trust a new device.

Admin reset:

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/admin/reset
```

Admin remove trusted phone:

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/admin/remove
```

HR support reset:

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/support/reset
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "optional-specific-device-key-id",
  "requestedBy": "admin@example.com",
  "reason": "Lost phone"
}
```

Response:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "revokedCount": 1,
  "canTrustNewDevice": true
}
```

If `deviceKeyId` is omitted, all active trusted devices for that staff are revoked. Normally there should only be one active device.

### Remove Staff Linked Attendance Device

Use this when an admin wants to remove the phone currently linked to a staff member's mobile attendance.

```http
POST https://api.variablexsolutions.com/attendance/api/mobile-attendance-device/admin/remove
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "requestedBy": "admin@example.com",
  "reason": "Staff requested device removal"
}
```

To remove a specific linked phone, include `deviceKeyId`:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceKeyId": "phone-key-001",
  "requestedBy": "admin@example.com",
  "reason": "Staff changed phone"
}
```

After a successful removal, the next `/validate` call for that staff should return:

```txt
NO_TRUSTED_DEVICE
```

Then the staff can trust a new phone through the normal `/challenge` + `/trust` flow.

## 7. Face Enrollment and Local Recognition

The mobile device should perform face detection/recognition locally. The backend stores templates and attendance logs by `staffIdentificationNumber`.

Recommended flow:

1. Sync templates from backend.
2. Store templates locally.
3. Use camera to identify staff locally.
4. Call attendance log API with matched `staffIdentificationNumber`.

### Create Face Enrollment

```http
POST https://api.variablexsolutions.com/attendance/api/face-enrollment
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "staffFullName": "SAKOE JAY",
  "staffPhoto": "https://example.com/photo.jpg",
  "faceTemplate": "{\"embedding\":[0.01,0.02,0.03]}",
  "deviceId": "device-001"
}
```

For mobile-owned enrollment, first create a `VALIDATE` challenge and include:

```json
{
  "source": "MOBILE",
  "deviceKeyId": "phone-key-001",
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "signature": "base64-signature"
}
```

Success response:

```json
"019d26a1-77be-78bd-86ba-d2216c5e652d"
```

The response is the enrollment id.

### Get Enrollment Status

```http
GET https://api.variablexsolutions.com/attendance/api/face-enrollment/MS987654321
```

Response:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "staffFullName": "SAKOE JAY",
  "staffPhoto": "https://example.com/photo.jpg",
  "hasFaceEnrollment": true,
  "faceEnrolledAt": "2026-07-22T10:00:00Z",
  "isCurrentlyCheckedIn": false,
  "lastCheckInTime": null
}
```

### Sync Enrollments

Initial sync:

```http
GET https://api.variablexsolutions.com/attendance/api/face-enrollments?pageNumber=1&pageSize=100
```

Delta sync:

```http
GET https://api.variablexsolutions.com/attendance/api/face-enrollments?updatedSince=2026-07-22T10:00:00Z
```

Response:

```json
{
  "serverTime": "2026-07-22T11:00:00Z",
  "data": [
    {
      "id": "019d26a1-77be-78bd-86ba-d2216c5e652d",
      "staffIdentificationNumber": "MS987654321",
      "staffFullName": "SAKOE JAY",
      "staffPhoto": "https://example.com/photo.jpg",
      "unitName": "TEST Unit 001",
      "departmentName": "TEST Department 001",
      "directorateName": "TEST Directorate 001",
      "gradeName": "Senior Staff Nurse",
      "faceTemplate": "{\"embedding\":[0.01,0.02,0.03]}",
      "deviceId": "device-001",
      "enrolledAt": "2026-07-22T10:00:00Z",
      "updatedAt": "2026-07-22T10:00:00Z",
      "isDeleted": false
    }
  ]
}
```

Store `serverTime` and use it as the next `updatedSince`.

If `isDeleted` is true, remove the template locally.

### Update Enrollment

```http
PUT https://api.variablexsolutions.com/attendance/api/face-enrollment/MS987654321
```

Payload:

```json
{
  "faceTemplate": "{\"embedding\":[0.04,0.05,0.06]}",
  "staffFullName": "SAKOE JAY",
  "staffPhoto": "https://example.com/photo.jpg",
  "deviceId": "device-001"
}
```

For mobile-owned updates, include `source: "MOBILE"` plus a signed `VALIDATE` challenge.

Success:

```http
204 No Content
```

### Remove Enrollment

```http
DELETE https://api.variablexsolutions.com/attendance/api/face-enrollment/MS987654321
```

Success:

```http
204 No Content
```

## 8. Attendance Status

Use this before showing the clock-in/out button.

```http
GET https://api.variablexsolutions.com/attendance/api/attendance/status/MS987654321
```

Response:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "staffFullName": "SAKOE JAY",
  "staffPhoto": "https://example.com/photo.jpg",
  "isEnrolled": true,
  "currentStatus": "CHECKOUT",
  "nextAction": "CHECKIN",
  "hasMissedCheckout": false,
  "checkedInAt": null,
  "activeSessionDuration": null,
  "lastCheckOutAt": "2026-07-22T09:00:00Z",
  "todaysPunches": [
    {
      "id": "guid",
      "status": "CHECKIN",
      "evaluation": "ON_TIME",
      "minutesVariance": 0,
      "timestamp": "2026-07-22T08:00:00Z",
      "deviceId": "device-001"
    }
  ],
  "todaysTotalWorkedTime": "7h 45m",
  "todaysShift": {
    "shiftId": "guid",
    "shiftName": "Morning",
    "expectedStart": "08:00:00",
    "expectedEnd": "16:00:00",
    "spansMidnight": false,
    "isWorkingDayToday": true,
    "assignmentType": "FIXED",
    "rotationName": null
  }
}
```

Possible `currentStatus` / `nextAction` values:

```txt
CHECKIN
CHECKOUT
NEVER
MISSED_CHECKOUT
```

Possible `evaluation` values:

```txt
ON_TIME
LATE
EARLY
OVERTIME
NON_WORKING_DAY
MISSED_CHECKOUT
```

## 9. Clock In / Clock Out

The API automatically decides whether the next punch is check-in or check-out.

```http
POST https://api.variablexsolutions.com/attendance/api/attendance/log
```

Payload:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "deviceId": "device-001",
  "forceCheckIn": false
}
```

Kiosk requests may omit `source` or send `"source": "KIOSK"` and keep using `deviceId`.

Mobile requests must first create an `ATTENDANCE_LOG` challenge and then send:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "source": "MOBILE",
  "deviceKeyId": "phone-key-001",
  "challengeId": "019d26a1-77be-78bd-86ba-d2216c5e652d",
  "signature": "base64-signature",
  "forceCheckIn": false
}
```

Response:

```json
{
  "status": "CHECKIN",
  "evaluation": "ON_TIME",
  "minutesVariance": 0,
  "staffIdentificationNumber": "MS987654321",
  "staffFullName": "SAKOE JAY",
  "staffPhoto": "https://example.com/photo.jpg",
  "timestamp": "2026-07-22T08:00:00Z",
  "deviceId": "device-001",
  "missedCheckoutAutoClosed": false
}
```

Mobile clock flow:

1. Load local face templates.
2. Capture face from camera.
3. Match locally.
4. Confirm match confidence.
5. Call attendance log.
6. Refresh attendance status.

## 10. Attendance Records

For staff history or admin-style list.

```http
GET https://api.variablexsolutions.com/attendance/api/attendance/records?staffIdentificationNumber=MS987654321&fromDate=2026-07-01&toDate=2026-07-22&pageNumber=1&pageSize=20
```

Query parameters:

```txt
staffIdentificationNumber
fromDate
toDate
status
search
sort
pageNumber
pageSize
```

Response shape:

```json
{
  "data": [
    {
      "id": "guid",
      "staffIdentificationNumber": "MS987654321",
      "staffFullName": "SAKOE JAY",
      "staffPhoto": "https://example.com/photo.jpg",
      "timestamp": "2026-07-22T08:00:00Z",
      "status": "CHECKIN",
      "deviceId": "device-001"
    }
  ],
  "pageNumber": 1,
  "pageSize": 20,
  "totalRecords": 1,
  "totalPages": 1
}
```

## 11. Staff Attendance Calendar

Best endpoint for the mobile calendar.

```http
GET https://api.variablexsolutions.com/attendance/api/staff-attendance-calendar/MS987654321?fromDate=2026-07-01&toDate=2026-07-31
```

Response:

```json
{
  "staffIdentificationNumber": "MS987654321",
  "staffFullName": "SAKOE JAY",
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "days": [
    {
      "date": "2026-07-22",
      "day": "Wednesday",
      "dutyStatus": "ON_DUTY",
      "attendanceStatus": "PRESENT",
      "rosterId": "guid",
      "rosterEntryId": "guid",
      "shiftId": "guid",
      "shiftName": "Morning",
      "timeIn": "2026-07-22T08:00:00Z",
      "timeOut": "2026-07-22T16:00:00Z",
      "manHours": "8h 00m",
      "isLate": false,
      "isEarlyCheckout": false,
      "isOvertime": false,
      "isMissedCheckout": false,
      "isNonWorkingDayPunch": false,
      "otherOnDutyCount": 2,
      "otherOnDutyStaff": [
        {
          "staffIdentificationNumber": "KBA000001",
          "staffFullName": "AMA MENSAH",
          "entryId": "guid",
          "shiftId": "guid",
          "shiftName": "Morning"
        }
      ]
    }
  ]
}
```

Use this for:
- monthly attendance calendar
- duty/off-duty labels
- present/absent/late badges
- "On duty with 2 others" details

## 12. Staff Roster

Current roster:

```http
GET https://api.variablexsolutions.com/attendance/api/staff-roster/MS987654321?filter=current
```

Upcoming roster:

```http
GET https://api.variablexsolutions.com/attendance/api/staff-roster/MS987654321?filter=upcoming
```

All rosters where staff appears:

```http
GET https://api.variablexsolutions.com/attendance/api/staff-roster/MS987654321
```

Response:

```json
[
  {
    "rosterId": "guid",
    "rosterName": "TEST Unit Weekly Roster",
    "startDate": "2026-07-22",
    "endDate": "2026-07-28",
    "status": "PUBLISHED",
    "cells": [
      {
        "entryId": "guid",
        "date": "2026-07-22",
        "dutyStatus": "ON_DUTY",
        "shiftId": "guid",
        "shiftName": "Morning",
        "isManualOverride": false,
        "notes": null,
        "concerns": [
          {
            "id": "guid",
            "type": "SHIFT_CHANGE",
            "status": "PENDING",
            "reason": "Need swap",
            "note": null,
            "targetRosterEntryId": null,
            "createdAt": "2026-07-22T08:00:00Z"
          }
        ]
      }
    ]
  }
]
```

Duty status values:

```txt
ON_DUTY
DAY_OFF
HOLIDAY_OFF
EXCUSE_DUTY
ANNUAL_LEAVE
STUDY_LEAVE
```

## 13. Leave Plan List

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/leave-plan/list?year=2026&pageNumber=1&pageSize=20
```

Optional query parameters:

```txt
year
status
leaveTypeId
sort
pageNumber
pageSize
```

Response shape:

```json
{
  "data": [
    {
      "id": "guid",
      "leaveTypeName": "Annual Leave",
      "leaveCategory": "ANNUAL",
      "year": 2026,
      "entitledDays": 30,
      "daysCarriedOver": 0,
      "daysUsed": 5,
      "daysDeferred": 0,
      "totalDaysPlanned": 15,
      "remainingDays": 25,
      "isApproved": false,
      "isExhausted": false,
      "status": "PENDING",
      "periods": [
        {
          "periodNumber": 1,
          "start": "2026-08-10",
          "end": "2026-08-14",
          "days": 5
        }
      ],
      "createdAt": "2026-07-22T10:00:00Z",
      "updatedAt": "2026-07-22T10:00:00Z"
    }
  ],
  "pageNumber": 1,
  "pageSize": 20,
  "totalRecords": 1,
  "totalPages": 1
}
```

## 14. Create Annual Leave Plan

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/leave-plan/create
```

Payload:

```json
{
  "leaveTypeId": null,
  "firstPeriodStart": "2026-08-10",
  "firstPeriodEnd": "2026-08-14",
  "secondPeriodStart": "2026-12-01",
  "secondPeriodEnd": "2026-12-05",
  "thirdPeriodStart": null,
  "thirdPeriodEnd": null
}
```

Success response:

```json
"Leave plan created successfully."
```

Validation notes:
- First period is required.
- Second and third periods are optional.
- Third period cannot be provided without second period.
- Dates must be in the future.
- Periods must not overlap.
- The backend checks leave entitlement and manpower availability.

## 15. Leave Plan Calendar

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/leave-plan/auth-staff/leave-plan-calendar?year=2026
```

Response:

```json
[
  {
    "id": "guid-1",
    "summary": "Annual Leave (Period 1)",
    "start": "2026-08-10T00:00:00",
    "end": "2026-08-14T23:59:59",
    "periodNumber": 1
  }
]
```

## 16. Create Leave Request

```http
POST https://api.variablexsolutions.com/hrm/api/staff-request/leave
```

Payload:

```json
{
  "leaveTypeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "startDate": "2026-08-10",
  "endDate": "2026-08-14",
  "year": 2026,
  "numberOfDays": 5,
  "relievingOfficer": "KBA000001",
  "contactWhenAway": true,
  "reason": "Annual leave",
  "contactAddressOnLeave": "Accra",
  "contactPhone": "0240000000",
  "contactEmail": "staff@example.com",
  "nextOfKinContact": "0241111111",
  "supportingDocumentUrl": "https://ik.imagekit.io/.../document.pdf"
}
```

Success response:

```json
"Leave request submitted successfully."
```

## 17. Leave Request History

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/leave?staffIdentificationNumber=MS987654321&year=2026&pageNumber=1&pageSize=20
```

Query parameters:

```txt
staffIdentificationNumber
year
status
leaveTypeId
search
sort
pageNumber
pageSize
```

Response shape:

```json
{
  "data": [
    {
      "id": "guid",
      "staffId": "guid",
      "staffIdentificationNumber": "MS987654321",
      "staffName": "SAKOE JAY",
      "leaveTypeId": "guid",
      "leaveName": "Annual Leave",
      "leaveCategory": "ANNUAL",
      "startDate": "2026-08-10",
      "endDate": "2026-08-14",
      "year": 2026,
      "numberOfDays": 5,
      "status": "PENDING",
      "reason": "Annual leave",
      "relievingOfficer": "KBA000001",
      "rejectionReason": null,
      "supportingDocumentUrl": "https://ik.imagekit.io/.../document.pdf",
      "createdAt": "2026-07-22T10:00:00Z",
      "updatedAt": "2026-07-22T10:00:00Z"
    }
  ],
  "pageNumber": 1,
  "pageSize": 20,
  "totalRecords": 1,
  "totalPages": 1
}
```

## 18. Staff Leave Status Shortcuts

Pending leave request:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/pending-leave-request
```

Active leave today:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/active-leave-data
```

Approved leave data:

```http
GET https://api.variablexsolutions.com/hrm/api/staff-request/auth-staff/approved-leave-data
```

Leave dashboard:

```http
GET https://api.variablexsolutions.com/hrm/api/leave/dashboard/my
```

## 19. Recommended Mobile Startup Flow

1. Read `accessToken`, `refreshToken`, `tenantId`, and `staffIdentificationNumber` from SecureStore.
2. If missing, show login.
3. If present, call:

```http
GET /hrm/api/staff/auth-staff
```

4. If access token is expired, call:

```http
POST /hrm/api/staff/auth/refresh-token
```

5. Fetch attendance status:

```http
GET /attendance/api/attendance/status/{staffIdentificationNumber}
```

6. Sync face templates:

```http
GET /attendance/api/face-enrollments?updatedSince={lastServerTime}
```

7. Fetch this month calendar:

```http
GET /attendance/api/staff-attendance-calendar/{staffIdentificationNumber}
```

8. Fetch current roster:

```http
GET /attendance/api/staff-roster/{staffIdentificationNumber}?filter=current
```

## 20. Suggested Local Data

Use secure storage for:

```txt
accessToken
refreshToken
tenantId
staffIdentificationNumber
staffId
```

Use SQLite for:

```txt
face_templates
- staffIdentificationNumber
- staffFullName
- staffPhoto
- faceTemplate
- updatedAt
- isDeleted

attendance_cache
- staffIdentificationNumber
- date
- dutyStatus
- attendanceStatus
- shiftName
- timeIn
- timeOut
- manHours

sync_state
- key
- serverTime
```

## 21. Important Implementation Notes

- Mobile face recognition is local-first. Backend does not identify a face from an image.
- Backend attendance log uses server UTC time.
- True offline attendance would need a backend endpoint that accepts signed device timestamps. Current `/attendance/api/attendance/log` is online/server-time based.
- Always send `x-tenant-id` after OTP confirmation.
- Treat `refreshToken` as single-use because the backend rotates it.
- If refresh fails, clear session and return to login.
