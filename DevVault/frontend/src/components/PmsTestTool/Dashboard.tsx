import React, { useState, useMemo } from 'react';
import { Search, Layers, Cpu, Code2, CheckSquare, ChevronDown } from 'lucide-react';
import type { AnalysisResult, ServiceInfo, ControllerInfo, MethodInfo, ParameterInfo } from './types';

interface ParamTagProps {
  p: ParameterInfo;
}

const ParamTag: React.FC<ParamTagProps> = ({ p }) => {
  return (
    <span className="param-tag" title={`${p.type} ${p.name}`}>
      {p.type} {p.name}
    </span>
  );
};

interface MethodRowProps {
  method: MethodInfo;
  expanded: boolean;
}

const MethodRow: React.FC<MethodRowProps> = ({ method, expanded: parentExpanded }) => {
  const [expanded, setExpanded] = useState(false);
  const show = parentExpanded || expanded;

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
          <ChevronDown className={`chevron ${show ? 'open' : ''}`} size={14} />
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
  );
};

interface ClassCardProps {
  item: ServiceInfo | ControllerInfo;
  type: 'service' | 'controller';
}

const ClassCard: React.FC<ClassCardProps> = ({ item, type }) => {
  const [expanded, setExpanded] = useState(false);
  const publicMethods = item.methods?.filter(m => m.isPublic) || [];
  const privateMethods = item.methods?.filter(m => !m.isPublic) || [];
  const routePrefix = type === 'controller' ? (item as ControllerInfo).routePrefix : null;

  return (
    <div className={`class-card ${type} ${expanded ? 'expanded' : ''}`}>
      <div className="class-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="class-card-icon">
          {type === 'service' ? (
            <Layers size={18} />
          ) : (
            <Cpu size={18} />
          )}
        </div>
        <div className="class-card-info">
          <h3>{item.name}</h3>
          <span className="class-ns">{item.namespace || 'global'}</span>
        </div>
        <div className="class-card-stats">
          <span className="method-stat" title="Public methods">{publicMethods.length} pub</span>
          <span className="method-stat sec" title="Private methods">{privateMethods.length} pri</span>
          {routePrefix && (
            <span className="route-badge">{routePrefix}</span>
          )}
        </div>
        <ChevronDown className={`chevron ${expanded ? 'open' : ''}`} size={14} />
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
  );
};

interface DashboardProps {
  data: AnalysisResult | null;
  onNavigateToTests: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onNavigateToTests }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'services' | 'controllers'>('all');

  const filteredServices = useMemo(() => {
    if (!data?.services) return [];
    let items = data.services;
    if (filter === 'controllers') return [];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.namespace.toLowerCase().includes(q) ||
        s.methods?.some(m => m.name.toLowerCase().includes(q))
      );
    }
    return items;
  }, [data?.services, search, filter]);

  const filteredControllers = useMemo(() => {
    if (!data?.controllers) return [];
    let items = data.controllers;
    if (filter === 'services') return [];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.namespace.toLowerCase().includes(q) ||
        c.methods?.some(m => m.name.toLowerCase().includes(q))
      );
    }
    return items;
  }, [data?.controllers, search, filter]);

  if (!data) return null;

  const totalMethods = data.totalMethods;
  const totalServices = data.services?.length || 0;
  const totalControllers = data.controllers?.length || 0;
  const totalScenarios = data.tests?.reduce((a, t) => a + (t.scenarios?.length || 0), 0) || 0;

  return (
    <div className="dashboard page-transition">
      <div className="dashboard-top">
        <div>
          <h2 className="dashboard-title">Project Analysis</h2>
          <p className="dashboard-sub">{data.projectName} ({data.projectType})</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card services">
          <div className="stat-icon">
            <Layers size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalServices}</span>
            <span className="stat-label">Services</span>
          </div>
        </div>
        <div className="stat-card controllers">
          <div className="stat-icon">
            <Cpu size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalControllers}</span>
            <span className="stat-label">Controllers</span>
          </div>
        </div>
        <div className="stat-card methods">
          <div className="stat-icon">
            <Code2 size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalMethods}</span>
            <span className="stat-label">Methods</span>
          </div>
        </div>
        <div className="stat-card scenarios">
          <div className="stat-icon">
            <CheckSquare size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{totalScenarios}</span>
            <span className="stat-label">Scenarios</span>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-box">
          <Search size={16} />
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
          <h3>No services or controllers detected</h3>
          <p>Make sure your project contains classes with names ending in <code>Service</code> or <code>Controller</code></p>
        </div>
      )}

      {data && (
        <div className="dashboard-footer" style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '1.5rem', width: '100%' }}>
          <button 
            className="btn btn-primary" 
            onClick={onNavigateToTests}
            style={{ padding: '0.8rem 3rem', fontSize: '0.95rem' }}
          >
            Generate & View Test Cases
          </button>
        </div>
      )}
    </div>
  );
};
