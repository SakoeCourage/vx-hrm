import type { ComponentType, RefObject } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  CameraDevice,
  CameraPosition,
  Frame,
  ReadonlyFrameProcessor,
} from 'react-native-vision-camera';
import type {
  Face,
  FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';

declare const require: (moduleName: string) => unknown;

type CameraPermissionState = {
  canRequestPermission: boolean;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

type FaceDetectorCameraProps = {
  device: CameraDevice;
  frameProcessor?: ReadonlyFrameProcessor;
  isActive: boolean;
  onError?: () => void;
  pixelFormat?: 'rgb' | 'yuv' | 'native' | 'unknown';
  photo?: boolean;
  ref?: RefObject<unknown>;
  style?: StyleProp<ViewStyle>;
};

type FaceDetectorPlugin = {
  detectFaces: (frame: Frame) => Face[];
  stopListeners: () => void;
};

type WorkletsApi = {
  createRunOnJS: <TArgs extends unknown[], TReturn>(
    func: (...args: TArgs) => TReturn
  ) => (...args: TArgs) => Promise<TReturn>;
};

export type FaceVerificationNativeModules = {
  Camera: ComponentType<FaceDetectorCameraProps>;
  runAtTargetFps: <T>(fps: number, func: () => T) => T | undefined;
  useFaceDetector: (options?: FrameFaceDetectionOptions) => FaceDetectorPlugin;
  useCameraDevice: (position: CameraPosition) => CameraDevice | undefined;
  useCameraPermission: () => CameraPermissionState;
  useFrameProcessor: (
    frameProcessor: (frame: Frame) => void,
    dependencies: readonly unknown[]
  ) => ReadonlyFrameProcessor;
  Worklets: WorkletsApi;
};

type FaceVerificationNativeModuleResult =
  | {
      error: Error;
      modules: null;
    }
  | {
      error: null;
      modules: FaceVerificationNativeModules;
    };

export function loadFaceVerificationNativeModules(): FaceVerificationNativeModuleResult {
  try {
    const visionCamera = require('react-native-vision-camera') as {
      Camera: FaceVerificationNativeModules['Camera'];
      runAtTargetFps: FaceVerificationNativeModules['runAtTargetFps'];
      useCameraDevice: FaceVerificationNativeModules['useCameraDevice'];
      useCameraPermission: FaceVerificationNativeModules['useCameraPermission'];
      useFrameProcessor: FaceVerificationNativeModules['useFrameProcessor'];
    };
    const faceDetector = require('react-native-vision-camera-face-detector/src/FaceDetector') as {
      useFaceDetector: FaceVerificationNativeModules['useFaceDetector'];
    };
    const workletsCore = require('react-native-worklets-core') as {
      Worklets: FaceVerificationNativeModules['Worklets'];
    };

    return {
      error: null,
      modules: {
        Camera: visionCamera.Camera,
        runAtTargetFps: visionCamera.runAtTargetFps,
        useFaceDetector: faceDetector.useFaceDetector,
        useCameraDevice: visionCamera.useCameraDevice,
        useCameraPermission: visionCamera.useCameraPermission,
        useFrameProcessor: visionCamera.useFrameProcessor,
        Worklets: workletsCore.Worklets,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error('Face verification native modules failed to load.'),
      modules: null,
    };
  }
}
