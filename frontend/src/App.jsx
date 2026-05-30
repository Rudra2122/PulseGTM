import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AccountDetail from './pages/AccountDetail'
import QBRBrief from './pages/QBRBrief'
import Expansion from './pages/Expansion'

const navStyle = (isActive) => ({
  fontSize: 14,
  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
  textDecoration: 'none',
  fontWeight: isActive ? 500 : 400,
  padding: '6px 12px',
  borderRadius: 6,
  background: isActive ? 'var(--color-background-secondary)' : 'transparent',
})

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: 'var(--color-background-tertiary)' }}>
        <nav style={{ background: 'var(--color-background-primary)', borderBottom: '0.5px solid var(--color-border-tertiary)',
          padding: '12px 1.5rem', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 500, marginRight: 16 }}>PulseGTM</span>
          <NavLink to="/" style={({ isActive }) => navStyle(isActive)}>Dashboard</NavLink>
          <NavLink to="/qbr" style={({ isActive }) => navStyle(isActive)}>QBR briefs</NavLink>
          <NavLink to="/expansion" style={({ isActive }) => navStyle(isActive)}>Expansion</NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/account/:id" element={<AccountDetail />} />
          <Route path="/qbr" element={<QBRBrief />} />
          <Route path="/expansion" element={<Expansion />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}