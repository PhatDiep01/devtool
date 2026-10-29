import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Send, 
  RotateCcw, 
  Check, 
  Copy, 
  Download, 
  Save, 
  Clock, 
  HardDrive, 
  ShieldCheck, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  SlidersHorizontal, 
  Layers, 
  Search, 
  FileCode, 
  Trash2, 
  Plus, 
  Sparkles, 
  Terminal, 
  ExternalLink, 
  Globe, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff,
  Code2,
  FileText,
  HelpCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ApiEndpoint, ApiEnvironment, ApiMethod } from '@/types';
import { apiDocsApi } from '@/services/api';
import { useJiraAuthStore } from '@/stores/jira-auth.store';
import { ApiMethodBadge } from './ApiMethodBadge';

interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

interface PathVariableItem {
  name: string;
  value: string;
  description?: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
}

interface ApiPostmanTesterProps {
  endpoint: ApiEndpoint;
  environments: ApiEnvironment[];
  selectedEnvironment?: ApiEnvironment;
  onSelectEnvironment?: (env: ApiEnvironment) => void;
  onSaveToSpecSuccess?: () => void;
  onSwitchToDocs?: () => void;
}

export const ApiPostmanTester: React.FC<ApiPostmanTesterProps> = ({
  endpoint,
  environments,
  selectedEnvironment,
  onSelectEnvironment,
  onSaveToSpecSuccess,
  onSwitchToDocs
}) => {
  const { user: jiraUser, token: jiraToken } = useJiraAuthStore();

  // Execution configuration
  const [method, setMethod] = useState<ApiMethod>(endpoint.method || 'GET');
  const [activeEnv, setActiveEnv] = useState<ApiEnvironment | undefined>(
    selectedEnvironment || environments[0]
  );
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [path, setPath] = useState<string>(endpoint.path || '/');
  const [runnerMode, setRunnerMode] = useState<'proxy' | 'direct'>('proxy');

  // Request Tabs: 'params' | 'pathVars' | 'headers' | 'auth' | 'body'
  const [activeReqTab, setActiveReqTab] = useState<'params' | 'pathVars' | 'headers' | 'auth' | 'body'>('params');

  // Parameters, Headers & Path Vars state
  const [queryParams, setQueryParams] = useState<KeyValueItem[]>([]);
  const [pathVariables, setPathVariables] = useState<PathVariableItem[]>([]);
  const [headers, setHeaders] = useState<KeyValueItem[]>([]);

  // Auth State
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic' | 'apiKey'>('none');
  const [bearerToken, setBearerToken] = useState<string>('');
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyLocation, setApiKeyLocation] = useState<'header' | 'query'>('header');

  // Body State
  const [bodyType, setBodyType] = useState<'none' | 'json' | 'urlencoded' | 'raw'>('none');
  const [jsonBody, setJsonBody] = useState<string>('');
  const [rawTextBody, setRawTextBody] = useState<string>('');
  const [selectedBodySampleIdx, setSelectedBodySampleIdx] = useState<number>(0);

  // Execution & Response State
  const [isLoading, setIsLoading] = useState(false);
  const [responseResult, setResponseResult] = useState<{
    status?: number;
    statusText?: string;
    durationMs?: number;
    sizeBytes?: number;
    headers?: Record<string, string>;
    body?: any;
    rawBody?: string;
    isJson?: boolean;
    error?: string;
  } | null>(null);

  // Response UI state
  const [activeRespTab, setActiveRespTab] = useState<'body' | 'headers'>('body');
  const [bodyViewFormat, setBodyViewFormat] = useState<'pretty' | 'raw'>('pretty');
  const [responseSearchTerm, setResponseSearchTerm] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSavingSample, setIsSavingSample] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('api_tester_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Extract path variables from path string (e.g. {id} or :id)
  const extractPathVariables = (pathStr: string): string[] => {
    const vars: string[] = [];
    const braceRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = braceRegex.exec(pathStr)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    const colonRegex = /:([a-zA-Z0-9_]+)/g;
    while ((match = colonRegex.exec(pathStr)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars;
  };

  // Initialize or re-sync all states from endpoint specification
  const resetFromEndpoint = () => {
    setMethod(endpoint.method || 'GET');
    setPath(endpoint.path || '/');

    // 1. Path variables
    const detectedVars = extractPathVariables(endpoint.path || '');
    const pVars: PathVariableItem[] = detectedVars.map(vName => {
      const specParam = (endpoint.parameters || []).find(p => p.name === vName && p.in === 'path');
      return {
        name: vName,
        value: specParam?.example || specParam?.default || '1',
        description: specParam?.description || ''
      };
    });
    setPathVariables(pVars);

    // 2. Query Params
    const qParams: KeyValueItem[] = (endpoint.parameters || [])
      .filter(p => p.in === 'query')
      .map((p, idx) => ({
        id: `qp_${idx}_${p.name}`,
        key: p.name,
        value: p.example || p.default || '',
        description: p.description || '',
        enabled: true
      }));
    if (qParams.length === 0) {
      qParams.push({ id: `qp_empty`, key: '', value: '', description: '', enabled: true });
    }
    setQueryParams(qParams);

    // 3. Headers
    const hList: KeyValueItem[] = [
      { id: 'h_content_type', key: 'Content-Type', value: 'application/json', description: 'Định dạng dữ liệu gửi', enabled: true },
      { id: 'h_accept', key: 'Accept', value: 'application/json', description: 'Định dạng dữ liệu nhận', enabled: true }
    ];
    (endpoint.parameters || [])
      .filter(p => p.in === 'header')
      .forEach((p, idx) => {
        hList.push({
          id: `h_spec_${idx}_${p.name}`,
          key: p.name,
          value: p.example || p.default || '',
          description: p.description || '',
          enabled: true
        });
      });
    setHeaders(hList);

    // 4. Auth
    if (endpoint.auth_type === 'bearer') {
      setAuthType('bearer');
    } else if (endpoint.auth_type === 'basic') {
      setAuthType('basic');
    } else if (endpoint.auth_type === 'apikey') {
      setAuthType('apiKey');
    } else {
      setAuthType('none');
    }

    // 5. Body
    const upperMethod = (endpoint.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH'].includes(upperMethod)) {
      setBodyType('json');
      const firstSample = endpoint.request_bodies?.[0]?.body;
      if (firstSample) {
        try {
          const parsed = JSON.parse(firstSample);
          setJsonBody(JSON.stringify(parsed, null, 2));
        } catch {
          setJsonBody(firstSample);
        }
      } else {
        setJsonBody('{\n  \n}');
      }
    } else {
      setBodyType('none');
      setJsonBody('');
    }

    // If there were path variables, default active tab to 'pathVars'
    if (detectedVars.length > 0) {
      setActiveReqTab('pathVars');
    } else if (['POST', 'PUT', 'PATCH'].includes(upperMethod)) {
      setActiveReqTab('body');
    } else {
      setActiveReqTab('params');
    }
  };

  // Sync when endpoint changes
  useEffect(() => {
    resetFromEndpoint();
    setResponseResult(null);
  }, [endpoint.id]);

  // Keep active environment in sync with prop
  useEffect(() => {
    if (selectedEnvironment) {
      setActiveEnv(selectedEnvironment);
    }
  }, [selectedEnvironment]);

  // Compute interpolated URL
  const { fullTargetUrl, computedPath, queryParamString } = useMemo(() => {
    let resolvedPath = path;

    // Substitute path variables
    pathVariables.forEach(pv => {
      if (pv.name && pv.value) {
        resolvedPath = resolvedPath
          .replace(new RegExp(`\\{${pv.name}\\}`, 'g'), encodeURIComponent(pv.value))
          .replace(new RegExp(`:${pv.name}\\b`, 'g'), encodeURIComponent(pv.value));
      }
    });

    // Compute Query params
    const activeQps = queryParams.filter(q => q.enabled && q.key.trim());
    const searchParams = new URLSearchParams();
    activeQps.forEach(q => {
      searchParams.append(q.key.trim(), q.value);
    });

    // Add apiKey if in query
    if (authType === 'apiKey' && apiKeyLocation === 'query' && apiKeyName.trim() && apiKeyValue.trim()) {
      searchParams.append(apiKeyName.trim(), apiKeyValue.trim());
    }

    const qStr = searchParams.toString();
    const base = customBaseUrl.trim() 
      ? customBaseUrl.trim().replace(/\/+$/, '') 
      : activeEnv?.url?.replace(/\/+$/, '') || 'https://api.internal.domain';

    const cleanPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
    const full = `${base}${cleanPath}${qStr ? `?${qStr}` : ''}`;

    return {
      fullTargetUrl: full,
      computedPath: cleanPath,
      queryParamString: qStr
    };
  }, [path, pathVariables, queryParams, activeEnv, customBaseUrl, authType, apiKeyLocation, apiKeyName, apiKeyValue]);

  // JSON Body format / validate
  const jsonValidity = useMemo(() => {
    if (bodyType !== 'json' || !jsonBody.trim()) return { isValid: true, error: null };
    try {
      JSON.parse(jsonBody);
      return { isValid: true, error: null };
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }
  }, [bodyType, jsonBody]);

  const handleFormatJson = () => {
    if (!jsonBody.trim()) return;
    try {
      const parsed = JSON.parse(jsonBody);
      setJsonBody(JSON.stringify(parsed, null, 2));
      toast.success('Đã làm đẹp JSON!');
    } catch (err: any) {
      toast.error('JSON không hợp lệ: ' + err.message);
    }
  };

  const handleMinifyJson = () => {
    if (!jsonBody.trim()) return;
    try {
      const parsed = JSON.parse(jsonBody);
      setJsonBody(JSON.stringify(parsed));
      toast.success('Đã nén JSON 1 dòng!');
    } catch (err: any) {
      toast.error('JSON không hợp lệ: ' + err.message);
    }
  };

  // 1-Click Fill Jira Token
  const handleUseJiraToken = () => {
    if (!jiraToken) {
      toast.error('Bạn chưa đăng nhập Jira. Vui lòng đăng nhập tại menu Quản lý Jira');
      return;
    }
    setAuthType('bearer');
    setBearerToken(jiraToken);
    toast.success('Đã nạp Token phiên Jira của bạn!');
  };

  // Keyboard shortcut Ctrl+Enter to Send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Execute Request (Postman Send)
  const handleSendRequest = async () => {
    if (isLoading) return;

    // Build headers object
    const reqHeaders: Record<string, string> = {};
    headers.filter(h => h.enabled && h.key.trim()).forEach(h => {
      reqHeaders[h.key.trim()] = h.value;
    });

    // Apply Auth
    if (authType === 'bearer' && bearerToken.trim()) {
      reqHeaders['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
    } else if (authType === 'basic' && (basicUser || basicPass)) {
      const credentials = btoa(`${basicUser}:${basicPass}`);
      reqHeaders['Authorization'] = `Basic ${credentials}`;
    } else if (authType === 'apiKey' && apiKeyLocation === 'header' && apiKeyName.trim() && apiKeyValue.trim()) {
      reqHeaders[apiKeyName.trim()] = apiKeyValue.trim();
    }

    // Prepare body
    let finalBody: any = undefined;
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
    if (isMutation) {
      if (bodyType === 'json' && jsonBody.trim()) {
        try {
          finalBody = JSON.parse(jsonBody);
        } catch {
          finalBody = jsonBody;
        }
      } else if (bodyType === 'raw' && rawTextBody.trim()) {
        finalBody = rawTextBody;
      }
    }

    setIsLoading(true);
    setResponseResult(null);

    const startTime = performance.now();

    try {
      if (runnerMode === 'proxy') {
        // Mode 1: Backend Proxy (Node.js Proxy - Bỏ qua CORS tuyệt đối)
        const proxyRes = await apiDocsApi.proxyTest({
          url: fullTargetUrl,
          method,
          headers: reqHeaders,
          body: finalBody,
          timeoutMs: 30000
        });

        const data = proxyRes.data;
        setResponseResult({
          status: data.status,
          statusText: data.statusText,
          durationMs: data.durationMs,
          sizeBytes: data.sizeBytes,
          headers: data.headers,
          body: data.body,
          rawBody: data.rawBody,
          isJson: data.isJson
        });

        // Add to history
        addHistoryItem(method, fullTargetUrl, data.status, data.durationMs);

      } else {
        // Mode 2: Direct Browser Fetch (Yêu cầu API đích hỗ trợ CORS)
        const fetchOptions: RequestInit = {
          method,
          headers: reqHeaders,
          body: isMutation && finalBody ? (typeof finalBody === 'object' ? JSON.stringify(finalBody) : finalBody) : undefined
        };

        const response = await fetch(fullTargetUrl, fetchOptions);
        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        const contentType = response.headers.get('content-type') || '';
        let respData: any;
        let rawBodyStr = '';
        let isJson = false;

        if (contentType.includes('application/json')) {
          respData = await response.json();
          rawBodyStr = JSON.stringify(respData, null, 2);
          isJson = true;
        } else {
          rawBodyStr = await response.text();
          respData = rawBodyStr;
        }

        const resHeaders: Record<string, string> = {};
        response.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });

        setResponseResult({
          status: response.status,
          statusText: response.statusText,
          durationMs,
          sizeBytes: new Blob([rawBodyStr]).size,
          headers: resHeaders,
          body: respData,
          rawBody: rawBodyStr,
          isJson
        });

        addHistoryItem(method, fullTargetUrl, response.status, durationMs);
      }
    } catch (err: any) {
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      let errorMsg = err.response?.data?.error || err.message || 'Không thể kết nối đến máy chủ';
      if (runnerMode === 'direct' && err.message?.includes('Failed to fetch')) {
        errorMsg += '\n\n💡 LƯU Ý: Yêu cầu bị chặn bởi chính sách CORS của trình duyệt. Vui lòng chuyển sang chế độ "Proxy Server (Bỏ qua CORS)" ở thanh công cụ phía trên để gọi được mọi API.';
      }

      setResponseResult({
        durationMs,
        error: errorMsg
      });

      addHistoryItem(method, fullTargetUrl, 0, durationMs);
    } finally {
      setIsLoading(false);
    }
  };

  const addHistoryItem = (m: string, u: string, st?: number, dMs?: number) => {
    const item: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      method: m,
      url: u,
      status: st,
      durationMs: dMs
    };
    setHistory(prev => {
      const next = [item, ...prev.slice(0, 9)];
      try {
        localStorage.setItem('api_tester_history', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Copy Response Body
  const handleCopyResponseBody = () => {
    if (!responseResult?.rawBody && !responseResult?.body) return;
    const text = responseResult.rawBody || (typeof responseResult.body === 'object' ? JSON.stringify(responseResult.body, null, 2) : String(responseResult.body));
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success('Đã sao chép toàn bộ phản hồi!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Download Response
  const handleDownloadResponse = () => {
    if (!responseResult?.rawBody && !responseResult?.body) return;
    const text = responseResult.rawBody || (typeof responseResult.body === 'object' ? JSON.stringify(responseResult.body, null, 2) : String(responseResult.body));
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${endpoint.method}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file phản hồi!');
  };

  // Save Response as Example to Endpoint Spec
  const handleSaveAsSampleToSpec = async () => {
    if (!responseResult || !responseResult.status) return;
    try {
      setIsSavingSample(true);
      const sampleName = `Mẫu thực tế (${responseResult.status} ${responseResult.statusText || 'OK'}) - ${new Date().toLocaleDateString('vi-VN')}`;
      const payloadBody = responseResult.rawBody || (typeof responseResult.body === 'object' ? JSON.stringify(responseResult.body, null, 2) : String(responseResult.body));
      
      await apiDocsApi.saveResponseAsExample(endpoint.id, {
        statusCode: responseResult.status,
        description: `Phản hồi thực tế từ Postman Runner [${responseResult.status}]`,
        name: sampleName,
        body: payloadBody
      });

      toast.success(`Đã lưu kết quả thành công vào mục Responses của ${endpoint.title}!`);
      if (onSaveToSpecSuccess) {
        onSaveToSpecSuccess();
      }
    } catch (err: any) {
      toast.error('Lỗi khi lưu phản hồi vào tài liệu: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingSample(false);
    }
  };

  // Format bytes
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-background select-text overflow-hidden">
      {/* 1. TOP CONTROL BAR: Environment, Runner Mode, Sync buttons */}
      <div className="px-4 py-2.5 border-b border-border bg-card/50 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Environment Selector */}
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1 rounded-xl">
            <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
            <select
              value={activeEnv?.id || 'custom'}
              onChange={e => {
                const found = environments.find(env => env.id === e.target.value);
                if (found) {
                  setActiveEnv(found);
                  setCustomBaseUrl('');
                  if (onSelectEnvironment) onSelectEnvironment(found);
                } else {
                  setActiveEnv(undefined);
                }
              }}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer text-xs"
            >
              {environments.map(env => (
                <option key={env.id} value={env.id} className="bg-card text-foreground">
                  {env.name} ({env.url.replace(/^https?:\/\//, '').split('/')[0]})
                </option>
              ))}
              <option value="custom" className="bg-card text-foreground">Tự nhập Custom URL...</option>
            </select>
          </div>

          {/* Custom Base URL if selected */}
          {(!activeEnv || activeEnv.id === 'custom') && (
            <input
              type="text"
              value={customBaseUrl}
              onChange={e => setCustomBaseUrl(e.target.value)}
              placeholder="https://your-api.domain.com"
              className="px-2.5 py-1 bg-muted/40 border border-border rounded-xl text-xs font-mono w-56 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          )}

          {/* Proxy Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-xl border border-border">
            <button
              onClick={() => setRunnerMode('proxy')}
              title="Gửi qua Node.js Backend: Bỏ qua hoàn toàn giới hạn CORS & Certificate lỗi thời"
              className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                runnerMode === 'proxy'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Proxy BE (Không sợ CORS)
            </button>
            <button
              onClick={() => setRunnerMode('direct')}
              title="Gửi trực tiếp từ trình duyệt"
              className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                runnerMode === 'direct'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Trình duyệt
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={resetFromEndpoint}
            title="Khôi phục lại toàn bộ thông số mặc định từ đặc tả"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors font-medium text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Nạp lại từ đặc tả
          </button>

          {onSwitchToDocs && (
            <button
              onClick={onSwitchToDocs}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors font-medium text-xs"
            >
              <FileText className="w-3.5 h-3.5 text-primary" /> Xem tài liệu (Docs)
            </button>
          )}
        </div>
      </div>

      {/* 2. POSTMAN URL & SEND BAR */}
      <div className="p-4 border-b border-border bg-card/30 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Method Selector */}
          <div className="relative shrink-0">
            <select
              value={method}
              onChange={e => setMethod(e.target.value as ApiMethod)}
              className={`h-11 px-3.5 rounded-xl font-bold text-xs border appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-colors ${
                method === 'GET' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' :
                method === 'POST' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' :
                method === 'PUT' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' :
                method === 'DELETE' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' :
                'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
              }`}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
          </div>

          {/* Full Target URL Input Bar */}
          <div className="flex-1 flex items-center bg-muted/40 border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary rounded-xl px-3.5 h-11 transition-all min-w-0">
            <span className="text-muted-foreground font-mono text-xs select-none pr-1 truncate hidden md:inline-block max-w-[200px]">
              {activeEnv?.url || customBaseUrl || 'https://api.internal.domain'}
            </span>
            <input
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/api/v1/resource/{id}"
              className="flex-1 bg-transparent font-mono text-xs sm:text-sm text-foreground focus:outline-none min-w-0 font-semibold"
            />
            {queryParamString && (
              <span className="text-amber-500/80 font-mono text-xs truncate max-w-[120px] select-none pl-1" title={`?${queryParamString}`}>
                ?{queryParamString}
              </span>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendRequest}
            disabled={isLoading}
            className="h-11 px-6 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg disabled:opacity-60 transition-all flex items-center justify-center gap-2 shrink-0 select-none active:scale-98"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white/20 rounded font-mono text-white/90">
                  Ctrl+↵
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Resolved Path Variables inline hint if any */}
        {pathVariables.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Code2 className="w-3 h-3 text-primary" /> Path variables:
            </span>
            {pathVariables.map(pv => (
              <span key={pv.name} className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md font-mono border border-border">
                <span className="text-primary font-bold">:{pv.name}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-foreground font-semibold">{pv.value || '(trống)'}</span>
              </span>
            ))}
            <span className="text-xs text-muted-foreground/60">(chỉnh sửa ở tab "Path Vars" bên dưới)</span>
          </div>
        )}
      </div>

      {/* 3. SPLIT WORKSPACE: Upper Request Builder + Lower Response Console */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* UPPER: Request Config Tabs */}
        <div className="flex-1 flex flex-col min-h-[220px] max-h-[48%] border-b border-border bg-card/10 overflow-hidden">
          {/* Tabs bar */}
          <div className="flex items-center border-b border-border px-4 bg-muted/20 shrink-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveReqTab('params')}
              className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReqTab === 'params'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Params</span>
              {queryParams.filter(q => q.enabled && q.key.trim()).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                  {queryParams.filter(q => q.enabled && q.key.trim()).length}
                </span>
              )}
            </button>

            {pathVariables.length > 0 && (
              <button
                onClick={() => setActiveReqTab('pathVars')}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeReqTab === 'pathVars'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Path Vars</span>
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center">
                  {pathVariables.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveReqTab('headers')}
              className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReqTab === 'headers'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Headers</span>
              {headers.filter(h => h.enabled && h.key.trim()).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-muted-foreground/20 text-foreground text-[10px] font-bold flex items-center justify-center">
                  {headers.filter(h => h.enabled && h.key.trim()).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveReqTab('auth')}
              className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReqTab === 'auth'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Auth</span>
              {authType !== 'none' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              onClick={() => setActiveReqTab('body')}
              className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeReqTab === 'body'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Body</span>
              {bodyType !== 'none' && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 text-xs">
            {/* 1. QUERY PARAMS TAB */}
            {activeReqTab === 'params' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground font-semibold px-2">
                  <span>Query Parameters</span>
                  <button
                    onClick={() => {
                      setQueryParams(prev => [
                        ...prev,
                        { id: `qp_${Date.now()}`, key: '', value: '', description: '', enabled: true }
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm param
                  </button>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-card/60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground">
                        <th className="py-1.5 px-3 w-10 text-center">Bật</th>
                        <th className="py-1.5 px-3 w-1/3">Key (Tên tham số)</th>
                        <th className="py-1.5 px-3 w-1/3">Value (Giá trị)</th>
                        <th className="py-1.5 px-3">Mô tả</th>
                        <th className="py-1.5 px-3 w-10 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {queryParams.map((qp, idx) => (
                        <tr key={qp.id} className="hover:bg-muted/20">
                          <td className="py-1 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={qp.enabled}
                              onChange={e => {
                                const next = [...queryParams];
                                next[idx].enabled = e.target.checked;
                                setQueryParams(next);
                              }}
                              className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-1 px-3">
                            <input
                              type="text"
                              value={qp.key}
                              onChange={e => {
                                const next = [...queryParams];
                                next[idx].key = e.target.value;
                                setQueryParams(next);
                              }}
                              placeholder="key"
                              className="w-full bg-transparent font-mono focus:outline-none text-foreground placeholder:text-muted-foreground/40 font-semibold"
                            />
                          </td>
                          <td className="py-1 px-3">
                            <input
                              type="text"
                              value={qp.value}
                              onChange={e => {
                                const next = [...queryParams];
                                next[idx].value = e.target.value;
                                setQueryParams(next);
                              }}
                              placeholder="value"
                              className="w-full bg-transparent font-mono focus:outline-none text-foreground placeholder:text-muted-foreground/40"
                            />
                          </td>
                          <td className="py-1 px-3">
                            <input
                              type="text"
                              value={qp.description || ''}
                              onChange={e => {
                                const next = [...queryParams];
                                next[idx].description = e.target.value;
                                setQueryParams(next);
                              }}
                              placeholder="Mô tả..."
                              className="w-full bg-transparent focus:outline-none text-muted-foreground placeholder:text-muted-foreground/30 text-[11px]"
                            />
                          </td>
                          <td className="py-1 px-3 text-center">
                            <button
                              onClick={() => {
                                setQueryParams(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. PATH VARIABLES TAB */}
            {activeReqTab === 'pathVars' && (
              <div className="space-y-2">
                <div className="text-muted-foreground font-semibold px-2">
                  <span>Tham số đường dẫn (Path Variables)</span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-card/60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground">
                        <th className="py-1.5 px-3 w-1/3">Variable (Tên biến)</th>
                        <th className="py-1.5 px-3 w-1/3">Value (Giá trị thay thế)</th>
                        <th className="py-1.5 px-3">Mô tả đặc tả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pathVariables.map((pv, idx) => (
                        <tr key={pv.name} className="hover:bg-muted/20">
                          <td className="py-1.5 px-3 font-mono font-bold text-primary">
                            :{pv.name}
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={pv.value}
                              onChange={e => {
                                const next = [...pathVariables];
                                next[idx].value = e.target.value;
                                setPathVariables(next);
                              }}
                              placeholder={`Nhập ${pv.name}...`}
                              className="w-full px-2 py-1 bg-muted/40 border border-border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-muted-foreground text-[11px]">
                            {pv.description || 'Tham số ID trên URL'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. HEADERS TAB */}
            {activeReqTab === 'headers' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                  <span className="text-muted-foreground font-semibold">Request Headers</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setHeaders(prev => [
                          ...prev,
                          { id: `h_corr_${Date.now()}`, key: 'X-Correlation-ID', value: crypto.randomUUID(), description: 'Tracing ID', enabled: true }
                        ]);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-0.5 rounded-lg border border-border"
                    >
                      + X-Correlation-ID
                    </button>
                    <button
                      onClick={() => {
                        setHeaders(prev => [
                          ...prev,
                          { id: `h_nocache_${Date.now()}`, key: 'Cache-Control', value: 'no-cache', description: 'Bỏ qua cache', enabled: true }
                        ]);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-0.5 rounded-lg border border-border"
                    >
                      + No-Cache
                    </button>
                    <button
                      onClick={() => {
                        setHeaders(prev => [
                          ...prev,
                          { id: `h_${Date.now()}`, key: '', value: '', description: '', enabled: true }
                        ]);
                      }}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm header
                    </button>
                  </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-card/60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground">
                        <th className="py-1.5 px-3 w-10 text-center">Bật</th>
                        <th className="py-1.5 px-3 w-1/3">Header Name</th>
                        <th className="py-1.5 px-3 w-1/3">Header Value</th>
                        <th className="py-1.5 px-3">Mô tả</th>
                        <th className="py-1.5 px-3 w-10 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {headers.map((h, idx) => (
                        <tr key={h.id} className="hover:bg-muted/20">
                          <td className="py-1 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={h.enabled}
                              onChange={e => {
                                const next = [...headers];
                                next[idx].enabled = e.target.checked;
                                setHeaders(next);
                              }}
                              className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-1 px-3">
                            <input
                              type="text"
                              value={h.key}
                              onChange={e => {
                                const next = [...headers];
                                next[idx].key = e.target.value;
                                setHeaders(next);
                              }}
                              placeholder="Header-Name"
                              className="w-full bg-transparent font-mono focus:outline-none text-foreground placeholder:text-muted-foreground/40 font-semibold"
                            />
                          </td>
                          <td className="py-1 px-3">
                            <input
                              type="text"
                              value={h.value}
                              onChange={e => {
                                const next = [...headers];
                                next[idx].value = e.target.value;
                                setHeaders(next);
                              }}
                              placeholder="value"
                              className="w-full bg-transparent font-mono focus:outline-none text-foreground placeholder:text-muted-foreground/40"
                            />
                          </td>
                          <td className="py-1 px-3">
                            <input
                              type="text"
                              value={h.description || ''}
                              onChange={e => {
                                const next = [...headers];
                                next[idx].description = e.target.value;
                                setHeaders(next);
                              }}
                              placeholder="Mô tả..."
                              className="w-full bg-transparent focus:outline-none text-muted-foreground placeholder:text-muted-foreground/30 text-[11px]"
                            />
                          </td>
                          <td className="py-1 px-3 text-center">
                            <button
                              onClick={() => {
                                setHeaders(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. AUTH TAB */}
            {activeReqTab === 'auth' && (
              <div className="space-y-4 max-w-xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-muted-foreground">Loại xác thực:</span>
                  <div className="flex flex-wrap gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                    <button
                      onClick={() => setAuthType('none')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        authType === 'none' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Không dùng (No Auth)
                    </button>
                    <button
                      onClick={() => setAuthType('bearer')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        authType === 'bearer' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Bearer Token
                    </button>
                    <button
                      onClick={() => setAuthType('basic')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        authType === 'basic' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Basic Auth
                    </button>
                    <button
                      onClick={() => setAuthType('apiKey')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        authType === 'apiKey' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      API Key
                    </button>
                  </div>
                </div>

                {/* Bearer Token Form */}
                {authType === 'bearer' && (
                  <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-foreground">Token (JWT / Bearer)</label>
                      {jiraToken && (
                        <button
                          onClick={handleUseJiraToken}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-bold"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Lấy token Jira hiện tại ({jiraUser?.displayName || 'User'})
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showBearerToken ? 'text' : 'password'}
                        value={bearerToken}
                        onChange={e => setBearerToken(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full pr-10 px-3 py-2 bg-card border border-border rounded-xl font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBearerToken(!showBearerToken)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showBearerToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Basic Auth Form */}
                {authType === 'basic' && (
                  <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-xl">
                    <div>
                      <label className="font-semibold text-foreground mb-1 block">Username</label>
                      <input
                        type="text"
                        value={basicUser}
                        onChange={e => setBasicUser(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3 py-2 bg-card border border-border rounded-xl font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-foreground mb-1 block">Password</label>
                      <input
                        type="password"
                        value={basicPass}
                        onChange={e => setBasicPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-card border border-border rounded-xl font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {/* API Key Form */}
                {authType === 'apiKey' && (
                  <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-xl">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-foreground mb-1 block">Key Name</label>
                        <input
                          type="text"
                          value={apiKeyName}
                          onChange={e => setApiKeyName(e.target.value)}
                          placeholder="X-API-Key"
                          className="w-full px-3 py-2 bg-card border border-border rounded-xl font-mono text-xs text-foreground focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-foreground mb-1 block">Vị trí gửi</label>
                        <select
                          value={apiKeyLocation}
                          onChange={e => setApiKeyLocation(e.target.value as any)}
                          className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
                        >
                          <option value="header">Header</option>
                          <option value="query">Query Parameter</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-foreground mb-1 block">Key Value</label>
                      <input
                        type="text"
                        value={apiKeyValue}
                        onChange={e => setApiKeyValue(e.target.value)}
                        placeholder="your-secret-api-key"
                        className="w-full px-3 py-2 bg-card border border-border rounded-xl font-mono text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. BODY TAB */}
            {activeReqTab === 'body' && (
              <div className="flex flex-col h-full space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-muted-foreground">Định dạng:</span>
                    <div className="flex gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                      <button
                        onClick={() => setBodyType('none')}
                        className={`px-2 py-0.5 rounded font-semibold ${bodyType === 'none' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                      >
                        none
                      </button>
                      <button
                        onClick={() => setBodyType('json')}
                        className={`px-2 py-0.5 rounded font-semibold ${bodyType === 'json' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                      >
                        raw (JSON)
                      </button>
                      <button
                        onClick={() => setBodyType('raw')}
                        className={`px-2 py-0.5 rounded font-semibold ${bodyType === 'raw' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                      >
                        raw (Text)
                      </button>
                    </div>
                  </div>

                  {bodyType === 'json' && (
                    <div className="flex items-center gap-2">
                      {/* Multiple samples dropdown if available */}
                      {endpoint.request_bodies && endpoint.request_bodies.length > 1 && (
                        <select
                          value={selectedBodySampleIdx}
                          onChange={e => {
                            const idx = Number(e.target.value);
                            setSelectedBodySampleIdx(idx);
                            const sample = endpoint.request_bodies[idx]?.body;
                            if (sample) {
                              try {
                                setJsonBody(JSON.stringify(JSON.parse(sample), null, 2));
                              } catch {
                                setJsonBody(sample);
                              }
                            }
                          }}
                          className="px-2 py-1 bg-muted/60 border border-border rounded-lg text-xs text-foreground focus:outline-none"
                        >
                          {endpoint.request_bodies.map((b, i) => (
                            <option key={i} value={i}>
                              {b.name || `Sample ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={handleFormatJson}
                        className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border font-medium text-[11px] inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" /> Làm đẹp
                      </button>
                      <button
                        onClick={handleMinifyJson}
                        className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border font-medium text-[11px]"
                      >
                        Nén 1 dòng
                      </button>
                    </div>
                  )}
                </div>

                {bodyType === 'json' && (
                  <div className="flex-1 flex flex-col min-h-0 relative">
                    <textarea
                      value={jsonBody}
                      onChange={e => setJsonBody(e.target.value)}
                      placeholder='{\n  "key": "value"\n}'
                      className="w-full flex-1 p-3 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none shadow-inner leading-relaxed"
                    />
                    {!jsonValidity.isValid && (
                      <div className="mt-1 flex items-center gap-1.5 text-red-500 text-[11px] font-mono">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Cú pháp JSON lỗi: {jsonValidity.error}</span>
                      </div>
                    )}
                  </div>
                )}

                {bodyType === 'raw' && (
                  <textarea
                    value={rawTextBody}
                    onChange={e => setRawTextBody(e.target.value)}
                    placeholder="Nhập nội dung văn bản thuần..."
                    className="w-full flex-1 p-3 font-mono text-xs bg-slate-950 text-slate-100 rounded-xl border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                )}

                {bodyType === 'none' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <p className="text-xs">Yêu cầu này không đính kèm Request Body.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* LOWER: Response Console (Postman View) */}
        <div className="flex-1 flex flex-col min-h-0 bg-card overflow-hidden">
          {/* Response Status Header */}
          <div className="px-4 py-2 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">Response</span>

              {responseResult?.status ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-xs flex items-center gap-1 ${
                      responseResult.status >= 200 && responseResult.status < 300
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : responseResult.status >= 300 && responseResult.status < 400
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                        : responseResult.status >= 400 && responseResult.status < 500
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                    }`}
                  >
                    <span>{responseResult.status}</span>
                    <span>{responseResult.statusText || 'OK'}</span>
                  </span>

                  {responseResult.durationMs !== undefined && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
                      <Clock className="w-3.5 h-3.5" /> {responseResult.durationMs} ms
                    </span>
                  )}

                  {responseResult.sizeBytes !== undefined && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
                      <HardDrive className="w-3.5 h-3.5" /> {formatBytes(responseResult.sizeBytes)}
                    </span>
                  )}
                </div>
              ) : responseResult?.error ? (
                <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-red-500/15 text-red-500 border border-red-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Lỗi kết nối
                </span>
              ) : null}
            </div>

            {/* Response Actions */}
            {responseResult && !responseResult.error && (
              <div className="flex items-center gap-1.5">
                {/* Save to Spec Button */}
                <button
                  onClick={handleSaveAsSampleToSpec}
                  disabled={isSavingSample}
                  title="Lưu kết quả phản hồi này thành mẫu ví dụ trong tài liệu đặc tả của Endpoint"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  {isSavingSample ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Lưu vào Đặc tả</span>
                </button>

                <button
                  onClick={handleCopyResponseBody}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Sao chép toàn bộ phản hồi"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleDownloadResponse}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Tải xuống file JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Response Content Tabs & Viewer */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-xs font-semibold text-foreground">Đang gửi request & chờ phản hồi từ máy chủ...</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1 max-w-md text-center truncate">
                  {fullTargetUrl}
                </p>
              </div>
            ) : responseResult ? (
              responseResult.error ? (
                /* ERROR STATE */
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Không thể nhận phản hồi</span>
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/90 leading-relaxed bg-background/50 p-3 rounded-lg border border-border">
                      {responseResult.error}
                    </pre>
                  </div>
                </div>
              ) : (
                /* SUCCESSFUL / HTTP RESPONSE STATE */
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Response Tabs (Body / Headers) */}
                  <div className="flex items-center justify-between border-b border-border px-4 bg-muted/10 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveRespTab('body')}
                        className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors ${
                          activeRespTab === 'body'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Body
                      </button>
                      <button
                        onClick={() => setActiveRespTab('headers')}
                        className={`py-2 px-3 text-xs font-bold border-b-2 transition-colors ${
                          activeRespTab === 'headers'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Headers ({Object.keys(responseResult.headers || {}).length})
                      </button>
                    </div>

                    {activeRespTab === 'body' && (
                      <div className="flex items-center gap-2">
                        {/* Search input in response */}
                        <div className="flex items-center gap-1 bg-muted/40 px-2 py-0.5 rounded-lg border border-border">
                          <Search className="w-3 h-3 text-muted-foreground" />
                          <input
                            type="text"
                            value={responseSearchTerm}
                            onChange={e => setResponseSearchTerm(e.target.value)}
                            placeholder="Tìm trong kết quả..."
                            className="bg-transparent text-[11px] font-mono text-foreground focus:outline-none w-28 sm:w-36"
                          />
                        </div>

                        {/* Format buttons */}
                        <div className="flex gap-1 bg-muted/60 p-0.5 rounded-lg">
                          <button
                            onClick={() => setBodyViewFormat('pretty')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              bodyViewFormat === 'pretty' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                            }`}
                          >
                            Pretty
                          </button>
                          <button
                            onClick={() => setBodyViewFormat('raw')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              bodyViewFormat === 'raw' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
                            }`}
                          >
                            Raw
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  {activeRespTab === 'body' && (
                    <div className="flex-1 overflow-auto p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed select-text scrollbar-thin">
                      <pre className="whitespace-pre-wrap break-all">
                        {bodyViewFormat === 'pretty' && responseResult.isJson
                          ? JSON.stringify(responseResult.body, null, 2)
                          : responseResult.rawBody || JSON.stringify(responseResult.body, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Headers Content */}
                  {activeRespTab === 'headers' && (
                    <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                      <div className="border border-border rounded-xl overflow-hidden bg-card">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground text-[11px]">
                              <th className="py-2 px-3 w-1/3">Header Name</th>
                              <th className="py-2 px-3">Header Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {Object.entries(responseResult.headers || {}).map(([hk, hv]) => (
                              <tr key={hk} className="hover:bg-muted/20">
                                <td className="py-1.5 px-3 font-mono font-semibold text-primary">{hk}</td>
                                <td className="py-1.5 px-3 font-mono text-foreground break-all">{hv}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* EMPTY IDLE STATE */
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center mb-3">
                  <Terminal className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-xs font-bold text-foreground mb-1">Chưa gửi request nào</h4>
                <p className="text-[11px] text-muted-foreground max-w-sm mb-4">
                  Bấm nút <span className="font-semibold text-primary">Send</span> hoặc phím tắt <kbd className="px-1 py-0.5 bg-muted rounded font-mono text-[10px]">Ctrl+Enter</kbd> để kiểm thử trực tiếp API này.
                </p>

                {/* Quick History Pills */}
                {history.length > 0 && (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">Lịch sử gọi gần đây:</span>
                    <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
                      {history.slice(0, 3).map(h => (
                        <button
                          key={h.id}
                          onClick={() => {
                            setMethod(h.method as ApiMethod);
                          }}
                          className="px-2 py-0.5 bg-muted/50 hover:bg-muted rounded-md text-[10px] font-mono border border-border flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="font-bold">{h.method}</span>
                          <span className="truncate max-w-[120px]">{h.url.split('?')[0].split('/').pop()}</span>
                          {h.status ? (
                            <span className={h.status < 400 ? 'text-emerald-500' : 'text-red-500'}>[{h.status}]</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
