import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, CheckSquare, Settings, ArrowRight, CornerDownLeft, X, AlignLeft, ArrowLeftRight, StickyNote } from 'lucide-react';
import { docsApi } from '../../services/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results.length > 0 && results[selectedIndex]) {
          navigate(`/docs/screen/${results[selectedIndex].id}`);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex, navigate]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await docsApi.search(query);
        setResults(resp.data || []);
        setSelectedIndex(0);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-3 sm:pt-20 p-4 animate-in fade-in"
    >
      <div 
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border gap-3 bg-muted/20">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search screens, APIs, business rules, or tasks..."
            className="flex-1 bg-transparent border-none text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded border border-border">ESC</kbd>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 sm:hidden text-muted-foreground hover:text-foreground transition"
            aria-label="Close command palette"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60dvh] sm:max-h-80 overflow-y-auto p-2 space-y-1">
          {loading && (
            <div className="p-4 text-center text-xs text-muted-foreground">Searching index...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No matching documents or records found for "{query}".
            </div>
          )}

          {results.map((res, idx) => (
            <div
              key={res.id}
              onClick={() => {
                navigate(`/docs/screen/${res.id}`);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors group ${
                selectedIndex === idx ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-accent/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedIndex === idx ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                }`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div 
                    className="text-sm font-semibold text-foreground truncate"
                    dangerouslySetInnerHTML={{ __html: res.title_hl || res.title }}
                  />
                  <div className="text-xs text-muted-foreground truncate">
                    Module: {res.module_name} • Author: {res.author}
                  </div>
                </div>
              </div>
              <ArrowRight className={`w-4 h-4 transition-colors shrink-0 ml-2 ${
                selectedIndex === idx ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
              }`} />
            </div>
          ))}

          {!query && (
            <div className="p-4 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
                Quick Navigation
              </div>
              <div
                onClick={() => { navigate('/jira'); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer text-sm"
              >
                <CheckSquare className="w-4 h-4 text-blue-500" />
                <span>Go to Jira Kanban Board</span>
              </div>
              <div
                onClick={() => { navigate('/docs'); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer text-sm"
              >
                <FileText className="w-4 h-4 text-green-500" />
                <span>Go to Handover Docs</span>
              </div>
              <div
                onClick={() => { navigate('/tools/sticky-notes'); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer text-sm"
              >
                <StickyNote className="w-4 h-4 text-amber-500" />
                <span>Open Sticky Notes (.txt)</span>
              </div>
              <div
                onClick={() => { navigate('/tools/compare-text'); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer text-sm"
              >
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                <span>Open Compare Text Online</span>
              </div>
              <div
                onClick={() => { navigate('/tools/text-formatter'); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer text-sm"
              >
                <AlignLeft className="w-4 h-4 text-emerald-500" />
                <span>Open Text Formatter Online</span>
              </div>
              <div
                onClick={() => { navigate('/settings'); onClose(); }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer text-sm"
              >
                <Settings className="w-4 h-4 text-purple-500" />
                <span>Open Settings</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="hidden sm:flex px-4 py-2 bg-muted/40 border-t border-border items-center justify-between text-[11px] text-muted-foreground">
          <span>Navigate with <b>↑</b> <b>↓</b></span>
          <span className="flex items-center gap-1">Select with <CornerDownLeft className="w-3 h-3" /></span>
        </div>
      </div>
    </div>
  );
};
