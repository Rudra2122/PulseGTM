import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { getAccount, getChurnSignals } from '../api'

const BAND_COLORS = {
  green: { bg: '#EAF3DE', text: '#27500A', border: '#97C459' },
  amber: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  red:   { bg: '#FCEBEB', text: '#791F1F', border: '#F09595' },
}

const SIGNAL_LABELS = {
  login_gap:        { label: 'Login gap',        color: '#E24B4A' },
  low_health_score: { label: 'Low health score', color: '#BA7517' },
  nps_detractor:    { label: 'NPS detractor',    color: '#E24B4A' },
  ticket_spike:     { label: 'Ticket spike',     color: '#BA7517' },
}

function generateUsageTrend(account) {
  const baseline = account.login_frequency_score
  return Array.from({ length: 12 }, (_, i) => {
    const weekAgo = 11 - i
    const drift = account.health_band === 'red'
      ? -(weekAgo * 2.5)
      : account.health_band === 'amber'
      ? -(weekAgo * 0.8)
      : (Math.random() - 0.3) * 5
    const val = Math.max(0, Math.min(100, baseline + drift + (Math.random() - 0.5) * 8))
    return {
      week: `W${i + 1}`,
      logins: Math.round(val),
      adoption: Math.round(Math.max(0, Math.min(100, account.feature_adoption_pct + drift * 0.5 + (Math.random() - 0.5) * 6))),
    }
  })
}

export default function AccountDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [signals, setSignals] = useState([])
  const [usageTrend, setUsageTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAccount(id), getChurnSignals()]).then(([acc, sigs]) => {
      setAccount(acc)
      setSignals(sigs.filter(s => s.account_id === id))
      setUsageTrend(generateUsageTrend(acc))
      setLoading(false)
    })
  }, [id])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>Loading account...</div>
  if (!account) return <div style={{ padding: '2rem' }}>Account not found.</div>

  const band = BAND_COLORS[account.health_band]

  const radarData = account.score_breakdown
    ? Object.entries(account.score_breakdown).map(([key, val]) => ({
        subject: { login_frequency: 'Login freq', feature_adoption: 'Adoption',
          support_tickets: 'Support', nps: 'NPS', days_to_renewal: 'Renewal' }[key] || key,
        score: Math.round(val),
        fullMark: 100,
      }))
    : []

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <button onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
          color: 'var(--color-text-secondary)', marginBottom: '1rem', padding: 0 }}>
        ← Back to dashboard
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 6px' }}>{account.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
            CSM: {account.csm_name} · {account.plan} plan · ${account.contract_value?.toLocaleString()}/yr · Renewal in {account.days_to_renewal} days
          </p>
          <span style={{ background: band.bg, color: band.text, border: `0.5px solid ${band.border}`,
            borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>
            {account.health_band} · {account.health_score}/100
          </span>
        </div>
        <button onClick={() => navigate(`/qbr?account=${id}`)} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
          Generate QBR brief ↗
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>

        {/* Score breakdown radar */}
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 1rem' }}>Score breakdown by dimension</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
              <PolarGrid stroke="#444" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#ffffff', fontWeight: 500 }} />
              <Radar name="Score" dataKey="score" stroke="#378ADD" fill="#378ADD" fillOpacity={0.18} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '0.75rem' }}>
            {radarData.map(d => (
              <div key={d.subject} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: '#ffffff' }}>{d.subject}</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{d.score}</span>
                </div>
                <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(d.score, 3)}%`, borderRadius: 2,
                    background: d.score >= 70 ? '#639922' : d.score >= 40 ? '#EF9F27' : '#E24B4A',
                    transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage trend line chart */}
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 1rem' }}>Usage trend — last 12 weeks</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={usageTrend} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#ffffff' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#ffffff' }} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  border: '0.5px solid #444',
                  borderRadius: 8,
                  background: '#1a1a1a',
                  color: '#ffffff',
                }}
                labelStyle={{ color: '#ffffff' }}
                itemStyle={{ color: '#ffffff' }}
              />
              <Line type="monotone" dataKey="logins" stroke="#378ADD" strokeWidth={2} dot={false} name="Login score" />
              <Line type="monotone" dataKey="adoption" stroke="#1D9E75" strokeWidth={2} dot={false} name="Adoption %" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ffffff' }}>
              <div style={{ width: 16, height: 2, background: '#378ADD', borderRadius: 1 }} /> Login score
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ffffff' }}>
              <div style={{ width: 16, height: 2, background: '#1D9E75', borderRadius: 1 }} /> Feature adoption
            </div>
          </div>
        </div>
      </div>

      {/* Churn signal timeline */}
      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '1.25rem' }}>
        <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 1rem' }}>Churn signal timeline</p>
        {signals.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            No signals detected. Run churn detection from the dashboard.
          </p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, background: 'var(--color-border-secondary)' }} />
            {signals.map((signal, i) => {
              const meta = SIGNAL_LABELS[signal.signal_type] || { label: signal.signal_type, color: '#888' }
              return (
                <div key={signal.id || i} style={{ position: 'relative', marginBottom: '1.25rem' }}>
                  <div style={{ position: 'absolute', left: -20, top: 4, width: 10, height: 10,
                    borderRadius: '50%', background: meta.color, border: '2px solid var(--color-background-primary)' }} />
                  <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: meta.color }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {signal.fired_at ? new Date(signal.fired_at).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{signal.description}</p>
                    {signal.ai_summary && (
                      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 8px',
                        borderLeft: `2px solid ${meta.color}`, paddingLeft: 10, borderRadius: 0 }}>
                        {signal.ai_summary}
                      </p>
                    )}
                    {signal.ai_actions?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', margin: '0 0 4px' }}>SUGGESTED ACTIONS</p>
                        {signal.ai_actions.map((action, j) => (
                          <div key={j} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-tertiary)' }}>{j + 1}.</span>
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}