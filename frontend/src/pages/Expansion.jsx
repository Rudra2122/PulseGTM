import { useEffect, useState } from 'react'
import { getAccounts, getExpansionSignals, runExpansionDetection } from '../api'

const SIGNAL_META = {
  headcount_growth: { label: 'Team growing fast', icon: '↑', color: { bg: '#E1F5EE', text: '#085041', border: '#5DCAA5' } },
  usage_ceiling:    { label: 'Hitting usage limit', icon: '⚡', color: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' } },
}

const PLAN_NEXT = { starter: 'Growth ($25K/yr)', growth: 'Enterprise ($80K/yr)', enterprise: 'Enterprise+' }

export default function Expansion() {
  const [accounts, setAccounts] = useState({})
  const [signals, setSignals] = useState([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    Promise.all([getAccounts(), getExpansionSignals()]).then(([accs, sigs]) => {
      const accMap = {}
      accs.forEach(a => { accMap[a.id] = a })
      setAccounts(accMap)
      setSignals(sigs)
      setLoading(false)
    })
  }, [])

  const handleRunDetection = async () => {
    setRunning(true)
    await runExpansionDetection()
    const { getExpansionSignals: getSigs } = await import('../api')
    setSignals(await getSigs())
    setRunning(false)
  }

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const grouped = {}
  signals.forEach(s => { if (!grouped[s.account_id]) grouped[s.account_id] = []; grouped[s.account_id].push(s) })
  const ranked = Object.entries(grouped)
    .map(([accountId, sigs]) => ({ accountId, sigs, account: accounts[accountId] }))
    .filter(r => r.account)
    .sort((a, b) => (b.account.contract_value || 0) - (a.account.contract_value || 0))

  const totalExpansionARR = ranked.reduce((sum, r) => sum + (r.account?.contract_value || 0), 0)

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>Loading...</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>Expansion pipeline</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
            {ranked.length} accounts flagged · ${totalExpansionARR.toLocaleString()} current ARR eligible for upsell
          </p>
        </div>
        <button onClick={handleRunDetection} disabled={running} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
          {running ? 'Detecting...' : 'Refresh signals ↗'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {[{ label: 'Accounts flagged', val: ranked.length },
          { label: 'Headcount signals', val: signals.filter(s => s.signal_type === 'headcount_growth').length },
          { label: 'Usage ceiling signals', val: signals.filter(s => s.signal_type === 'usage_ceiling').length }
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '14px' }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 4px' }}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{c.val}</p>
          </div>
        ))}
      </div>

      {ranked.length === 0 && (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>No expansion signals yet.</p>
          <button onClick={handleRunDetection} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Run expansion detection ↗</button>
        </div>
      )}

      {ranked.map(({ accountId, sigs, account }, idx) => {
        const isExpanded = expandedId === accountId
        const outreach = sigs.find(s => s.ai_outreach_draft)?.ai_outreach_draft
        return (
          <div key={accountId} style={{ background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1.25rem', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-background-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', flexShrink: 0, marginTop: 2 }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>{account.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                    {account.plan} · ${account.contract_value?.toLocaleString()}/yr
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>→ {PLAN_NEXT[account.plan]}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {sigs.map((s, i) => {
                    const m = SIGNAL_META[s.signal_type] || SIGNAL_META.headcount_growth
                    return (
                      <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                        background: m.color.bg, color: m.color.text, border: `0.5px solid ${m.color.border}` }}>
                        {m.icon} {m.label}
                      </span>
                    )
                  })}
                </div>
                {sigs.map((s, i) => (
                  <p key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{s.description}</p>
                ))}
                <button onClick={() => setExpandedId(isExpanded ? null : accountId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                    color: 'var(--color-text-info)', padding: '6px 0 0' }}>
                  {isExpanded ? '↑ Hide outreach draft' : '↓ View AI outreach draft'}
                </button>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-background-info)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 500, color: 'var(--color-text-info)', marginLeft: 'auto', marginBottom: 4 }}>
                  {account.csm_name?.split(' ').map(n => n[0]).join('')}
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>{account.csm_name?.split(' ')[0]}</p>
              </div>
            </div>
            {isExpanded && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    AI-drafted outreach message
                  </p>
                  <button onClick={() => handleCopy(outreach || '', accountId)}
                    style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer',
                      color: copiedId === accountId ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                    {copiedId === accountId ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px',
                  fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, fontStyle: 'italic' }}>
                  {outreach ? `"${outreach}"` : 'No outreach draft yet — run expansion detection to generate one.'}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}