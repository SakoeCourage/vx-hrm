import { useEffect, useMemo, type RefObject } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import type {
  Face,
  FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';

import type { FaceVerificationNativeModules } from '../face-native-module-loader';

const FACE_DETECTION_TARGET_FPS = 8;

type LocalFaceDetectorCameraProps = {
  cameraRef?: RefObject<unknown>;
  device: CameraDevice;
  isActive: boolean;
  nativeModules: FaceVerificationNativeModules;
  onFacesDetected: (faces: Face[]) => void;
  onError: () => void;
  options: FrameFaceDetectionOptions;
  photo?: boolean;
  style: StyleProp<ViewStyle>;
};

export function LocalFaceDetectorCamera({
  cameraRef,
  device,
  isActive,
  nativeModules,
  onFacesDetected,
  onError,
  options,
  photo,
  style,
}: LocalFaceDetectorCameraProps) {
  const Camera = nativeModules.Camera;
  const { runAtTargetFps, useFaceDetector, useFrameProcessor, Worklets } = nativeModules;
  const { detectFaces, stopListeners } = useFaceDetector(options);
  const runOnFacesDetected = useMemo(
    () => Worklets.createRunOnJS(onFacesDetected),
    [Worklets, onFacesDetected]
  );

  useEffect(() => stopListeners, [stopListeners]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(FACE_DETECTION_TARGET_FPS, () => {
        'worklet';
        const faces = detectFaces(frame).map((face) => ({
          ...face,
          frameHeight: frame.height,
          frameWidth: frame.width,
        }));
        runOnFacesDetected(faces);
      });
    },
    [detectFaces, runAtTargetFps, runOnFacesDetected]
  );

  return (
    <Camera
      ref={cameraRef}
      style={style}
      device={device}
      isActive={isActive}
      frameProcessor={frameProcessor}
      pixelFormat="yuv"
      photo={photo}
      onError={onError}
    />
  );
}
