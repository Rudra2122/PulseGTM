import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAccounts, getHealthSummary, runChurnDetection } from '../api'

const BAND_COLORS = {
  green: { bg: '#EAF3DE', text: '#27500A', border: '#97C459' },
  amber: { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  red:   { bg: '#FCEBEB', text: '#791F1F', border: '#F09595' },
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([getAccounts(), getHealthSummary()]).then(([accs, sum]) => {
      setAccounts(accs)
      setSummary(sum)
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? accounts : accounts.filter(a => a.health_band === filter)
  const sorted = [...filtered].sort((a, b) => a.health_score - b.health_score)

  const handleRunDetection = async () => {
    setRunning(true)
    await runChurnDetection()
    setRunning(false)
    alert('Churn detection complete — check Slack!')
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>Loading...</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>Account health dashboard</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
  {summary?.total_accounts} accounts · ${summary?.total_arr?.toLocaleString()} total ARR · ${summary?.at_risk_arr?.toLocaleString()} at-risk
</p>
        </div>
        <button onClick={handleRunDetection} disabled={running} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          {running ? 'Running...' : 'Run churn detection ↗'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        {['green', 'amber', 'red'].map(band => (
          <div key={band} onClick={() => setFilter(filter === band ? 'all' : band)}
            style={{ background: BAND_COLORS[band].bg, borderRadius: 8, padding: '14px', cursor: 'pointer',
              border: filter === band ? `2px solid ${BAND_COLORS[band].border}` : `0.5px solid ${BAND_COLORS[band].border}` }}>
            <p style={{ fontSize: 12, color: BAND_COLORS[band].text, margin: '0 0 4px', fontWeight: 500, textTransform: 'capitalize' }}>{band}</p>
            <p style={{ fontSize: 28, fontWeight: 500, color: BAND_COLORS[band].text, margin: 0 }}>{summary?.bands?.[band] ?? 0}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              {['Account', 'CSM', 'Plan', 'Health', 'Score', 'Top risk', 'Renewal'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: 'var(--color-text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(account => {
              const c = BAND_COLORS[account.health_band]
              return (
                <tr key={account.id} onClick={() => navigate(`/account/${account.id}`)}
                  style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{account.name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{account.csm_name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{account.plan}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, textTransform: 'capitalize' }}>
                      {account.health_band}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: c.text }}>{account.health_score}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)', fontSize: 12 }}>{account.top_risk_factor}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-secondary)' }}>{account.days_to_renewal}d</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}