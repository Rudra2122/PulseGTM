import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAccounts } from '../api'

async function generateQBRStreaming(accountId, onChunk, onDone, onError) {
  try {
    const response = await fetch(`http://localhost:8000/qbr/${accountId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error('Stream not available')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      accumulated += decoder.decode(value, { stream: true })
      onChunk(accumulated)
    }
    onDone(accumulated)
  } catch {
    const res = await fetch(`http://localhost:8000/qbr/${accountId}`, { method: 'POST' })
    const data = await res.json()
    const fullText = JSON.stringify(data.brief, null, 2)
    let i = 0
    const interval = setInterval(() => {
      i += 12
      onChunk(fullText.slice(0, i))
      if (i >= fullText.length) { clearInterval(interval); onDone(fullText) }
    }, 16)
  }
}

const SEVERITY_COLORS = {
  high:   { bg: '#FCEBEB', text: '#791F1F', border: '#F09595' },
  medium: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  low:    { bg: '#EAF3DE', text: '#27500A', border: '#97C459' },
}

function BriefSection({ title, children, delay = 0 }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{ marginBottom: '1.5rem', opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', margin: '0 0 8px',
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title.replace(/_/g, ' ')}
      </p>
      {children}
    </div>
  )
}

export default function QBRBrief() {
  const [accounts, setAccounts] = useState([])
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(searchParams.get('account') || '')
  const [brief, setBrief] = useState(null)
  const [streamText, setStreamText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { getAccounts().then(setAccounts) }, [])

  useEffect(() => {
    if (searchParams.get('account') && accounts.length > 0) handleGenerate(searchParams.get('account'))
  }, [accounts])

  const selectedAccount = accounts.find(a => a.id === selectedId)

  const handleGenerate = async (id = selectedId) => {
    if (!id) return
    setStreaming(true); setDone(false); setBrief(null); setStreamText('')
    await generateQBRStreaming(id,
      (chunk) => setStreamText(chunk),
      (final) => {
        setStreaming(false); setDone(true)
        try { setBrief(typeof final === 'string' ? JSON.parse(final) : final); setStreamText('') }
        catch { setStreamText(final) }
      },
      () => setStreaming(false)
    )
  }

  const handleCopy = () => {
    if (!brief) return
    const text = [`QBR BRIEF — ${selectedAccount?.name}`, '', 'EXECUTIVE SUMMARY', brief.executive_summary, '',
      'RISKS', ...(brief.risks || []).map(r => `• [${r.severity?.toUpperCase()}] ${r.risk} → ${r.mitigation}`), '',
      'TALKING POINTS', ...(brief.talking_points || []).map((t, i) => `${i + 1}. ${t}`), '',
      'RECOMMENDED NEXT STEP', brief.recommended_next_step].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>QBR brief generator</h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 1.5rem' }}>
        Select an account to generate a structured AI brief before your next renewal call.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ flex: 1, minWidth: 240 }}>
          <option value="">Select an account...</option>
          {accounts.sort((a, b) => a.health_score - b.health_score).map(a => (
            <option key={a.id} value={a.id}>{a.name} — {a.health_band} ({a.health_score}/100) · {a.plan}</option>
          ))}
        </select>
        <button onClick={() => handleGenerate()} disabled={!selectedId || streaming}
          style={{ padding: '8px 20px', cursor: selectedId && !streaming ? 'pointer' : 'not-allowed', fontSize: 13 }}>
          {streaming ? 'Generating...' : 'Generate brief ↗'}
        </button>
      </div>

      {selectedAccount && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
          {[{ label: 'Plan', val: selectedAccount.plan }, { label: 'ARR', val: `$${selectedAccount.contract_value?.toLocaleString()}` },
            { label: 'Health', val: `${selectedAccount.health_score}/100` }, { label: 'Renewal', val: `${selectedAccount.days_to_renewal} days` },
            { label: 'CSM', val: selectedAccount.csm_name }].map(c => (
            <div key={c.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>{c.label}: </span>
              <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{c.val}</span>
            </div>
          ))}
        </div>
      )}

      {streaming && !streamText && (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 12, padding: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>Analyzing account data and generating brief...</p>
        </div>
      )}

      {streaming && streamText && (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto' }}>
          {streamText}
          <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--color-text-secondary)',
            marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
        </div>
      )}

      {brief && done && (
        <div>
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 500, margin: '0 0 4px' }}>QBR brief — {selectedAccount?.name}</h2>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>
                  Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Powered by GPT-4o
                </p>
              </div>
              <button onClick={handleCopy} style={{ fontSize: 12, padding: '6px 14px', cursor: 'pointer',
                color: copied ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                {copied ? '✓ Copied' : 'Copy brief'}
              </button>
            </div>

            <BriefSection title="executive_summary" delay={0}>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.8, margin: 0 }}>{brief.executive_summary}</p>
            </BriefSection>

            {brief.key_achievements?.length > 0 && (
              <BriefSection title="key_achievements" delay={80}>
                {brief.key_achievements.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#1D9E75', fontWeight: 500 }}>✓</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{a}</span>
                  </div>
                ))}
              </BriefSection>
            )}

            {brief.risks?.length > 0 && (
              <BriefSection title="risks" delay={160}>
                {brief.risks.map((r, i) => {
                  const c = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.medium
                  return (
                    <div key={i} style={{ padding: '10px 14px', marginBottom: 8, borderRadius: 8, background: c.bg, border: `0.5px solid ${c.border}` }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: c.text, margin: '0 0 4px' }}>{r.risk}</p>
                      <p style={{ fontSize: 12, color: c.text, margin: 0, opacity: 0.8 }}>Mitigation: {r.mitigation}</p>
                    </div>
                  )
                })}
              </BriefSection>
            )}

            {brief.expansion_angles?.length > 0 && (
              <BriefSection title="expansion_angles" delay={240}>
                {brief.expansion_angles.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#1D9E75', fontWeight: 500 }}>↑</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{e}</span>
                  </div>
                ))}
              </BriefSection>
            )}

            {brief.talking_points?.length > 0 && (
              <BriefSection title="talking_points" delay={320}>
                {brief.talking_points.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13,
                    paddingBottom: 10, borderBottom: i < brief.talking_points.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-info)', minWidth: 22 }}>{i + 1}.</span>
                    <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{t}</span>
                  </div>
                ))}
              </BriefSection>
            )}

            {brief.recommended_next_step && (
              <BriefSection title="recommended_next_step" delay={400}>
                <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#085041', lineHeight: 1.6 }}>
                  {brief.recommended_next_step}
                </div>
              </BriefSection>
            )}
          </div>
          <button onClick={() => handleGenerate()} style={{ marginTop: 12, fontSize: 13, padding: '8px 16px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            ↺ Regenerate brief
          </button>
        </div>
      )}
      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  )
}