import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Trophy, Calendar, Clock, Swords, Pencil } from 'lucide-react'

function WaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const statusBadge = { scheduled: 'badge-gray', pending_result: 'badge-yellow', approved: 'badge-green' }

export default function DashboardPage() {
  const { profile, isAdmin, user } = useAuth()
  const [stats,      setStats]      = useState({ seasons: 0, matches: 0, pending: 0 })
  const [myMatches,  setMyMatches]  = useState([])
  const [myTeamId,   setMyTeamId]   = useState(null)
  const [scoreModal, setScoreModal] = useState(null)
  const [imgModal,   setImgModal]   = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => { fetchData() }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`dashboard-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' },
        () => fetchData())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  async function fetchData() {
    const [{ count: s }, { count: m }, { count: p }] = await Promise.all([
      supabase.from('seasons').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'pending_result'),
    ])
    setStats({ seasons: s || 0, matches: m || 0, pending: p || 0 })

    if (user?.id) {
      const { data: teamData } = await supabase.from('teams').select('id').eq('owner_id', user.id).maybeSingle()
      const teamId = teamData?.id || null
      setMyTeamId(teamId)
      if (teamId) {
        const { data: matchData } = await supabase.from('matches')
          .select('*, home_team:teams!home_team_id(id,name,owner:profiles!owner_id(whatsapp)), away_team:teams!away_team_id(id,name,owner:profiles!owner_id(whatsapp)), season:seasons(name)')
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order('round')
        setMyMatches(matchData || [])
      }
    }
    setLoading(false)
  }

  function canInput(m) {
    return myTeamId &&
      (m.home_team_id === myTeamId || m.away_team_id === myTeamId) &&
      m.status !== 'approved'
  }

  const myDone  = myMatches.filter(m => m.status === 'approved').length
  const myTotal = myMatches.length

  const myPending = myMatches.filter(m => m.status === 'pending_result').length

  const cards = [
    { label: 'Total Kompetisi', value: stats.seasons, icon: Trophy,   color: 'brand',  to: '/seasons' },
    { label: 'Match Dimainkan', value: myTeamId ? `${myDone}/${myTotal}` : stats.matches, icon: Calendar, color: 'green', to: '/seasons' },
    { label: 'Hasil Pending',   value: isAdmin ? stats.pending : myPending, icon: Clock, color: 'yellow', to: isAdmin ? '/admin' : '/seasons' },
  ]

  const colorMap = {
    brand:  'bg-brand-500/20 text-brand-400',
    green:  'bg-accent-green/20 text-accent-green',
    yellow: 'bg-accent-yellow/20 text-accent-yellow',
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title">Dashboard</h1>
        <p className="text-white/50 text-sm mt-1">
          Selamat datang, <span className="text-brand-400">{profile?.username}</span> 👋
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="stat-card hover:border-white/20 transition-colors cursor-pointer">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-display font-bold mt-2">{value}</div>
            <div className="text-xs text-white/50">{label}</div>
          </Link>
        ))}
      </div>

      {myTeamId && (
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <Swords size={18} className="text-brand-400" /> Jadwal Tim Saya
          </h2>
          {myMatches.length === 0 ? (
            <div className="card p-8 text-center text-white/30 text-sm">Belum ada jadwal</div>
          ) : (
            (() => {
              const rounds = [...new Set(myMatches.map(m => m.round))].sort((a, b) => a - b)
              return rounds.map(r => (
                <div key={r} className="card overflow-hidden">
                  <div className="px-5 py-2.5 border-b border-white/10 bg-pitch-dark/50">
                    <span className="font-display font-semibold text-sm text-brand-400">Pekan {r}</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {myMatches.filter(m => m.round === r).map(m => {
                      const isHome = myTeamId === m.home_team_id
                      const oppWa  = isHome ? m.away_team?.owner?.whatsapp : m.home_team?.owner?.whatsapp
                      return (
                        <div key={m.id} className="flex flex-wrap items-center px-4 py-3 gap-x-2 gap-y-1.5 table-row-hover">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-sm font-medium truncate max-w-[80px]">{m.home_team?.name}</span>
                              {!isHome && oppWa && (
                                <a href={`https://kirimwa.id/${oppWa.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                  className="text-accent-green hover:text-accent-green/70 transition-colors shrink-0">
                                  <WaIcon />
                                </a>
                              )}
                            </div>
                            <div
                              className={`font-display font-bold text-sm bg-pitch-dark rounded-lg px-2 py-1 w-12 text-center shrink-0 ${m.screenshot_url ? 'cursor-pointer hover:bg-white/10' : ''}`}
                              onClick={() => m.screenshot_url && setImgModal(m.screenshot_url)}
                            >
                              {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '–'}
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-sm font-medium truncate max-w-[80px]">{m.away_team?.name}</span>
                              {isHome && oppWa && (
                                <a href={`https://kirimwa.id/${oppWa.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                  className="text-accent-green hover:text-accent-green/70 transition-colors shrink-0">
                                  <WaIcon />
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canInput(m) && (
                              <button onClick={() => setScoreModal(m)} className="badge-blue cursor-pointer hover:bg-brand-500/30 transition-colors p-1.5 flex items-center">
                                <Pencil size={13} />
                              </button>
                            )}
                            {m.status === 'pending_result' && <span className={`${statusBadge.pending_result} flex items-center`}><Clock size={11} /></span>}
                            {m.status === 'approved' && <span className={statusBadge.approved}>✓</span>}
                            {m.status === 'scheduled' && !canInput(m) && <span className={statusBadge.scheduled}>–</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()
          )}
        </div>
      )}

      {scoreModal && (
        <ScoreModal
          match={scoreModal}
          onClose={() => setScoreModal(null)}
          onSaved={() => { setScoreModal(null); fetchData() }}
        />
      )}

      {imgModal && createPortal(
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="bukti" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>,
        document.body
      )}
    </div>
  )
}

function ScoreModal({ match, onClose, onSaved }) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? '')
  const [awayScore, setAwayScore] = useState(match.away_score ?? '')
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(match.screenshot_url || null)
  const [saving,    setSaving]    = useState(false)
  const fileRef = useRef()

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function compressImage(f) {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(f)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(1280 / img.width, 720 / img.height, 1)
        canvas.width  = img.width  * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        canvas.toBlob(resolve, 'image/webp', 0.75)
      }
      img.src = url
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    let screenshot_url = match.screenshot_url || null

    if (file) {
      const compressed = await compressImage(file)
      const path = `${match.id}_${Date.now()}.webp`
      const { error: upErr } = await supabase.storage
        .from('match-screenshots')
        .upload(path, compressed, { upsert: true, contentType: 'image/webp' })
      if (!upErr) {
        const { data } = supabase.storage.from('match-screenshots').getPublicUrl(path)
        screenshot_url = data.publicUrl
      }
    }

    await supabase.from('matches').update({
      home_score: parseInt(homeScore),
      away_score: parseInt(awayScore),
      screenshot_url,
      status: 'pending_result'
    }).eq('id', match.id)
    setSaving(false)
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-1">Input Skor</h2>
        <p className="text-white/40 text-xs mb-4">Skor akan menunggu persetujuan admin.</p>
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

          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Bukti Screenshot</label>
            <div
              onClick={() => fileRef.current.click()}
              className="w-full h-28 rounded-xl border-2 border-dashed border-white/15 hover:border-brand-500/50 transition-colors cursor-pointer overflow-hidden flex items-center justify-center bg-white/5"
            >
              {preview
                ? <img src={preview} alt="screenshot" className="w-full h-full object-cover" />
                : <span className="text-xs text-white/30">Klik untuk upload gambar</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          <div className="flex gap-3">
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-5 h-24 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="card h-48 animate-pulse bg-white/5" />
    </div>
  )
}
