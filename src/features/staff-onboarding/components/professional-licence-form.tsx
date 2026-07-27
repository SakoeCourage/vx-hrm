import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { HelperText } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import { AppButton, FormDateField, FormSelect, FormTextField } from '@/components/ui';
import { getProfessionalBodies } from '@/lib/auth/api';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

import { OnboardingFormShell } from './onboarding-form-shell';
import { ProfessionalLicenceFormValues, StaffOnboardingFormProps } from './types';

const initialValues: ProfessionalLicenceFormValues = {
  professionalBodyId: '',
  pin: '',
  issuedDate: '',
  expiryDate: '',
};

export function ProfessionalLicenceForm({
  defaultValues,
  submitLabel = 'Save licence details',
  isSubmitting,
  onValidityChange,
  submitSignal,
  tenantId,
  onSubmit,
}: StaffOnboardingFormProps<ProfessionalLicenceFormValues>) {
  const authenticatedRequest = useAuthenticatedRequest();
  const lastSubmitSignalRef = useRef(0);
  const form = useForm<ProfessionalLicenceFormValues>({
    defaultValues: { ...initialValues, ...defaultValues },
    mode: 'onChange',
  });
  const professionalBodiesQuery = useQuery({
    queryKey: ['professional-bodies', tenantId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getProfessionalBodies({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(tenantId),
  });
  const professionalBodyOptions = professionalBodiesQuery.data?.map((body) => ({
    label: body.professionalBodyName ?? body.name ?? 'Unnamed professional body',
    value: body.id,
  })) ?? [];

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
      icon="certificate-outline"
      subtitle="Add your licence details for professional verification.">
      <FormSelect
        control={form.control}
        name="professionalBodyId"
        label="Professional body *"
        options={professionalBodyOptions}
        searchable
        searchPlaceholder="Search professional bodies"
        rules={{ required: 'Professional body is required.' }}
      />
      {professionalBodiesQuery.isLoading && <HelperText type="info">Loading professional bodies...</HelperText>}
      {professionalBodiesQuery.error && (
        <HelperText type="error">Unable to load professional bodies.</HelperText>
      )}
      <FormTextField
        control={form.control}
        name="pin"
        label="PIN *"
        placeholder="e.g. PIN-12345"
        autoCapitalize="characters"
        rules={{ required: 'PIN is required.' }}
      />
      <FormDateField
        control={form.control}
        name="issuedDate"
        label="Issued date *"
        rules={{ required: 'Issued date is required.' }}
      />
      <FormDateField
        control={form.control}
        name="expiryDate"
        label="Expiry date *"
        rules={{ required: 'Expiry date is required.' }}
      />
      {submitSignal === undefined && (
        <AppButton loading={isSubmitting} disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)}>
          {submitLabel}
        </AppButton>
      )}
    </OnboardingFormShell>
  );
}
