import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import type { Face } from 'react-native-vision-camera-face-detector';

import { AppButton } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useSession } from '@/lib/auth/session-context';

import { evaluateFaceForFullFeatureCapture } from '../face-detection-policy';
import { SILENT_FACE_CAPTURE_OPTIONS } from '../face-camera-capture-options';
import {
  getLocalFaceEnrollment,
  getLocalFaceStaffIdentity,
  hasUsableLocalFaceRecognitionTemplate,
  type LocalFaceEnrollmentRecord,
} from '../face-enrollment-store';
import {
  loadFaceVerificationNativeModules,
  type FaceVerificationNativeModules,
} from '../face-native-module-loader';
import { markLocalFaceVerificationSession } from '../face-verification-session';
import {
  compareFaceEmbeddings,
  generateFaceEmbeddingFromImage,
  type FaceEmbedding,
} from '../face-recognition-service';
import { logFaceVerificationMatch } from '../face-verification-diagnostics';
import { FaceEnrollmentRequired } from './face-enrollment-required';
import {
  FACE_ENROLLMENT_FRAME_HEIGHT,
  FACE_ENROLLMENT_FRAME_RADIUS,
  FACE_ENROLLMENT_FRAME_WIDTH,
  FaceEnrollmentFrameMeter,
} from './face-enrollment-frame-meter';
import { FaceRecognitionUnavailable } from './face-recognition-unavailable';
import { FaceVerificationNativeUnavailable } from './face-verification-native-unavailable';
import { LocalFaceDetectorCamera } from './local-face-detector-camera';

const REQUIRED_STABLE_FACE_READS = 3;
const REQUIRED_MATCHED_FACE_CAPTURES = 2;
const FAILED_MATCH_RETRY_DELAY_MS = 1000;
const FINAL_MATCH_PROGRESS_DELAY_MS = 520;
const GUIDE_MESSAGE_MIN_VISIBLE_MS = 1400;
const VERIFICATION_MASK_COLOR = 'rgba(255, 255, 255, 0.78)';

type LocalFaceVerificationGateProps = {
  isActive: boolean;
  onVerified: () => void;
};

export function LocalFaceVerificationGate({
  isActive,
  onVerified,
}: LocalFaceVerificationGateProps) {
  const { session } = useSession();
  const staffIdentity = getLocalFaceStaffIdentity({
    staffIdentificationNumber: session?.staffIdentificationNumber,
    tenantId: session?.tenantId,
  });
  const [enrollmentState, setEnrollmentState] = useState<'checking' | 'enrolled' | 'missing'>(
    'checking'
  );
  const [enrollmentRecord, setEnrollmentRecord] = useState<LocalFaceEnrollmentRecord | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!staffIdentity) {
      setEnrollmentState('missing');
      return;
    }

    setEnrollmentState('checking');
    getLocalFaceEnrollment(staffIdentity)
      .then((enrollment) => {
        if (isMounted) {
          setEnrollmentState(enrollment ? 'enrolled' : 'missing');
          setEnrollmentRecord(enrollment);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEnrollmentState('missing');
          setEnrollmentRecord(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [staffIdentity]);

  if (enrollmentState === 'checking') {
    return (
      <View style={styles.permissionRoot}>
        <ActivityIndicator size={28} color={Colors.light.primary} />
        <Text style={styles.permissionTitle}>Checking face enrollment</Text>
      </View>
    );
  }

  if (!staffIdentity || enrollmentState === 'missing') {
    return <FaceEnrollmentRequired onEnrollPress={() => router.push('/face-enrollment')} />;
  }

  if (!hasUsableLocalFaceRecognitionTemplate(enrollmentRecord)) {
    return <FaceRecognitionUnavailable />;
  }

  const enrolledEmbedding = enrollmentRecord?.embedding;
  if (!enrolledEmbedding) {
    return <FaceRecognitionUnavailable />;
  }

  return (
    <LocalFaceVerificationNativeGate
      enrolledEmbedding={enrolledEmbedding}
      isActive={isActive}
      onVerified={onVerified}
      staffIdentity={staffIdentity}
    />
  );
}

type LocalFaceVerificationNativeGateProps = LocalFaceVerificationGateProps & {
  enrolledEmbedding: FaceEmbedding;
  staffIdentity: string;
};

function LocalFaceVerificationNativeGate({
  enrolledEmbedding,
  isActive,
  onVerified,
  staffIdentity,
}: LocalFaceVerificationNativeGateProps) {
  const nativeModuleResult = useMemo(() => loadFaceVerificationNativeModules(), []);

  if (!nativeModuleResult.modules) {
    return <FaceVerificationNativeUnavailable error={nativeModuleResult.error} />;
  }

  return (
    <LoadedLocalFaceVerificationGate
      enrolledEmbedding={enrolledEmbedding}
      isActive={isActive}
      nativeModules={nativeModuleResult.modules}
      onVerified={onVerified}
      staffIdentity={staffIdentity}
    />
  );
}

type LoadedLocalFaceVerificationGateProps = LocalFaceVerificationNativeGateProps & {
  nativeModules: FaceVerificationNativeModules;
};

function LoadedLocalFaceVerificationGate({
  enrolledEmbedding,
  isActive,
  nativeModules,
  onVerified,
  staffIdentity,
}: LoadedLocalFaceVerificationGateProps) {
  const device = nativeModules.useCameraDevice('front');
  const { canRequestPermission, hasPermission, requestPermission } =
    nativeModules.useCameraPermission();
  const stableFaceReadsRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const cameraRef = useRef<unknown>(null);
  const isMatchingFaceRef = useRef(false);
  const lastFailedMatchAtRef = useRef<number | null>(null);
  const matchedFaceCapturesRef = useRef(0);
  const lastAcceptedFaceRef = useRef<Face | null>(null);
  const guideMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGuideMessageUpdatedAtRef = useRef(Date.now());
  const [message, setMessage] = useState('Position your face in the frame.');
  const [visibleMessage, setVisibleMessage] = useState('Position your face in the frame.');
  const [middleRowWidth, setMiddleRowWidth] = useState(0);
  const [matchProgress, setMatchProgress] = useState(0);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const faceDetectionOptions = useMemo(
    () => ({
      cameraFacing: 'front' as const,
      classificationMode: 'all' as const,
      contourMode: 'none' as const,
      landmarkMode: 'all' as const,
      minFaceSize: 0.18,
      performanceMode: 'fast' as const,
      trackingEnabled: false,
    }),
    []
  );

  useEffect(() => {
    if (hasPermission || !canRequestPermission) {
      return;
    }

    setIsRequestingPermission(true);
    requestPermission().finally(() => setIsRequestingPermission(false));
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    if (message === visibleMessage) {
      return;
    }

    if (guideMessageTimeoutRef.current) {
      clearTimeout(guideMessageTimeoutRef.current);
      guideMessageTimeoutRef.current = null;
    }

    const elapsedMs = Date.now() - lastGuideMessageUpdatedAtRef.current;
    const updateDelayMs = Math.max(GUIDE_MESSAGE_MIN_VISIBLE_MS - elapsedMs, 0);

    guideMessageTimeoutRef.current = setTimeout(() => {
      setVisibleMessage(message);
      lastGuideMessageUpdatedAtRef.current = Date.now();
      guideMessageTimeoutRef.current = null;
    }, updateDelayMs);

    return () => {
      if (guideMessageTimeoutRef.current) {
        clearTimeout(guideMessageTimeoutRef.current);
        guideMessageTimeoutRef.current = null;
      }
    };
  }, [message, visibleMessage]);

  const handleFacesDetected = useCallback((faces: Face[]) => {
    if (hasCompletedRef.current || isMatchingFaceRef.current) {
      return;
    }

    if (
      lastFailedMatchAtRef.current &&
      Date.now() - lastFailedMatchAtRef.current < FAILED_MATCH_RETRY_DELAY_MS
    ) {
      return;
    }

    const result = evaluateFaceForFullFeatureCapture(faces);
    setMessage(result.message);

    if (!result.isAccepted) {
      stableFaceReadsRef.current = 0;
      return;
    }

    stableFaceReadsRef.current += 1;
    if (stableFaceReadsRef.current < REQUIRED_STABLE_FACE_READS) {
      return;
    }

    lastAcceptedFaceRef.current = faces[0];
    isMatchingFaceRef.current = true;
    setMessage('Matching face.');

    const camera = cameraRef.current as null | {
      takePhoto: (options?: typeof SILENT_FACE_CAPTURE_OPTIONS) => Promise<{ path: string }>;
    };

    if (!camera) {
      stableFaceReadsRef.current = 0;
      isMatchingFaceRef.current = false;
      setMessage('Camera is not ready yet.');
      return;
    }

    (async () => {
      try {
        const photo = await camera.takePhoto(SILENT_FACE_CAPTURE_OPTIONS);
        const imageUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
        const liveEmbedding = await generateFaceEmbeddingFromImage(imageUri);
        const match = compareFaceEmbeddings(enrolledEmbedding, liveEmbedding);
        logFaceVerificationMatch({
          enrolledEmbedding,
          face: lastAcceptedFaceRef.current ?? undefined,
          liveEmbedding,
          match,
          matchedCaptureCount: matchedFaceCapturesRef.current,
        });
        if (!match.isMatch) {
          stableFaceReadsRef.current = 0;
          matchedFaceCapturesRef.current = 0;
          setMatchProgress(0);
          lastFailedMatchAtRef.current = Date.now();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
            () => undefined
          );
          setMessage('Position your face in the frame.');
          return;
        }

        matchedFaceCapturesRef.current += 1;
        setMatchProgress(matchedFaceCapturesRef.current / REQUIRED_MATCHED_FACE_CAPTURES);
        if (matchedFaceCapturesRef.current < REQUIRED_MATCHED_FACE_CAPTURES) {
          stableFaceReadsRef.current = 0;
          setMessage('Matched. Hold still for one more check.');
          return;
        }

        hasCompletedRef.current = true;
        lastFailedMatchAtRef.current = null;
        setMessage('Verified.');
        await new Promise((resolve) => setTimeout(resolve, FINAL_MATCH_PROGRESS_DELAY_MS));
        markLocalFaceVerificationSession(staffIdentity);
        onVerified();
      } catch {
        stableFaceReadsRef.current = 0;
        lastFailedMatchAtRef.current = Date.now();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        setMessage('Position your face in the frame.');
      } finally {
        isMatchingFaceRef.current = false;
      }
    })();
  }, [enrolledEmbedding, onVerified, staffIdentity]);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      await requestPermission();
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleMiddleRowLayout = useCallback((event: LayoutChangeEvent) => {
    setMiddleRowWidth(event.nativeEvent.layout.width);
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.permissionRoot}>
        <View style={styles.permissionIcon}>
          <Icon source="face-recognition" size={42} color={Colors.light.primary} />
        </View>
        <Text style={styles.permissionTitle}>Face verification required</Text>
        <Text style={styles.permissionText}>
          Allow camera access so we can verify your face before scanning the attendance QR code.
        </Text>
        <AppButton
          icon="camera-outline"
          loading={isRequestingPermission}
          disabled={isRequestingPermission || !canRequestPermission}
          onPress={handleRequestPermission}>
          Allow camera access
        </AppButton>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permissionRoot}>
        <View style={styles.permissionIcon}>
          <Icon source="camera-off" size={42} color={Colors.light.danger} />
        </View>
        <Text style={styles.permissionTitle}>Front camera unavailable</Text>
        <Text style={styles.permissionText}>
          A front camera is required for local face verification.
        </Text>
      </View>
    );
  }

  const middleMaskPath =
    middleRowWidth > 0
      ? createRoundedCutoutPath({
          height: FACE_ENROLLMENT_FRAME_HEIGHT,
          radius: FACE_ENROLLMENT_FRAME_RADIUS,
          width: middleRowWidth,
          x: (middleRowWidth - FACE_ENROLLMENT_FRAME_WIDTH) / 2,
          y: 0,
        })
      : '';

  return (
    <View style={styles.root}>
      <LocalFaceDetectorCamera
        cameraRef={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        nativeModules={nativeModules}
        onFacesDetected={handleFacesDetected}
        options={faceDetectionOptions}
        photo
          onError={() => {
          stableFaceReadsRef.current = 0;
          setMessage('Could not start face verification.');
          setMatchProgress(0);
        }}
      />

      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.topMask}>
          <Text style={styles.statusText}>Confirming Identity</Text>
          <Text style={styles.guideText}>{visibleMessage}</Text>
        </View>
        <View style={styles.middleRow} onLayout={handleMiddleRowLayout}>
          {middleMaskPath && (
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              viewBox={`0 0 ${middleRowWidth} ${FACE_ENROLLMENT_FRAME_HEIGHT}`}>
              <Path d={middleMaskPath} fill={VERIFICATION_MASK_COLOR} fillRule="evenodd" />
            </Svg>
          )}
          <View style={styles.faceGuide}>
            <FaceEnrollmentFrameMeter
              progress={matchProgress}
              status={matchProgress >= 1 ? 'inRange' : 'under'}
            />
          </View>
        </View>
        <View style={styles.bottomMask}>
          <Text style={styles.bottomText}>
            {isMatchingFaceRef.current ? 'Matching' : 'Hold steady'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function createRoundedCutoutPath({
  height,
  radius,
  width,
  x,
  y,
}: {
  height: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}) {
  const right = x + FACE_ENROLLMENT_FRAME_WIDTH;
  const bottom = y + FACE_ENROLLMENT_FRAME_HEIGHT;

  return [
    `M 0 0 H ${width} V ${height} H 0 Z`,
    `M ${x + radius} ${y}`,
    `H ${right - radius}`,
    `A ${radius} ${radius} 0 0 1 ${right} ${y + radius}`,
    `V ${bottom - radius}`,
    `A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
    `H ${x + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x} ${bottom - radius}`,
    `V ${y + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    'Z',
  ].join(' ');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.light.appBgLight,
    paddingHorizontal: Spacing.four,
  },
  permissionIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  permissionTitle: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionText: {
    ...Typography.base,
    maxWidth: 320,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  topMask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: VERIFICATION_MASK_COLOR,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  middleRow: {
    height: FACE_ENROLLMENT_FRAME_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  bottomMask: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: VERIFICATION_MASK_COLOR,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  faceGuide: {
    width: FACE_ENROLLMENT_FRAME_WIDTH,
    height: FACE_ENROLLMENT_FRAME_HEIGHT,
    position: 'relative',
    borderRadius: FACE_ENROLLMENT_FRAME_RADIUS,
  },
  statusText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  guideText: {
    fontSize: 28,
    lineHeight: 34,
    maxWidth: 330,
    color: Colors.light.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  bottomText: {
    ...Typography.md,
    color: Colors.light.textSecondary,
    fontWeight: '800',
    textAlign: 'center',
  },
});
