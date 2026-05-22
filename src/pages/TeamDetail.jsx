import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { User, Swords, Gamepad2, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BackButton from '../components/layout/BackButton'

export default function TeamDetail() {
  const { id } = useParams()
  const [team,    setTeam]    = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  function copyEfootballId(val) {
    navigator.clipboard.writeText(val)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select('*, owner:profiles!owner_id(username, id, avatar_url, whatsapp, efootball_id)').eq('id', id).single(),
      supabase.from('match_history')
        .select('*')
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .order('approved_at', { ascending: false })
    ])
    setTeam(t)
    setMatches(m || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!team) return <div className="p-8 text-sm" style={{color:'#94a3b8'}}>Tim tidak ditemukan</div>

  const avatar = team.owner?.avatar_url

  return (
    <div className="space-y-6 animate-fade-in">
      <BackButton fallback="/teams" />

      {/* Header */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-100 border border-brand-200 flex items-center justify-center text-2xl font-display font-bold text-brand-600 overflow-hidden">
          {avatar
            ? <img src={avatar} alt="logo" className="w-full h-full object-cover" />
            : team.name[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold" style={{color:'#0f172a'}}>{team.name}</h1>
          <p className="text-sm mt-1 flex items-center gap-1" style={{color:'#94a3b8'}}>
            <User size={13} /> {team.owner?.username}
          </p>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {/* WhatsApp */}
            <a
              href={team.owner?.whatsapp ? `https://wa.me/${team.owner.whatsapp.replace(/\D/g, '')}` : undefined}
              target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-xs ${team.owner?.whatsapp ? 'text-[#25D366] hover:text-[#25D366]/80' : 'text-white/20 pointer-events-none'}`}
            >
              {/* WhatsApp SVG icon */}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {team.owner?.whatsapp || '-'}
            </a>
            {/* eFootball ID */}
            <span className="flex items-center gap-1.5 text-xs" style={{color:'#94a3b8'}}>
              <Gamepad2 size={12} />
              {team.owner?.efootball_id || '-'}
              {team.owner?.efootball_id && (
                <button onClick={() => copyEfootballId(team.owner.efootball_id)}
                  className="ml-0.5 text-white/30 hover:text-white/70 transition-colors">
                  {copied ? <Check size={11} className="text-accent-green" /> : <Copy size={11} />}
                </button>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Card */}
      {matches.length > 0 && (() => {
        const stats = matches.reduce((acc, m) => {
          const isHome = m.home_team_id === id
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
        
        const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0
        const goalDiff = stats.goalsFor - stats.goalsAgainst
        
        return (
          <div className="card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b" style={{borderColor:'#e2e8f0', backgroundColor:'#f8fafc'}}>
              <h3 className="font-display font-semibold text-sm" style={{color:'#64748b'}}>STATISTIK TIM</h3>
            </div>
            
            {/* Content */}
            <div className="p-5">
              {/* Top Row: Main Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Total Matches */}
                <div className="text-center p-4 rounded-xl" style={{backgroundColor:'#f1f5f9'}}>
                  <div className="text-xs font-medium mb-2" style={{color:'#64748b'}}>PERTANDINGAN</div>
                  <div className="text-4xl font-display font-bold text-brand-600">{stats.played}</div>
                </div>
                
                {/* Win Rate */}
                <div className="text-center p-4 rounded-xl" style={{backgroundColor:'rgba(34,197,94,0.08)'}}>
                  <div className="text-xs font-medium mb-2" style={{color:'#64748b'}}>WIN RATE</div>
                  <div className="text-4xl font-display font-bold text-accent-green">{winRate}%</div>
                </div>
                
                {/* Goal Difference */}
                <div className="text-center p-4 rounded-xl" style={{backgroundColor: goalDiff >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'}}>
                  <div className="text-xs font-medium mb-2" style={{color:'#64748b'}}>SELISIH GOL</div>
                  <div className={`text-4xl font-display font-bold ${goalDiff > 0 ? 'text-accent-green' : goalDiff < 0 ? 'text-accent-red' : 'text-slate-400'}`}>
                    {goalDiff > 0 ? '+' : ''}{goalDiff}
                  </div>
                </div>
              </div>
              
              {/* Bottom Row: Detailed Stats */}
              <div className="grid grid-cols-2 gap-4">
                {/* Form */}
                <div className="p-4 rounded-xl border" style={{borderColor:'#e2e8f0', backgroundColor:'#ffffff'}}>
                  <div className="text-xs font-medium mb-3" style={{color:'#64748b'}}>FORM</div>
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-display font-bold text-accent-green">{stats.won}</div>
                      <div className="text-[10px] mt-1" style={{color:'#94a3b8'}}>Menang</div>
                    </div>
                    <div className="w-px h-8" style={{backgroundColor:'#e2e8f0'}}></div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-display font-bold" style={{color:'#94a3b8'}}>{stats.drawn}</div>
                      <div className="text-[10px] mt-1" style={{color:'#94a3b8'}}>Seri</div>
                    </div>
                    <div className="w-px h-8" style={{backgroundColor:'#e2e8f0'}}></div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-display font-bold text-accent-red">{stats.lost}</div>
                      <div className="text-[10px] mt-1" style={{color:'#94a3b8'}}>Kalah</div>
                    </div>
                  </div>
                </div>
                
                {/* Goals */}
                <div className="p-4 rounded-xl border" style={{borderColor:'#e2e8f0', backgroundColor:'#ffffff'}}>
                  <div className="text-xs font-medium mb-3" style={{color:'#64748b'}}>GOL</div>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-display font-bold text-brand-600">{stats.goalsFor}</div>
                      <div className="text-[10px] mt-1" style={{color:'#94a3b8'}}>Dicetak</div>
                    </div>
                    <div className="text-3xl font-display font-bold" style={{color:'#cbd5e1'}}>:</div>
                    <div className="text-center">
                      <div className="text-2xl font-display font-bold text-accent-red">{stats.goalsAgainst}</div>
                      <div className="text-[10px] mt-1" style={{color:'#94a3b8'}}>Kebobolan</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div>
        <h2 className="font-display font-semibold text-base mb-3 flex items-center gap-2" style={{color:'#0f172a'}}>
          <Swords size={16} className="text-brand-600" /> Riwayat Pertandingan
        </h2>
        {matches.length === 0 ? (
          <div className="card p-8 text-center text-sm" style={{color:'#94a3b8'}}>Belum ada pertandingan</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y" style={{borderColor:'#e2e8f0'}}>
              {matches.map(m => {
                const isHome = m.home_team_id === id
                const myScore  = isHome ? m.home_score : m.away_score
                const oppScore = isHome ? m.away_score : m.home_score
                const result   = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D'
                const resultBadge = result === 'W' ? 'badge-green' : result === 'L' ? 'badge-red' : 'badge-gray'
                return (
                  <div key={m.id} className="flex items-center px-5 py-3 gap-3 table-row-hover">
                    <div className="w-[35%] text-right text-sm font-medium truncate" style={{color:'#0f172a'}}>{m.home_team_name}</div>
                    <div className="font-display font-bold text-base rounded-lg px-3 py-1 w-[80px] text-center shrink-0 border" style={{backgroundColor:'#f1f5f9', borderColor:'#e2e8f0', color:'#0f172a'}}>
                      {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '–'}
                    </div>
                    <div className="w-[35%] text-left text-sm font-medium truncate" style={{color:'#0f172a'}}>{m.away_team_name}</div>
                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      <span className={`hidden sm:inline-flex badge ${m.season_type === 'champions' ? 'badge-purple' : m.season_type === 'cup' ? 'badge-yellow' : 'badge-blue'}`}>
                        {m.season_name}
                      </span>
                      <span className={`badge ${resultBadge}`}>{result}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
