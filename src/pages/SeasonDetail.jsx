import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Trophy, Users, Calendar, BarChart2, Play, Settings, ArrowLeft, Star, Swords, Plus, XCircle, Clock, Pencil, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateRoundRobin, generateKnockout, generateGroupStage } from '../utils/scheduler'

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
      supabase.from('season_teams').select('*, team:teams(id,name,owner:profiles!owner_id(avatar_url))').eq('season_id', id),
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

  async function generateSchedule() {
    setShowGenModal(false)
    setGenLoading(true)
    const teamIds = teams.map(t => t.team_id)
    let matchRows = []

    if (season.type === 'league') {
      const rounds = generateRoundRobin(teamIds, season.legs || 1)
      rounds.forEach((round, ri) => {
        round.forEach(m => matchRows.push({ season_id: id, ...m, round: ri + 1, stage: 'league', status: 'scheduled' }))
      })
    } else if (season.type === 'cup') {
      const rounds = generateKnockout(teamIds)
      const stageNames = ['r32','r16','qf','sf','final']
      rounds.forEach((round, ri) => {
        round.forEach(m => matchRows.push({ season_id: id, ...m, round: ri + 1, stage: stageNames[ri] || `r${ri+1}`, status: 'scheduled' }))
      })
    } else if (season.type === 'champions') {
      matchRows = generateGroupStage(teamIds).map(m => ({ season_id: id, ...m, status: 'scheduled' }))
    }

    if (matchRows.length > 0) {
      await supabase.from('matches').insert(matchRows)
      await fetchAll()
    }
    setGenLoading(false)
  }

  async function finishSeason() {
    await supabase.from('seasons').update({ status: 'finished' }).eq('id', id)
    fetchAll()
  }

  async function deleteSeason() {
    setShowDeleteModal(false)
    await supabase.from('seasons').delete().eq('id', id)
    navigate('/seasons')
  }

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!season) return <div className="text-white/40 p-8">Kompetisi tidak ditemukan</div>

  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b)
  const groups = [...new Set(matches.map(m => m.group_id).filter(Boolean))]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <Link to="/seasons" className="text-white/40 hover:text-white text-sm flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> Kembali
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="section-title">{season.name}</h1>
              <span className={statusBadge[season.status]}>{statusLabel[season.status]}</span>
              <span className={season.type === 'champions' ? 'badge-purple' : season.type === 'cup' ? 'badge-yellow' : 'badge-blue'}>
                {season.type === 'league' ? 'Liga' : season.type === 'cup' ? 'Cup' : 'Champions'}
              </span>
            </div>
            <p className="text-white/40 text-sm mt-1">{teams.length} tim terdaftar · {matches.length} pertandingan</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              {matches.length === 0 && teams.length >= 2 && (
                <button onClick={() => setShowGenModal(true)} disabled={genLoading} className="btn-primary text-sm flex items-center gap-2">
                  <Calendar size={15} /> {genLoading ? 'Generating...' : 'Generate Jadwal'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-pitch-mid p-1 rounded-xl w-fit">
        {(isAdmin ? ['matches','standings','teams'] : ['matches','standings']).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearchParams({ tab: t }) }}
            className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all ${tab === t ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white'}`}>
            {t === 'matches' ? 'Jadwal & Hasil' : t === 'standings' ? 'Klasemen' : 'Tim'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'matches' && (
        <div className="space-y-6">
          {/* Hasil Terbaru Section */}
          {matches.filter(m => m.status === 'approved').length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-semibold text-sm flex items-center gap-2 text-white/50 px-1 uppercase tracking-wider">
                <Trophy size={14} className="text-brand-400" /> ringkasan pertandingan
              </h2>
              <div className="card overflow-hidden divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
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
                          className={`font-display font-bold text-sm bg-pitch-dark rounded-lg px-2 py-1 w-12 text-center shrink-0 ${m.screenshot_url ? 'cursor-pointer hover:bg-white/10' : ''}`}
                          onClick={() => m.screenshot_url && setImgModal(m.screenshot_url)}
                        >
                          {m.home_score}–{m.away_score}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[80px]">{m.away_team?.name}</span>
                      </div>
                      <div className="text-[10px] text-white/30 font-mono uppercase tracking-tighter shrink-0 flex flex-col items-end">
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

          {matches.length === 0 ? (
            <div className="card p-10 text-center text-white/30">
              <Calendar size={36} className="mx-auto mb-3 opacity-30" />
              <p>Belum ada jadwal. {isAdmin && teams.length >= 2 ? 'Klik "Generate Jadwal" untuk membuat otomatis.' : ''}</p>
            </div>
          ) : (
            groups.length > 0
              ? groups.map(g => (
                <div key={g} className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 bg-pitch-dark/50">
                    <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
                  </div>
                  <MatchList matches={matches.filter(m => m.group_id === g)} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                </div>
              ))
              : rounds.map(r => (
                <div key={r} className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 bg-pitch-dark/50">
                    <span className="font-display font-semibold text-sm text-brand-400">
                      {season.type === 'cup' ? stageLabel(r, rounds.length) : `Pekan ${r}`}
                    </span>
                  </div>
                  <MatchList matches={matches.filter(m => m.round === r)} isAdmin={isAdmin} myTeamId={myTeamId} onUpdate={fetchAll} season={season} />
                </div>
              ))
          )}
        </div>
      )}

      {tab === 'standings' && <StandingsTab seasonId={id} type={season.type} enrolledTeams={teams} />}

      {tab === 'teams' && (
        <TeamsTab
          seasonId={id}
          teams={teams}
          isAdmin={isAdmin}
          onUpdate={fetchAll}
          hasMatches={matches.length > 0}
        />
      )}

      {showGenModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowGenModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-2">Generate Jadwal</h2>
            <p className="text-white/60 text-sm mb-5">Pastikan semua tim sudah ditambahkan. Jadwal tidak bisa diubah setelah di-generate.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowGenModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={generateSchedule} className="btn-primary flex-1 text-sm">Generate</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-2">Hapus Kompetisi</h2>
            <p className="text-white/60 text-sm mb-1">Yakin ingin menghapus <span className="text-white font-semibold">{season.name}</span>?</p>
            <p className="text-white/40 text-xs mb-5">Semua jadwal, hasil pertandingan, tim terdaftar, dan data klasemen akan ikut terhapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
              <button onClick={deleteSeason} className="btn-danger flex-1 text-sm">Hapus</button>
            </div>
          </div>
        </div>
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
      <div className="divide-y divide-white/5">
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
                className={`font-display font-bold text-sm bg-pitch-dark rounded-lg px-2 py-1 w-12 text-center shrink-0 ${m.screenshot_url ? 'cursor-pointer hover:bg-white/10' : ''}`}
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
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setImgModal(null)}>
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm animate-slide-in" onClick={e => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-1">Input Skor</h2>
        {!isAdmin && <p className="text-white/40 text-xs mb-4">Skor akan menunggu persetujuan admin.</p>}
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

          {/* Screenshot upload */}
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

function StandingsTab({ seasonId, type, enrolledTeams }) {
  const [data, setData] = useState([])

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
      .filter(st => !filterFn || filterFn({ group_id: st.group_id }))
      .map(st => standingsMap[st.team_id] || {
        team_id:   st.team_id,
        team_name: st.team?.name,
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
            <div className="px-5 py-3 border-b border-white/10 bg-pitch-dark/50">
              <span className="font-display font-semibold text-sm text-accent-purple">Grup {g}</span>
            </div>
            <StandingsTable rows={buildRows(r => r.group_id === g)} />
          </div>
        ))}
        {groups.length === 0 && <div className="card p-8 text-center text-white/30 text-sm">Belum ada data grup</div>}
      </div>
    )
  }

  return <div className="card overflow-hidden"><StandingsTable rows={buildRows()} /></div>
}

function StandingsTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-xs font-mono">
            <th className="text-left pl-5 pr-1 py-2">#</th>
            <th className="text-left pl-1 pr-2 py-2">Tim</th>
            <th className="px-2 py-2">M</th><th className="px-2 py-2">W</th>
            <th className="px-2 py-2">D</th><th className="px-2 py-2">L</th>
            <th className="px-2 py-2">GD</th><th className="px-2 py-2 text-brand-400">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={r.team_id} className="table-row-hover">
              <td className="pl-5 pr-1 py-2.5 text-white/40 font-mono text-xs">{i + 1}</td>
              <td className="pl-1 pr-2 py-2.5">
                <Link to={`/teams/${r.team_id}`} className="flex items-center gap-2 hover:text-brand-400 transition-colors group">
                  <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold font-display text-brand-400 overflow-hidden shrink-0">
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      : r.team_name?.[0]}
                  </div>
                  <span className="font-medium group-hover:underline">{r.team_name}</span>
                </Link>
              </td>
              <td className="px-2 py-2.5 text-center text-white/60">{r.played}</td>
              <td className="px-2 py-2.5 text-center text-accent-green">{r.won}</td>
              <td className="px-2 py-2.5 text-center text-white/60">{r.drawn}</td>
              <td className="px-2 py-2.5 text-center text-accent-red">{r.lost}</td>
              <td className="px-2 py-2.5 text-center text-white/60">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="px-2 py-2.5 text-center font-display font-bold text-brand-400">{r.pts}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="text-center py-8 text-white/30 text-sm">Belum ada data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function TeamsTab({ seasonId, teams, isAdmin, onUpdate, hasMatches }) {
  const [allTeams,  setAllTeams]  = useState([])
  const [showModal, setShowModal] = useState(false)
  const [selected,  setSelected]  = useState([])
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    supabase.from('teams').select('id,name,owner:profiles!owner_id(avatar_url)').eq('status', 'approved').order('name')
      .then(({ data }) => setAllTeams(data || []))
  }, [])

  const enrolledIds = teams.map(t => t.team_id)

  function openModal() {
    setSelected([...enrolledIds])
    setShowModal(true)
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function saveTeams() {
    setSaving(true)
    const toAdd    = selected.filter(id => !enrolledIds.includes(id))
    const toRemove = enrolledIds.filter(id => !selected.includes(id))

    if (toAdd.length > 0) {
      await supabase.from('season_teams').insert(toAdd.map(team_id => ({ season_id: seasonId, team_id })))
    }
    if (toRemove.length > 0) {
      await supabase.from('season_teams').delete()
        .in('team_id', toRemove)
        .eq('season_id', seasonId)
    }

    setSaving(false)
    setShowModal(false)
    onUpdate()
  }

  return (
    <>
      <div className="card overflow-hidden">
        {isAdmin && !hasMatches && (
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm text-white/50">{teams.length} tim terdaftar</span>
            <button onClick={openModal} className="btn-primary text-sm flex items-center gap-1.5 py-2">
              <Plus size={14} /> Atur Tim
            </button>
          </div>
        )}
        {isAdmin && hasMatches && (
          <div className="px-5 py-2 border-b border-white/10 bg-accent-yellow/5">
            <p className="text-xs text-accent-yellow/80">Jadwal sudah di-generate, tim tidak bisa diubah.</p>
          </div>
        )}
        <div className="divide-y divide-white/5">
          {teams.map((st, i) => (
            <div key={st.id} className="flex items-center gap-4 px-5 py-3">
              <span className="w-6 text-center text-white/30 font-mono text-xs">{i + 1}</span>
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold font-display text-brand-400 overflow-hidden">
                {st.team?.owner?.avatar_url
                  ? <img src={st.team.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                  : st.team?.name?.[0]}
              </div>
              <Link to={`/teams/${st.team_id}`} className="font-medium flex-1 hover:text-brand-300 transition-colors">{st.team?.name}</Link>
              {st.group_id && <span className="badge-purple">Grup {st.group_id}</span>}
            </div>
          ))}
          {teams.length === 0 && <div className="p-8 text-center text-white/30 text-sm">Belum ada tim</div>}
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-sm animate-slide-in flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <h2 className="font-display font-bold text-base">Atur Tim Peserta</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white"><XCircle size={18} /></button>
            </div>

            {allTeams.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">Belum ada tim terdaftar</div>
            ) : (
              <>
                <div className="divide-y divide-white/5 overflow-y-auto flex-1">
                  {allTeams.map(t => {
                    const checked = selected.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => toggleSelect(t.id)}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${checked ? 'bg-brand-600/15' : 'hover:bg-white/5'}`}>
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold font-display text-brand-400 overflow-hidden shrink-0">
                          {t.owner?.avatar_url
                            ? <img src={t.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                            : t.name[0]}
                        </div>
                        <span className="font-medium text-sm flex-1">{t.name}</span>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand-500 border-brand-500' : 'border-white/20'}`}>
                          {checked && <Check size={12} className="text-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="px-5 py-4 border-t border-white/10 flex gap-3 shrink-0">
                  <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm">Batal</button>
                  <button onClick={saveTeams} disabled={saving} className="btn-primary flex-1 text-sm">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
