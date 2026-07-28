import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { Face } from 'react-native-vision-camera-face-detector';

import { AppButton } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useSession } from '@/lib/auth/session-context';

import { evaluateFaceForFullFeatureCapture } from '../face-detection-policy';
import {
  evaluateFaceForEnrollmentStep,
  FACE_ENROLLMENT_STEPS,
  type FaceEnrollmentStepResult,
} from '../face-enrollment-policy';
import { SILENT_FACE_CAPTURE_OPTIONS } from '../face-camera-capture-options';
import {
  getLocalFaceStaffIdentity,
  saveLocalFaceEnrollment,
} from '../face-enrollment-store';
import {
  loadFaceVerificationNativeModules,
  type FaceVerificationNativeModules,
} from '../face-native-module-loader';
import { clearLocalFaceVerificationSession } from '../face-verification-session';
import {
  averageFaceEmbeddings,
  generateFaceEmbeddingFromImage,
  type FaceEmbedding,
} from '../face-recognition-service';
import {
  logFaceEnrollmentCapture,
  logFaceEnrollmentSaved,
} from '../face-verification-diagnostics';
import {
  FACE_ENROLLMENT_FRAME_HEIGHT,
  FACE_ENROLLMENT_FRAME_RADIUS,
  FACE_ENROLLMENT_FRAME_WIDTH,
  FaceEnrollmentFrameMeter,
} from './face-enrollment-frame-meter';
import { FaceVerificationNativeUnavailable } from './face-verification-native-unavailable';
import { LocalFaceDetectorCamera } from './local-face-detector-camera';

const REQUIRED_STABLE_READS_PER_STEP = 3;
const LOCAL_FACE_TEMPLATE_VERSION = 1;
const LOCAL_FACE_EMBEDDING_MODEL = 'facenet-onnx-160';
const ENROLLMENT_COUNTDOWN_SECONDS = 3;
const STEP_INSTRUCTION_COUNTDOWN_SECONDS = 3;
const STEP_INSTRUCTION_FADE_MS = 220;
const GUIDE_MESSAGE_MIN_VISIBLE_MS = 1400;
const STEP_ACCEPTED_VISUAL_DELAY_MS = 420;
const MIDDLE_MASK_COLOR = 'rgba(255, 255, 255, 0.78)';

export function LocalFaceEnrollment() {
  const nativeModuleResult = useMemo(() => loadFaceVerificationNativeModules(), []);

  if (!nativeModuleResult.modules) {
    return <FaceVerificationNativeUnavailable error={nativeModuleResult.error} />;
  }

  return <LoadedLocalFaceEnrollment nativeModules={nativeModuleResult.modules} />;
}

type LoadedLocalFaceEnrollmentProps = {
  nativeModules: FaceVerificationNativeModules;
};

function LoadedLocalFaceEnrollment({ nativeModules }: LoadedLocalFaceEnrollmentProps) {
  const { session } = useSession();
  const staffIdentity = getLocalFaceStaffIdentity({
    staffIdentificationNumber: session?.staffIdentificationNumber,
    tenantId: session?.tenantId,
  });
  const device = nativeModules.useCameraDevice('front');
  const { canRequestPermission, hasPermission, requestPermission } =
    nativeModules.useCameraPermission();
  const stableFaceReadsRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const cameraRef = useRef<unknown>(null);
  const capturedEmbeddingsRef = useRef<FaceEmbedding[]>([]);
  const isCapturingEmbeddingRef = useRef(false);
  const isCompletingStepRef = useRef(false);
  const lastAcceptedFaceRef = useRef<Face | null>(null);
  const stepInstructionExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGuideMessageUpdatedAtRef = useRef(Date.now());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [countdown, setCountdown] = useState(ENROLLMENT_COUNTDOWN_SECONDS);
  const [stepInstructionIndex, setStepInstructionIndex] = useState<number | null>(0);
  const [stepInstructionCountdown, setStepInstructionCountdown] = useState(
    STEP_INSTRUCTION_COUNTDOWN_SECONDS
  );
  const [message, setMessage] = useState(FACE_ENROLLMENT_STEPS[0].instruction);
  const [visibleMessage, setVisibleMessage] = useState(FACE_ENROLLMENT_STEPS[0].instruction);
  const [middleRowWidth, setMiddleRowWidth] = useState(0);
  const [stepMeter, setStepMeter] = useState<FaceEnrollmentStepResult>({
    isAccepted: false,
    meterLabel: 'Start',
    meterProgress: 0,
    meterStatus: 'under',
    message: FACE_ENROLLMENT_STEPS[0].instruction,
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const stepInstructionOpacity = useSharedValue(0);
  const stepInstructionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stepInstructionOpacity.value,
  }));
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
    if (!hasPermission || !device || isSaving || saveError || countdown <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [countdown, device, hasPermission, isSaving, saveError]);

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

  useEffect(() => {
    if (countdown > 0 || stepInstructionIndex === null) {
      return;
    }

    if (stepInstructionExitTimeoutRef.current) {
      clearTimeout(stepInstructionExitTimeoutRef.current);
      stepInstructionExitTimeoutRef.current = null;
    }

    stepInstructionOpacity.value = 0;
    stepInstructionOpacity.value = withTiming(1, {
      duration: STEP_INSTRUCTION_FADE_MS,
    });
  }, [countdown, stepInstructionIndex, stepInstructionOpacity]);

  useEffect(() => {
    if (
      !hasPermission ||
      !device ||
      isSaving ||
      saveError ||
      countdown > 0 ||
      stepInstructionIndex === null
    ) {
      return;
    }

    stableFaceReadsRef.current = 0;
    const timeout = setTimeout(() => {
      if (stepInstructionCountdown <= 1) {
        stepInstructionOpacity.value = withTiming(0, {
          duration: STEP_INSTRUCTION_FADE_MS,
        });

        stepInstructionExitTimeoutRef.current = setTimeout(() => {
          setStepInstructionIndex(null);
          setStepInstructionCountdown(STEP_INSTRUCTION_COUNTDOWN_SECONDS);
          stepInstructionExitTimeoutRef.current = null;
        }, STEP_INSTRUCTION_FADE_MS);
        return;
      }

      setStepInstructionCountdown((current) => current - 1);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      if (stepInstructionExitTimeoutRef.current) {
        clearTimeout(stepInstructionExitTimeoutRef.current);
        stepInstructionExitTimeoutRef.current = null;
      }
    };
  }, [
    countdown,
    device,
    hasPermission,
    isSaving,
    saveError,
    stepInstructionCountdown,
    stepInstructionIndex,
    stepInstructionOpacity,
  ]);

  const completeEnrollment = useCallback(async (embedding: FaceEmbedding) => {
    if (!staffIdentity || hasCompletedRef.current) {
      return;
    }

    hasCompletedRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveLocalFaceEnrollment({
        embedding,
        embeddingModel: LOCAL_FACE_EMBEDDING_MODEL,
        enrolledAt: new Date().toISOString(),
        hasRecognitionTemplate: true,
        recognitionMode: 'embedding',
        staffIdentity,
        templateVersion: LOCAL_FACE_TEMPLATE_VERSION,
      });
    } catch {
      hasCompletedRef.current = false;
      stableFaceReadsRef.current = 0;
      setSaveError('Could not save face enrollment. Try again.');
      setMessage('Could not save face enrollment.');
      return;
    } finally {
      setIsSaving(false);
    }

    clearLocalFaceVerificationSession();
    Alert.alert('Face enrolled', 'Your face has been enrolled on this device.', [
      {
        text: 'Continue',
        onPress: () => router.replace('/scan'),
      },
    ]);
  }, [staffIdentity]);

  const captureCurrentStepEmbedding = useCallback(async () => {
    if (isCapturingEmbeddingRef.current) {
      return;
    }

    const camera = cameraRef.current as null | {
      takePhoto: (options?: typeof SILENT_FACE_CAPTURE_OPTIONS) => Promise<{ path: string }>;
    };

    if (!camera) {
      stableFaceReadsRef.current = 0;
      setMessage('Camera is not ready yet.');
      return;
    }

    isCapturingEmbeddingRef.current = true;
    setMessage('Capturing face template.');

    try {
      const photo = await camera.takePhoto(SILENT_FACE_CAPTURE_OPTIONS);
      const imageUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      const embedding = await generateFaceEmbeddingFromImage(imageUri);
      capturedEmbeddingsRef.current = [...capturedEmbeddingsRef.current, embedding];
      logFaceEnrollmentCapture({
        captureIndex: capturedEmbeddingsRef.current.length,
        embedding,
        face: lastAcceptedFaceRef.current ?? undefined,
        stepLabel: FACE_ENROLLMENT_STEPS[currentStepIndex].label,
      });

      if (currentStepIndex < FACE_ENROLLMENT_STEPS.length - 1) {
        const nextStep = FACE_ENROLLMENT_STEPS[currentStepIndex + 1];
        setCurrentStepIndex((current) => current + 1);
        setStepInstructionIndex(currentStepIndex + 1);
        setStepInstructionCountdown(STEP_INSTRUCTION_COUNTDOWN_SECONDS);
        setMessage(nextStep.instruction);
        setStepMeter({
          isAccepted: false,
          meterLabel: 'Next',
          meterProgress: 0,
          meterStatus: 'under',
          message: nextStep.instruction,
        });
        return;
      }

      const averagedEmbedding = averageFaceEmbeddings(capturedEmbeddingsRef.current);
      logFaceEnrollmentSaved({
        captureCount: capturedEmbeddingsRef.current.length,
        embedding: averagedEmbedding,
      });
      setMessage('Face enrollment complete.');
      await completeEnrollment(averagedEmbedding);
    } catch {
      stableFaceReadsRef.current = 0;
      setMessage('Could not capture face template. Try again.');
    } finally {
      isCapturingEmbeddingRef.current = false;
    }
  }, [completeEnrollment, currentStepIndex]);

  const handleFacesDetected = useCallback(
    (faces: Face[]) => {
      if (
        hasCompletedRef.current ||
        isCapturingEmbeddingRef.current ||
        isCompletingStepRef.current ||
        isSaving ||
        saveError ||
        countdown > 0 ||
        stepInstructionIndex !== null
      ) {
        return;
      }

      const readinessResult = evaluateFaceForFullFeatureCapture(faces);

      if (!readinessResult.isAccepted) {
        stableFaceReadsRef.current = 0;
        setMessage(readinessResult.message);
        setStepMeter((current) => ({
          ...current,
          isAccepted: false,
          meterLabel: 'Adjust',
          meterProgress: 0,
          meterStatus: 'under',
          message: readinessResult.message,
        }));
        return;
      }

      const step = FACE_ENROLLMENT_STEPS[currentStepIndex];
      const stepResult = evaluateFaceForEnrollmentStep(faces[0], step);
      setStepMeter(stepResult);
      setMessage(stepResult.message);

      if (!stepResult.isAccepted) {
        stableFaceReadsRef.current = 0;
        return;
      }

      stableFaceReadsRef.current += 1;
      if (stableFaceReadsRef.current < REQUIRED_STABLE_READS_PER_STEP) {
        setMessage('Hold still.');
        return;
      }

      stableFaceReadsRef.current = 0;
      lastAcceptedFaceRef.current = faces[0];
      isCompletingStepRef.current = true;
      setStepMeter({
        ...stepResult,
        meterLabel: 'Enough',
        meterProgress: 1,
        meterStatus: 'inRange',
      });

      setTimeout(() => {
        void captureCurrentStepEmbedding().finally(() => {
          isCompletingStepRef.current = false;
        });
      }, STEP_ACCEPTED_VISUAL_DELAY_MS);
    },
    [
      captureCurrentStepEmbedding,
      countdown,
      currentStepIndex,
      isSaving,
      saveError,
      stepInstructionIndex,
    ]
  );

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      await requestPermission();
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleRetrySave = () => {
    stableFaceReadsRef.current = 0;
    hasCompletedRef.current = false;
    capturedEmbeddingsRef.current = [];
    isCapturingEmbeddingRef.current = false;
    isCompletingStepRef.current = false;
    lastAcceptedFaceRef.current = null;
    setCurrentStepIndex(0);
    setCountdown(ENROLLMENT_COUNTDOWN_SECONDS);
    setStepInstructionIndex(0);
    setStepInstructionCountdown(STEP_INSTRUCTION_COUNTDOWN_SECONDS);
    setSaveError(null);
    setMessage(FACE_ENROLLMENT_STEPS[0].instruction);
    setVisibleMessage(FACE_ENROLLMENT_STEPS[0].instruction);
    lastGuideMessageUpdatedAtRef.current = Date.now();
    setStepMeter({
      isAccepted: false,
      meterLabel: 'Start',
      meterProgress: 0,
      meterStatus: 'under',
      message: FACE_ENROLLMENT_STEPS[0].instruction,
    });
  };

  const handleMiddleRowLayout = useCallback((event: LayoutChangeEvent) => {
    setMiddleRowWidth(event.nativeEvent.layout.width);
  }, []);

  if (!staffIdentity) {
    return (
      <View style={styles.centerRoot}>
        <View style={styles.iconWrap}>
          <Icon source="account-alert-outline" size={42} color={Colors.light.danger} />
        </View>
        <Text style={styles.title}>Staff session unavailable</Text>
        <Text style={styles.text}>Sign in again before enrolling face verification.</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centerRoot}>
        <View style={styles.iconWrap}>
          <Icon source="camera-outline" size={42} color={Colors.light.primary} />
        </View>
        <Text style={styles.title}>Camera access required</Text>
        <Text style={styles.text}>Allow camera access to enroll face verification.</Text>
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
      <View style={styles.centerRoot}>
        <View style={styles.iconWrap}>
          <Icon source="camera-off" size={42} color={Colors.light.danger} />
        </View>
        <Text style={styles.title}>Front camera unavailable</Text>
        <Text style={styles.text}>A front camera is required to enroll face verification.</Text>
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
    <View style={styles.cameraRoot}>
      <LocalFaceDetectorCamera
        cameraRef={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!isSaving}
        nativeModules={nativeModules}
        onFacesDetected={handleFacesDetected}
        options={faceDetectionOptions}
        photo
        onError={() => {
          stableFaceReadsRef.current = 0;
          setMessage('Could not start face enrollment.');
        }}
      />

      <View style={StyleSheet.absoluteFillObject}>
        <View style={styles.topMask}>
          <Text style={styles.stepLabel}>
            Step {currentStepIndex + 1} of {FACE_ENROLLMENT_STEPS.length} - {FACE_ENROLLMENT_STEPS[currentStepIndex].label}
          </Text>
          <Text style={styles.guideText}>{visibleMessage}</Text>
        </View>
        <View style={styles.middleRow} onLayout={handleMiddleRowLayout}>
          {middleMaskPath && (
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              viewBox={`0 0 ${middleRowWidth} ${FACE_ENROLLMENT_FRAME_HEIGHT}`}>
              <Path d={middleMaskPath} fill={MIDDLE_MASK_COLOR} fillRule="evenodd" />
            </Svg>
          )}
          <View style={styles.faceGuide}>
            <FaceEnrollmentFrameMeter
              progress={stepMeter.isAccepted ? 1 : stepMeter.meterProgress}
              status={stepMeter.meterStatus}
            />
          </View>
        </View>
        <View style={styles.bottomMask}>
          <Text
            style={[
              styles.poseMeterValue,
              stepMeter.meterStatus === 'under' ? styles.poseMeterValueUnder : null,
              stepMeter.meterStatus === 'inRange' ? styles.poseMeterValueInRange : null,
              stepMeter.meterStatus === 'over' ? styles.poseMeterValueOver : null,
            ]}>
            {stepMeter.meterLabel}
          </Text>
          {saveError && (
            <AppButton
              variant="outline"
              icon="refresh"
              textColor={Colors.light.primary}
              style={styles.retryButton}
              labelStyle={styles.retryButtonLabel}
              onPress={handleRetrySave}>
              Try again
            </AppButton>
          )}
        </View>
      </View>

      {countdown > 0 && !saveError && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownText}>Get ready</Text>
        </View>
      )}
      {countdown <= 0 && stepInstructionIndex !== null && !saveError && (
        <Animated.View style={[styles.stepInstructionOverlay, stepInstructionAnimatedStyle]}>
          <Text style={styles.stepInstructionTitle}>
            {FACE_ENROLLMENT_STEPS[stepInstructionIndex].instruction}
          </Text>
          <Text style={styles.stepInstructionText}>{stepInstructionCountdown}</Text>
        </Animated.View>
      )}
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
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.light.appBgLight,
    paddingHorizontal: Spacing.four,
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  title: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
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
    backgroundColor: MIDDLE_MASK_COLOR,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  middleRow: {
    height: FACE_ENROLLMENT_FRAME_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  faceGuide: {
    width: FACE_ENROLLMENT_FRAME_WIDTH,
    height: FACE_ENROLLMENT_FRAME_HEIGHT,
    position: 'relative',
    borderRadius: FACE_ENROLLMENT_FRAME_RADIUS,
  },
  bottomMask: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: MIDDLE_MASK_COLOR,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  guideText: {
    fontSize: 28,
    lineHeight: 34,
    maxWidth: 330,
    color: Colors.light.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepLabel: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  poseMeterValue: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '800',
  },
  poseMeterValueUnder: {
    color: Colors.light.warning,
  },
  poseMeterValueInRange: {
    color: Colors.light.success,
  },
  poseMeterValueOver: {
    color: Colors.light.danger,
  },
  retryButton: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.surface,
  },
  retryButtonLabel: {
    color: Colors.light.primary,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  countdownNumber: {
    fontSize: 96,
    lineHeight: 108,
    color: Colors.light.text,
    fontWeight: '800',
  },
  countdownText: {
    ...Typography.md,
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  stepInstructionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: Spacing.five,
  },
  stepInstructionTitle: {
    fontSize: 30,
    lineHeight: 36,
    color: Colors.light.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepInstructionText: {
    fontSize: 44,
    lineHeight: 52,
    marginTop: Spacing.two,
    color: Colors.light.textSecondary,
    fontWeight: '800',
  },
});
