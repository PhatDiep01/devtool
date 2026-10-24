import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { docsApi } from '../../../services/api';
import { Module } from '../../../types';

export const ImportScreen: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    docsApi.getModules().then(res => {
      setModules(res.data);
    });
  }, []);

  const processFile = (selected: File) => {
    if (!selected.name.endsWith('.md')) {
      setError('Vui lòng chọn file Markdown (.md) hợp lệ');
      return;
    }

    setError(null);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string || '');
    };
    reader.readAsText(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedModuleId) formData.append('moduleId', selectedModuleId);

    try {
      const res = await docsApi.importScreen(formData);
      navigate(`/docs/screen/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      <button
        onClick={() => navigate('/docs')}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Documents</span>
      </button>

      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Import Handover Document</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Upload a Markdown (.md) file created using the standard Screen Specification Template.
        </p>
      </div>

      <form onSubmit={handleImport} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">Target Module</label>
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-primary font-medium"
            >
              <option value="">✨ Tự động nhận diện nhóm từ Frontmatter (.md)</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon || '📁'} {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              If the markdown frontmatter specifies a module name, it will automatically match or register it.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">Markdown Specification File</label>
            <div 
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) processFile(droppedFile);
              }}
              className="border-2 border-dashed border-border rounded-2xl p-6 sm:p-10 text-center hover:bg-muted/10 transition-colors"
            >
              <input
                type="file"
                id="md-upload"
                accept=".md"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="md-upload" className="cursor-pointer space-y-2 block">
                <FileText className="w-8 h-8 mx-auto text-primary" />
                <div className="text-sm font-semibold text-foreground">
                  {file ? file.name : 'Nhấp để chọn hoặc kéo thả file .md vào đây'}
                </div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Định dạng chuẩn: Frontmatter + Các phần đặc tả (Tổng quan, Features, Business Rules, API, DB, QA)
                </p>
              </label>
            </div>
          </div>
        </div>

        {fileContent && (
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Raw Content Preview</h4>
            <pre className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs font-mono max-h-60 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-all scrollbar-thin">
              {fileContent}
            </pre>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/docs')}
            className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-accent text-muted-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !file}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>{loading ? 'Parsing & Saving...' : 'Import & View Document'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
