import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Trophy, Users, Calendar, BarChart2, Play, Settings, ArrowLeft, Star, Swords, Plus, XCircle, Clock, Pencil, Check, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateRoundRobin, generateKnockout, generateGroupStage } from '../utils/scheduler'
import BackButton from '../components/layout/BackButton'

// Scrollable tab container — hide scrollbar, support mouse/touch drag
function TabScroller({ children, activeTab }) {
  const ref = useRef(null)
  const dragging = useRef(false)
  const startX  = useRef(0)
  const scrollL = useRef(0)

  // Scroll aktif tab ke tengah saat tab berubah
  useEffect(() => {
    if (!ref.current) return
    const active = ref.current.querySelector('[data-active="true"]')
    if (!active) return
    const container = ref.current
    const btnLeft   = active.offsetLeft
    const btnWidth  = active.offsetWidth
    const target    = btnLeft - container.clientWidth / 2 + btnWidth / 2
    container.scrollTo({ left: target, behavior: 'smooth' })
  }, [activeTab])

  function onMouseDown(e) {
    dragging.current = true
    startX.current  = e.pageX - ref.current.offsetLeft
    scrollL.current = ref.current.scrollLeft
    ref.current.style.cursor = 'grabbing'
  }
  function onMouseUp() {
    dragging.current = false
    ref.current.style.cursor = 'grab'
  }
  function onMouseMove(e) {
    if (!dragging.current) return
    e.preventDefault()
    const x    = e.pageX - ref.current.offsetLeft
    const walk = x - startX.current
    ref.current.scrollLeft = scrollL.current - walk
  }

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onMouseMove={onMouseMove}
      className="no-scrollbar"
      style={{
        overflowX: 'auto',
        cursor: 'grab',
        userSelect: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  )
}

const statusBadge = { draft: 'badge-gray', active: 'badge-green', finished: 'badge-red' }
const statusLabel = { draft: 'Draft', active: 'Berjalan', finished: 'Selesai' }

export default function SeasonDetail() {
  const { id } = useParams()
  const { isAdmin, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [season,  setSeason]  = useState(null)
  const [teams,   setTeams]   = useState([])
  const [matches, setMatches] = useState([])
  const [myTeamId, setMyTeamId] = useState(null)
  const [tab,     setTab]     = useState(searchParams.get('tab') || 'matches')
  const [loading, setLoading] = useState(true)
  const [genLoading, setGenLoading] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteMatchesModal, setShowDeleteMatchesModal] = useState(false)
  const [imgModal, setImgModal] = useState(null)

  const navigate = useNavigate()

  useEffect(() => { fetchAll() }, [id])

  useEffect(() => {
    const channel = supabase
      .channel(`season-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `season_id=eq.${id}` },
        () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_teams', filter: `season_id=eq.${id}` },
        () => fetchAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])
  useEffect(() => {
    if (!user?.id) return
    supabase.from('teams').select('id').eq('owner_id', user.id).maybeSingle()
      .then(({ data }) => setMyTeamId(data?.id || null))
  }, [user?.id])

  async function fetchAll() {
    const [{ data: s }, { data: st }, { data: m }] = await Promise.all([
      supabase.from('seasons').select('*').eq('id', id).single(),
      supabase.from('season_teams').select('*, team:teams(id,name,owner:profiles!owner_id(avatar_url))').eq('season_id', id).order('division'),
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(id,name,owner:profiles!owner_id(whatsapp)), away_team:teams!away_team_id(id,name,owner:profiles!owner_id(whatsapp))')
        .eq('season_id', id)
        .order('round').order('match_date')
    ])
    setSeason(s)
    setTeams(st || [])
    setMatches(m || [])
    setLoading(false)
  }

  // Kelompokkan tim per divisi untuk generate jadwal
  function getTeamsByDivision() {
    const divMap = {}
    teams.forEach(t => {
      const div = t.division || 1
      if (!divMap[div]) divMap[div] = []
      divMap[div].push(t.team_id)
    })
    return divMap
  }

  // Hitung total pekan per divisi (ambil maksimal)
  function getTotalRounds() {
    if (season.type === 'league') {
      const divTeams = getTeamsByDivision()
      let maxRounds = 0
      Object.values(divTeams).forEach(ids => {
        const n = ids.length % 2 === 0 ? ids.length : ids.length + 1
        const r = (n - 1) * (season.legs || 1)
        if (r > maxRounds) maxRounds = r
      })
      return maxRounds
    } else if (season.type === 'cup') {
      const teamIds = teams.map(t => t.team_id)
      return generateKnockout(teamIds).length
    } else if (season.type === 'champions') {
      return 0
    }
    return 0
  }

  async function generateSchedule() {
    setShowGenModal(false)
    setGenLoading(true)

    // Untuk champions, generate sekaligus
    if (season.type === 'champions') {
      const teamIds = teams.map(t => t.team_id)
      const groupMap = {}
      teams.forEach(t => {
        if (t.group_id) {
          if (!groupMap[t.group_id]) groupMap[t.group_id] = []
          groupMap[t.group_id].push(t.team_id)
        }
      })
      const hasDrawn = Object.keys(groupMap).length > 0
      let matchRows = []

      if (hasDrawn) {
        for (const [groupId, members] of Object.entries(groupMap)) {
          const rounds = generateRoundRobin(members, 2)
          rounds.forEach((round, ri) => {
            round.forEach(m => matchRows.push({
              season_id: id, ...m,
              group_id: groupId,
              round: ri + 1,
              stage: 'group',
              status: 'scheduled'
            }))
          })
        }
      } else {
        const numGroups = season.num_groups || 4
        matchRows = generateGroupStage(teamIds, Math.ceil(teamIds.length / numGroups)).map(m => ({ season_id: id, ...m, status: 'scheduled' }))
        const groupSize = Math.ceil(teamIds.length / numGroups)
        const groupUpdates = teamIds.map((teamId, i) => ({
          team_id: teamId,
          group_id: String.fromCharCode(65 + Math.floor(i / groupSize))
        }))
        for (const { team_id, group_id } of groupUpdates) {
          await supabase.from('season_teams').update({ group_id }).eq('season_id', id).eq('team_id', team_id)
        }
      }

      if (matchRows.length > 0) await supabase.from('matches').insert(matchRows)
      await fetchAll()
      setGenLoading(false)
      return
    }

    if (season.type === 'league') {
      // Generate per divisi
      const divTeams = getTeamsByDivision()
      for (const [div, ids] of Object.entries(divTeams)) {
        const divMatches = matches.filter(m => {
          const isHome = teams.find(t => t.team_id === m.home_team_id)
          const isAway = teams.find(t => t.team_id === m.away_team_id)
          return isHome && isAway && (isHome.division || 1) === parseInt(div)
        })
        const existingRounds = [...new Set(divMatches.map(m => m.round))].sort((a, b) => a - b)
        const nextRound = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1
        const allRounds = generateRoundRobin(ids, season.legs || 1)
        const roundIndex = nextRound - 1
        if (roundIndex >= allRounds.length) continue

        const roundMatches = allRounds[roundIndex]
        const matchRows = roundMatches.map(m => ({
          season_id: id,
          ...m,
          round: nextRound,
          stage: 'league',
          status: 'scheduled'
        }))

        if (matchRows.length > 0) await supabase.from('matches').insert(matchRows)
      }
      await fetchAll()
      setGenLoading(false)
      return
    }

    // Cup: generate round by round (tanpa divisi)
    const teamIds = teams.map(t => t.team_id)
    const existingRounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b)
    const nextRound = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1
    const allRounds = generateKnockout(teamIds)
    const roundIndex = nextRound - 1
    if (roundIndex >= allRounds.length) {
      setGenLoading(false)
      return
    }

    const stageNames = ['r32','r16','qf','sf','final']
    const roundMatches = allRounds[roundIndex]
    const matchRows = roundMatches.map(m => ({
      season_id: id,
      ...m,
      round: nextRound,
      stage: stageNames[roundIndex] || `r${nextRound}`,
      status: 'scheduled'
    }))

    if (matchRows.length > 0) await supabase.from('matches').insert(matchRows)
    await fetchAll()
    setGenLoading(false)
  }

  async function finishSeason() {
    // Proses promosi/degradasi jika season dengan multi-divisi
    if (season.type === 'league' && (season.num_divisions || 1) > 1) {
      const relCount = season.relegation_count || 0
      const proCount = season.promotion_count || 0

      if (relCount > 0 || proCount > 0) {
        // Ambil standings per divisi
        const { data: standings } = await supabase
          .from('standings')
          .select('*')
          .eq('season_id', id)
          .order('division', { ascending: true })

        const byDiv = {}
        standings?.forEach(r => {
          const d = r.division || 1
          if (!byDiv[d]) byDiv[d] = []
          byDiv[d].push(r)
        })

        // Sort per divisi: urut berdasarkan pts, gd, gf
        Object.values(byDiv).forEach(arr => {
          arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        })

        const updates = []

        // Degradasi: X terbawah dari divisi 1 pindah ke divisi 2, X dari divisi 2 ke 3, dst
        for (let d = 1; d < Object.keys(byDiv).length; d++) {
          const upper = byDiv[d]
          const lower = byDiv[d + 1]
          if (!upper || !lower) continue

          // X terbawah divisi atas → degradasi
          const relegated = upper.slice(-relCount)
          relegated.forEach(r => {
            updates.push({ team_id: r.team_id, division: d + 1 })
          })

          // X teratas divisi bawah → promosi
          const promoted = lower.slice(0, proCount)
          promoted.forEach(r => {
            updates.push({ team_id: r.team_id, division: d })
          })
        }

        // Simpan perubahan division di season_teams
        for (const u of updates) {
          await supabase.from('season_teams').update({ division: u.division }).eq('season_id', id).eq('team_id', u.team_id)
        }
      }
    }

    await supabase.from('seasons').update({ status: 'finished' }).eq('id', id)
    fetchAll()
  }

  async function deleteSeason() {
    setShowDeleteModal(false)
    await supabase.from('seasons').delete().eq('id', id)
    navigate('/seasons')
  }

  async function deleteAllMatches() {
    setShowDeleteMatchesModal(false)
    const { error } = await supabase.from('matches').delete().eq('season_id', id)
    if (error) {
      alert('Gagal hapus jadwal: ' + error.message)
      return
    }
    fetchAll()
  }

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!season) return <div className="text-slate-400 p-8">Kompetisi tidak ditemukan</div>

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b)
  const groups = [...new Set(matches.map(m => m.group_id).filter(Boolean))]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <BackButton fallback="/seasons" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="section-title">{season.name}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm" style={{color:'#94a3b8'}}>{teams.length} tim terdaftar · {matches.length} pertandingan</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap items-center">
              {isAdmin && matches.length > 0 && (
                <button
                  onClick={() => setShowDeleteMatchesModal(true)}
                  className="transition-colors p-1.5 rounded-lg hover:bg-red-50 hover:text-accent-red"
                  style={{color:'#94a3b8'}}
                  title="Hapus Semua Jadwal"
                >
                  <Trash2 size={18} />
                </button>
              )}
              {(() => {
                if (season.type === 'cup') return null
                if (season.type === 'champions') {
                  return matches.filter(m => m.stage === 'group').length === 0 && teams.length >= 2 && (
                    <button onClick={() => setShowGenModal(true)} disabled={genLoading} className="btn-primary text-sm flex items-center gap-2">
                      <Calendar size={15} /> {genLoading ? 'Generating...' : 'Generate Jadwal'}
                    </button>
                  )
                }
                const existingRounds = [...new Set(matches.map(m => m.round))]
                const nextRound = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1
                const totalRounds = getTotalRounds()
                const allGenerated = nextRound > totalRounds
                return teams.length >= 2 && !allGenerated && (
                  <button onClick={() => setShowGenModal(true)} disabled={genLoading} className="btn-primary text-sm flex items-center gap-2">
                    <Calendar size={15} /> {genLoading ? 'Generating...' : `Generate Pekan ${nextRound}`}
                  </button>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <TabScroller activeTab={tab}>
        <div className="flex gap-1 p-1 rounded-xl w-max" style={{backgroundColor:"#f1f5f9"}}>
          {(() => {
          const baseTabs = ['matches']
          if (season.type === 'champions') baseTabs.push('draw')
          if (season.type !== 'cup') baseTabs.push('standings')
          if (season.type === 'champions') baseTabs.push('knockout')
          if (season.type === 'cup') baseTabs.push('bracket')
          if (isAdmin) baseTabs.push('teams')
          return baseTabs.map(t => (
            <button key={t} data-active={tab === t} onClick={() => { setTab(t); setSearchParams({ tab: t }) }}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all ${tab === t ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              {t === 'matches' ? 'Jadwal & Hasil' : t === 'standings' ? 'Klasemen' : t === 'draw' ? 'Undian Grup' : t === 'knockout' ? 'Fase Knockout' : t === 'bracket' ? 'Bagan Cup' : 'Tim'}
            </button>
          ))
        })()}
        </div>
      </TabScroller>

      {/* Tab content */}
      {tab === 'matches' && (
        <div className="space-y-6">
          {/* Hasil Terbaru Section */}
          {matches.filter(m => m.status === 'approved').length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-semibold text-sm flex items-center gap-2 px-1 uppercase tracking-wider text-slate-400">
                <Trophy size={14} className="text-brand-500" /> ringkasan pertandingan
              </h2>
              <div className="card overflow-hidden divide-y divide-slate-100 max-h-[calc(5*56px)] overflow-y-auto custom-scrollbar">
                {matches
                  .filter(m => m.status === 'approved')
                  .sort((a, b) => {
                    const dateA = a.approved_at ? new Date(a.approved_at).getTime() : 0
                    const dateB = b.approved_at ? new Date(b.approved_at).getTime() : 0
                    return dateB - dateA
                  })
                  .map(m => (
                    <div key={m.id} className="flex flex-wrap items-center px-4 py-3 gap-x-2 gap-y-1.5 table-row-hover">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-medium truncate max-w-[80px]">{m.home_team?.name}</span>
                        <div
                          className={`font-display font-bold text-sm rounded-lg px-2 py-1 w-12 text-center shrink-0 border ${m.screenshot_url ? "cursor-pointer hover:bg-slate-100" : ""}`} style={{backgroundColor:"#f1f5f9",borderColor:"#e2e8f0"}}
                          onClick={() => m.screenshot_url && setImgModal(m.screenshot_url)}
                        >
                          {m.home_score}–{m.away_score}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[80px]">{m.away_team?.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono uppercase tracking-tighter shrink-0 flex flex-col items-end">
                        <span>{m.stage === 'league' ? `Pekan ${m.round}` : m.stage}</span>
                        {m.approved_at && (
                          <span>{new Date(m.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Kelompokkan berdasarkan divisi jika multi-divisi */}
          {(() => {
            const numDiv = (season.num_divisions || 1)
            if (matches.length === 0) {
              return (
                <div className="card p-10 text-center text-slate-300">
                  <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                  <p>Belum ada jadwal. {isAdmin && teams.length >= 2 ? 'Klik "Generate Jadwal" untuk membuat otomatis.' : ''}</p>
                </div>
              )
            }
            if (groups.length > 0) {
              return <>
                {/* Fase Grup */}
                {groups.map(g => (
                  <div key={g} className="card overflow-hidden">
                    <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                      <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
                    </div>
                    <MatchList matches={matches.filter(m => m.group_id === g)} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                  </div>
                ))}
                {/* Fase Knockout (champions) */}
                {KO_ROUNDS.map(ko => {
                  const koMatches = matches.filter(m => m.stage === ko.key)
                  if (koMatches.length === 0) return null
                  return (
                    <div key={ko.key} className="card overflow-hidden">
                      <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                        <span className="font-display font-semibold text-sm text-accent-yellow">{ko.label}</span>
                      </div>
                      <MatchList matches={koMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                    </div>
                  )
                })}
              </>
            }
            // Multi-divisi: slide navigation per divisi
            if (season.type === 'league' && numDiv > 1) {
              const MatchDivSlider = () => {
                const [mDiv, setMDiv] = useState(1)
                const mPrev = () => setMDiv(d => Math.max(1, d - 1))
                const mNext = () => setMDiv(d => Math.min(numDiv, d + 1))
                const mDivMatches = matches.filter(m => {
                  const home = teams.find(t => t.team_id === m.home_team_id)
                  return home && (home.division || 1) === mDiv
                })
                const mDivRounds = [...new Set(mDivMatches.map(m => m.round))].sort((a, b) => a - b)
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <button onClick={mPrev} disabled={mDiv === 1}
                          className={`p-1 rounded-lg transition-colors ${mDiv === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <span className="font-display font-semibold text-sm text-brand-600">Divisi {mDiv}</span>
                        <button onClick={mNext} disabled={mDiv === numDiv}
                          className={`p-1 rounded-lg transition-colors ${mDiv === numDiv ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      </div>
                      <span className="text-xs text-slate-300 font-mono">{mDiv}/{numDiv}</span>
                    </div>
                    {mDivRounds.map(r => (
                      <div key={r} className="card overflow-hidden">
                        <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                          <span className="font-display font-semibold text-sm text-brand-600">Pekan {r}</span>
                        </div>
                        <MatchList matches={mDivMatches.filter(m => m.round === r)} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                      </div>
                    ))}
                    {mDivRounds.length === 0 && (
                      <div className="card overflow-hidden">
                        <MatchList matches={mDivMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                      </div>
                    )}
                  </div>
                )
              }
              return <MatchDivSlider />
            }
            // Single division / cup
            return rounds.map(r => (
              <div key={r} className="card overflow-hidden">
                <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                  <span className="font-display font-semibold text-sm text-brand-600">
                    {season.type === 'cup'
                      ? (KO_ROUNDS.find(k => matches.find(m => m.round === r && m.stage === k.key))?.label || stageLabel(r, rounds.length))
                      : `Pekan ${r}`}
                  </span>
                </div>
                <MatchList matches={matches.filter(m => m.round === r)} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
              </div>
            ))
          })()}
        </div>
      )}

      {tab === 'standings' && <StandingsTab seasonId={id} type={season.type} season={season} enrolledTeams={teams} />}

      {tab === 'draw' && season.type === 'champions' && (
        <DrawTab
          seasonId={id}
          season={season}
          teams={teams}
          isAdmin={isAdmin}
          myTeamId={myTeamId}
          onUpdate={fetchAll}
          hasMatches={matches.length > 0}
        />
      )}

      {tab === 'bracket' && season.type === 'cup' && (
        <KnockoutTab
          seasonId={id}
          season={season}
          enrolledTeams={teams}
          isAdmin={isAdmin}
          onUpdate={fetchAll}
        />
      )}

      {tab === 'knockout' && season.type === 'champions' && (
        <KnockoutTab
          seasonId={id}
          season={season}
          enrolledTeams={teams}
          isAdmin={isAdmin}
          onUpdate={fetchAll}
        />
      )}

      {tab === 'teams' && (
        <TeamsTab
          seasonId={id}
          season={season}
          teams={teams}
          isAdmin={isAdmin}
          onUpdate={fetchAll}
          hasMatches={matches.length > 0}
        />
      )}

      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowGenModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            {(() => {
              const existingRounds = [...new Set(matches.map(m => m.round))]
              const nextRound = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1
              const totalRounds = season.type !== 'champions' ? getTotalRounds() : null
              return (
                <>
                  <h2 className="font-display font-bold text-lg mb-2 text-slate-900">
                    {season.type === 'champions' ? 'Generate Jadwal' : `Generate Pekan ${nextRound}`}
                  </h2>
                  <p className="text-slate-500 text-sm mb-1">
                    {season.type === 'champions'
                      ? 'Generate semua jadwal fase grup sekaligus.'
                      : `Akan membuat jadwal pertandingan untuk pekan ${nextRound}${totalRounds ? ` dari ${totalRounds}` : ''}.`}
                  </p>
                  <p className="text-slate-400 text-xs mb-5">Jadwal yang sudah di-generate tidak bisa diubah.</p>
                </>
              )
            })()}
            <div className="flex gap-3">
              <button onClick={() => setShowGenModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={generateSchedule} className="btn-primary flex-1 text-sm">Generate</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteMatchesModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteMatchesModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-2 text-slate-900">Hapus Semua Jadwal</h2>
            <p className="text-slate-500 text-sm mb-1">Yakin ingin menghapus semua jadwal di <span className="text-white font-semibold">{season.name}</span>?</p>
            <p className="text-slate-400 text-xs mb-5">Kompetisi dan tim peserta tidak akan terhapus. Kamu bisa generate jadwal baru setelahnya.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteMatchesModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={deleteAllMatches} className="btn-danger flex-1 text-sm">Hapus Jadwal</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-2 text-slate-900">Hapus Kompetisi</h2>
            <p className="text-slate-500 text-sm mb-1">Yakin ingin menghapus <span className="text-white font-semibold">{season.name}</span>?</p>
            <p className="text-slate-400 text-xs mb-5">Semua jadwal, hasil pertandingan, tim terdaftar, dan data klasemen akan ikut terhapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={deleteSeason} className="btn-danger flex-1 text-sm">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {imgModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="bukti" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>,
        document.body
      )}
    </div>
  )
}

function stageLabel(round, total) {
  if (round === total) return 'Final'
  if (round === total - 1) return 'Semi Final'
  if (round === total - 2) return 'Perempat Final'
  return `Babak ${round}`
}

function WaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function MatchList({ matches, isAdmin, myTeamId, onUpdate, season }) {
  const [scoreModal, setScoreModal] = useState(null)
  const [imgModal,   setImgModal]   = useState(null) // screenshot_url

  function canInput(m) {
    if (isAdmin) return true
    // user bisa input jika timnya terlibat dan belum approved
    return myTeamId &&
      (m.home_team_id === myTeamId || m.away_team_id === myTeamId) &&
      m.status !== 'approved'
  }

  function showInputBtn(m) {
    if (isAdmin) return true // admin bisa edit kapan saja
    if (m.status === 'scheduled') return canInput(m)
    if (m.status === 'pending_result') return canInput(m) // user bisa edit selama pending
    return false
  }

  async function approveResult(match) {
    await supabase.from('matches').update({
      status: 'approved',
      approved_at: new Date().toISOString()
    }).eq('id', match.id)
    onUpdate()
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {matches.map(m => {
          const isHome   = myTeamId === m.home_team_id
          const isAway   = myTeamId === m.away_team_id
          const homeWa   = !isHome ? m.home_team?.owner?.whatsapp : null
          const awayWa   = !isAway ? m.away_team?.owner?.whatsapp : null
          return (
          <div key={m.id} className="flex flex-wrap items-center px-4 py-3 gap-x-2 gap-y-1.5 table-row-hover">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-sm font-medium truncate max-w-[80px]">{m.home_team?.name}</span>
                {homeWa && (
                  <a href={`https://kirimwa.id/${homeWa.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-accent-green hover:text-accent-green/70 transition-colors shrink-0" title="Chat WhatsApp">
                    <WaIcon />
                  </a>
                )}
              </div>
              <div
                className={`font-display font-bold text-sm rounded-lg px-2 py-1 w-12 text-center shrink-0 border ${m.screenshot_url ? "cursor-pointer hover:bg-slate-100" : ""}`} style={{backgroundColor:"#f1f5f9",borderColor:"#e2e8f0"}}
                onClick={() => m.screenshot_url && setImgModal(m.screenshot_url)}
              >
                {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '–'}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-sm font-medium truncate max-w-[80px]">{m.away_team?.name}</span>
                {awayWa && (
                  <a href={`https://kirimwa.id/${awayWa.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-accent-green hover:text-accent-green/70 transition-colors shrink-0" title="Chat WhatsApp">
                    <WaIcon />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {showInputBtn(m) && (
                <button onClick={() => setScoreModal(m)} className="badge-blue cursor-pointer hover:bg-brand-500/30 transition-colors p-1.5 flex items-center">
                  <Pencil size={13} />
                </button>
              )}
              {m.status === 'pending_result' && isAdmin && (
                <button onClick={() => approveResult(m)} className="badge-green cursor-pointer p-1.5 flex items-center">
                  <Check size={13} />
                </button>
              )}
              {m.status === 'pending_result' && !isAdmin && canInput(m) && <span className="badge-yellow flex items-center gap-1"><Clock size={11} /></span>}
              {m.status === 'pending_result' && !canInput(m) && <span className="badge-yellow flex items-center gap-1"><Clock size={11} /></span>}
              {m.status === 'approved' && !isAdmin && <span className="badge-green">✓</span>}
            </div>
          </div>
        )
        })}
      </div>

      {scoreModal && (
        <ScoreModal
          match={scoreModal}
          isAdmin={isAdmin}
          onClose={() => setScoreModal(null)}
          onSaved={() => { setScoreModal(null); onUpdate() }}
        />
      )}

      {imgModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="bukti" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>,
        document.body
      )}
    </>
  )
}

function ScoreModal({ match, isAdmin, onClose, onSaved }) {
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
      status: isAdmin ? 'approved' : 'pending_result',
      approved_at: isAdmin ? new Date().toISOString() : null
    }).eq('id', match.id)
    setSaving(false)
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-1 text-slate-900">Input Skor</h2>
        {!isAdmin && <p className="text-slate-400 text-xs mb-4">Skor akan menunggu persetujuan admin.</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <div className="text-xs text-slate-400 mb-1.5 truncate">{match.home_team?.name}</div>
              <input type="number" min="0" required value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className="input text-center text-2xl font-display font-bold w-full" placeholder="0" />
            </div>
            <span className="text-slate-300 font-display font-bold text-xl mt-5">–</span>
            <div className="flex-1 text-center">
              <div className="text-xs text-slate-400 mb-1.5 truncate">{match.away_team?.name}</div>
              <input type="number" min="0" required value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className="input text-center text-2xl font-display font-bold w-full" placeholder="0" />
            </div>
          </div>

          {/* Screenshot upload */}
          <div>
            <label className="text-sm text-slate-500 mb-1.5 block">Bukti Screenshot</label>
            <div
              onClick={() => fileRef.current.click()}
              className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-400 transition-colors cursor-pointer overflow-hidden flex items-center justify-center bg-slate-50"
            >
              {preview
                ? <img src={preview} alt="screenshot" className="w-full h-full object-cover" />
                : <span className="text-xs text-slate-300">Klik untuk upload gambar</span>}
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

function StandingsTab({ seasonId, type, season, enrolledTeams }) {
  const [data, setData] = useState([])
  const [currentDiv, setCurrentDiv] = useState(1)

  function fetchStandings() {
    supabase.from('standings').select('*').eq('season_id', seasonId).then(({ data }) => setData(data || []))
  }

  useEffect(() => {
    fetchStandings()
    const channel = supabase
      .channel(`standings-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `season_id=eq.${seasonId}` },
        () => fetchStandings())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [seasonId])

  // Merge enrolled teams with standings data (show all teams even with 0 stats)
  function buildRows(filterFn) {
    const standingsMap = {}
    data.filter(filterFn || (() => true)).forEach(r => { standingsMap[r.team_id] = r })

    return enrolledTeams
      .filter(st => !filterFn || filterFn({ group_id: st.group_id, division: st.division }))
      .map(st => standingsMap[st.team_id] || {
        team_id:   st.team_id,
        team_name: st.team?.name,
        division:  st.division || 1,
        avatar_url: st.team?.owner?.avatar_url,
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0
      })
      .map(r => ({
        ...r,
        avatar_url: r.avatar_url || enrolledTeams.find(t => t.team_id === r.team_id)?.team?.owner?.avatar_url
      }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  }

  if (type === 'champions') {
    const groups = [...new Set(enrolledTeams.map(t => t.group_id).filter(Boolean))]
    return (
      <div className="space-y-4">
        {groups.map(g => (
          <div key={g} className="card overflow-hidden">
            <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
              <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
            </div>
            <StandingsTable rows={buildRows(r => r.group_id === g)} />
          </div>
        ))}
        {groups.length === 0 && <div className="card p-8 text-center text-slate-300 text-sm">Belum ada data grup</div>}
      </div>
    )
  }

  // Multi-divisi league with arrow navigation
  const numDiv = season?.num_divisions || 1
  if (numDiv > 1) {
    const relCount = season?.relegation_count || 0
    const proCount = season?.promotion_count || 0
    const currentRows = buildRows(r => (r.division || 1) === currentDiv)

    function prevDiv() { setCurrentDiv(d => Math.max(1, d - 1)) }
    function nextDiv() { setCurrentDiv(d => Math.min(numDiv, d + 1)) }

    return (
      <div className="space-y-4">
        <div className="card overflow-hidden">
          {/* Header with arrow navigation */}
          <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevDiv}
                  disabled={currentDiv === 1}
                  className={`p-1 rounded-lg transition-colors ${currentDiv === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600 hover:bg-white'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className="font-display font-semibold text-sm text-brand-600">Divisi {currentDiv}</span>
                <button
                  onClick={nextDiv}
                  disabled={currentDiv === numDiv}
                  className={`p-1 rounded-lg transition-colors ${currentDiv === numDiv ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600 hover:bg-white'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

            </div>
          </div>
          <StandingsTable
            rows={currentRows}
            promotionCount={proCount}
            relegationCount={relCount}
            isTopDivision={currentDiv === 1}
            isBottomDivision={currentDiv === numDiv}
          />
        </div>
        {enrolledTeams.length === 0 && <div className="card p-8 text-center text-slate-300 text-sm">Belum ada tim terdaftar</div>}
      </div>
    )
  }

  // Single division
  return <div className="card overflow-hidden"><StandingsTable rows={buildRows()} /></div>
}

function StandingsTable({ rows, promotionCount, relegationCount, isTopDivision, isBottomDivision }) {
  const promotionLimit = promotionCount && !isTopDivision ? promotionCount : 0
  const relegationLimit = relegationCount && !isBottomDivision ? relegationCount : 0

  // Build rows using an array to avoid JSX expression nesting issues
  const tRows = rows.map((r, i) => {
    const isPromo = promotionLimit > 0 && i < promotionLimit
    const isRel = relegationLimit > 0 && i >= rows.length - relegationLimit
    const rowBg = isPromo ? 'bg-accent-green/5' : isRel ? 'bg-accent-red/5' : ''
    const pos = (isPromo ? '\u2B06 ' : isRel ? '\u2B07 ' : '') + (i + 1)
    return (
      <tr key={r.team_id || i} className={'table-row-hover ' + rowBg}>
        <td className="pl-4 pr-1 py-2.5 text-slate-400 font-mono text-xs text-center">{pos}</td>
        <td className="pl-1 pr-2 py-2.5">
          <Link to={`/teams/${r.team_id}`} className="flex items-center gap-2 hover:text-brand-600 transition-colors group">
            <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden shrink-0">
              {r.avatar_url
                ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                : (r.team_name || '?')[0]}
            </div>
            <span className="font-medium group-hover:underline truncate">{r.team_name}</span>
          </Link>
        </td>
        <td className="py-2.5 text-center text-slate-500">{r.played}</td>
        <td className="py-2.5 text-center text-accent-green">{r.won}</td>
        <td className="py-2.5 text-center text-slate-500">{r.drawn}</td>
        <td className="py-2.5 text-center text-accent-red">{r.lost}</td>
        <td className="py-2.5 text-center text-slate-500">{r.gd > 0 ? '+' + r.gd : r.gd}</td>
        <td className="py-2.5 pr-4 text-center font-display font-bold text-brand-600">{r.pts}</td>
      </tr>
    )
  })

  // Jika tidak ada data
  const emptyRow = rows.length === 0 ? (
    <tr key="empty">
      <td colSpan={8} className="text-center py-8 text-slate-300 text-sm">Belum ada data klasemen</td>
    </tr>
  ) : null

  const legend = null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <colgroup>
          <col style={{width: '2.5rem'}} />
          <col style={{width: '40%'}} />
          <col style={{width: '2rem'}} />
          <col style={{width: '2rem'}} />
          <col style={{width: '2rem'}} />
          <col style={{width: '2rem'}} />
          <col style={{width: '2.5rem'}} />
          <col style={{width: '2.5rem'}} />
        </colgroup>
        <thead>
          <tr className="text-slate-400 text-xs font-mono bg-slate-50">
            <th className="text-left pl-4 pr-1 py-2">#</th>
            <th className="text-left pl-1 pr-2 py-2">Tim</th>
            <th className="py-2 text-center">M</th>
            <th className="py-2 text-center">W</th>
            <th className="py-2 text-center">D</th>
            <th className="py-2 text-center">L</th>
            <th className="py-2 text-center">GD</th>
            <th className="py-2 pr-4 text-center text-brand-600">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tRows}
          {emptyRow}
        </tbody>
      </table>
      {legend}
    </div>
  )
}

function DrawTab({ seasonId, season, teams, isAdmin, myTeamId, onUpdate, hasMatches }) {
  const [drawing, setDrawing] = useState(false)
  const [drawingTeamId, setDrawingTeamId] = useState(null)

  const numGroups = season?.num_groups || 4
  const groupLetters = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const enrolledIds = teams.map(t => t.team_id)
  const myEntry = teams.find(t => t.team_id === myTeamId)
  const myGroupId = myEntry?.group_id || null
  const allDrawn = teams.length > 0 && teams.every(t => t.group_id)

  function getGroupSlots() {
    const counts = {}
    groupLetters.forEach(g => { counts[g] = 0 })
    teams.forEach(t => { if (t.group_id) counts[t.group_id] = (counts[t.group_id] || 0) + 1 })
    return counts
  }

  // Hitung kapasitas tiap grup secara merata
  // misal 10 tim, 3 grup → grup A=4, B=3, C=3
  function getGroupCapacity() {
    const total = teams.length
    const base = Math.floor(total / numGroups)
    const extra = total % numGroups // grup pertama dapat +1
    const capacity = {}
    groupLetters.forEach((g, i) => {
      capacity[g] = base + (i < extra ? 1 : 0)
    })
    return capacity
  }

  async function drawGroupForTeam(teamId) {
    const entry = teams.find(t => t.team_id === teamId)
    if (entry?.group_id) return
    setDrawingTeamId(teamId)
    const slots = getGroupSlots()
    const capacity = getGroupCapacity()
    // Buat pool slot yang tersedia (misal A punya 3 slot → ['A','A','A'])
    const pool = []
    groupLetters.forEach(g => {
      const remaining = capacity[g] - (slots[g] || 0)
      for (let i = 0; i < remaining; i++) pool.push(g)
    })
    if (pool.length === 0) { alert('Semua grup sudah penuh!'); setDrawingTeamId(null); return }
    // Fisher-Yates shuffle lalu ambil pertama
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const picked = pool[0]
    await supabase.from('season_teams').update({ group_id: picked }).eq('season_id', seasonId).eq('team_id', teamId)
    setDrawingTeamId(null)
    onUpdate()
  }

  async function drawGroup() {
    if (!myTeamId || myGroupId) return
    setDrawing(true)
    const slots = getGroupSlots()
    const capacity = getGroupCapacity()
    const pool = []
    groupLetters.forEach(g => {
      const remaining = capacity[g] - (slots[g] || 0)
      for (let i = 0; i < remaining; i++) pool.push(g)
    })
    if (pool.length === 0) { alert('Semua grup sudah penuh!'); setDrawing(false); return }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const picked = pool[0]
    await supabase.from('season_teams').update({ group_id: picked }).eq('season_id', seasonId).eq('team_id', myTeamId)
    setDrawing(false)
    onUpdate()
  }

  async function resetDraw(teamId) {
    await supabase.from('season_teams').update({ group_id: null }).eq('season_id', seasonId).eq('team_id', teamId)
    onUpdate()
  }

  async function drawAll() {
    const undrawn = teams.filter(t => !t.group_id)
    for (const t of undrawn) {
      await drawGroupForTeam(t.team_id)
    }
  }

  return (
    <div className="space-y-4">
      {/* Card undian untuk user */}
      {!isAdmin && myTeamId && enrolledIds.includes(myTeamId) && !hasMatches && (
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-sm">Undian Grup</p>
            {myGroupId
              ? <p className="text-slate-500 text-xs mt-0.5">Timmu masuk <span className="text-accent-purple font-bold">Grup {myGroupId}</span></p>
              : <p className="text-slate-500 text-xs mt-0.5">Klik tombol untuk ambil undian grup</p>}
          </div>
          {!myGroupId
            ? <button onClick={drawGroup} disabled={drawing} className="btn-primary text-sm flex items-center gap-2 shrink-0">
                🎲 {drawing ? 'Mengundi...' : 'Ambil Undian'}
              </button>
            : <span className="text-4xl font-display font-black text-accent-purple">Grup {myGroupId}</span>}
        </div>
      )}

      {/* Info progress undian untuk admin */}
      {isAdmin && !hasMatches && (
        <div className="card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-sm">
              {numGroups} Grup · {allDrawn ? 'Semua tim sudah diundi' : `${teams.filter(t => t.group_id).length}/${teams.length} tim sudah diundi`}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">Tim yang belum diundi tidak akan masuk jadwal</p>
          </div>
          <div className="flex gap-2">
            {allDrawn && (
              <button onClick={() => Promise.all(teams.map(t => resetDraw(t.team_id))).then(onUpdate)}
                className="btn-secondary text-xs px-3 py-2">Reset Semua Undian</button>
            )}
          </div>
        </div>
      )}

      {/* Daftar tim per grup */}
      {groupLetters.map(g => {
        const groupTeams = teams.filter(t => t.group_id === g)
        return (
          <div key={g} className="card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
              <span className="text-xs text-slate-300">{groupTeams.length} tim</span>
            </div>
            <div className="divide-y divide-slate-100">
              {groupTeams.map((st, i) => (
                <div key={st.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-5 text-center text-slate-300 font-mono text-xs">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden">
                    {st.team?.owner?.avatar_url
                      ? <img src={st.team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                      : st.team?.name?.[0]}
                  </div>
                  <Link to={`/teams/${st.team_id}`} className="font-medium flex-1 hover:text-brand-700 transition-colors text-sm">{st.team?.name}</Link>
                  {isAdmin && !hasMatches && (
                    <button onClick={() => resetDraw(st.team_id)} className="text-slate-300 hover:text-accent-red transition-colors text-xs px-2 py-1 rounded">✕</button>
                  )}
                </div>
              ))}
              {groupTeams.length === 0 && <div className="px-5 py-4 text-center text-slate-300 text-xs">Belum ada tim</div>}
            </div>
          </div>
        )
      })}

      {/* Tim belum diundi */}
      {teams.filter(t => !t.group_id).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
            <span className="font-display font-semibold text-sm text-slate-400">Daftar peserta belum mengundi</span>
          </div>
          <div className="divide-y divide-slate-100">
            {teams.filter(t => !t.group_id).map(st => (
              <div key={st.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden">
                  {st.team?.owner?.avatar_url
                    ? <img src={st.team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                    : st.team?.name?.[0]}
                </div>
                <Link to={`/teams/${st.team_id}`} className="font-medium flex-1 hover:text-brand-700 transition-colors text-sm">{st.team?.name}</Link>
                {isAdmin && !hasMatches
                  ? <button onClick={() => drawGroupForTeam(st.team_id)} disabled={drawingTeamId === st.team_id}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      🎲 {drawingTeamId === st.team_id ? '...' : 'Undi'}
                    </button>
                  : <span className="text-xs text-slate-300">Belum mengundi</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamsTab({ seasonId, season, teams, isAdmin, onUpdate, hasMatches }) {
  const [allTeams,     setAllTeams]     = useState([])
  const [showModal,    setShowModal]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  // State for modal: per-division team IDs
  const [divTeams,     setDivTeams]     = useState({}) // { 1: [teamId, ...], 2: [teamId, ...] }
  const [divTab,       setDivTab]       = useState(1)  // tab di modal
  const [viewDiv,      setViewDiv]      = useState(1)  // slider tampilan utama

  useEffect(() => {
    supabase.from('teams').select('id,name,owner:profiles!owner_id(avatar_url)').eq('status', 'approved').order('name')
      .then(({ data }) => setAllTeams(data || []))
  }, [seasonId])

  const enrolledIds = teams.map(t => t.team_id)
  const numDiv = season?.num_divisions || 1
  const multiDiv = numDiv > 1

  function openModal() {
    // Reconstruct per-division map from existing data
    const map = {}
    for (let d = 1; d <= numDiv; d++) map[d] = []
    teams.forEach(t => {
      const d = t.division || 1
      if (!map[d]) map[d] = []
      map[d].push(t.team_id)
    })
    setDivTeams(map)
    setDivTab(1)
    setShowModal(true)
  }

  function toggleInDiv(teamId, div) {
    setDivTeams(prev => {
      const copy = {}
      for (const d of Object.keys(prev)) {
        copy[d] = [...prev[d]]
      }
      if (copy[div].includes(teamId)) {
        // Uncheck: remove from this division
        copy[div] = copy[div].filter(id => id !== teamId)
      } else {
        // Check: add to this division, remove from all others
        for (const d of Object.keys(copy)) {
          copy[d] = copy[d].filter(id => id !== teamId)
        }
        copy[div].push(teamId)
      }
      return copy
    })
  }

  // Get all selected team IDs across divisions
  function getAllSelected() {
    const ids = []
    for (const d of Object.keys(divTeams)) {
      ids.push(...divTeams[d])
    }
    return ids
  }

  // Teams available in the current tab (not assigned to other divisions)
  function getAvailableForCurrentTab() {
    const current = divTeams[divTab] || []
    const others = []
    for (const d of Object.keys(divTeams)) {
      if (parseInt(d) !== divTab) {
        others.push(...divTeams[d])
      }
    }
    // All teams minus those already assigned to other divisions
    return allTeams.filter(t => !others.includes(t.id))
  }

  async function saveTeams() {
    setSaving(true)
    const selected = getAllSelected()
    const toAdd    = selected.filter(id => !enrolledIds.includes(id))
    const toRemove = enrolledIds.filter(id => !selected.includes(id))

    if (toRemove.length > 0) {
      await supabase.from('season_teams').delete().in('team_id', toRemove).eq('season_id', seasonId)
    }

    const currentMap = {}
    teams.forEach(t => { currentMap[t.team_id] = t })

    // Build a set of updated team IDs to track changes
    const allUpdated = new Set()

    for (const [div, ids] of Object.entries(divTeams)) {
      for (const teamId of ids) {
        allUpdated.add(teamId)
        const targetDiv = parseInt(div)
        if (toAdd.includes(teamId)) {
          await supabase.from('season_teams').insert({ season_id: seasonId, team_id: teamId, division: targetDiv })
        } else {
          const existing = currentMap[teamId]
          if (existing && (existing.division || 1) !== targetDiv) {
            await supabase.from('season_teams').update({ division: targetDiv }).eq('season_id', seasonId).eq('team_id', teamId)
          }
        }
      }
    }

    setSaving(false)
    setShowModal(false)
    onUpdate()
  }

  return (
    <>
      {/* Multi-divisi: slider antar divisi seperti StandingsTab */}
      {multiDiv && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            {/* Header dengan navigasi panah */}
            <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewDiv(d => Math.max(1, d - 1))}
                    disabled={viewDiv === 1}
                    className={`p-1 rounded-lg transition-colors ${viewDiv === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600 hover:bg-white'}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="font-display font-semibold text-sm text-brand-600">Divisi {viewDiv}</span>
                  <button
                    onClick={() => setViewDiv(d => Math.min(numDiv, d + 1))}
                    disabled={viewDiv === numDiv}
                    className={`p-1 rounded-lg transition-colors ${viewDiv === numDiv ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-brand-600 hover:bg-white'}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && !hasMatches && (
                    <button onClick={openModal} className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3">
                      <Plus size={12} /> Atur Tim
                    </button>
                  )}
                </div>
              </div>
              {isAdmin && hasMatches && (
                <p className="text-[10px] text-accent-yellow/80 mt-1 font-mono">Jadwal sudah di-generate, tim tidak bisa diubah.</p>
              )}
            </div>
            {/* Daftar tim divisi aktif */}
            {(() => {
              const divTeamList = teams.filter(st => (st.division || 1) === viewDiv)
              if (divTeamList.length === 0) {
                return <div className="px-5 py-8 text-center text-slate-300 text-sm italic">Belum ada tim di divisi ini</div>
              }
              return (
                <div className="divide-y divide-slate-100">
                  {divTeamList.map((st, i) => (
                    <div key={st.id} className="flex items-center gap-4 px-5 py-3">
                      <span className="w-5 text-center text-slate-300 font-mono text-xs">{i + 1}</span>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden">
                        {st.team?.owner?.avatar_url
                          ? <img src={st.team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                          : st.team?.name?.[0]}
                      </div>
                      <Link to={`/teams/${st.team_id}`} className="font-medium flex-1 hover:text-brand-700 transition-colors text-sm">{st.team?.name}</Link>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Single division: one simple card */}
      {!multiDiv && (
        <div className="card overflow-hidden">
          {isAdmin && !hasMatches && (
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500">{teams.length} tim terdaftar</span>
              <button onClick={openModal} className="btn-primary text-sm flex items-center gap-1.5 py-2">
                <Plus size={14} /> Atur Tim
              </button>
            </div>
          )}
          {isAdmin && hasMatches && (
            <div className="px-5 py-2 border-b border-slate-200 bg-amber-50">
              <p className="text-xs text-accent-yellow/80">Jadwal sudah di-generate, tim tidak bisa diubah.</p>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {teams.length === 0 ? (
              <div className="p-8 text-center text-slate-300 text-sm">Belum ada tim</div>
            ) : teams.map((st, i) => (
              <div key={st.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-6 text-center text-slate-300 font-mono text-xs">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden">
                  {st.team?.owner?.avatar_url
                    ? <img src={st.team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                    : st.team?.name?.[0]}
                </div>
                <Link to={`/teams/${st.team_id}`} className="font-medium flex-1 hover:text-brand-700 transition-colors text-sm">{st.team?.name}</Link>
                {st.group_id && <span className="badge-purple text-xs">Grup {st.group_id}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <h2 className="font-display font-bold text-base">
                {multiDiv ? 'Atur Tim Per Divisi' : 'Atur Tim Peserta'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
            </div>
            {allTeams.length === 0
              ? <div className="p-8 text-center text-slate-300 text-sm">Belum ada tim terdaftar</div>
              : <>
                  {/* Division tabs */}
                  {multiDiv && (
                    <div className="flex gap-1 p-2 border-b border-slate-200 bg-slate-50">
                      {Array.from({ length: numDiv }, (_, i) => i + 1).map(d => (
                        <button
                          key={d}
                          onClick={() => setDivTab(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${
                            divTab === d
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                          }`}
                        >
                          Divisi {d}
                          <span className="ml-1 text-[10px] opacity-60">({(divTeams[d] || []).length})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Team list for current tab */}
                  <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                    {getAvailableForCurrentTab().map(t => {
                      const checked = (divTeams[divTab] || []).includes(t.id)
                      return (
                        <button key={t.id} onClick={() => toggleInDiv(t.id, divTab)}
                          className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${checked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold font-display text-brand-600 overflow-hidden shrink-0">
                            {t.owner?.avatar_url ? <img src={t.owner.avatar_url} alt="" className="w-full h-full object-cover" /> : t.name[0]}
                          </div>
                          <span className="font-medium text-sm flex-1 truncate">{t.name}</span>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand-500 border-brand-500' : 'border-slate-300'}`}>
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                        </button>
                      )
                    })}
                    {getAvailableForCurrentTab().length === 0 && (
                      <div className="p-8 text-center text-slate-300 text-sm">Semua tim sudah masuk divisi lain</div>
                    )}
                  </div>

                  <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0">
                    <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
                    <button onClick={saveTeams} disabled={saving} className="btn-primary flex-1 text-sm">{saving ? 'Menyimpan...' : 'Simpan'}</button>
                  </div>
                </>
            }
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Knockout Tab ────────────────────────────────────────────────────────────

const KO_ROUNDS = [
  { key: 'r32',   label: '32 Besar',       next: 'r16'   },
  { key: 'r16',   label: '16 Besar',       next: 'qf'    },
  { key: 'qf',    label: 'Perempat Final', next: 'sf'    },
  { key: 'sf',    label: 'Semi Final',     next: 'final' },
  { key: 'final', label: 'Final',          next: null    },
]

function KnockoutTab({ seasonId, season, enrolledTeams, isAdmin, onUpdate }) {
  const [koMatches, setKoMatches]       = useState([])
  const [manageModal, setManageModal]   = useState(null) // stage key
  const [imgModal, setImgModal]         = useState(null)
  const [generating, setGenerating]     = useState(false)
  const [genLegModal, setGenLegModal]   = useState(null) // { fromStage, nextStage, nextLabel }
  const [setupModal, setSetupModal]     = useState(false) // modal setup bracket awal

  useEffect(() => { fetchKo() }, [seasonId])

  async function fetchKo() {
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(id,name,owner:profiles!owner_id(avatar_url,whatsapp)), away_team:teams!away_team_id(id,name,owner:profiles!owner_id(avatar_url,whatsapp))')
      .eq('season_id', seasonId)
      .in('stage', ['r32','r16','qf','sf','final'])
      .order('created_at')
    setKoMatches(data || [])
  }

  async function deleteMatch(matchId) {
    const { error } = await supabase.from('matches').delete().eq('id', matchId)
    if (error) { alert('Gagal hapus: ' + error.message); return }
    fetchKo()
    onUpdate()
  }

  // Generate babak berikutnya dari pemenang babak ini
  async function generateNextRound(currentStage, legs = 1) {
    const currentRound = KO_ROUNDS.find(r => r.key === currentStage)
    if (!currentRound?.next) return
    const nextStage = currentRound.next

    // Ambil semua match babak ini
    const currentMatches = koMatches.filter(m => m.stage === currentStage)
    const allApproved = currentMatches.every(m => m.status === 'approved')
    if (!allApproved) { alert('Semua laga babak ini harus selesai dulu!'); return }

    // Deteksi apakah babak ini 2 leg
    const isTwoLegs = currentMatches.some(m => m.leg_number === 2)

    let winners = []

    if (isTwoLegs) {
      // Kelompokkan per round (pair), hitung agregat
      const pairs = {}
      currentMatches.forEach(m => {
        const key = m.round
        if (!pairs[key]) pairs[key] = []
        pairs[key].push(m)
      })

      for (const [, pairMatches] of Object.entries(pairs)) {
        if (pairMatches.length < 2) { alert('Ada pasangan yang belum lengkap 2 leg!'); return }
        // leg_number 1: home_team_id adalah tim A, away_team_id adalah tim B
        const leg1 = pairMatches.find(m => m.leg_number === 1)
        const leg2 = pairMatches.find(m => m.leg_number === 2)
        if (!leg1 || !leg2) { alert('Data leg tidak lengkap!'); return }

        const teamA = leg1.home_team_id
        const teamB = leg1.away_team_id
        // Agregat tim A = skor home di leg1 + skor away di leg2
        const aggA = (leg1.home_score ?? 0) + (leg2.away_score ?? 0)
        // Agregat tim B = skor away di leg1 + skor home di leg2
        const aggB = (leg1.away_score ?? 0) + (leg2.home_score ?? 0)

        if (aggA > aggB) winners.push(teamA)
        else if (aggB > aggA) winners.push(teamB)
        else { alert(`Agregat imbang di babak ini! Tentukan pemenang secara manual.`); return }
      }
    } else {
      // 1 leg — pemenang langsung dari skor
      winners = currentMatches.map(m => {
        if (m.home_score > m.away_score) return m.home_team_id
        if (m.away_score > m.home_score) return m.away_team_id
        return null
      })
      if (winners.some(w => !w)) { alert('Ada laga yang berakhir seri, tentukan pemenang dulu!'); return }
    }

    if (winners.length < 2) { alert('Tidak cukup pemenang untuk babak berikutnya!'); return }

    // Cek apakah babak berikutnya sudah ada
    const nextExists = koMatches.some(m => m.stage === nextStage)
    if (nextExists) { alert(`Babak ${KO_ROUNDS.find(r => r.key === nextStage)?.label} sudah ada!`); return }

    setGenerating(true)
    // Pasangkan pemenang: 1 vs 2, 3 vs 4, dst
    const matchRows = []
    for (let i = 0; i < winners.length; i += 2) {
      if (winners[i + 1]) {
        const pairIndex = Math.floor(i / 2) + 1
        matchRows.push({
          season_id: seasonId,
          home_team_id: winners[i],
          away_team_id: winners[i + 1],
          stage: nextStage,
          round: pairIndex,
          leg_number: 1,
          status: 'scheduled'
        })
        if (legs === 2) {
          matchRows.push({
            season_id: seasonId,
            home_team_id: winners[i + 1],
            away_team_id: winners[i],
            stage: nextStage,
            round: pairIndex,
            leg_number: 2,
            status: 'scheduled'
          })
        }
      }
    }

    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) { alert('Gagal generate: ' + error.message) }
    else { await fetchKo(); onUpdate() }
    setGenerating(false)
  }

  // Tentukan babak mana saja yang aktif (ada match atau babak pertama)
  const activeRounds = KO_ROUNDS.filter(r => koMatches.some(m => m.stage === r.key))
  const firstRound   = activeRounds[0] ?? KO_ROUNDS[2] // default qf jika kosong

  // Untuk bracket tree: kumpulkan semua stage yang ada + stage berikutnya yg kosong
  const bracketRounds = (() => {
    const result = []
    for (const r of KO_ROUNDS) {
      const ms = koMatches.filter(m => m.stage === r.key)
      if (ms.length > 0) result.push(r)
      else if (result.length > 0) { result.push(r); break } // satu babak kosong berikutnya
    }
    if (result.length === 0) result.push(...KO_ROUNDS) // semua babak sebagai placeholder
    return result
  })()

  const hasAnyMatch = koMatches.length > 0

  return (
    <div className="space-y-4">
      {/* Admin controls */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol setup bracket awal — hanya muncul jika belum ada match */}
          {!hasAnyMatch && (
            <button
              onClick={() => setSetupModal(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus size={15} /> Setup Bracket
            </button>
          )}

          {/* Generate babak berikutnya */}
          {KO_ROUNDS.map(r => {
            const roundMatches = koMatches.filter(m => m.stage === r.key)
            const allDone = roundMatches.length > 0 && roundMatches.every(m => m.status === 'approved')
            const nextExists = r.next && koMatches.some(m => m.stage === r.next)
            const showGenNext = allDone && r.next && !nextExists
            const nextLabel = KO_ROUNDS.find(x => x.key === r.next)?.label
            if (!showGenNext) return null
            return (
              <button
                key={r.key}
                onClick={() => setGenLegModal({ fromStage: r.key, nextStage: r.next, nextLabel })}
                disabled={generating}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Calendar size={15} /> {generating ? '...' : `Generate ${nextLabel}`}
              </button>
            )
          })}
        </div>
      )}

      {/* Bracket Tree */}
      <BracketTree
        rounds={bracketRounds}
        koMatches={koMatches}
        isAdmin={isAdmin}
        onDelete={deleteMatch}
        onUpdate={fetchKo}
        onImgClick={setImgModal}
        onManage={isAdmin ? (stageKey) => setManageModal(stageKey) : null}
      />

      {setupModal && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSetupModal(false)}>
          <SetupBracketModal
            enrolledTeams={enrolledTeams}
            seasonId={seasonId}
            onClose={() => setSetupModal(false)}
            onSaved={() => { setSetupModal(false); fetchKo(); onUpdate() }}
          />
        </div>,
        document.body
      )}

      {manageModal && (
        <ManageKoTeamsModal
          seasonId={seasonId}
          stage={manageModal}
          stageLabel={KO_ROUNDS.find(r => r.key === manageModal)?.label}
          enrolledTeams={enrolledTeams}
          existingMatches={koMatches.filter(m => m.stage === manageModal)}
          onClose={() => setManageModal(null)}
          onSaved={() => { setManageModal(null); fetchKo(); onUpdate() }}
        />
      )}

      {genLegModal && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setGenLegModal(null)}>
          <GenLegModal
            nextLabel={genLegModal.nextLabel}
            onClose={() => setGenLegModal(null)}
            onConfirm={legs => {
              setGenLegModal(null)
              generateNextRound(genLegModal.fromStage, legs)
            }}
          />
        </div>,
        document.body
      )}

      {imgModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="bukti" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Modal Setup Bracket Awal ────────────────────────────────────────────────
// Step 1: pilih babak awal + format leg
// Step 2: pilih tim peserta + acak
function SetupBracketModal({ enrolledTeams, seasonId, onClose, onSaved }) {
  const teamList = enrolledTeams.map(st => st.team).filter(Boolean)
  const [step, setStep]       = useState(1)
  const [stage, setStage]     = useState(null)
  const [legs, setLegs]       = useState(1)
  const [selected, setSelected] = useState([])
  const [saving, setSaving]   = useState(false)

  // Jumlah tim yang dibutuhkan per babak
  const teamCount = { r32: 32, r16: 16, qf: 8, sf: 4, final: 2 }
  const needed = teamCount[stage] ?? 0

  function toggleTeam(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleGenerate() {
    if (selected.length < 2) { alert('Pilih minimal 2 tim!'); return }
    setSaving(true)

    const shuffled = [...selected].sort(() => Math.random() - 0.5)
    const matchRows = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        const pairIndex = Math.floor(i / 2) + 1
        matchRows.push({
          season_id: seasonId,
          home_team_id: shuffled[i],
          away_team_id: shuffled[i + 1],
          stage,
          round: pairIndex,
          leg_number: 1,
          status: 'scheduled'
        })
        if (legs === 2) {
          matchRows.push({
            season_id: seasonId,
            home_team_id: shuffled[i + 1],
            away_team_id: shuffled[i],
            stage,
            round: pairIndex,
            leg_number: 2,
            status: 'scheduled'
          })
        }
      }
    }

    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) alert('Gagal: ' + error.message)
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="font-display font-bold text-base">Setup Bracket</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Langkah {step} dari 2</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
      </div>

      {step === 1 && (
        <>
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Pilih babak awal */}
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Mulai dari babak</p>
              <div className="grid grid-cols-1 gap-1.5">
                {KO_ROUNDS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setStage(r.key)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium transition-all text-left
                      ${stage === r.key
                        ? 'bg-brand-50 border-brand-500 text-brand-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'}`}
                  >
                    <span className="font-display font-semibold">{r.label}</span>
              <span className="text-[10px] text-slate-400 font-mono">{teamCount[r.key]} tim</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pilih format leg */}
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Format pertandingan</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLegs(1)}
                  className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all
                    ${legs === 1 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
                >
                  1 Leg
                </button>
                <button
                  onClick={() => setLegs(2)}
                  className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all
                    ${legs === 2 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
                >
                  2 Leg
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {legs === 1 ? '1 pertandingan per pasangan.' : '2 pertandingan per pasangan (home & away). Pemenang dari agregat.'}
              </p>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
            <button onClick={() => setStep(2)} disabled={!stage} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              Pilih Tim <ArrowLeft size={13} className="rotate-180" />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="px-5 pt-3 pb-1 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Pilih tim untuk <span className="font-semibold text-slate-800">{KO_ROUNDS.find(r => r.key === stage)?.label}</span>
              </p>
              <span className={`text-[10px] font-mono ${selected.length > needed ? 'text-accent-red' : selected.length === needed ? 'text-accent-green' : 'text-slate-400'}`}>
                {selected.length}/{needed}
              </span>
            </div>
            {selected.length > needed && (
              <p className="text-[10px] text-accent-red mt-1">Terlalu banyak tim. Maksimal {needed} tim untuk babak ini.</p>
            )}
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {teamList.map(t => {
              const checked = selected.includes(t.id)
              return (
                <button key={t.id} onClick={() => toggleTeam(t.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${checked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-brand-600 overflow-hidden shrink-0">
                    {t.owner?.avatar_url ? <img src={t.owner.avatar_url} alt="" className="w-full h-full object-cover" /> : t.name[0]}
                  </div>
                  <span className="font-medium text-sm flex-1">{t.name}</span>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand-500 border-brand-500' : 'border-slate-300'}`}>
                    {checked && <Check size={12} className="text-white" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0">
            <button onClick={() => setStep(1)} className="btn-secondary text-sm px-4">
              <ArrowLeft size={14} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={saving || selected.length !== needed}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"
            >
              {saving ? 'Menyimpan...' : <><Swords size={14} /> Acak & Generate</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Modal pilih format leg saat generate babak berikutnya ───────────────────
function GenLegModal({ nextLabel, onClose, onConfirm }) {
  const [legs, setLegs] = useState(1)
  return (
    <div className="card w-full max-w-xs animate-slide-in p-5 space-y-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base">Generate {nextLabel}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={17} /></button>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-2">Format pertandingan</p>
        <div className="flex gap-2">
          <button
            onClick={() => setLegs(1)}
            className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all
              ${legs === 1 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
          >
            1 Leg
          </button>
          <button
            onClick={() => setLegs(2)}
            className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all
              ${legs === 2 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
          >
            2 Leg
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          {legs === 1
            ? '1 pertandingan per pasangan. Pemenang langsung lolos.'
            : '2 pertandingan per pasangan (home & away). Pemenang dari agregat skor.'}
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
        <button onClick={() => onConfirm(legs)} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
          <Calendar size={13} /> Generate
        </button>
      </div>
    </div>
  )
}

// ─── Bracket Tree ─────────────────────────────────────────────────────────────
// â”€â”€â”€ Bracket Tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Konstanta ukuran kartu
const CARD_W      = 180  // lebar kartu
const CARD_H_1LEG = 72   // tinggi kartu 1 leg
const CARD_H_2LEG = 120  // tinggi kartu 2 leg (header + leg1 + leg2 + agregat)
const CARD_GAP    = 20   // jarak antar kartu dalam satu kolom
const COL_GAP     = 48   // jarak horizontal antar babak

function BracketTree({ rounds, koMatches, isAdmin, onDelete, onUpdate, onImgClick, onManage }) {
  const [scoreModal, setScoreModal] = useState(null)

  if (rounds.length === 0) {
    return (
      <div className="card p-10 text-center text-slate-300 text-sm">
        <Trophy size={32} className="mx-auto mb-3 opacity-20" />
        Belum ada data bracket. Admin dapat menambahkan tim via tombol di atas.
      </div>
    )
  }

  // Untuk setiap babak, kumpulkan "pair" â€” 1 pair = 1 slot di bagan
  // Pair diidentifikasi oleh round number. Jika 2 leg, pair punya leg1 & leg2.
  function getPairs(stageKey) {
    const ms = koMatches.filter(m => m.stage === stageKey)
    const isTwoLegs = ms.some(m => m.leg_number === 2)
    if (!isTwoLegs) {
      return ms
        .sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
        .map(m => ({ type: '1leg', leg1: m, leg2: null, pairId: m.id }))
    }
    const roundNums = [...new Set(ms.map(m => m.round))].sort((a, b) => a - b)
    return roundNums.map(rn => {
      const leg1 = ms.find(m => m.round === rn && m.leg_number === 1) ?? null
      const leg2 = ms.find(m => m.round === rn && m.leg_number === 2) ?? null
      return { type: '2leg', leg1, leg2, pairId: `${stageKey}-${rn}` }
    })
  }

  function cardH(stageKey) {
    const ms = koMatches.filter(m => m.stage === stageKey)
    return ms.some(m => m.leg_number === 2) ? CARD_H_2LEG : CARD_H_1LEG
  }

  const firstPairs = getPairs(rounds[0].key)
  const firstSlots = Math.max(firstPairs.length, 1)
  const slotsPerRound = rounds.map((_, i) => Math.max(Math.ceil(firstSlots / Math.pow(2, i)), 1))

  const ch0  = cardH(rounds[0].key)
  const svgH = firstSlots * (ch0 + CARD_GAP) + CARD_GAP
  const svgW = rounds.length * (CARD_W + COL_GAP) - COL_GAP + 4

  function slotCY(slotIndex, totalSlots) {
    const cellH = svgH / totalSlots
    return cellH * slotIndex + cellH / 2
  }

  const colPositions = rounds.map((r, ci) => {
    const slots = slotsPerRound[ci]
    const pairs = getPairs(r.key)
    const ch    = cardH(r.key)
    const x     = ci * (CARD_W + COL_GAP)
    return Array.from({ length: slots }, (_, si) => ({
      x, cy: slotCY(si, slots), pair: pairs[si] ?? null, ch,
    }))
  })

  const connectors = []
  for (let ci = 0; ci < colPositions.length - 1; ci++) {
    const cur  = colPositions[ci]
    const next = colPositions[ci + 1]
    for (let ni = 0; ni < next.length; ni++) {
      const top = cur[ni * 2]
      const bot = cur[ni * 2 + 1]
      const dst = next[ni]
      if (!top || !dst) continue
      const x1 = top.x + CARD_W
      const x2 = dst.x
      const mx  = x1 + COL_GAP / 2
      if (bot) {
        const midY = (top.cy + bot.cy) / 2
        connectors.push(
          <g key={`conn-${ci}-${ni}`} stroke="#cbd5e1" strokeWidth="1.5" fill="none">
            <path d={`M${x1},${top.cy} H${mx} V${midY}`} />
            <path d={`M${x1},${bot.cy} H${mx} V${midY}`} />
            <path d={`M${mx},${midY} H${x2}`} />
          </g>
        )
      } else {
        connectors.push(
          <g key={`conn-${ci}-${ni}`} stroke="#cbd5e1" strokeWidth="1.5" fill="none">
            <path d={`M${x1},${top.cy} H${x2}`} />
          </g>
        )
      }
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        {/* Header label babak — ikut scroll bersama SVG */}
        <div className="flex border-b border-slate-200 bg-slate-50/60" style={{ minWidth: svgW + 24 }}>
          {rounds.map((r, ci) => (
            <div key={r.key} style={{ width: CARD_W, marginLeft: ci === 0 ? 12 : COL_GAP, flexShrink: 0 }} className="px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] font-display font-semibold text-accent-yellow uppercase tracking-widest">{r.label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3">
          <svg width={svgW} height={svgH} style={{ display: 'block', overflow: 'visible' }}>
            {connectors}
            {colPositions.map((col, ci) =>
              col.map(({ x, cy, pair, ch }, si) => (
                <BracketCard
                  key={`${ci}-${si}`}
                  x={x} cy={cy} cardH={ch} pair={pair}
                  isAdmin={isAdmin}
                  onDelete={onDelete} onUpdate={onUpdate}
                  onImgClick={onImgClick} onScoreClick={setScoreModal}
                />
              ))
            )}
          </svg>
        </div>
      </div>
      {scoreModal && (
        <ScoreModal match={scoreModal} isAdmin={isAdmin}
          onClose={() => setScoreModal(null)}
          onSaved={() => { setScoreModal(null); onUpdate() }} />
      )}
    </div>
  )
}

// â”€â”€â”€ Bracket Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BracketCard({ x, cy, cardH, pair, isAdmin, onDelete, onUpdate, onImgClick, onScoreClick }) {
  const y = cy - cardH / 2

  async function approve(matchId) {
    await supabase.from('matches').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', matchId)
    onUpdate()
  }

  if (!pair) {
    return (
      <foreignObject x={x} y={y} width={CARD_W} height={cardH}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          className="w-full h-full rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
          <span className="text-[10px] text-slate-300 font-mono">TBD</span>
        </div>
      </foreignObject>
    )
  }

  const { type, leg1, leg2 } = pair

  // â”€â”€ 1 Leg â”€â”€
  if (type === '1leg') {
    const m = leg1
    const homeWin  = m?.status === 'approved' && m.home_score > m.away_score
    const awayWin  = m?.status === 'approved' && m.away_score > m.home_score
    const hasScore = m?.home_score !== null && m?.away_score !== null
    return (
      <foreignObject x={x} y={y} width={CARD_W} height={cardH}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          className={`w-full h-full rounded-lg border flex flex-col overflow-hidden text-[11px] font-medium
            ${m?.status === 'approved' ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
          <BcTeamRow team={m?.home_team} score={hasScore ? m.home_score : null} isWinner={homeWin}
            onImgClick={m?.screenshot_url ? () => onImgClick(m.screenshot_url) : null} hasBorder />
          <BcTeamRow team={m?.away_team} score={hasScore ? m.away_score : null} isWinner={awayWin}
            onImgClick={m?.screenshot_url ? () => onImgClick(m.screenshot_url) : null} />
          <BcActionRow m={m} isAdmin={isAdmin}
            onApprove={() => approve(m.id)} onScore={() => onScoreClick(m)} onDelete={() => onDelete(m.id)} />
        </div>
      </foreignObject>
    )
  }

  // â”€â”€ 2 Leg â”€â”€
  const teamA = leg1?.home_team ?? leg2?.away_team ?? null
  const teamB = leg1?.away_team ?? leg2?.home_team ?? null
  const l1A = leg1?.home_score ?? null
  const l1B = leg1?.away_score ?? null
  const l2A = leg2?.away_score ?? null   // tim A main away di leg2
  const l2B = leg2?.home_score ?? null   // tim B main home di leg2
  const aggA = l1A !== null && l2A !== null ? l1A + l2A : null
  const aggB = l1B !== null && l2B !== null ? l1B + l2B : null
  const aggWinA = aggA !== null && aggB !== null && aggA > aggB
  const aggWinB = aggA !== null && aggB !== null && aggB > aggA
  const allDone = leg1?.status === 'approved' && leg2?.status === 'approved'

  return (
    <foreignObject x={x} y={y} width={CARD_W} height={cardH}>
      <div xmlns="http://www.w3.org/1999/xhtml"
        className={`w-full h-full rounded-lg border flex flex-col overflow-hidden text-[11px] font-medium
          ${allDone ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>

        {/* Header: nama tim A vs tim B */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <BcAvatar team={teamA} />
            <span className={`truncate text-[10px] font-semibold leading-tight ${aggWinA ? 'text-brand-700' : 'text-slate-500'}`}>
              {teamA?.name ?? 'TBD'}
            </span>
          </div>
          <span className="text-slate-300 text-[9px] font-mono mx-1 shrink-0">vs</span>
          <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
            <span className={`truncate text-[10px] font-semibold leading-tight text-right ${aggWinB ? 'text-brand-700' : 'text-slate-500'}`}>
              {teamB?.name ?? 'TBD'}
            </span>
            <BcAvatar team={teamB} />
          </div>
        </div>

        {/* Leg 1 */}
        <BcLegRow label="L1"
          scoreA={l1A} scoreB={l1B}
          done={leg1?.status === 'approved'} pending={leg1?.status === 'pending_result'}
          isAdmin={isAdmin}
          onApprove={leg1 ? () => approve(leg1.id) : null}
          onScore={leg1 ? () => onScoreClick(leg1) : null}
          onDelete={leg1 ? () => onDelete(leg1.id) : null}
          onImgClick={leg1?.screenshot_url ? () => onImgClick(leg1.screenshot_url) : null}
        />

        {/* Leg 2 */}
        <BcLegRow label="L2"
          scoreA={l2A} scoreB={l2B}
          done={leg2?.status === 'approved'} pending={leg2?.status === 'pending_result'}
          isAdmin={isAdmin}
          onApprove={leg2 ? () => approve(leg2.id) : null}
          onScore={leg2 ? () => onScoreClick(leg2) : null}
          onDelete={leg2 ? () => onDelete(leg2.id) : null}
          onImgClick={leg2?.screenshot_url ? () => onImgClick(leg2.screenshot_url) : null}
          hasBorderTop
        />

        {/* Agregat */}
        <div className={`flex items-center justify-center gap-1.5 px-2 py-1 border-t border-slate-200 shrink-0 ${allDone ? 'bg-slate-100' : 'bg-slate-50'}`}>
          <span className={`font-display font-bold text-[11px] ${aggWinA ? 'text-accent-green' : 'text-slate-400'}`}>{aggA ?? '-'}</span>
          <span className="text-[9px] text-slate-400 font-mono">agg</span>
          <span className={`font-display font-bold text-[11px] ${aggWinB ? 'text-accent-green' : 'text-slate-400'}`}>{aggB ?? '-'}</span>
        </div>
      </div>
    </foreignObject>
  )
}

function BcAvatar({ team }) {
  return (
    <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-[8px] font-bold text-brand-600 overflow-hidden shrink-0">
      {team?.owner?.avatar_url
        ? <img src={team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
        : team?.name?.[0] ?? '?'}
    </div>
  )
}

function BcTeamRow({ team, score, isWinner, onImgClick, hasBorder }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 flex-1 min-w-0 ${hasBorder ? 'border-b border-slate-100' : ''} ${isWinner ? 'bg-brand-50' : ''}`}>
      <BcAvatar team={team} />
      <span className={`flex-1 truncate leading-tight ${isWinner ? 'text-brand-700 font-semibold' : 'text-slate-600'}`}>
        {team?.name ?? 'TBD'}
      </span>
      {score !== null && (
        <span className={`font-display font-bold shrink-0 w-4 text-center ${isWinner ? 'text-brand-700' : 'text-slate-400'}`}
          onClick={onImgClick ?? undefined} style={{ cursor: onImgClick ? 'pointer' : 'default' }}>
          {score}
        </span>
      )}
    </div>
  )
}

function BcLegRow({ label, scoreA, scoreB, done, pending, isAdmin, onApprove, onScore, onDelete, onImgClick, hasBorderTop }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-1 shrink-0 ${hasBorderTop ? 'border-t border-slate-100' : ''} ${done ? 'bg-slate-50' : ''}`}>
      <span className="text-[9px] text-slate-400 font-mono w-4 shrink-0">{label}</span>
      <div className="flex-1 flex items-center justify-center gap-1"
        onClick={onImgClick ?? undefined} style={{ cursor: onImgClick ? 'pointer' : 'default' }}>
        {scoreA !== null && scoreB !== null
          ? <>
              <span className={`font-display font-bold text-[11px] w-4 text-center ${scoreA > scoreB ? 'text-brand-700' : 'text-slate-400'}`}>{scoreA}</span>
              <span className="text-slate-300 text-[9px]">-</span>
              <span className={`font-display font-bold text-[11px] w-4 text-center ${scoreB > scoreA ? 'text-brand-700' : 'text-slate-400'}`}>{scoreB}</span>
            </>
          : <span className="text-slate-300 text-[9px] font-mono">vs</span>
        }
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {done && <span className="text-[8px] text-accent-green">✓</span>}
        {pending && !done && <Clock size={8} className="text-accent-yellow" />}
        {isAdmin && (
          <>
            {pending && onApprove && (
              <button onClick={onApprove} className="w-4 h-4 rounded flex items-center justify-center hover:bg-accent-green/20" title="Approve">
                <Check size={8} className="text-accent-green" />
              </button>
            )}
            {onScore && (
              <button onClick={onScore} className="w-4 h-4 rounded flex items-center justify-center hover:bg-brand-100" title="Edit">
                <Pencil size={8} className="text-brand-600" />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="w-4 h-4 rounded flex items-center justify-center hover:bg-red-50" title="Hapus">
                <XCircle size={8} className="text-slate-400" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BcActionRow({ m, isAdmin, onApprove, onScore, onDelete }) {
  if (!m) return null
  return (
    <div className="flex items-center justify-end gap-0.5 px-1 py-0.5 border-t border-slate-100 bg-slate-50 shrink-0">
      {m.status === 'approved' && <span className="text-[9px] text-accent-green font-mono mr-auto pl-1">✓</span>}
      {m.status === 'pending_result' && !isAdmin && <Clock size={9} className="text-accent-yellow mr-auto ml-1" />}
      {isAdmin && (
        <>
          {m.status === 'pending_result' && (
            <button onClick={onApprove} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-green/20 transition-colors" title="Approve">
              <Check size={10} className="text-accent-green" />
            </button>
          )}
          <button onClick={onScore} className="w-5 h-5 rounded flex items-center justify-center hover:bg-brand-100 transition-colors" title="Edit skor">
            <Pencil size={10} className="text-brand-600" />
          </button>
          <button onClick={onDelete} className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-50 transition-colors" title="Hapus">
            <XCircle size={10} className="text-slate-400" />
          </button>
        </>
      )}
    </div>
  )
}
// Modal kelola tim per babak — tambah tim, lalu acak atau atur manual
function ManageKoTeamsModal({ seasonId, stage, stageLabel, enrolledTeams, existingMatches, onClose, onSaved }) {
  const teamList = enrolledTeams.map(st => st.team).filter(Boolean)

  // Tim yang sudah ada di laga babak ini
  const usedIds = new Set(existingMatches.flatMap(m => [m.home_team_id, m.away_team_id]))

  // Deteksi apakah babak ini sudah pakai 2 leg
  const existingLegs = existingMatches.some(m => m.leg_number === 2) ? 2 : 1

  // Jumlah tim yang dibutuhkan per fase
  const teamCount = { r32: 32, r16: 16, qf: 8, sf: 4, final: 2 }
  const needed = teamCount[stage] ?? 0

  const [selected, setSelected] = useState([...usedIds])
  const [legs, setLegs] = useState(existingLegs)
  const [saving, setSaving] = useState(false)

  const isExact = selected.length === needed
  const tooMany = selected.length > needed
  const tooFew  = selected.length < needed

  function toggleTeam(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleRandom() {
    if (selected.length < 2) { alert('Pilih minimal 2 tim!'); return }
    setSaving(true)

    // Hapus laga lama di babak ini dulu
    await supabase.from('matches').delete().eq('season_id', seasonId).eq('stage', stage)

    // Shuffle tim
    const shuffled = [...selected].sort(() => Math.random() - 0.5)
    const matchRows = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        const pairIndex = Math.floor(i / 2) + 1
        // Leg 1
        matchRows.push({
          season_id: seasonId,
          home_team_id: shuffled[i],
          away_team_id: shuffled[i + 1],
          stage,
          round: pairIndex,
          leg_number: 1,
          status: 'scheduled'
        })
        // Leg 2 — kandang dibalik
        if (legs === 2) {
          matchRows.push({
            season_id: seasonId,
            home_team_id: shuffled[i + 1],
            away_team_id: shuffled[i],
            stage,
            round: pairIndex,
            leg_number: 2,
            status: 'scheduled'
          })
        }
      }
    }

    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) alert('Gagal: ' + error.message)
    setSaving(false)
    onSaved()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-display font-bold text-base">Kelola Tim — {stageLabel}</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-display font-bold tabular-nums ${isExact ? 'text-accent-green' : tooMany ? 'text-accent-red' : 'text-slate-400'}`}>
              {selected.length}<span className="text-slate-300 font-normal">/{needed}</span>
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
          </div>
        </div>
        {(tooMany || (tooFew && selected.length > 0)) && (
          <div className={`px-5 py-2 text-[11px] shrink-0 ${tooMany ? 'text-accent-red bg-red-50' : 'text-slate-500 bg-slate-50'}`}>
            {tooMany
              ? `Terlalu banyak. ${stageLabel} butuh tepat ${needed} tim.`
              : `Butuh ${needed - selected.length} tim lagi untuk ${stageLabel}.`}
          </div>
        )}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <p className="text-xs text-slate-400 mb-2">Format pertandingan</p>
          <div className="flex gap-2">
            <button
              onClick={() => setLegs(1)}
              className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 1 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
            >
              1 Leg
            </button>
            <button
              onClick={() => setLegs(2)}
              className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 2 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
            >
              2 Leg
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-1.5">
            {legs === 1 ? '1 pertandingan per pasangan. Pemenang langsung lolos.' : '2 pertandingan per pasangan (home & away). Pemenang dari agregat skor.'}
          </p>
        </div>

        <p className="px-5 pt-2 pb-1 text-xs text-slate-400">Pilih tim yang masuk babak ini, lalu klik Acak untuk generate laga secara random.</p>
        <div className="divide-y divide-slate-100 overflow-y-auto flex-1 mt-1">
          {teamList.map(t => {
            const checked = selected.includes(t.id)
            return (
              <button key={t.id} onClick={() => toggleTeam(t.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${checked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-brand-600 overflow-hidden shrink-0">
                  {t.owner?.avatar_url ? <img src={t.owner.avatar_url} alt="" className="w-full h-full object-cover" /> : t.name[0]}
                </div>
                <span className="font-medium text-sm flex-1">{t.name}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand-500 border-brand-500' : 'border-slate-300'}`}>
                  {checked && <Check size={12} className="text-white" />}
                </div>
              </button>
            )
          })}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
          <button onClick={handleRandom} disabled={saving || !isExact} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
            🎲 {saving ? 'Menyimpan...' : `Acak (${selected.length} tim)`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

