import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export const FACE_ENROLLMENT_FRAME_WIDTH = 250;
export const FACE_ENROLLMENT_FRAME_HEIGHT = 300;
export const FACE_ENROLLMENT_FRAME_RADIUS = 18;

const FRAME_STROKE_WIDTH = 5;
const FRAME_OUTSET = 7;
const PROGRESS_ANIMATION_MS = 220;
const SVG_WIDTH = FACE_ENROLLMENT_FRAME_WIDTH + FRAME_OUTSET * 2;
const SVG_HEIGHT = FACE_ENROLLMENT_FRAME_HEIGHT + FRAME_OUTSET * 2;
const STROKE_INSET = FRAME_STROKE_WIDTH / 2;
const STROKE_RECT_WIDTH = SVG_WIDTH - FRAME_STROKE_WIDTH;
const STROKE_RECT_HEIGHT = SVG_HEIGHT - FRAME_STROKE_WIDTH;
const STROKE_RADIUS = FACE_ENROLLMENT_FRAME_RADIUS + FRAME_OUTSET - STROKE_INSET;
const STROKE_LEFT = STROKE_INSET;
const STROKE_TOP = STROKE_INSET;
const STROKE_RIGHT = STROKE_LEFT + STROKE_RECT_WIDTH;
const STROKE_BOTTOM = STROKE_TOP + STROKE_RECT_HEIGHT;
const STROKE_TOP_CENTER = STROKE_LEFT + STROKE_RECT_WIDTH / 2;
const STROKE_PATH_LENGTH =
  2 * (STROKE_RECT_WIDTH + STROKE_RECT_HEIGHT - 4 * STROKE_RADIUS) +
  2 * Math.PI * STROKE_RADIUS;
const STROKE_PATH = [
  `M ${STROKE_TOP_CENTER} ${STROKE_TOP}`,
  `H ${STROKE_RIGHT - STROKE_RADIUS}`,
  `A ${STROKE_RADIUS} ${STROKE_RADIUS} 0 0 1 ${STROKE_RIGHT} ${STROKE_TOP + STROKE_RADIUS}`,
  `V ${STROKE_BOTTOM - STROKE_RADIUS}`,
  `A ${STROKE_RADIUS} ${STROKE_RADIUS} 0 0 1 ${STROKE_RIGHT - STROKE_RADIUS} ${STROKE_BOTTOM}`,
  `H ${STROKE_LEFT + STROKE_RADIUS}`,
  `A ${STROKE_RADIUS} ${STROKE_RADIUS} 0 0 1 ${STROKE_LEFT} ${STROKE_BOTTOM - STROKE_RADIUS}`,
  `V ${STROKE_TOP + STROKE_RADIUS}`,
  `A ${STROKE_RADIUS} ${STROKE_RADIUS} 0 0 1 ${STROKE_LEFT + STROKE_RADIUS} ${STROKE_TOP}`,
  `H ${STROKE_TOP_CENTER}`,
].join(' ');

const AnimatedPath = Animated.createAnimatedComponent(Path);

type FaceEnrollmentFrameMeterProps = {
  progress: number;
  showProgress?: boolean;
  status: 'under' | 'inRange' | 'over';
};

export function FaceEnrollmentFrameMeter({
  progress,
  showProgress = true,
  status,
}: FaceEnrollmentFrameMeterProps) {
  const progressPercent = useSharedValue(Math.max(progress * 100, 4));

  useEffect(() => {
    progressPercent.value = withTiming(Math.max(progress * 100, 4), {
      duration: PROGRESS_ANIMATION_MS,
    });
  }, [progress, progressPercent]);

  const animatedProgressProps = useAnimatedProps(() => ({
    strokeDashoffset: STROKE_PATH_LENGTH - (progressPercent.value / 100) * STROKE_PATH_LENGTH,
  }));

  const meterColor =
    status === 'over'
      ? Colors.light.danger
      : status === 'inRange'
        ? Colors.light.success
        : Colors.light.warning;

  return (
    <View pointerEvents="none" style={styles.root}>
      <Svg height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} width="100%">
        <Path
          d={STROKE_PATH}
          fill="none"
          stroke="rgba(18, 24, 38, 0.18)"
          strokeWidth={FRAME_STROKE_WIDTH}
        />
        {showProgress && (
          <AnimatedPath
            d={STROKE_PATH}
            fill="none"
            stroke={meterColor}
            strokeWidth={FRAME_STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={STROKE_PATH_LENGTH}
            animatedProps={animatedProgressProps}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: -FRAME_OUTSET,
    right: -FRAME_OUTSET,
    bottom: -FRAME_OUTSET,
    left: -FRAME_OUTSET,
    zIndex: 3,
  },
});
