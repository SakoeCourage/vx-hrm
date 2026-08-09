import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Image,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Checkbox, HelperText, Icon, Text } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useMutation } from '@tanstack/react-query';

import { AppButton, AppSnackbar, FormTextField } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { staffLogin, verifyStaffOtp } from '@/lib/auth/api';
import { getRememberedStaffProfile } from '@/lib/auth/session-store';
import { AuthStaff, StaffSession } from '@/lib/auth/types';

type LoginForm = {
  staffIdentificationNumber: string;
  password: string;
  agreeToTerms: boolean;
};

type OtpForm = {
  otp: string;
};

type AuthPanelStep = 'credentials' | 'otp';

type LoginViewProps = {
  onAuthenticated: (session: StaffSession) => void | Promise<void>;
};

export function LoginView({ onAuthenticated }: LoginViewProps) {
  const [authPanelStep, setAuthPanelStep] = useState<AuthPanelStep>('credentials');
  const [rememberedStaff, setRememberedStaff] = useState<AuthStaff | null>(null);
  const [isUsingRememberedStaff, setIsUsingRememberedStaff] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState('');
  const [otpSubtitle, setOtpSubtitle] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'default' | 'danger' | 'success'>('default');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const lastSubmittedOtpRef = useRef('');

  const loginForm = useForm<LoginForm>({
    defaultValues: {
      staffIdentificationNumber: '',
      password: '',
      agreeToTerms: false,
    },
  });

  const otpForm = useForm<OtpForm>({
    defaultValues: {
      otp: '',
    },
  });
  const otpValue = otpForm.watch('otp');
  const rememberedStaffName = rememberedStaff ? formatStaffName(rememberedStaff) : '';

  useEffect(() => {
    let isMounted = true;

    getRememberedStaffProfile()
      .then((profile) => {
        if (!isMounted || !profile?.staffIdentificationNumber) {
          return;
        }

        setRememberedStaff(profile);
        setIsUsingRememberedStaff(true);
        loginForm.setValue('staffIdentificationNumber', profile.staffIdentificationNumber);
        loginForm.setValue('agreeToTerms', true);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [loginForm]);

  const loginMutation = useMutation({
    mutationFn: staffLogin,
    onSuccess: (response, variables) => {
      setPendingStaffId(variables.staffIdentificationNumber);
      setAuthPanelStep('otp');
      setOtpSubtitle(response.message);
      setResendCooldown(10);
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to start login');
      setMessageTone('danger');
      setSnackbarVisible(true);
    },
  });

  const otpMutation = useMutation({
    mutationFn: verifyStaffOtp,
    onSuccess: onAuthenticated,
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to verify OTP');
      setMessageTone('danger');
      setSnackbarVisible(true);
    },
  });

  useEffect(() => {
    if (
      authPanelStep !== 'otp' ||
      otpValue.length !== 4 ||
      otpValue === lastSubmittedOtpRef.current ||
      otpMutation.isPending ||
      !pendingStaffId
    ) {
      return;
    }

    lastSubmittedOtpRef.current = otpValue;
    Keyboard.dismiss();
    otpMutation.mutate({
      staffIdentificationNumber: pendingStaffId,
      otp: otpValue,
    });
  }, [authPanelStep, otpMutation, otpValue, pendingStaffId]);

  useEffect(() => {
    if (authPanelStep !== 'otp' || resendCooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [authPanelStep, resendCooldown]);

  const handleResendOtp = () => {
    if (resendCooldown > 0 || loginMutation.isPending) {
      return;
    }

    const { staffIdentificationNumber, password } = loginForm.getValues();
    lastSubmittedOtpRef.current = '';
    otpForm.reset({ otp: '' });
    loginMutation.mutate({ staffIdentificationNumber, password });
  };

  const resendLabel = loginMutation.isPending
    ? 'Sending...'
    : resendCooldown > 0
      ? `Resend in ${resendCooldown}s`
      : 'Resend code';

  const handleRememberedStaffLogin = (values: LoginForm) => {
    if (!rememberedStaff?.staffIdentificationNumber) {
      return;
    }

    loginMutation.mutate({
      staffIdentificationNumber: rememberedStaff.staffIdentificationNumber,
      password: values.password,
    });
  };

  const handleUseDifferentStaff = () => {
    setIsUsingRememberedStaff(false);
    setAuthPanelStep('credentials');
    setPendingStaffId('');
    setOtpSubtitle('');
    lastSubmittedOtpRef.current = '';
    otpForm.reset({ otp: '' });
    loginForm.reset({
      staffIdentificationNumber: '',
      password: '',
      agreeToTerms: false,
    });
  };

  const rememberedCredentialsContent = rememberedStaff ? (
    <>
      <View style={styles.rememberedStaffCard}>
        {rememberedStaff.passportPicture ? (
          <Image source={{ uri: rememberedStaff.passportPicture }} style={styles.rememberedAvatar} />
        ) : (
          <View style={styles.rememberedAvatarFallback}>
            <Text style={styles.rememberedAvatarText}>{getStaffInitials(rememberedStaff)}</Text>
          </View>
        )}
        <View style={styles.rememberedStaffText}>
          <Text style={styles.rememberedStaffName}>{rememberedStaffName}</Text>
          <Text style={styles.rememberedStaffId}>
            {rememberedStaff.staffIdentificationNumber}
          </Text>
        </View>
      </View>
      <FormTextField
        control={loginForm.control}
        name="password"
        label="Password *"
        placeholder="Enter password"
        autoFocus
        secureTextEntry
        canToggleSecureText
        rules={{ required: 'Password is required.' }}
      />
      <AppButton
        loading={loginMutation.isPending}
        disabled={loginMutation.isPending}
        onPress={loginForm.handleSubmit(handleRememberedStaffLogin)}>
        Send OTP
      </AppButton>
      <Pressable
        style={styles.differentStaffButton}
        disabled={loginMutation.isPending}
        onPress={handleUseDifferentStaff}>
        <Text style={styles.differentStaffText}>Sign in with a different staff ID</Text>
      </Pressable>
      <StepIndicator activeStep={authPanelStep} />
    </>
  ) : null;

  const credentialsContent = (
    <>
      <FormTextField
        control={loginForm.control}
        name="staffIdentificationNumber"
        label="Staff ID *"
        placeholder="MS987654321"
        autoCapitalize="characters"
        rules={{ required: 'Staff ID is required.' }}
      />
      <FormTextField
        control={loginForm.control}
        name="password"
        label="Password *"
        placeholder="Enter password"
        secureTextEntry
        canToggleSecureText
        rules={{ required: 'Password is required.' }}
      />
      <Controller
        control={loginForm.control}
        name="agreeToTerms"
        rules={{
          validate: (value) => value || 'Please agree to the terms and conditions.',
        }}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View>
            <View style={styles.termsRow}>
              <Checkbox.Android
                status={value ? 'checked' : 'unchecked'}
                onPress={() => onChange(!value)}
                color={Colors.light.primary}
                uncheckedColor={Colors.light.border}
              />
              <Text style={styles.termsText}>
                Agree with{' '}
                <Text style={styles.inlineLink} onPress={openVariableX}>
                  Terms & Conditions
                </Text>
              </Text>
            </View>
            {error?.message && <HelperText type="error">{error.message}</HelperText>}
          </View>
        )}
      />
      <AppButton
        loading={loginMutation.isPending}
        disabled={loginMutation.isPending}
        onPress={loginForm.handleSubmit((values) => loginMutation.mutate(values))}>
        Send OTP
      </AppButton>
      <StepIndicator activeStep={authPanelStep} />
    </>
  );

  const otpContent = (
    <>
      <OtpBoxes
        value={otpValue}
        active={authPanelStep === 'otp'}
        onChange={(value) => otpForm.setValue('otp', value, { shouldValidate: true })}
      />
      <View style={styles.resendRow}>
        <Text style={styles.resendMutedText}>Did not get OTP?</Text>
        <Pressable
          disabled={resendCooldown > 0 || loginMutation.isPending}
          onPress={handleResendOtp}
          hitSlop={8}>
          <Text
            style={[
              styles.resendText,
              resendCooldown > 0 || loginMutation.isPending ? styles.resendTextDisabled : null,
            ]}>
            {resendLabel}
          </Text>
        </Pressable>
      </View>
      <AppButton
        loading={otpMutation.isPending}
        disabled={otpMutation.isPending}
        onPress={otpForm.handleSubmit((values) => {
          lastSubmittedOtpRef.current = values.otp;
          otpMutation.mutate({
            staffIdentificationNumber: pendingStaffId,
            otp: values.otp,
          });
        })}>
        Verify
      </AppButton>
      <StepIndicator activeStep={authPanelStep} />
    </>
  );

  return (
    <AuthShell
      title={authPanelStep === 'otp' ? 'Verify OTP' : 'Welcome back'}
      subtitle={
        authPanelStep === 'otp'
          ? otpSubtitle
          : isUsingRememberedStaff && rememberedStaff
            ? 'Enter your password to continue.'
            : 'Securely log in with your staff credentials.'
      }
      panelTitle={
        authPanelStep === 'otp'
          ? 'Enter code'
          : isUsingRememberedStaff && rememberedStaff
            ? 'Sign in as'
            : 'Sign in'
      }
      activeStep={authPanelStep}
      credentialsContent={
        isUsingRememberedStaff && rememberedStaff ? rememberedCredentialsContent : credentialsContent
      }
      otpContent={otpContent}
      panelAction={
        authPanelStep === 'otp' ? (
          <Pressable
            style={styles.panelAction}
            onPress={() => {
              Keyboard.dismiss();
              setAuthPanelStep('credentials');
            }}>
            <Icon source="chevron-left" size={20} color={Colors.light.primary} />
            <Text style={styles.panelActionText}>Back</Text>
          </Pressable>
        ) : null
      }>
      <AppSnackbar
        visible={snackbarVisible}
        message={message}
        tone={messageTone}
        position="top"
        onDismiss={() => setSnackbarVisible(false)}
      />
      <Text style={styles.poweredText}>
        Powered by{' '}
        <Text style={styles.inlineLink} onPress={openVariableX}>
          Variable X Solutions
        </Text>
      </Text>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  panelTitle,
  panelAction,
  activeStep,
  credentialsContent,
  otpContent,
  children,
}: {
  title: string;
  subtitle: string;
  panelTitle: string;
  panelAction?: React.ReactNode;
  activeStep: AuthPanelStep;
  credentialsContent: React.ReactNode;
  otpContent: React.ReactNode;
  children: React.ReactNode;
}) {
  const [panelWidth, setPanelWidth] = useState(0);
  const carouselOffset = useSharedValue(0);
  const carouselStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: carouselOffset.value }],
  }));

  useEffect(() => {
    carouselOffset.value = withTiming(activeStep === 'otp' ? -panelWidth : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeStep, carouselOffset, panelWidth]);

  return (
    <View style={styles.authBackground}>
      <ScrollView
        contentContainerStyle={styles.authScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[Colors.light.primary, '#0a6f86', '#0f91aa']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.authHero}>
          <View style={styles.heroCurveOne} />
          <View style={styles.heroCurveTwo} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>
        </LinearGradient>

        <View style={styles.authPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{panelTitle}</Text>
            {panelAction}
          </View>
          <View
            style={styles.authCarouselViewport}
            onLayout={({ nativeEvent }) => setPanelWidth(nativeEvent.layout.width)}>
            <Animated.View style={[styles.authCarouselTrack, carouselStyle]}>
              <View style={[styles.authCarouselPage, { width: panelWidth }]}>
                {credentialsContent}
              </View>
              <View style={[styles.authCarouselPage, { width: panelWidth }]}>
                {otpContent}
              </View>
            </Animated.View>
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

function openVariableX() {
  Linking.openURL('https://variablexsolutions.com/');
}

function formatStaffName(staff: AuthStaff) {
  return [staff.firstName, staff.otherNames, staff.lastName].filter(Boolean).join(' ') || 'Staff member';
}

function getStaffInitials(staff: AuthStaff) {
  const nameParts = [staff.firstName, staff.lastName].filter(Boolean);
  const initials = nameParts.map((part) => part?.[0]).join('').slice(0, 2).toUpperCase();

  return initials || staff.staffIdentificationNumber.slice(0, 2).toUpperCase();
}

function StepIndicator({ activeStep }: { activeStep: AuthPanelStep }) {
  return (
    <View style={styles.stepIndicator}>
      <View
        style={[
          styles.stepDot,
          activeStep === 'credentials' ? styles.stepDotActive : styles.stepDotInactive,
        ]}
      />
      <View
        style={[
          styles.stepDot,
          activeStep === 'otp' ? styles.stepDotActive : styles.stepDotInactive,
        ]}
      />
    </View>
  );
}

function OtpBoxes({
  value,
  active,
  onChange,
}: {
  value: string;
  active: boolean;
  onChange: (value: string) => void;
}) {
  const refs = useRef<(RNTextInput | null)[]>([]);
  const digits = Array.from({ length: 4 }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (!active) {
      return;
    }

    const timeout = setTimeout(() => {
      refs.current[0]?.focus();
    }, 340);

    return () => clearTimeout(timeout);
  }, [active]);

  return (
    <View style={styles.otpGroup}>
      <View style={styles.otpBoxes}>
        {digits.map((digit, index) => (
          <RNTextInput
            key={index}
            ref={(input) => {
              refs.current[index] = input;
            }}
            value={digit}
            maxLength={4}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
            onChangeText={(text) => {
              const nextText = text.replace(/\D/g, '').slice(0, 4);
              const nextDigits = [...digits];

              if (nextText.length > 1) {
                nextText.split('').forEach((nextDigit, digitIndex) => {
                  const nextIndex = index + digitIndex;
                  if (nextIndex < nextDigits.length) {
                    nextDigits[nextIndex] = nextDigit;
                  }
                });
              } else {
                nextDigits[index] = nextText;
              }

              onChange(nextDigits.join(''));

              const nextFocusIndex = Math.min(index + Math.max(nextText.length, 1), refs.current.length - 1);
              if (nextText && nextFocusIndex > index) {
                refs.current[nextFocusIndex]?.focus();
              }
            }}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digit && index > 0) {
                refs.current[index - 1]?.focus();
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authBackground: {
    flex: 1,
    backgroundColor: Colors.light.primaryMuted,
  },
  authScrollContent: {
    flexGrow: 1,
    backgroundColor: Colors.light.appBgLight,
  },
  authHero: {
    minHeight: 286,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroCopy: {
    gap: Spacing.one,
    maxWidth: 290,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 38,
    color: '#ffffff',
    fontWeight: '600',
  },
  heroSubtitle: {
    ...Typography.base,
    color: '#e8fbff',
    maxWidth: 230,
  },
  heroCurveOne: {
    position: 'absolute',
    right: -80,
    bottom: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: '#7ecbd8',
    opacity: 0.35,
  },
  heroCurveTwo: {
    position: 'absolute',
    right: -30,
    bottom: 12,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: '#d5f6fb',
    opacity: 0.3,
  },
  authPanel: {
    flex: 1,
    marginTop: -44,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.light.appBgLight,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.four,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  panelTitle: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  panelAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelActionText: {
    ...Typography.lg,
    color: Colors.light.primary,
    fontWeight: '400',
  },
  authCarouselViewport: {
    overflow: 'hidden',
  },
  authCarouselTrack: {
    flexDirection: 'row',
  },
  authCarouselPage: {
    gap: Spacing.five,
  },
  resendText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: Colors.light.textSecondary,
  },
  resendMutedText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  stepDot: {
    height: 6,
    borderRadius: 3,
  },
  stepDotActive: {
    width: 22,
    backgroundColor: Colors.light.primary,
  },
  stepDotInactive: {
    width: 6,
    backgroundColor: Colors.light.primaryMuted,
  },
  otpGroup: {},
  otpBoxes: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#f7fbfc',
    color: Colors.light.text,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryMuted,
  },
  rememberedStaffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    padding: Spacing.three,
  },
  rememberedAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.light.primaryMuted,
  },
  rememberedAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  rememberedAvatarText: {
    ...Typography.lg,
    color: Colors.light.primary,
    fontWeight: '800',
  },
  rememberedStaffText: {
    flex: 1,
    gap: 2,
  },
  rememberedStaffName: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '800',
  },
  rememberedStaffId: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  differentStaffButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  differentStaffText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
    gap: 2,
  },
  termsText: {
    ...Typography.sm,
    color: Colors.light.text,
    flex: 1,
  },
  poweredText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 'auto',
  },
  inlineLink: {
    color: Colors.light.primary,
    fontWeight: '500',
  },
});
