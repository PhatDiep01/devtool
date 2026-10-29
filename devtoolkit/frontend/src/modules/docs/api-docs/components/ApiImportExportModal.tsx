import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileCode, 
  Terminal, 
  Layers, 
  Check, 
  AlertCircle,
  FileText,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiDocsApi } from '../../../../services/api';

interface ApiImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  onImportSuccess?: () => void;
}

export const ApiImportExportModal: React.FC<ApiImportExportModalProps> = ({
  isOpen,
  onClose,
  moduleId,
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importType, setImportType] = useState<'openapi' | 'postman' | 'curl'>('openapi');
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'skip' | 'keep_both'>('overwrite');

  const [rawInput, setRawInput] = useState('');
  const [folderName, setFolderName] = useState('Chung');
  const [isProcessing, setIsProcessing] = useState(false);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setRawInput(content);
      toast.success(`Đã nạp file ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!rawInput.trim()) {
      toast.error('Vui lòng dán nội dung hoặc chọn file tải lên');
      return;
    }

    try {
      setIsProcessing(true);

      if (importType === 'curl') {
        const res = await apiDocsApi.importCurl({
          curl: rawInput.trim(),
          moduleId,
          folder: folderName || 'Chung'
        });
        toast.success(res.data.message || 'Đã tạo endpoint từ cURL!');
        setRawInput('');
        onImportSuccess?.();
        onClose();
        return;
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawInput);
      } catch (err: any) {
        toast.error('Nội dung không phải JSON hợp lệ. Vui lòng kiểm tra lại!');
        return;
      }

      if (importType === 'openapi') {
        const res = await apiDocsApi.importOpenApi({
          spec: parsedJson,
          moduleId,
          defaultFolder: folderName || 'OpenAPI Import',
          conflictStrategy
        });
        toast.success(res.data.message || 'Nhập OpenAPI thành công!');
        setRawInput('');
        onImportSuccess?.();
        onClose();
      } else if (importType === 'postman') {
        const res = await apiDocsApi.importPostman({
          collection: parsedJson,
          moduleId,
          conflictStrategy
        });
        toast.success(res.data.message || 'Nhập Postman Collection thành công!');
        setRawInput('');
        onImportSuccess?.();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportOpenApi = () => {
    const url = apiDocsApi.getExportOpenApiUrl(moduleId, 'v1');
    window.open(url, '_blank');
  };

  const handleExportMarkdown = () => {
    const url = apiDocsApi.getExportMarkdownUrl(moduleId);
    window.open(url, '_blank');
  };

  const handleExportHtml = () => {
    const mdUrl = apiDocsApi.getExportMarkdownUrl(moduleId);
    fetch(mdUrl)
      .then(res => res.text())
      .then(mdContent => {
        const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>API Documentation - Handover Export</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px 20px; background: #0d1117; color: #c9d1d9; }
    .markdown-body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; background: #161b22; border-radius: 16px; border: 1px solid #30363d; }
    @media (max-width: 767px) { .markdown-body { padding: 15px; } }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <article class="markdown-body" id="content">Đang tải...</article>
  <script>
    const markdown = ${JSON.stringify(mdContent)};
    document.getElementById('content').innerHTML = marked.parse(markdown);
  </script>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `api-docs-module-${moduleId}.html`;
        a.click();
        toast.success('Đã xuất file HTML tĩnh độc lập!');
      })
      .catch(err => toast.error('Không thể tạo file HTML: ' + err.message));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Nhập / Xuất Tài Liệu API</h2>
              <p className="text-xs text-muted-foreground">Tương thích với OpenAPI/Swagger, Postman, cURL và tài liệu Markdown/HTML</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border px-6 bg-muted/10 shrink-0">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'import' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="w-4 h-4" /> Nhập dữ liệu (Import)
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'export' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Download className="w-4 h-4" /> Xuất tài liệu (Export)
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto scrollbar-thin flex-1 space-y-5">
          {activeTab === 'import' ? (
            /* IMPORT TAB */
            <div className="space-y-4">
              {/* Format selection */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Định dạng nguồn</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setImportType('openapi')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      importType === 'openapi'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <FileCode className="w-5 h-5 mb-1 text-primary" />
                    <div className="font-bold text-xs">OpenAPI / Swagger</div>
                    <div className="text-[10px] opacity-80">JSON hoặc 3.0 spec</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportType('postman')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      importType === 'postman'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Layers className="w-5 h-5 mb-1 text-amber-500" />
                    <div className="font-bold text-xs">Postman Collection</div>
                    <div className="text-[10px] opacity-80">Định dạng v2.1 JSON</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportType('curl')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      importType === 'curl'
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Terminal className="w-5 h-5 mb-1 text-emerald-500" />
                    <div className="font-bold text-xs">Lệnh cURL</div>
                    <div className="text-[10px] opacity-80">Dán 1 lệnh cURL gọi API</div>
                  </button>
                </div>
              </div>

              {/* Duplicate Strategy & Folder */}
              {importType !== 'curl' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Xử lý khi trùng lặp endpoint</label>
                    <select
                      value={conflictStrategy}
                      onChange={e => setConflictStrategy(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg text-foreground focus:outline-none"
                    >
                      <option value="overwrite">Ghi đè nội dung cũ (Khuyến nghị)</option>
                      <option value="skip">Bỏ qua nếu đã tồn tại</option>
                      <option value="keep_both">Giữ cả hai (Thêm đuôi copy)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Thư mục mặc định</label>
                    <input
                      type="text"
                      value={folderName}
                      onChange={e => setFolderName(e.target.value)}
                      placeholder="Chung / Import"
                      className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Paste or Upload Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {importType === 'curl' ? 'Dán lệnh cURL vào đây:' : 'Dán chuỗi JSON hoặc tải file:'}
                  </label>
                  {importType !== 'curl' && (
                    <label className="text-xs text-primary font-semibold hover:underline cursor-pointer">
                      <span>Chọn file từ máy</span>
                      <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                    </label>
                  )}
                </div>

                <textarea
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  placeholder={
                    importType === 'curl'
                      ? 'curl -X POST https://api.internal.domain/api/v1/surveys -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d \'{"title": "Khảo sát"}\''
                      : '{\n  "openapi": "3.0.3",\n  "paths": { ... }\n}'
                  }
                  rows={8}
                  className="w-full p-3 text-xs font-mono bg-muted/20 border border-border rounded-xl focus:border-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExecuteImport}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isProcessing ? 'Đang phân tích & nhập...' : 'Bắt đầu Nhập'}
                </button>
              </div>
            </div>
          ) : (
            /* EXPORT TAB */
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tài liệu API có thể được xuất ra dưới nhiều định dạng tiêu chuẩn để phục vụ việc chia sẻ cho đối tác, kẹp vào tài liệu bàn giao hoặc đẩy lên các công cụ API testing:
              </p>

              <div className="space-y-3">
                {/* OpenAPI 3.0 Export */}
                <div className="p-4 border border-border rounded-xl bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">OpenAPI 3.0.3 Specification (JSON)</div>
                      <div className="text-[11px] text-muted-foreground">Chuẩn quốc tế để nạp vào Swagger UI, Postman hoặc Redoc</div>
                    </div>
                  </div>
                  <button
                    onClick={handleExportOpenApi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải JSON
                  </button>
                </div>

                {/* Markdown Export */}
                <div className="p-4 border border-border rounded-xl bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">Tài Liệu Toàn Diện (Markdown)</div>
                      <div className="text-[11px] text-muted-foreground">Dành cho BA, Dev kẹp vào Jira, Confluence hoặc Git repository</div>
                    </div>
                  </div>
                  <button
                    onClick={handleExportMarkdown}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải Markdown
                  </button>
                </div>

                {/* Single-file HTML Export */}
                <div className="p-4 border border-border rounded-xl bg-card hover:border-primary/50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">Trang Web Tĩnh Độc Lập (.html)</div>
                      <div className="text-[11px] text-muted-foreground">Mở trực tiếp trên mọi trình duyệt mà không cần cài đặt thêm phần mềm</div>
                    </div>
                  </div>
                  <button
                    onClick={handleExportHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải HTML
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
