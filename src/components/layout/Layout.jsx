import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Trophy, Users, LogOut, Shield, Sun, Moon, User
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/',          label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/seasons',   label: 'Kompetisi',  icon: Trophy },
  { to: '/teams',     label: 'Tim',        icon: Users },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const mobileNavItems = [
    ...navItems,
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
    { to: '/profile', label: 'Profil', icon: User },
  ]

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">

      {/* ── Sidebar (desktop only) ─────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-64 bg-white border-r border-surface-border z-30 flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-brand-sm">
              <Trophy size={18} className="text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-base tracking-wider text-ink">eFOOTBALL</div>
              <div className="text-[10px] text-ink-faint font-mono uppercase tracking-widest">Manager</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            >
              <Shield size={17} />
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-surface-border">
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2 rounded-lg hover:bg-surface-muted transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-display font-bold text-sm overflow-hidden shrink-0 border border-brand-200">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : profile?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{profile?.username}</div>
                <div className="text-xs text-ink-faint capitalize">{profile?.role}</div>
              </div>
            </Link>
            <button
              onClick={() => setDark(d => !d)}
              className="text-ink-faint hover:text-ink transition-colors p-2 rounded-lg hover:bg-surface-muted"
              title={dark ? 'Mode Terang' : 'Mode Gelap'}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={handleSignOut}
              className="text-ink-faint hover:text-accent-red transition-colors p-2 rounded-lg hover:bg-accent-red/10"
              title="Keluar"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-surface-border sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Trophy size={14} className="text-white" />
            </div>
            <span className="font-display font-bold tracking-wider text-sm text-ink">eFOOTBALL MANAGER</span>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="text-ink-faint hover:text-ink transition-colors p-2 rounded-lg hover:bg-surface-muted"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom Tab Bar (mobile only) ───────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-surface-border flex items-stretch shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
        {mobileNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-150 ${
                isActive ? 'text-brand-600' : 'text-ink-faint hover:text-ink-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`p-1 rounded-lg transition-colors duration-150 ${isActive ? 'bg-brand-50' : ''}`}>
                  <Icon size={20} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
