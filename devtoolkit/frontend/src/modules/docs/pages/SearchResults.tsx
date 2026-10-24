import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FileText, ArrowRight, CornerDownRight } from 'lucide-react';
import { docsApi } from '../../../services/api';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    docsApi.search(query)
      .then(res => setResults(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Search Results</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Showing matching results for query: <b className="text-foreground">"{query}"</b>
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <span>Searching database...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-sm">
          <Search className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <h4 className="text-base font-bold text-foreground">No matching specifications found</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Try searching for screen titles, API endpoints (GET /api/...), business rules, or author names.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/docs/screen/${r.id}`)}
              className="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-4 sm:p-5 cursor-pointer shadow-sm group hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-accent text-muted-foreground">
                  {r.module_name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{new Date(r.updated_at).toLocaleDateString()}</span>
              </div>

              <h3 
                className="text-base font-bold text-foreground group-hover:text-primary transition-colors"
                dangerouslySetInnerHTML={{ __html: r.title_hl || r.title }}
              />

              {r.snippet && (
                <div 
                  className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-muted/20 p-2.5 rounded-xl border border-border/50 font-mono"
                  dangerouslySetInnerHTML={{ __html: r.snippet }}
                />
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                <span>Author: {r.author}</span>
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <span>View specification</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
