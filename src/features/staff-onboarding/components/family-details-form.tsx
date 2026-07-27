import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { AppButton, FormTextField } from '@/components/ui';

import { OnboardingFormShell } from './onboarding-form-shell';
import { FamilyDetailsFormValues, StaffOnboardingFormProps } from './types';

const initialValues: FamilyDetailsFormValues = {
  fathersName: '',
  mothersName: '',
  spouseName: '',
  spousePhoneNumber: '',
  nextOfKIN: '',
  nextOfKINPhoneNumber: '',
  emergencyPerson: '',
  emergencyPersonPhoneNumber: '',
};

export function FamilyDetailsForm({
  defaultValues,
  submitLabel = 'Save family details',
  isSubmitting,
  onValidityChange,
  submitSignal,
  onSubmit,
}: StaffOnboardingFormProps<FamilyDetailsFormValues>) {
  const lastSubmitSignalRef = useRef(0);
  const form = useForm<FamilyDetailsFormValues>({
    defaultValues: { ...initialValues, ...defaultValues },
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset({ ...initialValues, ...defaultValues });
  }, [defaultValues, form]);

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
      icon="account-heart-outline"
      subtitle="Add your next of kin and emergency contact information.">
      <FormTextField
        control={form.control}
        name="fathersName"
        label="Father's name *"
        placeholder="Full name"
        rules={{ required: "Father's name is required." }}
      />
      <FormTextField
        control={form.control}
        name="mothersName"
        label="Mother's name *"
        placeholder="Full name"
        rules={{ required: "Mother's name is required." }}
      />
      <FormTextField
        control={form.control}
        name="spouseName"
        label="Spouse name"
        placeholder="Full name"
      />
      <FormTextField
        control={form.control}
        name="spousePhoneNumber"
        label="Spouse phone"
        placeholder="0240000000"
        keyboardType="phone-pad"
      />
      <FormTextField
        control={form.control}
        name="nextOfKIN"
        label="Next of kin *"
        placeholder="Full name"
        rules={{ required: 'Next of kin is required.' }}
      />
      <FormTextField
        control={form.control}
        name="nextOfKINPhoneNumber"
        label="Next of kin phone *"
        placeholder="0240000000"
        keyboardType="phone-pad"
        rules={{ required: 'Next of kin phone is required.' }}
      />
      <FormTextField
        control={form.control}
        name="emergencyPerson"
        label="Emergency person *"
        placeholder="Full name"
        rules={{ required: 'Emergency person is required.' }}
      />
      <FormTextField
        control={form.control}
        name="emergencyPersonPhoneNumber"
        label="Emergency person phone *"
        placeholder="0240000000"
        keyboardType="phone-pad"
        rules={{ required: 'Emergency person phone is required.' }}
      />
      {submitSignal === undefined && (
        <AppButton loading={isSubmitting} disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)}>
          {submitLabel}
        </AppButton>
      )}
    </OnboardingFormShell>
  );
}
