import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, User, Swords } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function TeamDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [team,    setTeam]    = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select('*, owner:profiles!owner_id(username, id, avatar_url)').eq('id', id).single(),
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(id,name), away_team:teams!away_team_id(id,name), season:seasons(name)')
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .eq('status', 'approved')
        .order('match_date', { ascending: false })
    ])
    setTeam(t)
    setMatches(m || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!team) return <div className="text-white/40 p-8">Tim tidak ditemukan</div>

  const avatar = team.owner?.avatar_url

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/teams" className="text-white/40 hover:text-white text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> Kembali
      </Link>

      {/* Header */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-2xl font-display font-bold text-brand-400 overflow-hidden">
          {avatar
            ? <img src={avatar} alt="logo" className="w-full h-full object-cover" />
            : team.name[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">{team.name}</h1>
          <p className="text-white/40 text-sm mt-1 flex items-center gap-1">
            <User size={13} /> {team.owner?.username}
          </p>
        </div>
      </div>

      {/* Match history */}
      <div>
        <h2 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
          <Swords size={16} className="text-brand-400" /> Riwayat Pertandingan
        </h2>
        {matches.length === 0 ? (
          <div className="card p-8 text-center text-white/30 text-sm">Belum ada pertandingan</div>
        ) : (
          <div className="card overflow-hidden divide-y divide-white/5">
            {matches.map(m => {
              const isHome = m.home_team_id === id
              const opponent = isHome ? m.away_team : m.home_team
              const myScore  = isHome ? m.home_score : m.away_score
              const oppScore = isHome ? m.away_score : m.home_score
              const result   = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D'
              const resultColor = result === 'W' ? 'text-accent-green' : result === 'L' ? 'text-accent-red' : 'text-accent-yellow'
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <span className={`w-6 text-center font-display font-bold text-sm ${resultColor}`}>{result}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">vs {opponent?.name}</div>
                    <div className="text-xs text-white/40">{m.season?.name}</div>
                  </div>
                  <div className="font-display font-bold text-base bg-pitch-dark rounded-lg px-3 py-1 min-w-[56px] text-center">
                    {myScore} – {oppScore}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
