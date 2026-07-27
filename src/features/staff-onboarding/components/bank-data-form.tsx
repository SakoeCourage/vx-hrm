import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Dialog, HelperText, Icon, Portal, Text } from 'react-native-paper';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AppButton, FormSelect, FormTextField } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getPaymentBanks, getSetupBanks, resolveBankAccount } from '@/lib/auth/api';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

import { OnboardingFormShell } from './onboarding-form-shell';
import { BankDataFormValues, StaffOnboardingFormProps } from './types';

const initialValues: BankDataFormValues = {
  accountType: 'SAVINGS',
  bankName: '',
  bankCode: '',
  bankId: '',
  bankEntryMode: 'verified',
  branchName: '',
  accountName: '',
  accountNumber: '',
  isGhipsVerified: true,
};

const accountTypeOptions = [
  { label: 'Savings', value: 'SAVINGS' },
  { label: 'Current', value: 'CURRENT' },
];

export function BankDataForm({
  defaultValues,
  submitLabel = 'Save bank details',
  isSubmitting,
  onValidityChange,
  submitSignal,
  tenantId,
  tenantName,
  onSubmit,
}: StaffOnboardingFormProps<BankDataFormValues>) {
  const authenticatedRequest = useAuthenticatedRequest();
  const [verificationDialogVisible, setVerificationDialogVisible] = useState(false);
  const [verifiedAccountName, setVerifiedAccountName] = useState('');
  const lastSubmitSignalRef = useRef(0);
  const form = useForm<BankDataFormValues>({
    defaultValues: { ...initialValues, ...defaultValues },
    mode: 'onChange',
  });
  const bankEntryMode = form.watch('bankEntryMode');
  const selectedBankCode = form.watch('bankCode');
  const selectedBankId = form.watch('bankId');
  const accountNumber = form.watch('accountNumber');
  const canLoadReferences = Boolean(tenantId);

  const paymentBanksQuery = useQuery({
    queryKey: ['payment-banks', tenantId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getPaymentBanks(activeSession.accessToken, activeSession.tenantId)
      ),
    enabled: canLoadReferences && bankEntryMode === 'verified',
  });
  const setupBanksQuery = useQuery({
    queryKey: ['setup-banks', tenantId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getSetupBanks({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: canLoadReferences && bankEntryMode === 'manual',
  });
  const resolveAccountMutation = useMutation({
    mutationFn: () =>
      authenticatedRequest((activeSession) =>
        resolveBankAccount({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          accountNumber,
          code: selectedBankCode,
        })
      ),
    onSuccess: (account) => {
      setVerifiedAccountName(account?.accountName ?? '');
    },
  });

  useEffect(() => {
    form.reset({ ...initialValues, ...defaultValues });
    setVerifiedAccountName(defaultValues?.accountName ?? '');
  }, [defaultValues, form]);

  const paymentBankOptions = paymentBanksQuery.data?.map((bank) => ({
    label: bank.name,
    value: bank.code,
  })) ?? [];
  const setupBankOptions = setupBanksQuery.data?.map((bank) => ({
    label: bank.bankName ?? bank.name ?? 'Unnamed bank',
    value: bank.id,
  })) ?? [];
  const selectedPaymentBank = paymentBanksQuery.data?.find((bank) => bank.code === selectedBankCode);
  const selectedSetupBank = setupBanksQuery.data?.find((bank) => bank.id === selectedBankId);
  const isVerifiedMode = bankEntryMode === 'verified';
  const accountName = form.watch('accountName');
  const hasConfirmedAccount = !isVerifiedMode || Boolean(accountName);
  const canShowVerifyAccount = isVerifiedMode && !hasConfirmedAccount && accountNumber.trim().length >= 5;
  const provisionedBankTitle = `${tenantName?.trim() || 'Tenant'} Provisioned bank list`;

  const handleSubmit = useCallback(
    (values: BankDataFormValues) => {
      if (isVerifiedMode && !values.accountName) {
        form.setError('accountNumber', {
          type: 'validate',
          message: 'Verify the account before saving bank details.',
        });
        return;
      }

      const bankName = isVerifiedMode ? selectedPaymentBank?.name ?? values.bankName : '';
      const bankId = isVerifiedMode ? '' : values.bankId;

      return onSubmit({
        ...values,
        bankId,
        bankName,
        accountName: values.accountName.trim(),
        isGhipsVerified: isVerifiedMode,
      });
    },
    [form, isVerifiedMode, onSubmit, selectedPaymentBank?.name]
  );

  useEffect(() => {
    if (
      submitSignal === undefined ||
      submitSignal <= 0 ||
      submitSignal === lastSubmitSignalRef.current
    ) {
      return;
    }

    lastSubmitSignalRef.current = submitSignal;
    form.handleSubmit(handleSubmit)();
  }, [form, handleSubmit, submitSignal]);

  useEffect(() => {
    onValidityChange?.(form.formState.isValid && hasConfirmedAccount);
  }, [form.formState.isValid, hasConfirmedAccount, onValidityChange]);

  const handleModeChange = (nextMode: BankDataFormValues['bankEntryMode']) => {
    form.setValue('bankEntryMode', nextMode);
    form.setValue('isGhipsVerified', nextMode === 'verified');
    form.setValue('bankName', '');
    form.setValue('bankCode', '');
    form.setValue('bankId', '');
    form.setValue('accountName', '');
    setVerifiedAccountName('');
  };

  const handleVerifyAccount = () => {
    Keyboard.dismiss();
    setVerificationDialogVisible(true);
    setVerifiedAccountName('');
    resolveAccountMutation.mutate();
  };

  const handleConfirmAccountName = () => {
    form.setValue('accountName', verifiedAccountName, { shouldValidate: true });
    setVerificationDialogVisible(false);
  };

  const handleChangeVerifiedAccount = () => {
    form.setValue('accountName', '');
    setVerifiedAccountName('');
    setVerificationDialogVisible(false);
  };

  return (
    <>
      <OnboardingFormShell
        icon="bank-outline"
        subtitle="Provide the account details used for payroll and staff payments.">
        {isVerifiedMode ? (
          <>
            <View style={styles.bankGuide}>
              <Text style={styles.bankGuideText}>
                Select your bank and verify the account number to fill the account name automatically.
              </Text>
            </View>
            <FormSelect
              control={form.control}
              name="bankCode"
              label="Bank *"
              options={paymentBankOptions}
              searchable
              searchPlaceholder="Search banks"
              rules={{ required: 'Select a bank.' }}
            />
            <Pressable
              style={styles.switchBankSource}
              onPress={() => handleModeChange('manual')}
              hitSlop={8}>
              <Text style={styles.switchBankText}>
                Cannot find your bank? <Text style={styles.switchBankLink}>Click here</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.adminBankNotice}>
              <Text style={styles.adminBankTitle}>{provisionedBankTitle}</Text>
              <Text style={styles.adminBankText}>
                These are banks provided by your admin. Select one and enter the account name manually.
                If you still cannot find your bank, contact HR.
              </Text>
            </View>
            <FormSelect
              control={form.control}
              name="bankId"
              label="Bank *"
              options={setupBankOptions}
              searchable
              searchPlaceholder="Search banks"
              rules={{ required: 'Select a bank.' }}
            />
            <Pressable
              style={styles.switchBankSource}
              onPress={() => handleModeChange('verified')}
              hitSlop={8}>
              <Text style={styles.switchBankText}>
                Cannot find your bank? <Text style={styles.switchBankLink}>View another bank list</Text>
              </Text>
            </Pressable>
          </>
        )}
      {(paymentBanksQuery.isLoading || setupBanksQuery.isLoading) && (
        <HelperText type="info">Loading banks...</HelperText>
      )}
      {paymentBanksQuery.error && <HelperText type="error">Unable to load verified banks.</HelperText>}
      {setupBanksQuery.error && <HelperText type="error">Unable to load setup banks.</HelperText>}
      <FormTextField
        control={form.control}
        name="accountNumber"
        label="Account number *"
        placeholder="Enter account number"
        keyboardType="number-pad"
        rules={{ required: 'Account number is required.' }}
      />
        {canShowVerifyAccount && (
        <>
          <AppButton
            variant="outline"
            icon="shield-check-outline"
            disabled={!selectedBankCode || !accountNumber || resolveAccountMutation.isPending}
            onPress={handleVerifyAccount}>
            Verify account
          </AppButton>
          {resolveAccountMutation.error && (
            <HelperText type="error">Unable to verify this account.</HelperText>
          )}
        </>
      )}
      {hasConfirmedAccount && (
        <>
          <FormTextField
            control={form.control}
            name="accountName"
            label="Account name *"
            placeholder={isVerifiedMode ? 'Verified account name' : 'Name on account'}
            editable={!isVerifiedMode}
            rules={{ required: 'Account name is required.' }}
          />
          <FormTextField
            control={form.control}
            name="branchName"
            label="Branch name *"
            placeholder="e.g Main Branch"
            rules={{ required: 'Branch name is required.' }}
          />
          <FormSelect
            control={form.control}
            name="accountType"
            label="Account type *"
            options={accountTypeOptions}
            rules={{ required: 'Account type is required.' }}
          />
          {isVerifiedMode && (
            <AppButton variant="ghost" icon="pencil-outline" onPress={handleChangeVerifiedAccount}>
              Change verified account
            </AppButton>
          )}
        </>
      )}
      {!isVerifiedMode && selectedSetupBank && (
        <HelperText type="info">
          Selected bank: {selectedSetupBank.bankName ?? selectedSetupBank.name}
        </HelperText>
      )}
      {submitSignal === undefined && (
        <AppButton loading={isSubmitting} disabled={isSubmitting} onPress={form.handleSubmit(handleSubmit)}>
          {submitLabel}
        </AppButton>
      )}
      </OnboardingFormShell>
      <Portal>
        <Dialog
          visible={verificationDialogVisible}
          onDismiss={() => {
            if (!resolveAccountMutation.isPending) {
              setVerificationDialogVisible(false);
            }
          }}
          style={styles.verifyDialog}>
          <Dialog.Title>Verify account</Dialog.Title>
          <View style={styles.verifyDivider} />
          <Dialog.Content style={styles.verifyDialogContent}>
            {resolveAccountMutation.isPending ? (
              <>
                <Text style={styles.verifyText}>Checking the account details...</Text>
                <HelperText type="info">This may take a moment.</HelperText>
              </>
            ) : resolveAccountMutation.error ? (
              <Text style={styles.verifyError}>
                Unable to verify this account. Check the bank and account number.
              </Text>
            ) : (
              <>
                <Text style={styles.verifyText}>Name on account</Text>
                <View style={styles.verifiedNameRow}>
                  <View style={styles.verifiedNameIcon}>
                    <Icon source="account-outline" size={20} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.verifiedName}>{verifiedAccountName || 'No account name returned'}</Text>
                </View>
              </>
            )}
          </Dialog.Content>
          <View style={styles.verifyDivider} />
          <Dialog.Actions style={styles.verifyActions}>
            {resolveAccountMutation.error ? (
              <AppButton variant="ghost" icon="close" onPress={handleChangeVerifiedAccount}>
                Change
              </AppButton>
            ) : null}
            {!resolveAccountMutation.error && !resolveAccountMutation.isPending ? (
              <AppButton variant="ghost" icon="close" onPress={handleChangeVerifiedAccount}>
                Change
              </AppButton>
            ) : null}
            {!resolveAccountMutation.error && !resolveAccountMutation.isPending ? (
              <AppButton
                variant="outline"
                icon="plus"
                onPress={handleConfirmAccountName}
                disabled={!verifiedAccountName}>
                That is correct
              </AppButton>
            ) : null}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  bankGuide: {
    borderRadius: 12,
    backgroundColor: Colors.light.primaryMuted,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bankGuideText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  adminBankNotice: {
    gap: 2,
    borderRadius: 12,
    backgroundColor: Colors.light.warningMuted,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  adminBankTitle: {
    ...Typography.sm,
    color: '#8a5a12',
    fontWeight: '600',
  },
  adminBankText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  switchBankSource: {
    alignSelf: 'flex-start',
  },
  switchBankText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  switchBankLink: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  verifyDialog: {
    borderRadius: 16,
    backgroundColor: '#f7fcfd',
  },
  verifyDialogContent: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  verifyDivider: {
    height: 1,
    backgroundColor: '#e2f2f5',
  },
  verifyActions: {
    paddingTop: Spacing.three,
  },
  verifyText: {
    ...Typography.base,
    color: Colors.light.textSecondary,
  },
  verifyError: {
    ...Typography.base,
    color: Colors.light.danger,
  },
  verifiedName: {
    ...Typography.lg,
    flex: 1,
    color: Colors.light.text,
    fontWeight: '600',
  },
  verifiedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  verifiedNameIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
});
