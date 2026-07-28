import type { FaceDetectionInput } from './face-detection-policy';

export type FaceEnrollmentStepId = 'center' | 'left' | 'right' | 'up' | 'down';

export type FaceEnrollmentStep = {
  id: FaceEnrollmentStepId;
  label: string;
  instruction: string;
};

export const FACE_ENROLLMENT_STEPS: FaceEnrollmentStep[] = [
  {
    id: 'center',
    label: 'Center',
    instruction: 'Look straight at the camera.',
  },
  {
    id: 'left',
    label: 'Left',
    instruction: 'Slowly turn your face left.',
  },
  {
    id: 'right',
    label: 'Right',
    instruction: 'Slowly turn your face right.',
  },
  {
    id: 'up',
    label: 'Up',
    instruction: 'Tilt your face slightly up.',
  },
  {
    id: 'down',
    label: 'Down',
    instruction: 'Tilt your face slightly down.',
  },
];

const CENTER_MAX_YAW_ANGLE = 12;
const CENTER_MAX_PITCH_ANGLE = 12;
const TURN_MIN_YAW_ANGLE = 10;
const TURN_MAX_YAW_ANGLE = 28;
const TILT_MIN_PITCH_ANGLE = 8;
const TILT_MAX_PITCH_ANGLE = 24;

export type FaceEnrollmentStepResult = {
  isAccepted: boolean;
  meterLabel: string;
  meterProgress: number;
  meterStatus: 'under' | 'inRange' | 'over';
  message: string;
};

function createStepResult({
  isAccepted,
  meterLabel,
  meterProgress,
  meterStatus,
  message,
}: FaceEnrollmentStepResult): FaceEnrollmentStepResult {
  return {
    isAccepted,
    meterLabel,
    meterProgress: Math.min(Math.max(meterProgress, 0), 1),
    meterStatus,
    message,
  };
}

export function evaluateFaceForEnrollmentStep(
  face: FaceDetectionInput,
  step: FaceEnrollmentStep
): FaceEnrollmentStepResult {
  const yawAngle = face.yawAngle ?? 0;
  const pitchAngle = face.pitchAngle ?? 0;

  switch (step.id) {
    case 'center':
      if (
        Math.abs(yawAngle) <= CENTER_MAX_YAW_ANGLE &&
        Math.abs(pitchAngle) <= CENTER_MAX_PITCH_ANGLE
      ) {
        return createStepResult({
          isAccepted: true,
          meterLabel: 'Centered',
          meterProgress: 0.5,
          meterStatus: 'inRange',
          message: 'Hold still.',
        });
      }

      return createStepResult({
        isAccepted: false,
        meterLabel: 'Move to center',
        meterProgress: 0.5,
        meterStatus: 'over',
        message: step.instruction,
      });

    case 'left':
      return evaluateRangeStep({
        angle: Math.max(yawAngle, 0),
        instruction: step.instruction,
        maxAngle: TURN_MAX_YAW_ANGLE,
        minAngle: TURN_MIN_YAW_ANGLE,
      });

    case 'right':
      return evaluateRangeStep({
        angle: Math.abs(Math.min(yawAngle, 0)),
        instruction: step.instruction,
        maxAngle: TURN_MAX_YAW_ANGLE,
        minAngle: TURN_MIN_YAW_ANGLE,
      });

    case 'up':
      return evaluateRangeStep({
        angle: Math.max(pitchAngle, 0),
        instruction: step.instruction,
        maxAngle: TILT_MAX_PITCH_ANGLE,
        minAngle: TILT_MIN_PITCH_ANGLE,
      });

    case 'down':
      return evaluateRangeStep({
        angle: Math.abs(Math.min(pitchAngle, 0)),
        instruction: step.instruction,
        maxAngle: TILT_MAX_PITCH_ANGLE,
        minAngle: TILT_MIN_PITCH_ANGLE,
      });
  }
}

function evaluateRangeStep({
  angle,
  instruction,
  maxAngle,
  minAngle,
}: {
  angle: number;
  instruction: string;
  maxAngle: number;
  minAngle: number;
}): FaceEnrollmentStepResult {
  const meterProgress = angle / minAngle;

  if (angle < minAngle) {
    return createStepResult({
      isAccepted: false,
      meterLabel: 'Not enough',
      meterProgress,
      meterStatus: 'under',
      message: instruction,
    });
  }

  if (angle > maxAngle) {
    return createStepResult({
      isAccepted: false,
      meterLabel: 'Too much',
      meterProgress,
      meterStatus: 'over',
      message: 'Move back slightly.',
    });
  }

    return createStepResult({
      isAccepted: true,
      meterLabel: 'Enough',
      meterProgress,
      meterStatus: 'inRange',
      message: 'Hold still.',
  });
}
