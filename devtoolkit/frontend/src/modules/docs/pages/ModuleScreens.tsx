import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, Plus, Clock, Tag, User } from 'lucide-react';
import { docsApi } from '../../../services/api';
import { Screen } from '../../../types';

export const ModuleScreens: React.FC = () => {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const navigate = useNavigate();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleSlug) return;
    setLoading(true);
    docsApi.getScreensByModule(moduleSlug)
      .then(res => setScreens(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [moduleSlug]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Back button & Action */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          onClick={() => navigate('/docs')}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Modules</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/docs/screens/new')}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 sm:px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tạo Màn Hình</span>
          </button>
          <button
            onClick={() => navigate('/docs/import')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-card border border-border text-foreground hover:bg-accent rounded-xl transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Import .md</span>
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground capitalize">
          {moduleSlug?.replace(/-/g, ' ')}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Showing all screen specifications and feature designs registered under this module.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Loading screen documents...</span>
        </div>
      ) : screens.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-sm">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h4 className="text-base font-bold text-foreground">No documents yet</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            No screen handover documents have been imported into this module. You can upload an existing markdown file or use the specification template.
          </p>
          <button
            onClick={() => navigate('/docs/import')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl mt-3 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Import your first .md</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {screens.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/docs/screen/${s.id}`)}
              className="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-5 cursor-pointer group shadow-sm flex flex-col justify-between hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                    s.status === 'Published' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {s.status}
                  </span>
                  {s.jira_key && (
                    <span className="text-[11px] font-mono text-blue-500 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-md">
                      {s.jira_key}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                  {s.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                  {s.overview || 'Click to view complete features, business rules and technical specifications.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[120px]">{s.author}</span>
                </div>
                <div className="flex items-center gap-1 font-mono shrink-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{new Date(s.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
