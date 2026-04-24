import React, { useState } from 'react';

import EmailVerificationScreen from './EmailVerificationScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import type { AuthSession } from '../services/authService';

type Screen = 'login' | 'register' | 'forgot' | 'verify';

interface Props {
  /** Called when the user is fully authenticated (and verified). */
  onAuthenticated: (session: AuthSession) => void;
}

/**
 * Lightweight auth flow navigator using callback-prop pattern.
 * No external navigation library required.
 */
const AuthNavigator: React.FC<Props> = ({ onAuthenticated }) => {
  const [screen, setScreen] = useState<Screen>('login');
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);

  const handleAuthSuccess = (session: AuthSession) => {
    setPendingSession(session);
    setScreen('verify');
  };

  const handleVerified = () => {
    if (pendingSession) onAuthenticated(pendingSession);
  };

  const handleSkipVerify = () => {
    if (pendingSession) onAuthenticated(pendingSession);
  };

  switch (screen) {
    case 'login':
      return (
        <LoginScreen
          onSuccess={handleAuthSuccess}
          onRegister={() => setScreen('register')}
          onForgotPassword={() => setScreen('forgot')}
        />
      );
    case 'register':
      return <RegisterScreen onSuccess={handleAuthSuccess} onLogin={() => setScreen('login')} />;
    case 'forgot':
      return <ForgotPasswordScreen onBack={() => setScreen('login')} />;
    case 'verify':
      return <EmailVerificationScreen onVerified={handleVerified} onSkip={handleSkipVerify} />;
  }
};

export default AuthNavigator;
