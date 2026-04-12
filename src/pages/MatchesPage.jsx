import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const statusBadge = { scheduled: 'badge-gray', pending_result: 'badge-yellow', approved: 'badge-green', cancelled: 'badge-red' }
const statusLabel = { scheduled: 'Terjadwal', pending_result: 'Pending', approved: 'Selesai', cancelled: 'Batal' }

export default function MatchesPage() {
  const { isAdmin, user } = useAuth()
  const [matches,    setMatches]    = useState([])
  const [seasons,    setSeasons]    = useState([])
  const [myTeamId,   setMyTeamId]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [filterS,    setFilterS]    = useState('all')
  const [filterSt,   setFilterSt]   = useState('all')
  const [search,     setSearch]     = useState('')
  const [scoreModal, setScoreModal] = useState(null)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (!user?.id || isAdmin) return
    supabase.from('teams').select('id').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => setMyTeamId(data?.id || null))
  }, [user?.id])

  async function fetchAll() {
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), season:seasons(name,type)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('seasons').select('id,name').order('created_at', { ascending: false })
    ])
    setMatches(m || [])
    setSeasons(s || [])
    setLoading(false)
  }

  async function approveMatch(id) {
    await supabase.from('matches').update({ status: 'approved' }).eq('id', id)
    fetchAll()
  }

  function canInput(m) {
    if (isAdmin) return true
    return myTeamId &&
      (m.home_team_id === myTeamId || m.away_team_id === myTeamId) &&
      m.status !== 'approved'
  }

  function showInputBtn(m) {
    if (isAdmin) return true
    if (m.status === 'scheduled') return canInput(m)
    if (m.status === 'pending_result') return canInput(m)
    return false
  }

  const displayed = matches.filter(m => {
    const matchesSeason = filterS === 'all' || m.season_id === filterS
    const matchesStatus = filterSt === 'all' || m.status === filterSt
    const matchesSearch = !search || m.home_team?.name.toLowerCase().includes(search.toLowerCase()) || m.away_team?.name.toLowerCase().includes(search.toLowerCase())
    return matchesSeason && matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title">Pertandingan</h1>
        <p className="text-white/50 text-sm mt-1">{matches.length} total pertandingan</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 text-sm" placeholder="Cari tim..." />
        </div>
        <select value={filterS} onChange={e => setFilterS(e.target.value)} className="input text-sm w-auto flex-shrink-0">
          <option value="all">Semua Kompetisi</option>
          {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)} className="input text-sm w-auto flex-shrink-0">
          <option value="all">Semua Status</option>
          <option value="scheduled">Terjadwal</option>
          <option value="pending_result">Pending</option>
          <option value="approved">Selesai</option>
        </select>
      </div>

      {isAdmin && matches.filter(m => m.status === 'pending_result').length > 0 && (
        <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl px-5 py-3 text-sm text-accent-yellow flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-yellow animate-pulse-slow" />
          Ada {matches.filter(m => m.status === 'pending_result').length} hasil pertandingan yang menunggu persetujuan.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
      ) : (
        <div className="card overflow-hidden">
          {displayed.length === 0 ? (
            <div className="p-10 text-center text-white/30">
              <Calendar size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Tidak ada pertandingan</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {displayed.map(m => (
                <div key={m.id} className="flex items-center px-5 py-3 gap-3 table-row-hover">
                  <div className="w-[35%] text-right text-sm font-medium truncate">{m.home_team?.name}</div>
                  <div className="font-display font-bold text-base bg-pitch-dark rounded-lg px-3 py-1 w-[80px] text-center shrink-0">
                    {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '–'}
                  </div>
                  <div className="w-[35%] text-left text-sm font-medium truncate">{m.away_team?.name}</div>
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <span className={`hidden sm:inline-flex badge ${m.season?.type === 'champions' ? 'badge-purple' : m.season?.type === 'cup' ? 'badge-yellow' : 'badge-blue'}`}>
                      {m.season?.name}
                    </span>
                    <span className={statusBadge[m.status]}>{statusLabel[m.status]}</span>
                    {m.status === 'scheduled' && canInput(m) && (
                      <button onClick={() => setScoreModal(m)} className="text-xs btn-secondary py-1 px-3">Input</button>
                    )}
                    {m.status === 'pending_result' && showInputBtn(m) && (
                      <button onClick={() => setScoreModal(m)} className="text-xs btn-secondary py-1 px-3">Edit</button>
                    )}
                    {m.status === 'pending_result' && isAdmin && (
                      <button onClick={() => approveMatch(m.id)} className="text-xs btn-success py-1 px-3">Approve</button>
                    )}
                    {m.status === 'approved' && isAdmin && (
                      <button onClick={() => setScoreModal(m)} className="text-xs btn-secondary py-1 px-3">Edit</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scoreModal && (
        <ScoreModal
          match={scoreModal}
          isAdmin={isAdmin}
          onClose={() => setScoreModal(null)}
          onSaved={() => { setScoreModal(null); fetchAll() }}
        />
      )}
    </div>
  )
}

function ScoreModal({ match, isAdmin, onClose, onSaved }) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? '')
  const [awayScore, setAwayScore] = useState(match.away_score ?? '')
  const [saving,    setSaving]    = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const newStatus = isAdmin ? 'approved' : 'pending_result'
    console.log('isAdmin:', isAdmin, '→ status:', newStatus)
    await supabase.from('matches').update({
      home_score: parseInt(homeScore),
      away_score: parseInt(awayScore),
      status: newStatus
    }).eq('id', match.id)
    setSaving(false)
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-1">Input Skor</h2>
        <p className="text-white/40 text-xs mb-5">
          {!isAdmin && 'Skor akan menunggu persetujuan admin.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <div className="text-xs text-white/50 mb-1.5 truncate">{match.home_team?.name}</div>
              <input type="number" min="0" required value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className="input text-center text-2xl font-display font-bold w-full" placeholder="0" />
            </div>
            <span className="text-white/30 font-display font-bold text-xl mt-5">–</span>
            <div className="flex-1 text-center">
              <div className="text-xs text-white/50 mb-1.5 truncate">{match.away_team?.name}</div>
              <input type="number" min="0" required value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className="input text-center text-2xl font-display font-bold w-full" placeholder="0" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
