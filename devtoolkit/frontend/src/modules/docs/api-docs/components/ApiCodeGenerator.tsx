import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  Terminal, 
  Play, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Settings,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiEndpoint, ApiEnvironment } from '@/types';
import { generateSnippet, CodeLanguage } from '../utils/codeGenerators';
import { apiDocsApi } from '@/services/api';

interface ApiCodeGeneratorProps {
  endpoint: ApiEndpoint;
  environments: ApiEnvironment[];
  selectedEnvironment?: ApiEnvironment;
  onSelectEnvironment: (env: ApiEnvironment) => void;
  activeRequestIndex?: number;
  onOpenPostmanTester?: () => void;
}

const LANGUAGES: Array<{ id: CodeLanguage; label: string }> = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript (Angular)' },
  { id: 'csharp', label: 'C# (HttpClient)' },
  { id: 'python', label: 'Python' }
];

export const ApiCodeGenerator: React.FC<ApiCodeGeneratorProps> = ({
  endpoint,
  environments,
  selectedEnvironment,
  onSelectEnvironment,
  activeRequestIndex = 0,
  onOpenPostmanTester
}) => {
  const [activeTab, setActiveTab] = useState<'snippet' | 'tester'>('snippet');
  const [language, setLanguage] = useState<CodeLanguage>(() => {
    return (localStorage.getItem('api_code_lang') as CodeLanguage) || 'curl';
  });
  const [copied, setCopied] = useState(false);

  // Fast Runner / Tester states
  const [testToken, setTestToken] = useState('');
  const [testBody, setTestBody] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    status?: number;
    statusText?: string;
    durationMs?: number;
    data?: any;
    headers?: Record<string, string>;
    error?: string;
  } | null>(null);

  // Sync test body when endpoint changes
  useEffect(() => {
    const sample = endpoint.request_bodies?.[activeRequestIndex] || endpoint.request_bodies?.[0];
    setTestBody(sample?.body || '');
    setTestResult(null);
  }, [endpoint.id, activeRequestIndex]);

  const handleSelectLanguage = (lang: CodeLanguage) => {
    setLanguage(lang);
    localStorage.setItem('api_code_lang', lang);
  };

  const codeSnippet = generateSnippet(language, {
    endpoint,
    environment: selectedEnvironment,
    activeRequestIndex
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    toast.success(`Đã sao chép mã ${language.toUpperCase()}!`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fast Runner Execute
  const handleRunTest = async () => {
    const baseUrl = selectedEnvironment?.url?.replace(/\/+$/, '') || '';
    if (!baseUrl) {
      toast.error('Vui lòng chọn môi trường gọi API');
      return;
    }

    // Safety warning for production or mutation methods
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method.toUpperCase());
    const isProd = selectedEnvironment?.id === 'prod' || baseUrl.includes('api.internal.domain');

    if (isProd && isMutation) {
      if (!window.confirm(`⚠️ CẢNH BÁO NGUY HIỂM: Bạn đang chuẩn bị gửi request [${endpoint.method}] làm thay đổi dữ liệu lên môi trường PRODUCTION (${baseUrl}). Bạn có chắc chắn muốn tiếp tục?`)) {
        return;
      }
    }

    let pathVal = endpoint.path;
    const pathParams = (endpoint.parameters || []).filter(p => p.in === 'path');
    for (const p of pathParams) {
      const v = p.example || p.default || '1';
      pathVal = pathVal.replace(`{${p.name}}`, v).replace(`:${p.name}`, v);
    }

    const fullUrl = `${baseUrl}${pathVal.startsWith('/') ? '' : '/'}${pathVal}`;
    const startTime = performance.now();
    setIsRunning(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (testToken.trim()) {
        headers['Authorization'] = testToken.startsWith('Bearer ') ? testToken : `Bearer ${testToken}`;
      }

      let parsedBody: any = undefined;
      if (isMutation && testBody.trim()) {
        try {
          parsedBody = JSON.parse(testBody);
        } catch {
          parsedBody = testBody;
        }
      }

      // Execute via Backend Proxy to prevent browser CORS blocks
      const proxyRes = await apiDocsApi.proxyTest({
        url: fullUrl,
        method: endpoint.method,
        headers,
        body: parsedBody
      });

      const resData = proxyRes.data;
      setTestResult({
        status: resData.status,
        statusText: resData.statusText,
        durationMs: resData.durationMs,
        data: resData.body,
        headers: resData.headers
      });
    } catch (err: any) {
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);
      setTestResult({
        durationMs,
        error: `Không thể kết nối hoặc lỗi Proxy: ${err.response?.data?.error || err.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none">
      {/* Top Header: Environment selector */}
      <div className="p-3 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-primary" /> Môi trường
          </span>
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
            {selectedEnvironment?.url || 'Chưa chọn'}
          </span>
        </div>

        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-lg">
          {environments.map(env => {
            const isSelected = selectedEnvironment?.id === env.id;
            return (
              <button
                key={env.id}
                onClick={() => onSelectEnvironment(env)}
                className={`flex-1 py-1 px-2 text-xs font-semibold rounded-md transition-all ${
                  isSelected
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {env.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs: Code Snippet / Tester */}
      <div className="flex border-b border-border px-3 bg-muted/10 shrink-0">
        <button
          onClick={() => setActiveTab('snippet')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'snippet'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> Mã gọi mẫu
        </button>
        <button
          onClick={() => setActiveTab('tester')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'tester'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Play className="w-3.5 h-3.5 text-emerald-500" /> Thử gọi (Runner)
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0">
        {activeTab === 'snippet' ? (
          /* CODE SNIPPET TAB */
          <div className="flex flex-col flex-1 p-3">
            {/* Language Selector pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none shrink-0">
              {LANGUAGES.map(l => (
                <button
                  key={l.id}
                  onClick={() => handleSelectLanguage(l.id)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap transition-colors ${
                    language === l.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Code Block with copy button */}
            <div className="relative flex-1 mt-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 flex flex-col overflow-hidden shadow-inner font-mono text-xs">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 shrink-0">
                <span className="text-[11px] font-semibold">{language.toUpperCase()}</span>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Đã copy' : 'Copy'}
                </button>
              </div>

              <div className="flex-1 p-3 overflow-auto scrollbar-thin select-text">
                <pre className="whitespace-pre leading-relaxed">{codeSnippet}</pre>
              </div>

              {/* Safe Token Placeholder Notice */}
              <div className="p-2 bg-slate-900/60 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Header xác thực sử dụng placeholder <code className="text-amber-400">&lt;TOKEN&gt;</code> an toàn.</span>
              </div>
            </div>
          </div>
        ) : (
          /* FAST TEST RUNNER TAB */
          <div className="p-3 space-y-3 flex-1 flex flex-col">
            {onOpenPostmanTester && (
              <button
                onClick={onOpenPostmanTester}
                className="w-full py-2 px-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" /> Mở Postman Tester đầy đủ 🚀
              </button>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Authorization Token (chỉ lưu phiên này)
              </label>
              <input
                type="text"
                value={testToken}
                onChange={e => setTestToken(e.target.value)}
                placeholder="Bearer eyJhbGciOi..."
                className="w-full px-2.5 py-1.5 text-xs bg-muted/30 border border-border rounded-lg font-mono focus:outline-none focus:border-primary"
              />
            </div>

            {['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase()) && (
              <div className="flex-1 flex flex-col min-h-[140px]">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Request Body JSON
                </label>
                <textarea
                  value={testBody}
                  onChange={e => setTestBody(e.target.value)}
                  rows={6}
                  className="w-full flex-1 p-2 text-xs font-mono bg-muted/20 border border-border rounded-lg focus:outline-none focus:border-primary select-text"
                />
              </div>
            )}

            <button
              onClick={handleRunTest}
              disabled={isRunning}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isRunning ? 'Đang gửi request...' : `Gửi [${endpoint.method}] tới ${selectedEnvironment?.name.split(' ')[0]}`}
            </button>

            {/* Test Results Output */}
            {testResult && (
              <div className="flex-1 flex flex-col rounded-xl border border-border overflow-hidden bg-muted/10">
                <div className="flex items-center justify-between p-2.5 border-b border-border bg-muted/30 text-xs">
                  <div className="flex items-center gap-2">
                    {testResult.status ? (
                      <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                        testResult.status >= 200 && testResult.status < 300 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {testResult.status} {testResult.statusText}
                      </span>
                    ) : (
                      <span className="font-bold text-red-500">Lỗi kết nối</span>
                    )}
                  </div>
                  {testResult.durationMs !== undefined && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                      <Clock className="w-3 h-3" /> {testResult.durationMs}ms
                    </span>
                  )}
                </div>

                <div className="flex-1 p-2.5 overflow-auto text-xs font-mono select-text scrollbar-thin">
                  {testResult.error ? (
                    <div className="text-red-500 text-[11px] leading-relaxed whitespace-pre-wrap">
                      {testResult.error}
                    </div>
                  ) : (
                    <pre className="whitespace-pre leading-relaxed text-foreground">
                      {typeof testResult.data === 'object'
                        ? JSON.stringify(testResult.data, null, 2)
                        : String(testResult.data)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
