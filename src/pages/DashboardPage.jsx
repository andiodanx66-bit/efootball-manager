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
  const [seasonIdx,  setSeasonIdx]  = useState(0)

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
          .select('*, home_team:teams!home_team_id(id,name,owner:profiles!owner_id(whatsapp,avatar_url)), away_team:teams!away_team_id(id,name,owner:profiles!owner_id(whatsapp,avatar_url)), season:seasons(id,name,type,created_at,status)')
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

  // Kelompokkan per kompetisi (sama seperti di SeasonSlider)
  const seasonMap = {}
  myMatches.forEach(m => {
    const sid = m.season_id
    if (!seasonMap[sid]) seasonMap[sid] = []
    seasonMap[sid].push(m)
  })
  const seasonEntries = Object.entries(seasonMap)
  const activeSeasonMatches = seasonEntries[seasonIdx]?.[1] ?? myMatches

  const myDone  = activeSeasonMatches.filter(m => m.status === 'approved').length
  const myTotal = activeSeasonMatches.length

  const myPending = activeSeasonMatches.filter(m => m.status === 'pending_result').length

  const cards = [
    { label: 'Total Kompetisi', value: stats.seasons, icon: Trophy,   color: 'brand',  to: '/seasons' },
    { label: 'Match Dimainkan', value: myTeamId ? `${myDone}/${myTotal}` : stats.matches, icon: Calendar, color: 'green', to: '/seasons' },
    { label: 'Hasil Pending',   value: isAdmin ? stats.pending : (myTeamId ? myPending : stats.pending), icon: Clock, color: 'yellow', to: isAdmin ? '/admin' : '/seasons' },
  ]

  const colorMap = {
    brand:  'bg-brand-100 text-brand-600',
    green:  'bg-accent-green/10 text-accent-green',
    yellow: 'bg-accent-yellow/10 text-accent-yellow',
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title">Dashboard</h1>
        <p className="text-ink-muted text-sm mt-1">
          Selamat datang, <span className="text-brand-600 font-semibold">{profile?.username}</span> 👋
        </p>
      </div>

      <div className="flex gap-3">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="stat-card hover:border-white/20 transition-colors cursor-pointer flex items-start gap-3 px-4 py-3 flex-1 text-justify">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-display font-bold text-ink">{value}</div>
              <div className="text-xs text-ink-muted">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Team Statistics - Compact */}
      {myTeamId && myMatches.length > 0 && (() => {
        const stats = myMatches
          .filter(m => m.status === 'approved')
          .reduce((acc, m) => {
            const isHome = m.home_team_id === myTeamId
            const myScore = isHome ? m.home_score : m.away_score
            const oppScore = isHome ? m.away_score : m.home_score
            
            acc.played++
            acc.goalsFor += myScore
            acc.goalsAgainst += oppScore
            
            if (myScore > oppScore) acc.won++
            else if (myScore < oppScore) acc.lost++
            else acc.drawn++
            
            return acc
          }, { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 })
        
        if (stats.played === 0) return null
        
        const winRate = Math.round((stats.won / stats.played) * 100)
        const goalDiff = stats.goalsFor - stats.goalsAgainst
        
        return (
          <Link to={`/teams/${myTeamId}`} className="card p-3 cursor-pointer hover:border-white/20 transition-colors block">
            <div className="grid grid-cols-3 divide-x divide-surface-border">
              {/* Win Rate */}
              <div className="flex flex-col items-center justify-center gap-0.5 px-3">
                <div className="text-[10px] text-ink-muted">Win Rate</div>
                <div className="text-lg font-display font-bold text-accent-green">{winRate}%</div>
                <div className="text-[10px] text-ink-faint">({stats.won}W-{stats.drawn}D-{stats.lost}L)</div>
              </div>
              
              {/* Goals */}
              <div className="flex flex-col items-center justify-center gap-0.5 px-3">
                <div className="text-xs text-ink-muted">Gol</div>
                <div className="flex items-center gap-1">
                  <div className="text-lg font-display font-bold text-brand-600">{stats.goalsFor}</div>
                  <div className="text-xs text-ink-faint">:</div>
                  <div className="text-lg font-display font-bold text-accent-red">{stats.goalsAgainst}</div>
                </div>
              </div>
              
              {/* Total Matches */}
              <div className="flex flex-col items-center justify-center gap-0.5 px-3">
                <div className="text-xs text-ink-muted">Total Main</div>
                <div className="text-lg font-display font-bold text-brand-600">{stats.played}</div>
              </div>
            </div>
          </Link>
        )
      })()}

      {myTeamId && (
        <div className="space-y-3">
          <div>
            <h2 className="font-display font-semibold text-lg flex items-center gap-2 text-ink">
              <Swords size={18} className="text-brand-600" /> Jadwal Tim Saya
            </h2>
            <p className="text-xs text-ink-faint mt-0.5">Klik papan skor untuk input hasil, klik nama tim untuk chat</p>
          </div>
          {myMatches.length === 0 ? (
            <div className="card p-8 text-center text-ink-faint text-sm">Belum ada jadwal</div>
          ) : (
          <SeasonSlider matches={myMatches} myTeamId={myTeamId} canInput={canInput} onScoreClick={setScoreModal} onImgClick={setImgModal} seasonIdx={seasonIdx} onSeasonChange={setSeasonIdx} />
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

function SeasonSlider({ matches, myTeamId, canInput, onScoreClick, onImgClick, seasonIdx, onSeasonChange }) {
  const KO_ROUNDS = [
    { key: 'r16',   label: '16 Besar' },
    { key: 'qf',    label: 'Perempat Final' },
    { key: 'sf',    label: 'Semi Final' },
    { key: 'final', label: 'Final' },
  ]

  // Kelompokkan per kompetisi (exclude yang sudah finished)
  const seasonMap = {}
  matches.forEach(m => {
    // Skip jika kompetisi sudah selesai
    if (m.season?.status === 'finished') return
    
    const sid = m.season_id
    if (!seasonMap[sid]) seasonMap[sid] = { 
      name: m.season?.name || 'Kompetisi', 
      type: m.season?.type || 'league',
      created_at: m.season?.created_at || '',
      status: m.season?.status || 'draft',
      matches: [] 
    }
    seasonMap[sid].matches.push(m)
  })
  // Sort seasons: terbaru dulu (descending created_at)
  const seasons = Object.entries(seasonMap).sort((a, b) => {
    const dateA = new Date(a[1].created_at).getTime()
    const dateB = new Date(b[1].created_at).getTime()
    return dateB - dateA
  })
  const idx = Math.min(seasonIdx, Math.max(0, seasons.length - 1))
  const current = seasons[idx]

  if (!current) return null
  const [, { name, type, matches: sMatches }] = current

  function renderMatchRow(m) {
    const homeWa = m.home_team?.owner?.whatsapp
    const awayWa = m.away_team?.owner?.whatsapp
    const homeWaLink = homeWa ? `https://kirimwa.id/${homeWa.replace(/\D/g, '')}` : null
    const awayWaLink = awayWa ? `https://kirimwa.id/${awayWa.replace(/\D/g, '')}` : null
    const canClick = canInput(m)

    return (
      <div key={m.id}
        onClick={() => canClick && onScoreClick(m)}
        className={`relative flex items-center justify-center px-4 py-3 gap-x-3 gap-y-1.5 ${canClick ? 'cursor-pointer hover:bg-surface-border' : ''}`}>
        {/* Home team */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          {homeWaLink ? (
            <a href={homeWaLink} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-sm font-medium truncate max-w-[90px] text-right hover:text-accent-green underline underline-offset-2 transition-colors">
              {m.home_team?.name}
            </a>
          ) : (
            <span className="text-sm font-medium truncate max-w-[90px] text-right">{m.home_team?.name}</span>
          )}
          <div className="w-6 h-6 rounded bg-surface-muted flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden shrink-0">
            {m.home_team?.owner?.avatar_url
              ? <img src={m.home_team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
              : (m.home_team?.name || '?')[0]}
          </div>
        </div>

        {/* Score */}
        <div
          className={`font-display font-bold text-sm rounded-lg px-2 py-1 w-12 text-center shrink-0 border ${canClick ? 'cursor-pointer hover:bg-slate-100' : ''} ${m.screenshot_url ? 'border-brand-300' : ''}`}
          style={{backgroundColor:"#f1f5f9",borderColor:"#e2e8f0"}}
          onClick={e => { if (canClick) { e.stopPropagation(); onScoreClick(m) } else if (m.screenshot_url) { e.stopPropagation(); onImgClick(m.screenshot_url) } }}
        >
          {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '–'}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-start">
          <div className="w-6 h-6 rounded bg-surface-muted flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden shrink-0">
            {m.away_team?.owner?.avatar_url
              ? <img src={m.away_team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
              : (m.away_team?.name || '?')[0]}
          </div>
          {awayWaLink ? (
            <a href={awayWaLink} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-sm font-medium truncate max-w-[90px] hover:text-accent-green underline underline-offset-2 transition-colors">
              {m.away_team?.name}
            </a>
          ) : (
            <span className="text-sm font-medium truncate max-w-[90px]">{m.away_team?.name}</span>
          )}
        </div>

        {/* Status badges — absolute positioned */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {m.status === 'pending_result' && <span className={`${statusBadge.pending_result} flex items-center`}><Clock size={11} /></span>}
          {m.status === 'approved' && <span className={statusBadge.approved}>✓</span>}
        </div>
      </div>
    )
  }

  function renderContent() {
    if (type === 'champions') {
      // Fase grup: kelompokkan per group_id
      const groupMatches = sMatches.filter(m => m.group_id)
      const koMatches    = sMatches.filter(m => KO_ROUNDS.some(k => k.key === m.stage))
      const groups = [...new Set(groupMatches.map(m => m.group_id))].sort()

      return (
        <>
          {groups.map(g => (
            <div key={g} className="card overflow-hidden">
              <div className="px-5 py-2.5 border-b border-surface-border bg-surface-muted">
                <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
              </div>
              <div className="divide-y divide-surface-border">
                {groupMatches.filter(m => m.group_id === g).map(renderMatchRow)}
              </div>
            </div>
          ))}
          {KO_ROUNDS.map(ko => {
            const roundMatches = koMatches.filter(m => m.stage === ko.key)
            if (roundMatches.length === 0) return null
            return (
              <div key={ko.key} className="card overflow-hidden">
                <div className="px-5 py-2.5 border-b border-surface-border bg-surface-muted">
                  <span className="font-display font-semibold text-sm text-accent-yellow">{ko.label}</span>
                </div>
                <div className="divide-y divide-surface-border">
                  {roundMatches.map(renderMatchRow)}
                </div>
              </div>
            )
          })}
          {groups.length === 0 && koMatches.length === 0 && (
            <div className="card p-6 text-center text-ink-faint text-sm">Belum ada jadwal</div>
          )}
        </>
      )
    }

    // Liga / Cup: per pekan
    const rounds = [...new Set(sMatches.map(m => m.round))].sort((a, b) => a - b)

    if (type === 'cup') {
      return KO_ROUNDS.map(ko => {
        const roundMatches = sMatches.filter(m => m.stage === ko.key)
        if (roundMatches.length === 0) return null
        return (
          <div key={ko.key} className="card overflow-hidden">
            <div className="px-5 py-2.5 border-b border-surface-border bg-surface-muted">
              <span className="font-display font-semibold text-sm text-accent-yellow">{ko.label}</span>
            </div>
            <div className="divide-y divide-surface-border">
              {roundMatches.map(renderMatchRow)}
            </div>
          </div>
        )
      })
    }

    return rounds.map(r => (
      <div key={r} className="card overflow-hidden">
        <div className="px-5 py-2.5 border-b border-surface-border bg-surface-muted">
          <span className="font-display font-semibold text-sm text-brand-600">Pekan {r}</span>
        </div>
        <div className="divide-y divide-surface-border">
          {sMatches.filter(m => m.round === r).map(renderMatchRow)}
        </div>
      </div>
    ))
  }

  return (
    <div className="space-y-3">
      {/* Header slider */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => onSeasonChange(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="w-8 h-8 rounded-lg bg-surface-muted hover:bg-surface-border disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0 text-lg text-ink"
          >‹</button>
          <span className="font-display font-semibold text-sm text-brand-600 truncate">{name}</span>
          <button
            onClick={() => onSeasonChange(i => Math.min(seasons.length - 1, i + 1))}
            disabled={idx === seasons.length - 1}
            className="w-8 h-8 rounded-lg bg-surface-muted hover:bg-surface-border disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0 text-lg text-ink"
          >›</button>
        </div>
        <span className="text-xs text-ink-faint shrink-0">{idx + 1} / {seasons.length}</span>
      </div>

      {renderContent()}
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-1 text-ink">Input Skor</h2>
        <p className="text-ink-faint text-xs mb-4">Skor akan menunggu persetujuan admin.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <div className="text-xs text-ink-faint mb-1.5 truncate">{match.home_team?.name}</div>
              <input type="number" min="0" required value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className="input text-center text-2xl font-display font-bold w-full" placeholder="0" />
            </div>
            <span className="text-ink-faint font-display font-bold text-xl mt-5">–</span>
            <div className="flex-1 text-center">
              <div className="text-xs text-ink-faint mb-1.5 truncate">{match.away_team?.name}</div>
              <input type="number" min="0" required value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className="input text-center text-2xl font-display font-bold w-full" placeholder="0" />
            </div>
          </div>

          <div>
            <label className="text-sm text-ink-muted mb-1.5 block">Bukti Screenshot</label>
            <div
              onClick={() => fileRef.current.click()}
              className="w-full h-28 rounded-xl border-2 border-dashed border-surface-border hover:border-brand-400 transition-colors cursor-pointer overflow-hidden flex items-center justify-center bg-surface-muted"
            >
              {preview
                ? <img src={preview} alt="screenshot" className="w-full h-full object-cover" />
                : <span className="text-xs text-ink-faint">Klik untuk upload gambar</span>}
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
          <div key={i} className="card p-5 h-24 animate-pulse bg-surface-muted" />
        ))}
      </div>
      <div className="card h-48 animate-pulse bg-surface-muted" />
    </div>
  )
}
