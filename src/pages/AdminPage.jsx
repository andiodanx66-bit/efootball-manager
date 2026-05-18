import { useEffect, useState } from 'react'
import { Shield, CheckCircle, XCircle, Clock, Key } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import ManageUsersTab from '../components/admin/ManageUsersTab'
import InviteTokensTab from '../components/admin/InviteTokensTab'

export default function AdminPage() {
  const [tab, setTab] = useState('pending')
  const [pendingMatches, setPendingMatches] = useState([])
  const [allTeams,       setAllTeams]       = useState([])
  const [counts,         setCounts]         = useState({ matches: 0 })
  const [loading,        setLoading]        = useState(true)
  const [imgModal,       setImgModal]       = useState(null)

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('admin-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchAll() {
    const [{ data: pm }, { data: at }] = await Promise.all([
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), season:seasons(name)')
        .eq('status', 'pending_result'),
      supabase.from('teams').select('id,name,status').eq('status','approved').order('name')
    ])
    setPendingMatches(pm || [])
    setAllTeams(at || [])
    setCounts({ matches: pm?.length || 0 })
    setLoading(false)
  }

  async function approveMatch(id) {
    await supabase.from('matches').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id)
    fetchAll()
  }

  async function rejectMatch(id) {
    await supabase.from('matches').update({ status: 'scheduled', home_score: null, away_score: null }).eq('id', id)
    fetchAll()
  }

  const tabs = [
    { key: 'pending', label: 'Hasil Pending', count: counts.matches },
    { key: 'users',   label: 'Pengguna & Tim' },
    { key: 'tokens',  label: 'Token Undangan' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
          <Shield size={20} className="text-accent-purple" />
        </div>
        <div>
          <h1 className="section-title">Admin Panel</h1>
          <p className="text-sm" style={{color:'#64748b'}}>Kelola kompetisi, tim, dan hasil pertandingan</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{backgroundColor:'#f1f5f9'}}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all flex items-center gap-2 ${
              tab === t.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className="w-5 h-5 rounded-full bg-accent-yellow text-white text-xs flex items-center justify-center font-bold">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div className="space-y-4">
          <h2 className="font-display font-semibold text-base flex items-center gap-2" style={{color:'#0f172a'}}>
            <Clock size={16} className="text-accent-yellow" />
            Hasil Pertandingan Pending ({pendingMatches.length})
          </h2>
          {pendingMatches.length === 0 ? (
            <div className="card p-8 text-center text-sm" style={{color:'#94a3b8'}}>
              Tidak ada hasil pending ✓
            </div>
          ) : (
            <div className="card overflow-hidden divide-y" style={{borderColor:'#e2e8f0'}}>
              {pendingMatches.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3 flex-wrap hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium truncate" style={{color:'#0f172a'}}>{m.home_team?.name}</span>
                    <div
                      className={`font-display font-bold text-sm rounded-lg px-2.5 py-1 w-14 text-center shrink-0 border ${m.screenshot_url ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                      style={{backgroundColor:'#f1f5f9', borderColor:'#e2e8f0', color:'#0f172a'}}
                      onClick={() => m.screenshot_url && setImgModal(m.screenshot_url)}
                    >
                      {m.home_score}–{m.away_score}
                    </div>
                    <span className="text-sm font-medium truncate" style={{color:'#0f172a'}}>{m.away_team?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge-blue hidden sm:inline-flex text-xs">{m.season?.name}</span>
                    <button onClick={() => approveMatch(m.id)} className="btn-success text-xs py-1.5 px-3 flex items-center gap-1">
                      <CheckCircle size={13} /> OK
                    </button>
                    <button onClick={() => rejectMatch(m.id)} className="btn-danger text-xs py-1.5 px-3">
                      Reset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'users'  && <ManageUsersTab />}
      {tab === 'tokens' && <InviteTokensTab />}

      {imgModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="bukti" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>,
        document.body
      )}
    </div>
  )
}
