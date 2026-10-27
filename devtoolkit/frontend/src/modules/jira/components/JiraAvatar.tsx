import React, { useState } from 'react';
import { User } from 'lucide-react';
import { getJiraProxyImageUrl } from '@/services/api';

export interface JiraAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  className?: string;
  sizeText?: string;
}

export const JiraAvatar: React.FC<JiraAvatarProps> = ({
  avatarUrl,
  displayName,
  className = 'w-7 h-7',
  sizeText = 'text-xs'
}) => {
  const [imgError, setImgError] = useState(false);

  const getInitials = (name?: string | null): string => {
    if (!name || !name.trim()) return 'J';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const proxiedUrl = avatarUrl ? getJiraProxyImageUrl(avatarUrl) : null;

  if (!proxiedUrl || imgError) {
    return (
      <div 
        className={`${className} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 border border-primary/20 select-none ${sizeText}`}
        title={displayName || 'User'}
      >
        {displayName ? getInitials(displayName) : <User className="w-3.5 h-3.5" />}
      </div>
    );
  }

  return (
    <img
      src={proxiedUrl}
      alt={displayName || 'User'}
      className={`${className} rounded-full object-cover shrink-0 border border-border/60 shadow-xs`}
      title={displayName || 'User'}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  );
};
