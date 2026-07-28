# VX HRM

VX HRM is a staff mobile app built with Expo, React Native, Expo Router, React Query, React Native Paper, and Uniwind. It connects to the VX HRM gateway for staff authentication, profile data, onboarding checks, attendance, roster, and QR-based workflows.

## Tech Stack

- Expo SDK 54
- React 19 and React Native 0.81
- Expo Router 6 with typed routes enabled
- TanStack React Query for server state
- React Native Paper for UI primitives
- Uniwind and Tailwind CSS for styling support
- Expo SecureStore for persisted session credentials
- EAS Build for internal preview and production builds

> Note: repository agent instructions require checking the Expo SDK 57 documentation before code changes. The app dependencies currently target Expo SDK 54.

## Requirements

- Node.js 20.19.x or newer for the current Expo SDK target
- npm
- Xcode for iOS builds
- Android Studio and Android SDK for Android builds
- Expo CLI through `npx expo`
- EAS CLI through `npx eas-cli` when creating cloud builds

## Getting Started

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npm run start
```

Run on iOS:

```bash
npm run ios
```

Run on Android:

```bash
npm run android
```

Run the web target:

```bash
npm run web
```

Lint the project:

```bash
npm run lint
```

## App Structure

```text
src/app/                 Expo Router routes
src/app/(tabs)/          Authenticated tab screens
src/app/(features)/      Feature route screens
src/features/            Feature implementations shared by routes
src/components/ui/       Shared UI components
src/constants/           Theme and Paper configuration
src/lib/api/             Gateway API client
src/lib/auth/            Session, token, staff auth, and prerequisite helpers
src/lib/device/          Device helpers
app-doc/                 API bootstrap documentation
assets/                  App icons, splash, fonts, and images
```

Main routes:

- `/` starts the staff authentication flow.
- `/(tabs)/home` shows the authenticated home screen.
- `/(tabs)/attendance` handles attendance views.
- `/(tabs)/scan` provides the QR scan workflow.
- `/(tabs)/roster` shows duty roster information.
- `/(tabs)/profile` shows staff profile information.

## API

The mobile app uses the gateway at:

```text
https://hrm-gateway.fly.dev
```

Service paths are grouped under:

```text
/hrm
/attendance
```

Authenticated HRM requests send:

```http
Authorization: Bearer {accessToken}
x-tenant-id: {tenantId}
Content-Type: application/json
```

See [app-doc/mobile-app-api.md](app-doc/mobile-app-api.md) for endpoint payloads, response shapes, and session storage notes.

## Native Configuration

App configuration is in [app.json](app.json).

- iOS bundle identifier: `com.variablexsolutions.vxhrm`
- Android package: `com.variablexsolutions.vxhrm`
- Deep link scheme: `vxhrm`
- Face ID usage text is configured for attendance identity checks.
- Android biometric and fingerprint permissions are enabled.
- Image picker permissions are configured for passport photo capture and selection.

## Builds

EAS configuration is in [eas.json](eas.json).

Create an internal Android APK preview build:

```bash
npx eas-cli build --platform android --profile preview
```

Create a production build:

```bash
npx eas-cli build --platform all --profile production
```

## Notes

- Staff tokens are stored with `expo-secure-store`.
- The app uses a gateway API client in `src/lib/api/client.ts`.
- Attendance biometric sessions are cleared after the app remains backgrounded beyond the configured delay.
