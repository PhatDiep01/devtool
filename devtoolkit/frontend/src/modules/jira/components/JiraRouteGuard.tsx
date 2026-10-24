import React, { useEffect, useState } from 'react';
import { useJiraAuthStore } from '../../../stores/jira-auth.store';
import { JiraLoginPage } from './JiraLoginPage';

interface JiraRouteGuardProps {
  children: React.ReactNode;
}

export const JiraRouteGuard: React.FC<JiraRouteGuardProps> = ({ children }) => {
  const { token, isAuthenticated, checkSession } = useJiraAuthStore();
  // Only verify with server if a token exists in storage
  const [checking, setChecking] = useState<boolean>(Boolean(token));

  useEffect(() => {
    let mounted = true;
    if (token) {
      checkSession().finally(() => {
        if (mounted) setChecking(false);
      });
    } else {
      setChecking(false);
    }
    return () => {
      mounted = false;
    };
  }, [token, checkSession]);

  if (checking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground animate-in fade-in">
        <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <span className="font-semibold text-foreground">Verifying Jira session...</span>
        <span className="text-xs text-muted-foreground mt-1">Connecting to Atlassian Jira Cloud</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <JiraLoginPage />;
  }

  return <>{children}</>;
};

export default JiraRouteGuard;
