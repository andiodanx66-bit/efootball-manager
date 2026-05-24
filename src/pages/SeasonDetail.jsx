import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Trophy, Users, Calendar, BarChart2, Play, Settings, ArrowLeft, Star, Swords, Plus, XCircle, Clock, Pencil, Check, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateRoundRobin, generateKnockout, generateGroupStage } from '../utils/scheduler'
import BackButton from '../components/layout/BackButton'

const KO_ROUNDS = [
  { key: 'r32',   label: '32 Besar',       next: 'r16'   },
  { key: 'r16',   label: '16 Besar',       next: 'qf'    },
  { key: 'qf',    label: 'Perempat Final', next: 'sf'    },
  { key: 'sf',    label: 'Semi Final',     next: 'final' },
  { key: 'final', label: 'Final',          next: null    },
]

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
        .select('*, home_team:teams!home_team_id(id,name,owner:profiles!owner_id(whatsapp,avatar_url)), away_team:teams!away_team_id(id,name,owner:profiles!owner_id(whatsapp,avatar_url))')
        .eq('season_id', id)
        .order('round').order('match_date')
    ])
    setSeason(s)
    setTeams(st || [])
    setMatches(m || [])
    setLoading(false)
  }

  function getTeamsByDivision() {
    const divMap = {}
    teams.forEach(t => {
      const div = t.division || 1
      if (!divMap[div]) divMap[div] = []
      divMap[div].push(t.team_id)
    })
    return divMap
  }

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
    if (season.type === 'league' && (season.num_divisions || 1) > 1) {
      const relCount = season.relegation_count || 0
      const proCount = season.promotion_count || 0

      if (relCount > 0 || proCount > 0) {
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

        Object.values(byDiv).forEach(arr => {
          arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
        })

        const updates = []

        for (let d = 1; d < Object.keys(byDiv).length; d++) {
          const upper = byDiv[d]
          const lower = byDiv[d + 1]
          if (!upper || !lower) continue

          const relegated = upper.slice(-relCount)
          relegated.forEach(r => {
            updates.push({ team_id: r.team_id, division: d + 1 })
          })

          const promoted = lower.slice(0, proCount)
          promoted.forEach(r => {
            updates.push({ team_id: r.team_id, division: d })
          })
        }

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
      <div>
        <BackButton fallback="/seasons" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {season.logo_url ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img src={season.logo_url} alt={season.name} className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="section-title">{season.name}</h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm" style={{color:'#94a3b8'}}>{teams.length} tim terdaftar · {matches.length} pertandingan</p>
              </div>
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

      {tab === 'matches' && (
        <div className="space-y-6">
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

            const items = []

            if (groups.length > 0) {
              // Teks petunjuk + info tersisa
              if (matches.length > 0) {
                const totalPending = matches.filter(m => m.status !== 'approved').length
                const totalAll = matches.length
                items.push(
                  <div key="hint" className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-accent-green">
                      {totalPending} pertandingan tersisa, total {totalAll} pertandingan
                    </span>
                    <p className="text-xs" style={{color:'#94a3b8'}}>Klik papan skor untuk input hasil, klik nama tim untuk chat</p>
                  </div>
                )
              }
              // Fase Grup
              groups.forEach(g => {
                const groupMatches = matches.filter(m => m.group_id === g)
                items.push(
                  <div key={`group-${g}`} className="card overflow-hidden">
                    <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                      <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
                    </div>
                    <MatchList matches={groupMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                  </div>
                )
              })

              // Fase Knockout (champions)
              KO_ROUNDS.forEach(ko => {
                const koMatches = matches.filter(m => m.stage === ko.key)
                if (koMatches.length === 0) return
                const isFinal = ko.key === 'final'
                const finalSeriesType = season?.final_series_type || 'single'
                
                if (isFinal && finalSeriesType === 'best_of') {
                  const roundNums = [...new Set(koMatches.map(m => m.round))].sort((a, b) => a - b)
                  roundNums.forEach(rn => {
                    const seriesMatches = koMatches
                      .filter(m => m.round === rn)
                      .sort((a, b) => (a.leg_number ?? 0) - (b.leg_number ?? 0))
                    
                    let winsA = 0, winsB = 0
                    seriesMatches.forEach(g => {
                      if (g.status === 'approved' && g.home_score !== null && g.away_score !== null) {
                        if (g.home_score > g.away_score) {
                          if (g.home_team_id === (seriesMatches[0]?.home_team_id)) winsA++
                          else winsB++
                        } else if (g.away_score > g.home_score) {
                          if (g.away_team_id === (seriesMatches[0]?.home_team_id)) winsA++
                          else winsB++
                        }
                      }
                    })
                    
                    const seriesPending = seriesMatches.filter(m => m.status !== 'approved').length
                    const seriesTotal = seriesMatches.length
                    
                    items.push(
                      <div key={`ko-${ko.key}-${rn}`} className="card overflow-hidden">
                        <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold text-sm text-accent-yellow">{ko.label}</span>
                            <span className="text-xs text-slate-400 font-mono">({winsA}-{winsB})</span>
                          </div>
                        </div>
                        <MatchList matches={seriesMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                      </div>
                    )
                  })
                } else {
                  const koPending = koMatches.filter(m => m.status !== 'approved').length
                  const koTotal = koMatches.length
                  items.push(
                    <div key={`ko-${ko.key}`} className="card overflow-hidden">
                      <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                        <div className="flex items-center justify-between">
                          <span className="font-display font-semibold text-sm text-accent-yellow">{ko.label}</span>
                          <span className="text-[11px] font-medium text-accent-green">
                            {koPending} pertandingan tersisa, total {koTotal} pertandingan
                          </span>
                        </div>
                      </div>
                      <MatchList matches={koMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                    </div>
                  )
                }
              })
            } else if (season.type === 'league' && numDiv > 1) {
              // Multi-divisi
              items.push(<MatchDivSlider key="multidiv" matches={matches} teams={teams} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} numDiv={numDiv} />)
            } else {
              // Single division / cup
              if (matches.length > 0) {
                const totalPending = matches.filter(m => m.status !== 'approved').length
                const totalAll = matches.length
                items.push(
                  <div key="hint" className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-accent-green">
                      {totalPending} pertandingan tersisa, total {totalAll} pertandingan
                    </span>
                    <p className="text-xs" style={{color:'#94a3b8'}}>Klik papan skor untuk input hasil, klik nama tim untuk chat</p>
                  </div>
                )
              }
              
              if (season.type === 'cup') {
                KO_ROUNDS.forEach(ko => {
                  const koMatches = matches.filter(m => m.stage === ko.key)
                  if (koMatches.length === 0) return
                  const isFinal = ko.key === 'final'
                  const finalSeriesType = season?.final_series_type || 'single'
                  
                  if (isFinal && finalSeriesType === 'best_of') {
                    const roundNums = [...new Set(koMatches.map(m => m.round))].sort((a, b) => a - b)
                    roundNums.forEach(rn => {
                      const seriesMatches = koMatches
                        .filter(m => m.round === rn)
                        .sort((a, b) => (a.leg_number ?? 0) - (b.leg_number ?? 0))
                      
                      let winsA = 0, winsB = 0
                      seriesMatches.forEach(g => {
                        if (g.status === 'approved' && g.home_score !== null && g.away_score !== null) {
                          if (g.home_score > g.away_score) {
                            if (g.home_team_id === (seriesMatches[0]?.home_team_id)) winsA++
                            else winsB++
                          } else if (g.away_score > g.home_score) {
                            if (g.away_team_id === (seriesMatches[0]?.home_team_id)) winsA++
                            else winsB++
                          }
                        }
                      })
                      
                      items.push(
                        <div key={`cup-${ko.key}-${rn}`} className="card overflow-hidden">
                          <div className="px-5 py-3 flex items-center gap-2" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                            <span className="font-display font-semibold text-sm text-brand-600">{ko.label}</span>
                            <span className="text-xs text-slate-400 font-mono">({winsA}-{winsB})</span>
                          </div>
                          <MatchList matches={seriesMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                        </div>
                      )
                    })
                  } else {
                    items.push(
                      <div key={`cup-${ko.key}`} className="card overflow-hidden">
                        <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                          <span className="font-display font-semibold text-sm text-brand-600">{ko.label}</span>
                        </div>
                        <MatchList matches={koMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                      </div>
                    )
                  }
                })
              } else {
                rounds.forEach(r => {
                  const roundMatches = matches.filter(m => m.round === r)
                  items.push(
                    <div key={`round-${r}`} className="card overflow-hidden">
                      <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
                        <span className="font-display font-semibold text-sm text-brand-600">
                          {season.type === 'cup'
                            ? (KO_ROUNDS.find(k => matches.find(m => m.round === r && m.stage === k.key))?.label || stageLabel(r, rounds.length))
                            : `Pekan ${r}`}
                        </span>
                      </div>
                      <MatchList matches={roundMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                    </div>
                  )
                })
              }
            }

            return items
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

function MatchDivSlider({ matches, teams, isAdmin, myTeamId, onUpdate, season, numDiv }) {
  const [mDiv, setMDiv] = useState(1)
  const mPrev = () => setMDiv(d => Math.max(1, d - 1))
  const mNext = () => setMDiv(d => Math.min(numDiv, d + 1))
  const mDivMatches = matches.filter(m => {
    const home = teams.find(t => t.team_id === m.home_team_id)
    return home && (home.division || 1) === mDiv
  })
  const mDivRounds = [...new Set(mDivMatches.map(m => m.round))].sort((a, b) => a - b)
  const divPending = mDivMatches.filter(m => m.status !== 'approved').length
  const divTotal = mDivMatches.length

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
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-accent-green">
          {divPending} pertandingan tersisa, total {divTotal} pertandingan
        </span>
        <p className="text-xs" style={{color:'#94a3b8'}}>
          Klik papan skor untuk input hasil, klik nama tim untuk chat
        </p>
      </div>
      {mDivRounds.map(r => {
        const roundMatches = mDivMatches.filter(m => m.round === r)
        return (
        <div key={r} className="card overflow-hidden">
          <div className="px-5 py-3" style={{borderBottom:"1px solid #e2e8f0",backgroundColor:"#f8fafc"}}>
            <span className="font-display font-semibold text-sm text-brand-600">Pekan {r}</span>
          </div>
          <MatchList matches={roundMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={onUpdate} season={season} />
        </div>
      )})}
      {mDivRounds.length === 0 && (
        <div className="card overflow-hidden">
          <MatchList matches={mDivMatches} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={onUpdate} season={season} />
        </div>
      )}
    </div>
  )
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

  async function approveResult(match) {
    await supabase.from('matches').update({
      status: 'approved',
      approved_at: new Date().toISOString()
    }).eq('id', match.id)
    onUpdate()
  }

  function showScoreBtn(m) {
    if (m.status === 'approved') return false
    if (isAdmin) return true
    return myTeamId && (m.home_team_id === myTeamId || m.away_team_id === myTeamId)
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {matches.map(m => {
          const homeWa   = m.home_team?.owner?.whatsapp
          const awayWa   = m.away_team?.owner?.whatsapp
          const homeWaLink = homeWa ? `https://kirimwa.id/${homeWa.replace(/\D/g, '')}` : null
          const awayWaLink = awayWa ? `https://kirimwa.id/${awayWa.replace(/\D/g, '')}` : null
          const canClick = showScoreBtn(m) || isAdmin
          return (
          <div key={m.id}
            onClick={() => canClick && setScoreModal(m)}
            className={`relative flex items-center justify-center px-4 py-3 gap-x-3 gap-y-1.5 ${canClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
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
              <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden shrink-0">
                {m.home_team?.owner?.avatar_url
                  ? <img src={m.home_team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (m.home_team?.name || '?')[0]}
              </div>
            </div>

            <div
              className={`font-display font-bold text-sm rounded-lg px-2 py-1 w-12 text-center shrink-0 border ${canClick ? 'cursor-pointer hover:bg-slate-100' : ''} ${m.screenshot_url ? 'border-brand-300' : ''}`} style={{backgroundColor:"#f1f5f9",borderColor:"#e2e8f0"}}
              onClick={e => { if (canClick) { e.stopPropagation(); setScoreModal(m) } else if (m.screenshot_url) { e.stopPropagation(); setImgModal(m.screenshot_url) } }}
            >
              {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '–'}
            </div>

            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-start">
              <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden shrink-0">
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

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {m.status === 'pending_result' && isAdmin && (
                <button onClick={e => { e.stopPropagation(); approveResult(m) }} className="badge-green cursor-pointer p-1 flex items-center">
                  <Check size={12} />
                </button>
              )}
              {m.status === 'pending_result' && !isAdmin && canInput(m) && <span className="badge-yellow flex items-center gap-1 p-1"><Clock size={10} /></span>}
              {m.status === 'pending_result' && !canInput(m) && <span className="badge-yellow flex items-center gap-1 p-1"><Clock size={10} /></span>}
              {m.status === 'approved' && !isAdmin && <span className="badge-green text-xs px-1">✓</span>}
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

  return <div className="card overflow-hidden"><StandingsTable rows={buildRows()} /></div>
}

function StandingsTable({ rows, promotionCount, relegationCount, isTopDivision, isBottomDivision }) {
  const promotionLimit = promotionCount && !isTopDivision ? promotionCount : 0
  const relegationLimit = relegationCount && !isBottomDivision ? relegationCount : 0

  const tRows = rows.map((r, i) => {
    const isPromo = promotionLimit > 0 && i < promotionLimit
    const isRel = relegationLimit > 0 && i >= rows.length - relegationLimit
    const rowBgStyle = isPromo
      ? { backgroundColor: 'rgba(52,211,153,0.08)' }
      : isRel
      ? { backgroundColor: 'rgba(248,113,113,0.08)' }
      : {}
    const indicatorColor = isPromo ? '#34d399' : isRel ? '#f87171' : 'transparent'
    const pos = i + 1
    return (
      <tr key={r.team_id || i} className="table-row-hover" style={rowBgStyle}>
        <td className="pl-4 pr-1 py-2.5 font-mono text-xs text-center" style={{color:'#64748b', borderLeft: `3px solid ${indicatorColor}`}}>{pos}</td>
        <td className="pl-1 pr-2 py-2.5">
          <Link to={`/teams/${r.team_id}`} className="flex items-center gap-2 hover:text-brand-600 transition-colors group">
            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold font-display text-brand-600 overflow-hidden shrink-0" style={{backgroundColor:'rgba(255,255,255,0.08)'}}>
              {r.avatar_url
                ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                : (r.team_name || '?')[0]}
            </div>
            <span className="font-medium group-hover:underline truncate">{r.team_name}</span>
          </Link>
        </td>
        <td className="py-2.5 text-center" style={{color:'#94a3b8'}}>{r.played}</td>
        <td className="py-2.5 text-center text-accent-green">{r.won}</td>
        <td className="py-2.5 text-center" style={{color:'#94a3b8'}}>{r.drawn}</td>
        <td className="py-2.5 text-center text-accent-red">{r.lost}</td>
        <td className="py-2.5 text-center" style={{color:'#94a3b8'}}>{r.gd > 0 ? '+' + r.gd : r.gd}</td>
        <td className="py-2.5 pr-4 text-center font-display font-bold text-brand-600">{r.pts}</td>
      </tr>
    )
  })

  const emptyRow = rows.length === 0 ? (
    <tr key="empty">
      <td colSpan={8} className="text-center py-8 text-slate-300 text-sm">Belum ada data klasemen</td>
    </tr>
  ) : null

  const showLegend = promotionLimit > 0 || relegationLimit > 0

  return (
    <div className="overflow-x-auto">
      {showLegend && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-white/10" style={{backgroundColor:'rgba(255,255,255,0.04)'}}>
          {promotionLimit > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded" style={{backgroundColor:'rgba(52,211,153,0.2)', border:'1.5px solid rgba(52,211,153,0.6)'}} />
              <span style={{color:'#059669'}}>Promosi</span>
            </div>
          )}
          {relegationLimit > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded" style={{backgroundColor:'rgba(248,113,113,0.2)', border:'1.5px solid rgba(248,113,113,0.6)'}} />
              <span style={{color:'#dc2626'}}>Degradasi</span>
            </div>
          )}
        </div>
      )}
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
          <tr className="text-xs font-mono" style={{color:'#64748b', borderBottom:'1px solid rgba(255,255,255,0.08)', backgroundColor:'rgba(255,255,255,0.03)'}}>
            <th className="text-center pl-4 pr-1 py-2">#</th>
            <th className="text-left pl-1 pr-2 py-2">Tim</th>
            <th className="py-2 text-center">M</th>
            <th className="py-2 text-center">W</th>
            <th className="py-2 text-center">D</th>
            <th className="py-2 text-center">L</th>
            <th className="py-2 text-center">GD</th>
            <th className="py-2 pr-4 text-center text-brand-600">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {tRows}
          {emptyRow}
        </tbody>
      </table>
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

  function getGroupCapacity() {
    const total = teams.length
    const base = Math.floor(total / numGroups)
    const extra = total % numGroups
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
    const pool = []
    groupLetters.forEach(g => {
      const remaining = capacity[g] - (slots[g] || 0)
      for (let i = 0; i < remaining; i++) pool.push(g)
    })
    if (pool.length === 0) { alert('Semua grup sudah penuh!'); setDrawingTeamId(null); return }
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
  const [divTeams,     setDivTeams]     = useState({})
  const [divTab,       setDivTab]       = useState(1)
  const [viewDiv,      setViewDiv]      = useState(1)

  useEffect(() => {
    supabase.from('teams').select('id,name,owner:profiles!owner_id(avatar_url)').eq('status', 'approved').order('name')
      .then(({ data }) => setAllTeams(data || []))
  }, [seasonId])

  const enrolledIds = teams.map(t => t.team_id)
  const numDiv = season?.num_divisions || 1
  const multiDiv = numDiv > 1

  function openModal() {
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
        copy[div] = copy[div].filter(id => id !== teamId)
      } else {
        for (const d of Object.keys(copy)) {
          copy[d] = copy[d].filter(id => id !== teamId)
        }
        copy[div].push(teamId)
      }
      return copy
    })
  }

  function getAllSelected() {
    const ids = []
    for (const d of Object.keys(divTeams)) {
      ids.push(...divTeams[d])
    }
    return ids
  }

  function getAvailableForCurrentTab() {
    const current = divTeams[divTab] || []
    const others = []
    for (const d of Object.keys(divTeams)) {
      if (parseInt(d) !== divTab) {
        others.push(...divTeams[d])
      }
    }
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
      {multiDiv && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
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

function KnockoutTab({ seasonId, season, enrolledTeams, isAdmin, onUpdate }) {
  const [koMatches, setKoMatches]       = useState([])
  const [manageModal, setManageModal]   = useState(null)
  const [imgModal, setImgModal]         = useState(null)
  const [generating, setGenerating]     = useState(false)
  const [genLegModal, setGenLegModal]   = useState(null)
  const [setupModal, setSetupModal]     = useState(false)

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

  async function generateNextRound(currentStage, legs = 1) {
    const currentRound = KO_ROUNDS.find(r => r.key === currentStage)
    if (!currentRound?.next) return
    const nextStage = currentRound.next

    const currentMatches = koMatches.filter(m => m.stage === currentStage)
    const allApproved = currentMatches.every(m => m.status === 'approved')
    if (!allApproved) { alert('Semua laga babak ini harus selesai dulu!'); return }

    const isTwoLegs = currentMatches.some(m => m.leg_number === 2)

    let winners = []

    if (isTwoLegs) {
      const pairs = {}
      currentMatches.forEach(m => {
        const key = m.round
        if (!pairs[key]) pairs[key] = []
        pairs[key].push(m)
      })

      for (const [, pairMatches] of Object.entries(pairs)) {
        if (pairMatches.length < 2) { alert('Ada pasangan yang belum lengkap 2 leg!'); return }
        const leg1 = pairMatches.find(m => m.leg_number === 1)
        const leg2 = pairMatches.find(m => m.leg_number === 2)
        if (!leg1 || !leg2) { alert('Data leg tidak lengkap!'); return }

        const teamA = leg1.home_team_id
        const teamB = leg1.away_team_id
        const aggA = (leg1.home_score ?? 0) + (leg2.away_score ?? 0)
        const aggB = (leg1.away_score ?? 0) + (leg2.home_score ?? 0)

        if (aggA > aggB) winners.push(teamA)
        else if (aggB > aggA) winners.push(teamB)
        else { alert(`Agregat imbang di babak ini! Tentukan pemenang secara manual.`); return }
      }
    } else {
      winners = currentMatches.map(m => {
        if (m.home_score > m.away_score) return m.home_team_id
        if (m.away_score > m.home_score) return m.away_team_id
        return null
      })
      if (winners.some(w => !w)) { alert('Ada laga yang berakhir seri, tentukan pemenang dulu!'); return }
    }

    if (winners.length < 2) { alert('Tidak cukup pemenang untuk babak berikutnya!'); return }

    const nextExists = koMatches.some(m => m.stage === nextStage)
    if (nextExists) { alert(`Babak ${KO_ROUNDS.find(r => r.key === nextStage)?.label} sudah ada!`); return }

    setGenerating(true)
    const matchRows = []
    
    const isFinal = nextStage === 'final'
    const finalSeriesType = season?.final_series_type || 'single'
    const finalBestOf = season?.final_best_of || 1
    
    for (let i = 0; i < winners.length; i += 2) {
      if (winners[i + 1]) {
        const pairIndex = Math.floor(i / 2) + 1
        
        if (isFinal && finalSeriesType === 'best_of') {
          for (let gameNum = 1; gameNum <= finalBestOf; gameNum++) {
            const isEven = gameNum % 2 === 0
            matchRows.push({
              season_id: seasonId,
              home_team_id: isEven ? winners[i + 1] : winners[i],
              away_team_id: isEven ? winners[i] : winners[i + 1],
              stage: nextStage,
              round: pairIndex,
              leg_number: gameNum,
              status: 'scheduled'
            })
          }
        } else {
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
    }

    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) { alert('Gagal generate: ' + error.message) }
    else { await fetchKo(); onUpdate() }
    setGenerating(false)
  }

  const activeRounds = KO_ROUNDS.filter(r => koMatches.some(m => m.stage === r.key))
  const firstRound   = activeRounds[0] ?? KO_ROUNDS[2]

  const bracketRounds = (() => {
    const result = []
    for (const r of KO_ROUNDS) {
      const ms = koMatches.filter(m => m.stage === r.key)
      if (ms.length > 0) result.push(r)
      else if (result.length > 0) { result.push(r); break }
    }
    if (result.length === 0) result.push(...KO_ROUNDS)
    return result
  })()

  const hasAnyMatch = koMatches.length > 0

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {!hasAnyMatch && (
            <button
              onClick={() => setSetupModal(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus size={15} /> Setup Bracket
            </button>
          )}

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

      <BracketTree
        rounds={bracketRounds}
        koMatches={koMatches}
        isAdmin={isAdmin}
        onDelete={deleteMatch}
        onUpdate={fetchKo}
        onImgClick={setImgModal}
        onManage={isAdmin ? (stageKey) => setManageModal(stageKey) : null}
        season={season}
      />

      {setupModal && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSetupModal(false)}>
          <SetupBracketModal
            enrolledTeams={enrolledTeams}
            seasonId={seasonId}
            season={season}
            onClose={() => setSetupModal(false)}
            onSaved={() => { setSetupModal(false); fetchKo(); onUpdate() }}
          />
        </div>,
        document.body
      )}

      {manageModal && (
        <ManageKoTeamsModal
          seasonId={seasonId}
          season={season}
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
            nextStage={genLegModal.nextStage}
            season={season}
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
function SetupBracketModal({ enrolledTeams, seasonId, season, onClose, onSaved }) {
  const teamList = enrolledTeams.map(st => st.team).filter(Boolean)
  const teamCount = { r32: 32, r16: 16, qf: 8, sf: 4, final: 2 }
  const [step, setStep]       = useState(1)
  const [stage, setStage]     = useState(null)
  const [legs, setLegs]       = useState(1)
  const [selected, setSelected] = useState([])
  const [pairs, setPairs]     = useState([])
  const [saving, setSaving]   = useState(false)
  const needed = teamCount[stage] ?? 0
  const isExact = selected.length === needed
  const selectedTeams = teamList.filter(t => selected.includes(t.id))
  
  const isFinal = stage === 'final'
  const finalSeriesType = season?.final_series_type || 'single'
  const finalBestOf = season?.final_best_of || 1

  function toggleTeam(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function initManualPairs() {
    const newPairs = []
    for (let i = 0; i < selected.length; i += 2) {
      if (selected[i + 1]) {
        newPairs.push({ homeTeamId: selected[i], awayTeamId: selected[i + 1] })
      }
    }
    setPairs(newPairs)
    setStep(3)
  }

  function swapPair(idx) {
    setPairs(prev => {
      const copy = [...prev]
      copy[idx] = { homeTeamId: copy[idx].awayTeamId, awayTeamId: copy[idx].homeTeamId }
      return copy
    })
  }

  function changeHomeTeam(pairIdx, teamId) {
    setPairs(prev => {
      const copy = [...prev]
      copy[pairIdx] = { ...copy[pairIdx], homeTeamId: teamId }
      return copy
    })
  }
  function changeAwayTeam(pairIdx, teamId) {
    setPairs(prev => {
      const copy = [...prev]
      copy[pairIdx] = { ...copy[pairIdx], awayTeamId: teamId }
      return copy
    })
  }

  function getTeamObj(id) { return teamList.find(t => t.id === id) }

  function allTeamsUnique() {
    const used = new Set()
    for (const p of pairs) {
      if (used.has(p.homeTeamId) || used.has(p.awayTeamId)) return false
      used.add(p.homeTeamId)
      used.add(p.awayTeamId)
    }
    return used.size === selected.length
  }

  async function handleSave(pairData) {
    setSaving(true)
    const matchRows = []
    pairData.forEach((pair, i) => {
      const round = i + 1
      
      if (isFinal && finalSeriesType === 'best_of') {
        for (let gameNum = 1; gameNum <= finalBestOf; gameNum++) {
          const isEven = gameNum % 2 === 0
          matchRows.push({
            season_id: seasonId,
            home_team_id: isEven ? pair.awayTeamId : pair.homeTeamId,
            away_team_id: isEven ? pair.homeTeamId : pair.awayTeamId,
            stage,
            round,
            leg_number: gameNum,
            status: 'scheduled'
          })
        }
      } else {
        matchRows.push({
          season_id: seasonId,
          home_team_id: pair.homeTeamId,
          away_team_id: pair.awayTeamId,
          stage,
          round,
          leg_number: 1,
          status: 'scheduled'
        })
        if (legs === 2) {
          matchRows.push({
            season_id: seasonId,
            home_team_id: pair.awayTeamId,
            away_team_id: pair.homeTeamId,
            stage,
            round,
            leg_number: 2,
            status: 'scheduled'
          })
        }
      }
    })

    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) alert('Gagal: ' + error.message)
    setSaving(false)
    if (!error) onSaved()
  }

  async function handleRandom() {
    if (selected.length < 2) { alert('Pilih minimal 2 tim!'); return }
    const shuffled = [...selected].sort(() => Math.random() - 0.5)
    const pairData = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        pairData.push({ homeTeamId: shuffled[i], awayTeamId: shuffled[i + 1] })
      }
    }
    await handleSave(pairData)
  }

  async function handleManualSave() {
    if (!allTeamsUnique()) { alert('Ada tim yang terpakai lebih dari sekali! Periksa pairing.'); return }
    await handleSave(pairs)
  }

  if (step === 3) {
    const usedTeamIds = new Set()
    pairs.forEach(p => { usedTeamIds.add(p.homeTeamId); usedTeamIds.add(p.awayTeamId) })
    const unpairedTeams = selectedTeams.filter(t => !usedTeamIds.has(t.id))

    return (
      <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(2)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="font-display font-bold text-base">Atur Pasangan — {KO_ROUNDS.find(r => r.key === stage)?.label}</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Atur pairing tim secara manual</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <p className="text-xs text-slate-500">Atur pasangan tim. Tombol ⇄ untuk swap home/away.</p>
          {unpairedTeams.length > 0 && (
            <p className="text-[10px] text-accent-red mt-1">⚠ {unpairedTeams.length} tim belum dipasangkan!</p>
          )}
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
          {pairs.map((pair, i) => {
            const home = getTeamObj(pair.homeTeamId)
            const away = getTeamObj(pair.awayTeamId)
            return (
              <div key={i} className="px-5 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Pair {i + 1}</span>
                  <button onClick={() => swapPair(i)} className="text-slate-300 hover:text-brand-600 transition-colors text-xs px-2 py-0.5 rounded hover:bg-slate-100" title="Swap home/away">
                    ⇄ Swap
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select value={pair.homeTeamId} onChange={e => changeHomeTeam(i, parseInt(e.target.value))}
                      className="input text-sm w-full appearance-none cursor-pointer">
                      {selected.map(tid => {
                        const t = getTeamObj(tid)
                        const isUsedElsewhere = pairs.some((p, pi) => pi !== i && (p.homeTeamId === tid || p.awayTeamId === tid))
                        return <option key={tid} value={tid} disabled={isUsedElsewhere}>{t?.name} {isUsedElsewhere ? '(terpakai)' : ''}</option>
                      })}
                    </select>
                  </div>
                  <span className="text-slate-300 text-xs font-mono shrink-0">vs</span>
                  <div className="relative flex-1">
                    <select value={pair.awayTeamId} onChange={e => changeAwayTeam(i, parseInt(e.target.value))}
                      className="input text-sm w-full appearance-none cursor-pointer">
                      {selected.map(tid => {
                        const t = getTeamObj(tid)
                        const isUsedElsewhere = pairs.some((p, pi) => pi !== i && (p.homeTeamId === tid || p.awayTeamId === tid))
                        return <option key={tid} value={tid} disabled={isUsedElsewhere}>{t?.name} {isUsedElsewhere ? '(terpakai)' : ''}</option>
                      })}
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0">
          <button onClick={() => handleRandom()} disabled={saving}
            className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1.5">
            🎲 {saving ? '...' : 'Acak'}
          </button>
          <button onClick={handleManualSave} disabled={saving || !allTeamsUnique()}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
            {saving ? 'Menyimpan...' : 'Simpan Pairing'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="font-display font-bold text-base">Setup Bracket</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Langkah {step} dari 3</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
      </div>

      {step === 1 && (
        <>
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
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
            {isFinal && finalSeriesType === 'best_of' ? (
              <div className="p-4 rounded-xl" style={{backgroundColor:'#f8fafc', border:'1px solid #e2e8f0'}}>
                <p className="text-xs text-slate-500 mb-2 font-medium">Format Final</p>
                <div className="space-y-1">
                  <p className="text-sm text-slate-600 font-semibold">Best of {finalBestOf}</p>
                  <p className="text-[10px] text-slate-400">Seri {finalBestOf} pertandingan, pemenang terbanyak</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Format pertandingan</p>
                <div className="flex gap-2">
                  <button onClick={() => setLegs(1)}
                    className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 1 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}>1 Leg</button>
                  <button onClick={() => setLegs(2)}
                    className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 2 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}>2 Leg</button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {legs === 1 ? '1 pertandingan per pasangan.' : '2 pertandingan per pasangan (home & away). Pemenang dari agregat.'}
                </p>
              </div>
            )}
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
              <p className="text-xs text-slate-500">Pilih tim untuk <span className="font-semibold text-slate-800">{KO_ROUNDS.find(r => r.key === stage)?.label}</span></p>
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
            <button onClick={handleRandom} disabled={saving || !isExact}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
              🎲 {saving ? 'Menyimpan...' : 'Acak & Generate'}
            </button>
            <button onClick={initManualPairs} disabled={!isExact}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
              <Swords size={14} /> Atur Manual
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Modal pilih format leg saat generate babak berikutnya ───────────────────
function GenLegModal({ nextLabel, nextStage, season, onClose, onConfirm }) {
  const [legs, setLegs] = useState(1)
  
  const isFinal = nextStage === 'final'
  const finalSeriesType = season?.final_series_type || 'single'
  const finalBestOf = season?.final_best_of || 1
  
  const handleConfirm = () => {
    onConfirm(legs)
  }
  
  return (
    <div className="card w-full max-w-xs animate-slide-in p-5 space-y-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base">Generate {nextLabel}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={17} /></button>
      </div>

      {isFinal && finalSeriesType === 'best_of' ? (
        <div className="p-4 rounded-xl" style={{backgroundColor:'#f8fafc', border:'1px solid #e2e8f0'}}>
          <p className="text-xs text-slate-500 mb-2 font-medium">Format Final</p>
          <div className="space-y-1">
            <p className="text-sm text-slate-600 font-semibold">Best of {finalBestOf}</p>
            <p className="text-[10px] text-slate-400">Seri {finalBestOf} pertandingan, pemenang terbanyak</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-400 mb-2">Format pertandingan</p>
          <div className="flex gap-2">
            <button onClick={() => setLegs(1)}
              className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 1 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}>1 Leg</button>
            <button onClick={() => setLegs(2)}
              className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 2 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}>2 Leg</button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {legs === 1 ? '1 pertandingan per pasangan. Pemenang langsung lolos.' : '2 pertandingan per pasangan (home & away). Pemenang dari agregat skor.'}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1 text-sm">Batal</button>
        <button onClick={handleConfirm} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
          <Calendar size={13} /> Generate
        </button>
      </div>
    </div>
  )
}

// ─── Bracket Tree ─────────────────────────────────────────────────────────────
const CARD_W      = 180
const CARD_H_1LEG = 72
const CARD_H_2LEG = 120
const CARD_H_BESTOF_BASE = 72
const CARD_H_PER_GAME = 40
const CARD_GAP    = 20
const COL_GAP     = 48

function BracketTree({ rounds, koMatches, isAdmin, onDelete, onUpdate, onImgClick, onManage, season }) {
  const [scoreModal, setScoreModal] = useState(null)

  if (rounds.length === 0) {
    return (
      <div className="card p-10 text-center text-slate-300 text-sm">
        <Trophy size={32} className="mx-auto mb-3 opacity-20" />
        Belum ada data bracket. Admin dapat menambahkan tim via tombol di atas.
      </div>
    )
  }

  function getPairs(stageKey) {
    const ms = koMatches.filter(m => m.stage === stageKey)
    const isFinal = stageKey === 'final'
    const finalSeriesType = season?.final_series_type || 'single'
    const isBestOf = isFinal && finalSeriesType === 'best_of'
    
    if (isBestOf) {
      const roundNums = [...new Set(ms.map(m => m.round))].sort((a, b) => a - b)
      return roundNums.map(rn => {
        const games = ms
          .filter(m => m.round === rn)
          .sort((a, b) => (a.leg_number ?? 0) - (b.leg_number ?? 0))
        return { type: 'best_of', games, pairId: `${stageKey}-${rn}` }
      })
    }
    
    const isTwoLegs = ms.some(m => m.leg_number === 2)
    if (!isTwoLegs) {
      return ms.sort((a, b) => (a.round ?? 0) - (b.round ?? 0)).map(m => ({ type: '1leg', leg1: m, leg2: null, pairId: m.id }))
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
    const isFinal = stageKey === 'final'
    const finalSeriesType = season?.final_series_type || 'single'
    
    if (isFinal && finalSeriesType === 'best_of') {
      const maxGameNum = Math.max(...ms.map(m => m.leg_number ?? 1), 1)
      return CARD_H_BESTOF_BASE + (maxGameNum - 1) * CARD_H_PER_GAME
    }
    
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

// ─── Bracket Card ─────────────────────────────────────────────────────────────
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

  const { type } = pair

  if (type === 'best_of') {
    const { games } = pair
    if (!games || games.length === 0) {
      return (
        <foreignObject x={x} y={y} width={CARD_W} height={cardH}>
          <div xmlns="http://www.w3.org/1999/xhtml"
            className="w-full h-full rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
            <span className="text-[10px] text-slate-300 font-mono">TBD</span>
          </div>
        </foreignObject>
      )
    }

    const teamA = games[0]?.home_team ?? null
    const teamB = games[0]?.away_team ?? null
    
    let winsA = 0, winsB = 0
    games.forEach(g => {
      if (g.status === 'approved' && g.home_score !== null && g.away_score !== null) {
        if (g.home_score > g.away_score) {
          if (g.home_team_id === (games[0]?.home_team_id)) winsA++
          else winsB++
        } else if (g.away_score > g.home_score) {
          if (g.away_team_id === (games[0]?.home_team_id)) winsA++
          else winsB++
        }
      }
    })

    const allDone = games.every(g => g.status === 'approved')
    const seriesWinA = winsA > winsB && allDone
    const seriesWinB = winsB > winsA && allDone

    return (
      <foreignObject x={x} y={y} width={CARD_W} height={cardH}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          className={`w-full h-full rounded-lg border flex flex-col overflow-hidden text-[11px] font-medium
            ${allDone ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>

          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <BcAvatar team={teamA} />
              <span className={`truncate text-[10px] font-semibold leading-tight ${seriesWinA ? 'text-brand-700' : 'text-slate-500'}`}>
                {teamA?.name ?? 'TBD'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 mx-1">
              <span className={`font-display font-bold text-[12px] ${seriesWinA ? 'text-accent-green' : 'text-slate-400'}`}>{winsA}</span>
              <span className="text-[9px] text-slate-400 font-mono">-</span>
              <span className={`font-display font-bold text-[12px] ${seriesWinB ? 'text-accent-green' : 'text-slate-400'}`}>{winsB}</span>
            </div>
            <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
              <span className={`truncate text-[10px] font-semibold leading-tight text-right ${seriesWinB ? 'text-brand-700' : 'text-slate-500'}`}>
                {teamB?.name ?? 'TBD'}
              </span>
              <BcAvatar team={teamB} />
            </div>
          </div>

          {games.map((g, i) => {
            const isHomeA = g.home_team_id === games[0]?.home_team_id
            const scoreA = isHomeA ? g.home_score : g.away_score
            const scoreB = isHomeA ? g.away_score : g.home_score
            const gameWinA = g.status === 'approved' && scoreA !== null && scoreB !== null && scoreA > scoreB
            const gameWinB = g.status === 'approved' && scoreA !== null && scoreB !== null && scoreB > scoreA
            
            return (
              <BcLegRow key={g.id} label={`G${g.leg_number ?? i + 1}`}
                scoreA={scoreA} scoreB={scoreB}
                done={g.status === 'approved'} pending={g.status === 'pending_result'}
                isAdmin={isAdmin}
                onApprove={() => approve(g.id)}
                onScore={() => onScoreClick(g)}
                onDelete={() => onDelete(g.id)}
                onImgClick={g?.screenshot_url ? () => onImgClick(g.screenshot_url) : null}
                hasBorderTop={i > 0}
                highlightA={gameWinA} highlightB={gameWinB}
              />
            )
          })}
        </div>
      </foreignObject>
    )
  }

  if (type === '1leg') {
    const { leg1 } = pair
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

  const { leg1, leg2 } = pair
  const teamA = leg1?.home_team ?? leg2?.away_team ?? null
  const teamB = leg1?.away_team ?? leg2?.home_team ?? null
  const l1A = leg1?.home_score ?? null
  const l1B = leg1?.away_score ?? null
  const l2A = leg2?.away_score ?? null
  const l2B = leg2?.home_score ?? null
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

        <BcLegRow label="L1"
          scoreA={l1A} scoreB={l1B}
          done={leg1?.status === 'approved'} pending={leg1?.status === 'pending_result'}
          isAdmin={isAdmin}
          onApprove={leg1 ? () => approve(leg1.id) : null}
          onScore={leg1 ? () => onScoreClick(leg1) : null}
          onDelete={leg1 ? () => onDelete(leg1.id) : null}
          onImgClick={leg1?.screenshot_url ? () => onImgClick(leg1.screenshot_url) : null}
        />

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

function BcLegRow({ label, scoreA, scoreB, done, pending, isAdmin, onApprove, onScore, onDelete, onImgClick, hasBorderTop, highlightA, highlightB }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-1 shrink-0 ${hasBorderTop ? 'border-t border-slate-100' : ''} ${done ? 'bg-slate-50' : ''}`}>
      <span className="text-[9px] text-slate-400 font-mono w-4 shrink-0">{label}</span>
      <div className="flex-1 flex items-center justify-center gap-1"
        onClick={onImgClick ?? undefined} style={{ cursor: onImgClick ? 'pointer' : 'default' }}>
        {scoreA !== null && scoreB !== null
          ? <>
              <span className={`font-display font-bold text-[11px] w-4 text-center ${highlightA ? 'text-accent-green' : scoreA > scoreB ? 'text-brand-700' : 'text-slate-400'}`}>{scoreA}</span>
              <span className="text-slate-300 text-[9px]">-</span>
              <span className={`font-display font-bold text-[11px] w-4 text-center ${highlightB ? 'text-accent-green' : scoreB > scoreA ? 'text-brand-700' : 'text-slate-400'}`}>{scoreB}</span>
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

function ManageKoTeamsModal({ seasonId, season, stage, stageLabel, enrolledTeams, existingMatches, onClose, onSaved }) {
  const teamList = enrolledTeams.map(st => st.team).filter(Boolean)
  const usedIds = new Set(existingMatches.flatMap(m => [m.home_team_id, m.away_team_id]))
  const existingLegs = existingMatches.some(m => m.leg_number === 2) ? 2 : 1
  const teamCount = { r32: 32, r16: 16, qf: 8, sf: 4, final: 2 }
  const needed = teamCount[stage] ?? 0

  const [step, setStep]       = useState(1)
  const [selected, setSelected] = useState([...usedIds])
  const [legs, setLegs]       = useState(existingLegs)
  const [saving, setSaving]   = useState(false)
  const [pairs, setPairs]     = useState([])

  const isExact = selected.length === needed
  const tooMany = selected.length > needed
  const tooFew  = selected.length < needed
  const selectedTeams = teamList.filter(t => selected.includes(t.id))
  
  const isFinal = stage === 'final'
  const finalSeriesType = season?.final_series_type || 'single'
  const finalBestOf = season?.final_best_of || 1

  function toggleTeam(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function initManualPairs() {
    const newPairs = []
    for (let i = 0; i < selected.length; i += 2) {
      if (selected[i + 1]) {
        newPairs.push({ homeTeamId: selected[i], awayTeamId: selected[i + 1] })
      }
    }
    setPairs(newPairs)
    setStep(2)
  }

  function swapPair(idx) {
    setPairs(prev => {
      const copy = [...prev]
      copy[idx] = { homeTeamId: copy[idx].awayTeamId, awayTeamId: copy[idx].homeTeamId }
      return copy
    })
  }

  function changeHomeTeam(pairIdx, teamId) {
    setPairs(prev => {
      const copy = [...prev]
      copy[pairIdx] = { ...copy[pairIdx], homeTeamId: teamId }
      return copy
    })
  }
  function changeAwayTeam(pairIdx, teamId) {
    setPairs(prev => {
      const copy = [...prev]
      copy[pairIdx] = { ...copy[pairIdx], awayTeamId: teamId }
      return copy
    })
  }

  function allTeamsUnique() {
    const used = new Set()
    for (const p of pairs) {
      if (used.has(p.homeTeamId) || used.has(p.awayTeamId)) return false
      used.add(p.homeTeamId)
      used.add(p.awayTeamId)
    }
    return used.size === selected.length
  }

  async function handleSave(pairData) {
    setSaving(true)
    await supabase.from('matches').delete().eq('season_id', seasonId).eq('stage', stage)
    const matchRows = []
    pairData.forEach((pair, i) => {
      const round = i + 1
      
      if (isFinal && finalSeriesType === 'best_of') {
        for (let gameNum = 1; gameNum <= finalBestOf; gameNum++) {
          const isEven = gameNum % 2 === 0
          matchRows.push({
            season_id: seasonId,
            home_team_id: isEven ? pair.awayTeamId : pair.homeTeamId,
            away_team_id: isEven ? pair.homeTeamId : pair.awayTeamId,
            stage,
            round,
            leg_number: gameNum,
            status: 'scheduled'
          })
        }
      } else {
        matchRows.push({ season_id: seasonId, home_team_id: pair.homeTeamId, away_team_id: pair.awayTeamId, stage, round, leg_number: 1, status: 'scheduled' })
        if (legs === 2) {
          matchRows.push({ season_id: seasonId, home_team_id: pair.awayTeamId, away_team_id: pair.homeTeamId, stage, round, leg_number: 2, status: 'scheduled' })
        }
      }
    })
    const { error } = await supabase.from('matches').insert(matchRows)
    if (error) alert('Gagal: ' + error.message)
    setSaving(false)
    onSaved()
  }

  async function handleRandom() {
    if (selected.length < 2) { alert('Pilih minimal 2 tim!'); return }
    const shuffled = [...selected].sort(() => Math.random() - 0.5)
    const pairData = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) {
        pairData.push({ homeTeamId: shuffled[i], awayTeamId: shuffled[i + 1] })
      }
    }
    await handleSave(pairData)
  }

  async function handleManualSave() {
    if (!allTeamsUnique()) { alert('Ada tim yang terpakai lebih dari sekali! Periksa pairing.'); return }
    await handleSave(pairs)
  }

  function getTeamObj(id) { return teamList.find(t => t.id === id) }
  const usedTeamIds = new Set()
  pairs.forEach(p => { usedTeamIds.add(p.homeTeamId); usedTeamIds.add(p.awayTeamId) })
  const unpairedTeams = selectedTeams.filter(t => !usedTeamIds.has(t.id))

  if (step === 2) {
    return createPortal(
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
                <ArrowLeft size={16} />
              </button>
              <h2 className="font-display font-bold text-base">Atur Pasangan — {stageLabel}</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
          </div>
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <p className="text-xs text-slate-500">Atur pasangan tim. Klik tim untuk memilih pengganti. Tap tombol ⇄ untuk swap home/away.</p>
            {unpairedTeams.length > 0 && <p className="text-[10px] text-accent-red mt-1">⚠ {unpairedTeams.length} tim belum dipasangkan!</p>}
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {pairs.map((pair, i) => {
              const home = getTeamObj(pair.homeTeamId)
              const away = getTeamObj(pair.awayTeamId)
              return (
                <div key={i} className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Pair {i + 1}</span>
                    <button onClick={() => swapPair(i)} className="text-slate-300 hover:text-brand-600 transition-colors text-xs px-2 py-0.5 rounded hover:bg-slate-100">⇄ Swap</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select value={pair.homeTeamId} onChange={e => changeHomeTeam(i, parseInt(e.target.value))} className="input text-sm w-full appearance-none cursor-pointer">
                        {selected.map(tid => {
                          const t = getTeamObj(tid)
                          const isUsedElsewhere = pairs.some((p, pi) => pi !== i && (p.homeTeamId === tid || p.awayTeamId === tid))
                          return <option key={tid} value={tid} disabled={isUsedElsewhere}>{t?.name} {isUsedElsewhere ? '(terpakai)' : ''}</option>
                        })}
                      </select>
                    </div>
                    <span className="text-slate-300 text-xs font-mono shrink-0">vs</span>
                    <div className="relative flex-1">
                      <select value={pair.awayTeamId} onChange={e => changeAwayTeam(i, parseInt(e.target.value))} className="input text-sm w-full appearance-none cursor-pointer">
                        {selected.map(tid => {
                          const t = getTeamObj(tid)
                          const isUsedElsewhere = pairs.some((p, pi) => pi !== i && (p.homeTeamId === tid || p.awayTeamId === tid))
                          return <option key={tid} value={tid} disabled={isUsedElsewhere}>{t?.name} {isUsedElsewhere ? '(terpakai)' : ''}</option>
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-4 border-t border-slate-200 flex gap-3 shrink-0">
            <button onClick={() => handleRandom()} disabled={saving} className="btn-secondary flex-1 text-sm">🎲 {saving ? '...' : 'Acak Ulang'}</button>
            <button onClick={handleManualSave} disabled={saving || !allTeamsUnique()} className="btn-primary flex-1 text-sm">{saving ? 'Menyimpan...' : 'Simpan Pairing'}</button>
          </div>
        </div>
      </div>,
      document.body
    )
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
            {tooMany ? `Terlalu banyak. ${stageLabel} butuh tepat ${needed} tim.` : `Butuh ${needed - selected.length} tim lagi untuk ${stageLabel}.`}
          </div>
        )}
        {isFinal && finalSeriesType === 'best_of' ? (
          <div className="px-5 pt-4 pb-2 shrink-0">
            <div className="p-4 rounded-xl" style={{backgroundColor:'#f8fafc', border:'1px solid #e2e8f0'}}>
              <p className="text-xs text-slate-500 mb-2 font-medium">Format Final</p>
              <div className="space-y-1">
                <p className="text-sm text-slate-600 font-semibold">Best of {finalBestOf}</p>
                <p className="text-[10px] text-slate-400">Seri {finalBestOf} pertandingan, pemenang terbanyak</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-2 shrink-0">
            <p className="text-xs text-slate-400 mb-2">Format pertandingan</p>
            <div className="flex gap-2">
              <button onClick={() => setLegs(1)} className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 1 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}>1 Leg</button>
              <button onClick={() => setLegs(2)} className={`flex-1 py-2 rounded-lg text-sm font-display font-semibold border transition-all ${legs === 2 ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}>2 Leg</button>
            </div>
          </div>
        )}
        <p className="px-5 pt-2 pb-1 text-xs text-slate-400">Pilih tim yang masuk babak ini, lalu pilih metode:</p>
        <div className="divide-y divide-slate-100 overflow-y-auto flex-1 mt-1">
          {teamList.map(t => {
            const checked = selected.includes(t.id)
            return (
              <button key={t.id} onClick={() => toggleTeam(t.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${checked ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-brand-600 overflow-hidden shrink-0">
                  {t.owner?.avatar_url ? <img src={t.owner.avatar_url} alt="" /> : t.name[0]}
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
          <button onClick={handleRandom} disabled={saving || !isExact} className="btn-primary flex-1 text-sm">🎲 {saving ? 'Menyimpan...' : 'Acak'}</button>
          <button onClick={initManualPairs} disabled={!isExact} className="btn-primary flex-1 text-sm"><Swords size={14} /> Atur Manual</button>
        </div>
      </div>
    </div>,
    document.body
  )
}