import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Trophy, Users, LogOut, Menu, Shield
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/',           label: 'Dashboard',   icon: LayoutDashboard, end: true },
  { to: '/seasons',    label: 'Kompetisi',   icon: Trophy },
  { to: '/teams',      label: 'Tim',         icon: Users },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate  = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-pitch-mid border-r border-white/10 z-30
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:flex
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
              <Trophy size={18} className="text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-base tracking-wider">eFOOTBALL</div>
              <div className="text-xs text-white/40 font-mono">MANAGER</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
              onClick={() => setOpen(false)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
              onClick={() => setOpen(false)}
            >
              <Shield size={17} />
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-brand-600/40 flex items-center justify-center text-brand-400 font-display font-bold text-sm overflow-hidden shrink-0">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : profile?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{profile?.username}</div>
                <div className="text-xs text-white/40 capitalize">{profile?.role}</div>
              </div>
            </Link>
            <button onClick={handleSignOut} className="text-white/40 hover:text-white/80 transition-colors p-2">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-pitch-mid border-b border-white/10 sticky top-0 z-10">
          <button onClick={() => setOpen(true)} className="text-white/60 hover:text-white">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-brand-400" />
            <span className="font-display font-bold tracking-wider text-sm">eFOOTBALL MANAGER</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
