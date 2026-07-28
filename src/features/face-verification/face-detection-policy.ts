type FaceBounds = {
  width: number;
  height: number;
};

type FacePoint = {
  x: number;
  y: number;
};

type FaceLandmarks = {
  LEFT_EYE?: FacePoint;
  MOUTH_BOTTOM?: FacePoint;
  MOUTH_LEFT?: FacePoint;
  MOUTH_RIGHT?: FacePoint;
  NOSE_BASE?: FacePoint;
  RIGHT_EYE?: FacePoint;
};

export type FaceDetectionInput = {
  bounds: FaceBounds;
  frameWidth?: number;
  frameHeight?: number;
  landmarks?: FaceLandmarks;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  pitchAngle?: number;
  rollAngle?: number;
  yawAngle?: number;
};

export type FaceDetectionPolicyResult = {
  isAccepted: boolean;
  message: string;
};

const MIN_FACE_FRAME_RATIO = 0.22;
const MAX_FACE_FRAME_RATIO = 0.72;
const MAX_YAW_ANGLE = 12;
const MAX_PITCH_ANGLE = 18;
const MAX_ROLL_ANGLE = 10;
const MIN_EYE_OPEN_PROBABILITY = 0.2;

export function evaluateFaceForAttendance(faces: FaceDetectionInput[]): FaceDetectionPolicyResult {
  if (faces.length === 0) {
    return {
      isAccepted: false,
      message: 'Position your face in the frame.',
    };
  }

  if (faces.length > 1) {
    return {
      isAccepted: false,
      message: 'Only one face should be visible.',
    };
  }

  const face = faces[0];
  const frameWidth = face.frameWidth || 0;
  const frameHeight = face.frameHeight || 0;
  const minFrameSide = Math.min(frameWidth, frameHeight);
  const minFaceSide = Math.min(face.bounds.width, face.bounds.height);

  if (minFrameSide > 0 && minFaceSide / minFrameSide < MIN_FACE_FRAME_RATIO) {
    return {
      isAccepted: false,
      message: 'Move a little closer.',
    };
  }

  if (minFrameSide > 0 && minFaceSide / minFrameSide > MAX_FACE_FRAME_RATIO) {
    return {
      isAccepted: false,
      message: 'Move back slightly.',
    };
  }

  if (Math.abs(face.yawAngle ?? 0) > MAX_YAW_ANGLE) {
    return {
      isAccepted: false,
      message: 'Face the camera directly.',
    };
  }

  if (Math.abs(face.pitchAngle ?? 0) > MAX_PITCH_ANGLE) {
    return {
      isAccepted: false,
      message: 'Keep your head level.',
    };
  }

  if (Math.abs(face.rollAngle ?? 0) > MAX_ROLL_ANGLE) {
    return {
      isAccepted: false,
      message: 'Straighten your head.',
    };
  }

  if (
    isEyeProbabilityClosed(face.leftEyeOpenProbability) &&
    isEyeProbabilityClosed(face.rightEyeOpenProbability)
  ) {
    return {
      isAccepted: false,
      message: 'Keep your eyes open.',
    };
  }

  return {
    isAccepted: true,
    message: 'Hold still.',
  };
}

export function evaluateFaceForFullFeatureCapture(
  faces: FaceDetectionInput[]
): FaceDetectionPolicyResult {
  const result = evaluateFaceForAttendance(faces);

  if (!result.isAccepted) {
    return result;
  }

  const landmarks = faces[0]?.landmarks;

  if (
    !landmarks?.LEFT_EYE ||
    !landmarks.RIGHT_EYE ||
    !landmarks.NOSE_BASE ||
    !landmarks.MOUTH_LEFT ||
    !landmarks.MOUTH_RIGHT ||
    !landmarks.MOUTH_BOTTOM
  ) {
    return {
      isAccepted: false,
      message: 'Show your full face: eyes, nose, and mouth.',
    };
  }

  return result;
}

function isEyeProbabilityClosed(value?: number) {
  return typeof value === 'number' && value < MIN_EYE_OPEN_PROBABILITY;
}
