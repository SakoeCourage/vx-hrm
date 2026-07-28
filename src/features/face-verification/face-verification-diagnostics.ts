import type { FaceDetectionInput } from './face-detection-policy';
import type { FaceEmbedding, FaceRecognitionMatch } from './face-recognition-service';
import { summarizeFaceEmbedding } from './face-recognition-service';

const LOG_PREFIX = '[FaceVerification]';

export function logFaceEnrollmentCapture({
  captureIndex,
  embedding,
  face,
  stepLabel,
}: {
  captureIndex: number;
  embedding: FaceEmbedding;
  face?: FaceDetectionInput;
  stepLabel: string;
}) {
  if (!__DEV__) {
    return;
  }

  console.log(LOG_PREFIX, 'enrollment_capture', {
    captureIndex,
    embedding: summarizeFaceEmbedding(embedding),
    face: summarizeFaceForDiagnostics(face),
    stepLabel,
  });
}

export function logFaceEnrollmentSaved({
  captureCount,
  embedding,
}: {
  captureCount: number;
  embedding: FaceEmbedding;
}) {
  if (!__DEV__) {
    return;
  }

  console.log(LOG_PREFIX, 'enrollment_saved', {
    captureCount,
    embedding: summarizeFaceEmbedding(embedding),
  });
}

export function logFaceVerificationMatch({
  enrolledEmbedding,
  face,
  liveEmbedding,
  match,
  matchedCaptureCount,
}: {
  enrolledEmbedding: FaceEmbedding;
  face?: FaceDetectionInput;
  liveEmbedding: FaceEmbedding;
  match: FaceRecognitionMatch;
  matchedCaptureCount: number;
}) {
  if (!__DEV__) {
    return;
  }

  console.log(LOG_PREFIX, 'verification_match', {
    enrolledEmbedding: summarizeFaceEmbedding(enrolledEmbedding),
    face: summarizeFaceForDiagnostics(face),
    liveEmbedding: summarizeFaceEmbedding(liveEmbedding),
    matchedCaptureCount,
    similarityPercent: Number((match.similarity * 100).toFixed(2)),
    thresholdPercent: Number((match.threshold * 100).toFixed(2)),
    passed: match.isMatch,
  });
}

function summarizeFaceForDiagnostics(face?: FaceDetectionInput) {
  if (!face) {
    return null;
  }

  const frameWidth = face.frameWidth ?? 0;
  const frameHeight = face.frameHeight ?? 0;
  const minFrameSide = Math.min(frameWidth, frameHeight);
  const minFaceSide = Math.min(face.bounds.width, face.bounds.height);
  const landmarks = face.landmarks;

  return {
    bounds: face.bounds,
    faceFrameRatio:
      minFrameSide > 0 ? Number((minFaceSide / minFrameSide).toFixed(4)) : null,
    frameHeight,
    frameWidth,
    landmarks: {
      leftEye: Boolean(landmarks?.LEFT_EYE),
      mouthBottom: Boolean(landmarks?.MOUTH_BOTTOM),
      mouthLeft: Boolean(landmarks?.MOUTH_LEFT),
      mouthRight: Boolean(landmarks?.MOUTH_RIGHT),
      noseBase: Boolean(landmarks?.NOSE_BASE),
      rightEye: Boolean(landmarks?.RIGHT_EYE),
    },
    pitchAngle: face.pitchAngle,
    rollAngle: face.rollAngle,
    yawAngle: face.yawAngle,
  };
}
