import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { AppButton, FormDateField, FormSelect, FormTextField } from '@/components/ui';

import { OnboardingFormShell } from './onboarding-form-shell';
import { AccommodationDataFormValues, StaffOnboardingFormProps } from './types';

const initialValues: AccommodationDataFormValues = {
  source: '',
  gpsAddress: '',
  accommodationType: '',
  flatNumber: '',
  allocationDate: '',
};

const sourceOptions = [
  { label: 'Rented', value: 'Rented' },
  { label: 'Official', value: 'Official' },
  { label: 'Personal', value: 'Personal' },
];

const accommodationTypeOptions = [
  { label: 'Flat', value: 'FLAT' },
  { label: 'Compound house', value: 'COMPOUND HOUSE' },
  { label: 'Self-contained', value: 'SELF-CONTAINED' },
  { label: 'Semi-detached', value: 'SEMI-DETACHED' },
  { label: 'Detached', value: 'DETACHED' },
  { label: 'Out-house', value: 'OUT-HOUSE' },
];

export function AccommodationDataForm({
  defaultValues,
  submitLabel = 'Save accommodation',
  isSubmitting,
  onValidityChange,
  submitSignal,
  onSubmit,
}: StaffOnboardingFormProps<AccommodationDataFormValues>) {
  const lastSubmitSignalRef = useRef(0);
  const form = useForm<AccommodationDataFormValues>({
    defaultValues: { ...initialValues, ...defaultValues },
    mode: 'onChange',
  });
  const source = form.watch('source');
  const requiresAllocationDate = source === 'Official';

  useEffect(() => {
    form.reset({ ...initialValues, ...defaultValues });
  }, [defaultValues, form]);

  useEffect(() => {
    if (!requiresAllocationDate) {
      form.setValue('allocationDate', '', { shouldValidate: true });
    }
  }, [form, requiresAllocationDate]);

  useEffect(() => {
    if (
      submitSignal === undefined ||
      submitSignal <= 0 ||
      submitSignal === lastSubmitSignalRef.current
    ) {
      return;
    }

    lastSubmitSignalRef.current = submitSignal;
    form.handleSubmit(onSubmit)();
  }, [form, onSubmit, submitSignal]);

  useEffect(() => {
    onValidityChange?.(form.formState.isValid);
  }, [form.formState.isValid, onValidityChange]);

  return (
    <OnboardingFormShell
      icon="home-city-outline"
      subtitle="Provide your current residential address and contact details.">
      <FormSelect
        control={form.control}
        name="source"
        label="Source *"
        options={sourceOptions}
        rules={{ required: 'Source is required.' }}
      />
      <FormTextField
        control={form.control}
        name="gpsAddress"
        label="GPS address *"
        placeholder="e.g. GA-000-0000"
        autoCapitalize="characters"
        rules={{ required: 'GPS address is required.' }}
      />
      <FormSelect
        control={form.control}
        name="accommodationType"
        label="Accommodation type *"
        options={accommodationTypeOptions}
        rules={{ required: 'Accommodation type is required.' }}
      />
      <FormTextField
        control={form.control}
        name="flatNumber"
        label="Flat number *"
        placeholder="e.g. A1"
        autoCapitalize="characters"
        rules={{ required: 'Flat number is required.' }}
      />
      {requiresAllocationDate && (
        <FormDateField
          control={form.control}
          name="allocationDate"
          label="Allocation date *"
          rules={{ required: 'Allocation date is required for official accommodation.' }}
        />
      )}
      {submitSignal === undefined && (
        <AppButton loading={isSubmitting} disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)}>
          {submitLabel}
        </AppButton>
      )}
    </OnboardingFormShell>
  );
}
