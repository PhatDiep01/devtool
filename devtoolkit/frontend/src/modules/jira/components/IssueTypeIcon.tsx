import React, { useState } from 'react';
import { 
  Bug, 
  Bookmark, 
  CheckSquare, 
  GitBranch, 
  Zap, 
  Sparkles, 
  Layers 
} from 'lucide-react';
import { getJiraProxyImageUrl } from '@/services/api';

export interface IssueTypeIconProps {
  type?: {
    name?: string;
    iconUrl?: string;
    subtask?: boolean;
  } | null;
  className?: string;
}

export const IssueTypeIcon: React.FC<IssueTypeIconProps> = ({ 
  type, 
  className = 'w-4 h-4'
}) => {
  const [imgError, setImgError] = useState(false);

  const name = (type?.name || '').toLowerCase();
  const isSubtask = Boolean(type?.subtask || name.includes('sub'));

  // SVG Fallback Icon based on standard Jira types
  const renderFallback = () => {
    let icon = <Layers className={`${className} text-muted-foreground shrink-0`} />;

    if (name.includes('bug')) {
      icon = <Bug className={`${className} text-rose-500 shrink-0`} />;
    } else if (name.includes('story')) {
      icon = <Bookmark className={`${className} text-emerald-500 shrink-0`} />;
    } else if (isSubtask) {
      icon = <GitBranch className={`${className} text-purple-500 shrink-0`} />;
    } else if (name.includes('epic')) {
      icon = <Zap className={`${className} text-purple-600 shrink-0`} />;
    } else if (name.includes('improve') || name.includes('feature')) {
      icon = <Sparkles className={`${className} text-amber-500 shrink-0`} />;
    } else if (name.includes('task')) {
      icon = <CheckSquare className={`${className} text-blue-500 shrink-0`} />;
    }

    return (
      <span title={type?.name || 'Issue'} className="inline-flex items-center justify-center">
        {icon}
      </span>
    );
  };

  const proxiedUrl = type?.iconUrl ? getJiraProxyImageUrl(type.iconUrl) : null;

  if (!proxiedUrl || imgError) {
    return renderFallback();
  }

  return (
    <img
      src={proxiedUrl}
      alt={type?.name || 'Type'}
      className={`${className} object-contain shrink-0 rounded-xs`}
      title={type?.name}
      onError={() => setImgError(true)}
      loading="lazy"
    />
  );
};
