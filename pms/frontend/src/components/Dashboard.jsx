import { useState, useMemo } from 'react'

function ParamTag({ p }) {
  return <span className="param-tag" title={`${p.type} ${p.name}`}>{p.type} {p.name}</span>
}

function MethodRow({ method, expanded: parentExpanded }) {
  const [expanded, setExpanded] = useState(false)
  const show = parentExpanded || expanded

  return (
    <div className={`method-row ${show ? 'expanded' : ''}`}>
      <div className="method-head" onClick={() => setExpanded(!expanded)}>
        <div className="method-signature">
          <span className={`method-vis ${method.isPublic ? 'pub' : 'pri'}`}>
            {method.isPublic ? 'pub' : 'pri'}
          </span>
          <span className="method-ret">{method.returnType}</span>
          <span className="method-name">{method.name}</span>
          <span className="method-paren">(</span>
          <span className="method-params">
            {method.parameters?.length > 0 ? (
              method.parameters.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="param-sep">, </span>}
                  <ParamTag p={p} />
                </span>
              ))
            ) : (
              <span className="no-params">none</span>
            )}
          </span>
          <span className="method-paren">)</span>
        </div>
        <div className="method-meta">
          <span className="param-count">{method.parameters?.length || 0} params</span>
          <span className={`chevron ${show ? 'open' : ''}`}>▼</span>
        </div>
      </div>
      {show && method.parameters?.length > 0 && (
        <div className="method-detail">
          <div className="detail-table">
            <div className="detail-header">
              <span>Parameter</span>
              <span>Type</span>
              <span>Default</span>
            </div>
            {method.parameters.map((p, i) => (
              <div key={i} className="detail-row">
                <span className="detail-name">{p.name}</span>
                <span className="detail-type">{p.type}</span>
                <span className="detail-default">{p.hasDefaultValue ? p.defaultValue : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClassCard({ item, type }) {
  const [expanded, setExpanded] = useState(false)
  const publicMethods = item.methods?.filter(m => m.isPublic) || []
  const privateMethods = item.methods?.filter(m => !m.isPublic) || []

  return (
    <div className={`class-card ${type} ${expanded ? 'expanded' : ''}`}>
      <div className="class-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="class-card-icon">
          {type === 'service' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          )}
        </div>
        <div className="class-card-info">
          <h3>{item.name}</h3>
          <span className="class-ns">{item.namespace}</span>
        </div>
        <div className="class-card-stats">
          <span className="method-stat" title="Public methods">{publicMethods.length} pub</span>
          <span className="method-stat sec" title="Private methods">{privateMethods.length} pri</span>
          {type === 'controller' && item.routePrefix && (
            <span className="route-badge">{item.routePrefix}</span>
          )}
        </div>
        <span className={`chevron ${expanded ? 'open' : ''}`}>▼</span>
      </div>
      {expanded && (
        <div className="class-card-body">
          {item.methods?.length === 0 && (
            <div className="empty-methods">No methods detected</div>
          )}
          {item.methods?.map((m, i) => (
            <MethodRow key={i} method={m} expanded={false} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ data }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filteredServices = useMemo(() => {
    if (!data?.services) return []
    let items = data.services
    if (filter === 'services') return items
    if (filter === 'controllers') return []
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.namespace.toLowerCase().includes(q) ||
        s.methods?.some(m => m.name.toLowerCase().includes(q))
      )
    }
    return items
  }, [data?.services, search, filter])

  const filteredControllers = useMemo(() => {
    if (!data?.controllers) return []
    let items = data.controllers
    if (filter === 'services') return []
    if (filter === 'controllers') return items
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.namespace.toLowerCase().includes(q) ||
        c.methods?.some(m => m.name.toLowerCase().includes(q))
      )
    }
    return items
  }, [data?.controllers, search, filter])

  if (!data) return null

  const totalMethods = data.totalMethods
  const totalServices = data.services?.length || 0
  const totalControllers = data.controllers?.length || 0
  const totalScenarios = data.tests?.reduce((a, t) => a + (t.scenarios?.length || 0), 0) || 0

  return (
    <div className="dashboard">
      <div className="dashboard-top">
        <div>
          <h2 className="dashboard-title">Project Analysis</h2>
          <p className="dashboard-sub">{data.projectName}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card services">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalServices}</span>
            <span className="stat-label">Services</span>
          </div>
        </div>
        <div className="stat-card controllers">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalControllers}</span>
            <span className="stat-label">Controllers</span>
          </div>
        </div>
        <div className="stat-card methods">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalMethods}</span>
            <span className="stat-label">Methods</span>
          </div>
        </div>
        <div className="stat-card scenarios">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalScenarios}</span>
            <span className="stat-label">Test Scenarios</span>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search services, controllers, or methods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="filter-tabs">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-btn ${filter === 'services' ? 'active' : ''}`} onClick={() => setFilter('services')}>Services</button>
          <button className={`filter-btn ${filter === 'controllers' ? 'active' : ''}`} onClick={() => setFilter('controllers')}>Controllers</button>
        </div>
      </div>

      {search && (filter === 'all' || filter === 'services') && filteredServices.length === 0 && (
        <div className="empty-state">
          <p>No services matching "<strong>{search}</strong>"</p>
        </div>
      )}

      {filteredServices.length > 0 && (
        <section className="class-section">
          <div className="section-header">
            <h3>Services</h3>
            <span className="section-count">{filteredServices.length} found</span>
          </div>
          <div className="class-list">
            {filteredServices.map((s, i) => <ClassCard key={i} item={s} type="service" />)}
          </div>
        </section>
      )}

      {filteredControllers.length > 0 && (
        <section className="class-section">
          <div className="section-header">
            <h3>Controllers</h3>
            <span className="section-count">{filteredControllers.length} found</span>
          </div>
          <div className="class-list">
            {filteredControllers.map((c, i) => <ClassCard key={i} item={c} type="controller" />)}
          </div>
        </section>
      )}

      {filteredServices.length === 0 && filteredControllers.length === 0 && !search && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>No services or controllers detected</h3>
          <p>Make sure your project contains classes with names ending in <code>Service</code> or <code>Controller</code></p>
        </div>
      )}
    </div>
  )
}
