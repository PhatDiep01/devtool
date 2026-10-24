import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Palette, 
  Code2, 
  CheckSquare, 
  ShieldCheck, 
  Bot, 
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AGENT_ROLES, copyToClipboard } from './formatter-engine';

interface AgentPromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentPromptsModal: React.FC<AgentPromptsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('designer');
  const [copiedRole, setCopiedRole] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentRole = AGENT_ROLES.find(r => r.id === activeTab) || AGENT_ROLES[0];

  const [isCopiedAll, setIsCopiedAll] = useState<boolean>(false);

  const handleCopyPrompt = async (roleId: string, promptText: string) => {
    const success = await copyToClipboard(promptText);
    if (success) {
      setCopiedRole(roleId);
      toast.success(`Đã sao chép System Prompt cho ${currentRole.title}!`, {
        icon: '📋',
        duration: 2500
      });
      setTimeout(() => setCopiedRole(null), 2000);
    } else {
      toast.error('Không thể sao chép vào bộ nhớ tạm.');
    }
  };

  const handleCopyAllPrompts = async () => {
    const combined = `# BỘ ĐẶC TẢ SYSTEM PROMPTS CHO 4 AI AGENTS (/boost)\n\n` + 
      AGENT_ROLES.map(role => `## ${role.title} (${role.badge})\n> ${role.summary}\n\n\`\`\`markdown\n${role.systemPrompt}\n\`\`\``).join('\n\n---\n\n');
    const success = await copyToClipboard(combined);
    if (success) {
      setIsCopiedAll(true);
      toast.success('Đã sao chép toàn bộ System Prompts của 4 Agents!', { icon: '✨', duration: 3000 });
      setTimeout(() => setIsCopiedAll(false), 2000);
    } else {
      toast.error('Không thể sao chép vào bộ nhớ tạm.');
    }
  };

  const getRoleIcon = (roleId: string) => {
    switch (roleId) {
      case 'designer':
        return <Palette className="w-4 h-4" />;
      case 'coder':
        return <Code2 className="w-4 h-4" />;
      case 'qa':
        return <CheckSquare className="w-4 h-4" />;
      case 'review':
        return <ShieldCheck className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">AI Boost Agent Squad</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
                  /boost mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Đặc tả 4 vai trò AI Agent chuyên trách: Thiết Kế, Lập Trình (Coder), Kiểm Thử (QA) và Đánh Giá (Review)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllPrompts}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-foreground hover:bg-accent text-xs font-semibold transition shadow-xs"
              title="Sao chép toàn bộ System Prompts của cả 4 vai trò"
            >
              {isCopiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
              <span>{isCopiedAll ? 'Đã Copy 4 Agents' : 'Copy Cả 4 Agents'}</span>
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition"
              aria-label="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-6 pt-3 border-b border-border bg-card overflow-x-auto scrollbar-thin">
          {AGENT_ROLES.map((role) => {
            const isActive = activeTab === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setActiveTab(role.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
              >
                {getRoleIcon(role.id)}
                <span>{role.title}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
                  {role.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Active Role Summary Card */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-card border border-border text-primary shadow-sm shrink-0">
                {getRoleIcon(currentRole.id)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {currentRole.title}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Sẵn sàng sử dụng
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentRole.summary}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopyPrompt(currentRole.id, currentRole.systemPrompt)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md hover:bg-primary/90 transition shrink-0 w-full sm:w-auto justify-center"
            >
              {copiedRole === currentRole.id ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Đã Sao Chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao Chép System Prompt</span>
                </>
              )}
            </button>
          </div>

          {/* System Prompt Codeblock Viewer */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" />
                <span className="ml-2 font-semibold">system_prompt_{currentRole.id}.md</span>
              </div>
              <span className="text-[10px]">Markdown UTF-8</span>
            </div>

            <pre className="p-4 text-xs font-mono text-foreground leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-96 select-text bg-card">
              {currentRole.systemPrompt}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span>Đưa prompt này vào bất kỳ mô hình AI (Claude, GPT-4o, Gemini 2.0) để kích hoạt agent tương ứng.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-accent text-foreground text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
