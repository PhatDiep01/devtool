import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseJwt, verifyJwtSignature } from '../engine/jwt';
import { ParsedJwt, JwtValidityStatus } from '../types';

const SAMPLE_JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InYxIn0.eyJpc3MiOiJodHRwczovL2F1dGguZGV2dG9vbGtpdC52biIsInN1YiI6InVzcl85ODc2NTQzMjEiLCJhdWQiOlsiZGV2dG9vbGtpdC1hcGkiLCJtYW5hZ2VtZW50LXBvcnRhbCJdLCJleHAiOjE4OTM0NTYwMDAsIm5iZiI6MTYwOTQ1OTIwMCwiaWF0IjoxNjA5NDU5MjAwLCJqdGkiOiJmMWYyZjNmNC1hMWExLWIyYjItYzNjMy1kNGQ0ZDRkNGQ0ZDQiLCJuYW1lIjoiTmd1eeG7h24gVsSDbiBBIiwiZW1haWwiOiJ2YW5hLmRldkBleGFtcGxlLmNvbSIsInJvbGVzIjpbImFkbWluIiwiZGV2ZWxvcGVyIl0sImRlcHQiOiJFbmdpbmVlcmluZyJ9.qZpL493F-wH9gNcr_m5uA2T33_1xZ61yH883L6N39g8`;

export const JwtTab: React.FC = () => {
  const [tokenInput, setTokenInput] = useState<string>(SAMPLE_JWT);
  const [secretKey, setSecretKey] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{ checked: boolean; valid: boolean; message: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Parsed JWT state
  const parsed: ParsedJwt = useMemo(() => parseJwt(tokenInput), [tokenInput]);

  // Reset verification when token or secret changes
  useEffect(() => {
    setVerificationResult(null);
  }, [tokenInput, secretKey]);

  // Copy helper
  const handleCopy = async (text: string, keyIdentifier: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyIdentifier);
      toast.success('Đã sao chép vào Clipboard!');
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  // Paste token
  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        setTokenInput(text.trim());
        toast.success('Đã dán JWT từ Clipboard');
      }
    } catch {
      toast.error('Vui lòng dùng phím Ctrl+V');
    }
  };

  // Clear
  const handleClear = () => {
    setTokenInput('');
    setSecretKey('');
    setVerificationResult(null);
  };

  // Verify Signature
  const handleVerify = async () => {
    if (!parsed.isValid) {
      toast.error('Token JWT không hợp lệ, không thể xác minh chữ ký.');
      return;
    }
    if (!secretKey.trim()) {
      toast.error('Vui lòng nhập khóa bí mật (Secret Key) hoặc Public Key PEM.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyJwtSignature(
        parsed.rawHeader,
        parsed.rawPayload,
        parsed.rawSignature,
        parsed.algorithm,
        secretKey
      );
      setVerificationResult({ checked: true, valid: res.valid, message: res.message });
      if (res.valid) {
        toast.success('Chữ ký hoàn toàn hợp lệ!');
      } else {
        toast.error('Chữ ký không hợp lệ!');
      }
    } catch (err: any) {
      setVerificationResult({ checked: true, valid: false, message: err?.message || 'Lỗi kiểm tra chữ ký' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: JwtValidityStatus, msg: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{msg}</span>
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>{msg}</span>
          </span>
        );
      case 'not_yet_valid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            <span>{msg}</span>
          </span>
        );
      case 'no_exp':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Info className="w-3.5 h-3.5" />
            <span>{msg}</span>
          </span>
        );
      case 'malformed':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{msg}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 text-foreground">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Bảo mật 100% Client-Side:</strong> Giải mã trực tiếp trong trình duyệt máy bạn, không gửi token hay khóa bí mật lên máy chủ. <em>Tuyệt đối không dán token thật của Production vào các website online trôi nổi bên ngoài.</em>
          </span>
        </div>
      </div>

      {/* Alg: None Warning Banner */}
      {parsed.isAlgNone && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2.5 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>CẢNH BÁO: Token này sử dụng thuật toán ký "none" - Không có chữ ký bảo vệ (Insecure JWT)!</span>
        </div>
      )}

      {/* Main Grid: Left Token Input, Right Decoded Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (5 cols): Token Raw Input with 3-part syntax coloring */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-primary" />
              <span>Dán chuỗi JWT (Mã hóa)</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTokenInput(SAMPLE_JWT)}
                className="px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                Ví dụ
              </button>
              <button
                type="button"
                onClick={handlePaste}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                title="Dán từ Clipboard"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={!tokenInput}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition disabled:opacity-40"
                title="Xóa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[300px]">
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.trim())}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
              className="w-full h-full p-4 bg-transparent resize-none font-mono text-xs focus:outline-none border-0 text-foreground placeholder:text-muted-foreground/60 leading-relaxed break-all"
              spellCheck={false}
            />
          </div>

          {/* Color Breakdown Legend */}
          <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-around text-[11px] font-semibold">
            <span className="text-rose-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Header
            </span>
            <span className="text-violet-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              Payload
            </span>
            <span className="text-cyan-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
              Signature
            </span>
          </div>
        </div>

        {/* Right Column (7 cols): Decoded Header, Payload, Signature */}
        <div className="lg:col-span-7 space-y-4">
          {/* Status Header */}
          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Trạng thái:</span>
              {renderStatusBadge(parsed.status, parsed.statusMessage)}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Thuật toán: <strong className="text-foreground font-mono">{parsed.algorithm}</strong>
              </span>
              <span>
                Loại: <strong className="text-foreground font-mono">{parsed.tokenType}</strong>
              </span>
            </div>
          </div>

          {/* Structure Error if any */}
          {parsed.errors.structure && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {parsed.errors.structure}
            </div>
          )}

          {/* 1. HEADER BOX (Rose) */}
          <div className="rounded-2xl bg-card border border-rose-500/30 overflow-hidden shadow-xs">
            <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                HEADER: Thuật toán & Loại Token
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy(parsed.rawHeader, 'rawHeader')}
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Copy chuỗi Base64 Header gốc"
                >
                  {copiedKey === 'rawHeader' ? 'Đã copy' : 'Copy Base64'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(parsed.formattedHeaderJson, 'headerJson')}
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Copy JSON Header"
                >
                  {copiedKey === 'headerJson' ? 'Đã copy' : 'Copy JSON'}
                </button>
              </div>
            </div>
            <div className="p-3 font-mono text-xs text-foreground bg-muted/10 overflow-x-auto">
              {parsed.errors.header ? (
                <div className="text-destructive">{parsed.errors.header}</div>
              ) : (
                <pre className="whitespace-pre">{parsed.formattedHeaderJson || '{}'}</pre>
              )}
            </div>
          </div>

          {/* 2. PAYLOAD BOX (Violet) */}
          <div className="rounded-2xl bg-card border border-violet-500/30 overflow-hidden shadow-xs">
            <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 flex items-center justify-between">
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                PAYLOAD: Dữ liệu & Các Claim
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy(parsed.rawPayload, 'rawPayload')}
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition"
                  title="Copy chuỗi Base64 Payload gốc"
                >
                  {copiedKey === 'rawPayload' ? 'Đã copy' : 'Copy Base64'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(parsed.formattedPayloadJson, 'payloadJson')}
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition"
                  title="Copy JSON Payload"
                >
                  {copiedKey === 'payloadJson' ? 'Đã copy' : 'Copy JSON'}
                </button>
              </div>
            </div>
            <div className="p-3 font-mono text-xs text-foreground bg-muted/10 overflow-x-auto max-h-64 overflow-y-auto">
              {parsed.errors.payload ? (
                <div className="text-destructive">{parsed.errors.payload}</div>
              ) : (
                <pre className="whitespace-pre">{parsed.formattedPayloadJson || '{}'}</pre>
              )}
            </div>
          </div>

          {/* 3. SIGNATURE VERIFICATION BOX (Cyan) */}
          <div className="rounded-2xl bg-card border border-cyan-500/30 overflow-hidden shadow-xs">
            <div className="px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                SIGNATURE: Chữ ký số & Xác minh
              </span>
              <button
                type="button"
                onClick={() => handleCopy(parsed.rawSignature, 'signature')}
                className="px-2 py-0.5 rounded text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition"
              >
                {copiedKey === 'signature' ? 'Đã copy' : 'Copy Signature'}
              </button>
            </div>

            <div className="p-3 space-y-3 bg-muted/10">
              <div className="font-mono text-xs text-foreground break-all bg-card/60 p-2.5 rounded-xl border border-border">
                {parsed.rawSignature || '(Không có chữ ký)'}
              </div>

              {/* Secret Key Input & Verify Button */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    <span>Kiểm tra chữ ký (Secret Key cho HMAC / Public Key PEM cho RS256):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecret ? 'Ẩn' : 'Hiện'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Nhập secret key (ví dụ: your-256-bit-secret)..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-card border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={isVerifying || !secretKey}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
                  >
                    {isVerifying ? 'Đang kiểm tra...' : 'Xác minh'}
                  </button>
                </div>

                {verificationResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      verificationResult.valid
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-destructive/10 border border-destructive/30 text-destructive'
                    }`}
                  >
                    {verificationResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{verificationResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CLAIMS TABLE DETAILS */}
      {parsed.claims.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
              <span>Bảng Giải Thích Các Claim ({parsed.claims.length})</span>
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Bao gồm giải nghĩa chuẩn RFC 7519 và thời gian địa phương
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-2.5 px-4 w-36">Claim</th>
                  <th className="py-2.5 px-4 w-52">Ý nghĩa chuẩn</th>
                  <th className="py-2.5 px-4">Giá trị (Value)</th>
                  <th className="py-2.5 px-4 w-44">Thời gian / Chi tiết</th>
                  <th className="py-2.5 px-4 w-20 text-right">Copy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {parsed.claims.map((claim) => (
                  <tr key={claim.key} className="hover:bg-muted/20 transition group">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                      {claim.key}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                      {claim.label}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-foreground break-all">
                      {typeof claim.value === 'object'
                        ? JSON.stringify(claim.value)
                        : String(claim.value)}
                    </td>
                    <td className="py-2.5 px-4 text-[11px]">
                      {claim.formattedTime ? (
                        <div>
                          <div className="font-semibold text-foreground">{claim.formattedTime}</div>
                          <div className="text-muted-foreground">{claim.relativeTime}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            typeof claim.value === 'object'
                              ? JSON.stringify(claim.value)
                              : String(claim.value),
                            `claim_${claim.key}`
                          )
                        }
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Copy giá trị"
                      >
                        {copiedKey === `claim_${claim.key}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
