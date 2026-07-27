import { SegmentedButtons } from 'react-native-paper';

type SegmentedFilterProps = {
  value: string;
  onChange: (value: string) => void;
  buttons: { value: string; label: string }[];
};

export function SegmentedFilter({ value, onChange, buttons }: SegmentedFilterProps) {
  return (
    <SegmentedButtons
      value={value}
      onValueChange={onChange}
      buttons={buttons}
      density="small"
      style={{ borderRadius: 8 }}
    />
  );
}
