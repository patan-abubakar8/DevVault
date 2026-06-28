import React, { useState, useMemo } from 'react';
import { Database, ArrowRight, ShieldAlert, Braces, Binary, FileCode, Search } from 'lucide-react';

interface ToolsDashboardProps {
  onSelectSqlServerToPostgres: () => void;
  onSelectPmsTestTool: () => void;
}

type UtilityCategory = 'all' | 'database' | 'testing' | 'frontend' | 'backend';

export const ToolsDashboard: React.FC<ToolsDashboardProps> = ({
  onSelectSqlServerToPostgres,
  onSelectPmsTestTool,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<UtilityCategory>('all');

  const tools = useMemo(() => [
    {
      id: 'sqlserver-to-postgres',
      name: 'SQL Server → PostgreSQL Migrator',
      desc: 'High-performance schema and data migration tool. Support auto type mappings, secondary indices creation, and parallel table migration with cascading drop setup.',
      icon: <Database size={22} />,
      enabled: true,
      action: onSelectSqlServerToPostgres,
      badge: 'Active',
      categories: ['database', 'backend']
    },
    {
      id: 'pms-test-tool',
      name: 'PMS Unit Test Generator',
      desc: 'Analyze C#, JS/TS, or Java source files to automatically scan classes and public methods, generate comprehensive test cases and boilerplate test code, and simulate execution.',
      icon: <FileCode size={22} />,
      enabled: true,
      action: onSelectPmsTestTool,
      badge: 'Active',
      categories: ['testing', 'backend']
    },
    {
      id: 'jwt-debugger',
      name: 'JWT Debugger & Parser',
      desc: 'Decode, verify, and generate JSON Web Tokens locally. Inspect token headers, payloads, and signatures in real time without exposing cryptographic keys.',
      icon: <ShieldAlert size={22} />,
      enabled: false,
      badge: 'Coming Soon',
      categories: ['backend', 'testing']
    },
    {
      id: 'json-formatter',
      name: 'JSON Formatter & Validator',
      desc: 'Format, validate, prettify, and minify raw JSON data. Clean up nested structures, fix alignment, and identify JSON syntax errors instantly.',
      icon: <Braces size={22} />,
      enabled: false,
      badge: 'Coming Soon',
      categories: ['frontend']
    },
    {
      id: 'regex-tester',
      name: 'Regex Tester & Builder',
      desc: 'Write, test, and debug regular expressions with real-time match highlighting, group captures, and detailed regex expression breakdowns.',
      icon: <FileCode size={22} />,
      enabled: false,
      badge: 'Coming Soon',
      categories: ['testing', 'frontend']
    },
    {
      id: 'base64-converter',
      name: 'Base64 Encoder / Decoder',
      desc: 'Quickly encode and decode string inputs or files to/from Base64 binary format locally in your browser with full charset support.',
      icon: <Binary size={22} />,
      enabled: false,
      badge: 'Coming Soon',
      categories: ['frontend', 'backend']
    }
  ], [onSelectSqlServerToPostgres, onSelectPmsTestTool]);

  // Combined search and category filtering logic
  const filteredTools = useMemo(() => {
    return tools.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.desc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || t.categories.includes(activeCategory);
      return matchesSearch && matchesCategory;
    });
  }, [tools, searchQuery, activeCategory]);

  const categoriesList: { label: string; key: UtilityCategory }[] = [
    { label: 'All Utilities', key: 'all' },
    { label: 'Database', key: 'database' },
    { label: 'Testing', key: 'testing' },
    { label: 'Frontend', key: 'frontend' },
    { label: 'Backend', key: 'backend' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">DeVault Utility Hub</h2>
        <p className="dashboard-subtitle">
          Select a tool below to get started. All calculations and transformations run entirely locally on your machine.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="dashboard-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', margin: '0.5rem 0 1.5rem 0' }}>
        <div className="filter-tabs">
          {categoriesList.map(cat => (
            <button
              key={cat.key}
              className={`filter-btn ${activeCategory === cat.key ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="viewport-search-bar" style={{ width: '240px' }}>
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Search tools..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Tools */}
      <div className="tools-grid">
        {filteredTools.length > 0 ? (
          filteredTools.map((t) => {
            const isClickable = t.enabled && t.action;
            return (
              <div
                key={t.id}
                className={`tool-card ${t.id} ${t.enabled ? '' : 'disabled'}`}
                onClick={isClickable ? t.action : undefined}
              >
                <div className="tool-card-icon-wrapper">
                  {t.icon}
                </div>
                <div className="tool-card-info">
                  <div className="tool-card-name">
                    <span>{t.name}</span>
                    {!t.enabled && <span className="badge-coming-soon">{t.badge}</span>}
                  </div>
                  <p className="tool-card-desc">{t.desc}</p>
                </div>
                
                <div className="tool-card-footer">
                  {t.enabled ? (
                    <>
                      Launch Tool <ArrowRight size={14} />
                    </>
                  ) : (
                    <span>Planned Module</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state" style={{ gridColumn: 'span 2', padding: '4rem 1rem' }}>
            <p>No utilities found matching "{searchQuery}" under this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};
