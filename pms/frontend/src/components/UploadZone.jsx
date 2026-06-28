import { useState, useRef, useCallback } from 'react'

const PROJECT_TYPES = [
  {
    id: 'DotNet',
    label: '.NET',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    desc: 'C# services & controllers',
    files: '.cs files or .zip',
    color: '#818cf8'
  },
  {
    id: 'Node',
    label: 'Node.js',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    desc: 'JS/TS services & controllers',
    files: '.js/.ts files or .zip',
    color: '#34d399'
  },
  {
    id: 'Spring',
    label: 'Spring Boot',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    desc: 'Java services & controllers',
    files: '.java files or .zip',
    color: '#fbbf24'
  },
]

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function UploadZone({ onAnalyzed, onError }) {
  const [step, setStep] = useState('select-type')
  const [projectType, setProjectType] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const reset = useCallback(() => {
    setSelectedFiles([])
    setError(null)
    setProgress(0)
  }, [])

  function handleTypeSelect(type) {
    setProjectType(type)
    setStep('upload')
    reset()
  }

  function addFiles(fileList) {
    const files = Array.from(fileList)
    const invalid = files.some(f => !f.name.endsWith('.zip') &&
      !f.name.endsWith('.cs') && !f.name.endsWith('.js') &&
      !f.name.endsWith('.ts') && !f.name.endsWith('.java'))
    if (invalid) {
      setError('Unsupported file type. Use .cs, .js, .ts, .java, or .zip')
      return
    }
    setSelectedFiles(prev => [...prev, ...files])
    setError(null)
  }

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    selectedFiles.forEach(f => formData.append('files', f))
    formData.append('projectType', projectType.id)

    try {
      const res = await fetch('http://localhost:5000/api/ProjectTest/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `Server error: ${res.status}`)
      }

      for (let i = 10; i <= 90; i += 20) {
        await new Promise(r => setTimeout(r, 80))
        setProgress(i)
      }

      const data = await res.json()
      setProgress(100)
      await new Promise(r => setTimeout(r, 400))
      onAnalyzed(data)
    } catch (err) {
      setError(err.message)
      onError?.(err.message)
    } finally {
      setUploading(false)
    }
  }

  function getAcceptedFormats() {
    switch (projectType?.id) {
      case 'DotNet': return '.cs,.zip'
      case 'Node': return '.js,.ts,.zip'
      case 'Spring': return '.java,.zip'
      default: return '.zip'
    }
  }

  if (step === 'select-type') {
    return (
      <div className="upload-section">
        <div className="upload-header">
          <h2>Select Project Type</h2>
          <p>Choose your project framework to enable language-specific analysis and test generation.</p>
        </div>
        <div className="project-type-grid">
          {PROJECT_TYPES.map(type => (
            <div key={type.id} className="project-type-card" onClick={() => handleTypeSelect(type)}>
              <div className="pt-icon" style={{ background: type.color + '20', color: type.color }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <h3>{type.label}</h3>
              <p className="pt-desc">{type.desc}</p>
              <span className="pt-files">{type.files}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="upload-section">
      <div className="upload-header">
        <div className="upload-breadcrumb">
          <button className="breadcrumb-link" onClick={() => { setStep('select-type'); reset() }}>
            Project Type
          </button>
          <span className="breadcrumb-sep">→</span>
          <span className="breadcrumb-current">{projectType?.label}</span>
        </div>
        <p>Upload <strong>.zip</strong> archive or individual source files.</p>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="file-name">{f.name}</span>
                <span className="file-size">{formatBytes(f.size)}</span>
                <button className="file-remove" onClick={() => removeFile(i)}>✕</button>
              </div>
            ))}
          </div>
          <button className="upload-submit-btn" onClick={handleUpload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
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
          <li>Test scenarios are generated for every public method</li>
        </ul>
      </div>
    </div>
  )
}
