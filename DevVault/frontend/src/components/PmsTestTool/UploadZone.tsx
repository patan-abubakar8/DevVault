import React, { useState, useRef, useCallback } from 'react';
import { Upload, AlertCircle, FileCode, X, ArrowLeft } from 'lucide-react';
import type { ProjectTypeOption } from './types';

const PROJECT_TYPES: ProjectTypeOption[] = [
  {
    id: 'DotNet',
    label: '.NET',
    icon: <FileCode size={24} />,
    desc: 'C# services & controllers',
    files: '.cs files or .zip',
    color: '#818cf8'
  },
  {
    id: 'Node',
    label: 'Node.js',
    icon: <FileCode size={24} />,
    desc: 'JS/TS services & controllers',
    files: '.js/.ts files or .zip',
    color: '#34d399'
  },
  {
    id: 'Spring',
    label: 'Spring Boot',
    icon: <FileCode size={24} />,
    desc: 'Java services & controllers',
    files: '.java files or .zip',
    color: '#fbbf24'
  },
];

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface UploadZoneProps {
  onAnalyzed: (data: any) => void;
  onError?: (msg: string) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onAnalyzed, onError }) => {
  const [step, setStep] = useState<'select-type' | 'upload'>('select-type');
  const [projectType, setProjectType] = useState<ProjectTypeOption | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSelectedFiles([]);
    setError(null);
    setProgress(0);
  }, []);

  function handleTypeSelect(type: ProjectTypeOption) {
    setProjectType(type);
    setStep('upload');
    reset();
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList);
    const invalid = files.some(f => !f.name.endsWith('.zip') &&
      !f.name.endsWith('.cs') && !f.name.endsWith('.js') &&
      !f.name.endsWith('.ts') && !f.name.endsWith('.java'));
    if (invalid) {
      setError('Unsupported file type. Use .cs, .js, .ts, .java, or .zip');
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
    setError(null);
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || !projectType) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));
    formData.append('projectType', projectType.id);

    try {
      const res = await fetch('http://localhost:5252/api/ProjectTest/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      for (let i = 10; i <= 90; i += 20) {
        await new Promise(r => setTimeout(r, 80));
        setProgress(i);
      }

      const data = await res.json();
      setProgress(100);
      await new Promise(r => setTimeout(r, 400));
      onAnalyzed(data);
    } catch (err: any) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setUploading(false);
    }
  }

  function getAcceptedFormats() {
    switch (projectType?.id) {
      case 'DotNet': return '.cs,.zip';
      case 'Node': return '.js,.ts,.zip';
      case 'Spring': return '.java,.zip';
      default: return '.zip';
    }
  }

  if (step === 'select-type') {
    return (
      <div className="upload-section page-transition">
        <div className="upload-header">
          <h2>Select Project Type</h2>
          <p>Choose your project framework to enable language-specific analysis and test generation.</p>
        </div>
        <div className="project-type-grid">
          {PROJECT_TYPES.map(type => (
            <div key={type.id} className="project-type-card" onClick={() => handleTypeSelect(type)}>
              <div className="pt-icon" style={{ background: type.color + '20', color: type.color }}>
                {type.icon}
              </div>
              <h3>{type.label}</h3>
              <p className="pt-desc">{type.desc}</p>
              <span className="pt-files">{type.files}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="upload-section page-transition">
      <div className="upload-header">
        <div className="upload-breadcrumb">
          <button className="breadcrumb-link" onClick={() => { setStep('select-type'); reset(); }}>
            <ArrowLeft size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Project Type
          </button>
          <span className="breadcrumb-sep">→</span>
          <span className="breadcrumb-current">{projectType?.label}</span>
        </div>
        <p style={{ marginTop: '0.5rem' }}>Upload <strong>.zip</strong> archive or individual source files.</p>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={getAcceptedFormats()}
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />

        {uploading ? (
          <div className="upload-progress">
            <div className="progress-ring">
              <svg viewBox="0 0 36 36">
                <path className="ring-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path className="ring-fill"
                  strokeDasharray={`${progress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.5" className="ring-text">{progress}%</text>
              </svg>
            </div>
            <div className="upload-status">
              <p className="status-title">Analyzing {projectType?.label} Project</p>
              <p className="status-sub">Scanning services, controllers, and methods...</p>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="upload-icon">
              <Upload size={32} />
            </div>
            <h3>Drop files here</h3>
            <p className="upload-hint">or click to browse — .zip, {projectType?.id === 'DotNet' ? '.cs' : projectType?.id === 'Node' ? '.js/.ts' : '.java'} files</p>
            <div className="upload-formats">
              <span>ZIP archives</span>
              <span>Source files</span>
              <span>Max 500 MB</span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="upload-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {selectedFiles.length > 0 && !uploading && (
        <div className="selected-files">
          <div className="selected-files-header">
            <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
            <button className="clear-btn" onClick={() => setSelectedFiles([])}>Clear all</button>
          </div>
          <div className="file-list">
            {selectedFiles.map((f, i) => (
              <div key={i} className="file-item">
                <FileCode size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="file-name">{f.name}</span>
                <span className="file-size">{formatBytes(f.size)}</span>
                <button className="file-remove" onClick={() => removeFile(i)}><X size={14} /></button>
              </div>
            ))}
          </div>
          <button className="upload-submit-btn" onClick={handleUpload}>
            <Upload size={16} />
            Analyze {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      <div className="upload-tips">
        <h4>How it works</h4>
        <ul>
          <li>Select your project type first, then upload source files</li>
          <li>Upload a <code>.zip</code> of the whole project, or pick individual source files</li>
          <li>Classes ending with <code>Service</code> / <code>Controller</code> are auto-detected</li>
          <li>Test scenarios are dynamically customized based on method names</li>
        </ul>
      </div>
    </div>
  );
};
