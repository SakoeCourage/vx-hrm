import { Chip } from 'react-native-paper';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneColors: Record<BadgeTone, { backgroundColor: string; textColor: string }> = {
  success: { backgroundColor: '#e6f6ec', textColor: '#087443' },
  warning: { backgroundColor: '#fff4df', textColor: '#b54708' },
  danger: { backgroundColor: '#fee4e2', textColor: '#b42318' },
  info: { backgroundColor: '#e4f6fa', textColor: '#087d96' },
  neutral: { backgroundColor: '#edf5f7', textColor: '#45616a' },
};

type AppStatusBadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function AppStatusBadge({ label, tone = 'neutral' }: AppStatusBadgeProps) {
  const colors = toneColors[tone];

  return (
    <Chip
      compact
      style={{ backgroundColor: colors.backgroundColor, borderRadius: 6 }}
      textStyle={{ color: colors.textColor, fontSize: 10, fontWeight: '600' }}>
      {label}
    </Chip>
  );
}
