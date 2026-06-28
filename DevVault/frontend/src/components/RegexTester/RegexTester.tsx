import React, { useState, useMemo } from 'react';
import { HelpCircle, Check, AlertCircle, Copy, FileText, Code, Settings, List } from 'lucide-react';

interface RegexRecipe {
  name: string;
  pattern: string;
  desc: string;
  sampleText: string;
}

const RECIPES: RegexRecipe[] = [
  {
    name: 'Email Validator',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    desc: 'Matches standard user email structures (e.g. john.doe@company.com).',
    sampleText: 'You can reach out to support@devvault.org or contact dev-admin@gmail.com for issues. Incorrect emails like test@domain or admin@.com won\'t match.'
  },
  {
    name: 'US Phone Number',
    pattern: '^\\+?1?\\s*\\(?(\\d{3})\\)?[-.\\s]?(\\d{3})[-.\\s]?(\\d{4})$',
    desc: 'Matches standard 10-digit US phone numbers with optional formats.',
    sampleText: 'Office: +1 (555) 019-2834\nMobile: 555-829-1920\nSupport: 555.932.4932\nInternational: +44 20 7946 0958 (non-matching)'
  },
  {
    name: 'URL Parser',
    pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&\\/\\/=]*)',
    desc: 'Extracts full website links, sub-domains, and query parameters.',
    sampleText: 'Visit our site at https://devvault.org/docs/api?v=1.0 or read details on http://www.google.com for research. Invalid links like www.com or http://test won\'t parse.'
  },
  {
    name: 'IPv4 Address',
    pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    desc: 'Matches IPv4 addresses ranging from 0.0.0.0 to 255.255.255.255.',
    sampleText: 'Local host: 127.0.0.1\nGateway IP: 192.168.1.1\nPublic DNS: 8.8.8.8\nInvalid Address: 256.1.2.3 or 192.168.1.300'
  },
  {
    name: 'Date (YYYY-MM-DD)',
    pattern: '\\b\\d{4}-\\d{2}-\\d{2}\\b',
    desc: 'Matches date logs formatted as Year-Month-Day.',
    sampleText: 'Created on: 2026-06-28\nLast Modified: 2026-07-02\nInvalid format: 28-06-2026 or 2026/06/28'
  }
];

export const RegexTester: React.FC = () => {
  const [pattern, setPattern] = useState(RECIPES[0].pattern);
  const [flags, setFlags] = useState({
    g: true,
    i: true,
    m: false
  });
  const [testText, setTestText] = useState(RECIPES[0].sampleText);
  const [copied, setCopied] = useState(false);

  const flagString = `${flags.g ? 'g' : ''}${flags.i ? 'i' : ''}${flags.m ? 'm' : ''}`;

  // Real-time Regex Compilation & Error Catcher
  const regexMeta = useMemo(() => {
    if (!pattern) {
      return { regex: null, error: 'Pattern is empty' };
    }
    try {
      const r = new RegExp(pattern, flagString);
      return { regex: r, error: null };
    } catch (e: any) {
      return { regex: null, error: e.message };
    }
  }, [pattern, flagString]);

  // Extract all matches and capturing groups
  const matches = useMemo(() => {
    if (!regexMeta.regex || !pattern) return [];
    try {
      const r = regexMeta.regex;
      const list = [];
      
      if (flags.g) {
        const matchesArray = Array.from(testText.matchAll(r));
        return matchesArray.map((m, idx) => ({
          id: idx,
          value: m[0],
          index: m.index!,
          groups: m.slice(1) // capturing groups
        }));
      } else {
        // Non-global search (only returns first match)
        const m = testText.match(r);
        if (m) {
          return [{
            id: 0,
            value: m[0],
            index: m.index!,
            groups: m.slice(1)
          }];
        }
        return [];
      }
    } catch (err) {
      return [];
    }
  }, [regexMeta, pattern, testText, flags.g]);

  // Generate highlighted display output safely as React elements to prevent XSS
  const highlightedContent = useMemo(() => {
    if (!pattern || !regexMeta.regex) return [testText];
    try {
      const r = regexMeta.regex;
      const matchesArray = Array.from(testText.matchAll(r));
      if (matchesArray.length === 0) return [testText];

      const result: React.ReactNode[] = [];
      let lastIndex = 0;

      matchesArray.forEach((match, idx) => {
        const start = match.index!;
        const end = start + match[0].length;

        // If pattern matches empty string (0-length), advance by 1 character to avoid infinite loop
        if (start === lastIndex && match[0].length === 0) {
          return;
        }

        if (start > lastIndex) {
          result.push(testText.substring(lastIndex, start));
        }

        result.push(
          <mark key={idx} className="regex-highlight-tag">
            {match[0]}
          </mark>
        );

        lastIndex = end;
      });

      if (lastIndex < testText.length) {
        result.push(testText.substring(lastIndex));
      }

      return result;
    } catch (e) {
      return [testText];
    }
  }, [testText, regexMeta, pattern]);

  const loadRecipe = (recipe: RegexRecipe) => {
    setPattern(recipe.pattern);
    setTestText(recipe.sampleText);
  };

  const handleCopyPattern = () => {
    navigator.clipboard.writeText(pattern);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tests-workspace page-transition" style={{ gap: '1.5rem' }}>
      <div className="tests-view-header">
        <div>
          <h2>Regex Tester & Builder</h2>
          <p className="tests-view-sub">
            Build, test, and explain regular expressions locally with syntax highlighting and match groups.
          </p>
        </div>
      </div>

      <div className="tests-full-width-pane" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem', padding: '1.75rem' }}>
        {/* Left Column: Editor & Test Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Regex Input Section */}
          <div className="regex-input-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="selector-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Expression Pattern</span>
              <button 
                className="code-toggle" 
                onClick={handleCopyPattern}
                style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Copy size={12} />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </label>

            <div className="regex-pattern-bar" style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 1rem',
              gap: '0.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem',
              color: 'var(--text-secondary)'
            }}>
              <span style={{ color: 'var(--accent)', fontWeight: '700' }}>/</span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Insert regular expression..."
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.98rem',
                  outline: 'none',
                  flex: 1
                }}
              />
              <span style={{ color: 'var(--accent)', fontWeight: '700' }}>/</span>
              
              {/* Flags Panel */}
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem', borderLeft: '1px solid var(--border-default)', paddingLeft: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={flags.g}
                    onChange={(e) => setFlags({ ...flags, g: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>g</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={flags.i}
                    onChange={(e) => setFlags({ ...flags, i: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>i</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={flags.m}
                    onChange={(e) => setFlags({ ...flags, m: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>m</span>
                </label>
              </div>
            </div>

            {/* Pattern validity message */}
            {regexMeta.error ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '0.8rem', marginTop: '2px' }}>
                <AlertCircle size={14} />
                <span>Invalid regex: {regexMeta.error}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.8rem', marginTop: '2px' }}>
                <Check size={14} />
                <span>Pattern matches successfully compiled</span>
              </div>
            )}
          </div>

          {/* Test Text Section */}
          <div className="regex-textarea-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="selector-label">Test Sample Strings</label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter text to test matches against..."
              style={{
                width: '100%',
                height: '130px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem',
                padding: '0.8rem 1rem',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Highlighted Results Preview */}
          <div className="regex-highlight-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="selector-label">Highlighted Matches Display</label>
            <div 
              style={{
                width: '100%',
                minHeight: '130px',
                maxHeight: '260px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem',
                padding: '0.8rem 1rem',
                overflowY: 'auto',
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}
            >
              {highlightedContent}
            </div>
          </div>
        </div>

        {/* Right Column: Library Recipes & Match Group Explorer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid var(--border-default)', paddingLeft: '2rem' }}>
          
          {/* Quick Recipe Library */}
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              <List size={16} style={{ color: 'var(--accent)' }} />
              <span>Regex Snippets Library</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {RECIPES.map(r => (
                <button
                  key={r.name}
                  className="code-toggle"
                  onClick={() => loadRecipe(r)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '8px 12px',
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <span style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{r.name}</span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Match Groups Inspector */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              <Code size={16} style={{ color: '#10b981' }} />
              <span>Matches Inspector ({matches.length})</span>
            </h4>
            
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              background: 'var(--bg-panel)', 
              border: '1px solid var(--border-default)', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.75rem 1rem',
              maxHeight: '340px'
            }}>
              {matches.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {matches.map((m, idx) => (
                    <div key={m.id} style={{ borderBottom: idx < matches.length - 1 ? '1px dashed var(--border-default)' : 'none', paddingBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        <span style={{ color: '#10b981' }}>Match #{idx + 1}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Index: {m.index}</span>
                      </div>
                      
                      <div style={{ 
                        background: 'var(--bg-card)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: '0.82rem', 
                        margin: '4px 0',
                        color: 'var(--text-primary)',
                        borderLeft: '2px solid #10b981'
                      }}>
                        {m.value}
                      </div>

                      {/* Display capturing groups if present */}
                      {m.groups && m.groups.length > 0 && m.groups.some(g => g !== undefined) && (
                        <div style={{ paddingLeft: '0.5rem', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>Capture Groups:</span>
                          {m.groups.map((group, gIdx) => (
                            <div key={gIdx} style={{ display: 'flex', gap: '4px' }}>
                              <span style={{ color: 'var(--accent)' }}>Group {gIdx + 1}:</span>
                              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                {group === undefined ? 'null' : `"${group}"`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                  <HelpCircle size={20} style={{ marginBottom: '4px' }} />
                  <span>No matches found. Check your pattern or update flags.</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
