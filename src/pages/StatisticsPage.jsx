import { useEffect, useState } from 'react'
import { Swords, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function StatisticsPage() {
  const [seasons,   setSeasons]   = useState([])
  const [selected,  setSelected]  = useState('all')
  const [teamStats, setTeamStats] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('seasons').select('id,name').then(({ data }) => {
      setSeasons(data || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { fetchStats() }, [selected])

  async function fetchStats() {
    // Team stats from standings
    let sq = supabase.from('standings').select('*')
    if (selected !== 'all') sq = sq.eq('season_id', selected)
    const { data: st } = await sq
    const teamMap = {}
    ;(st || []).forEach(row => {
      const k = row.team_id
      if (!teamMap[k]) teamMap[k] = { team_name: row.team_name, played: 0, won: 0, gf: 0, ga: 0, pts: 0 }
      teamMap[k].played += parseInt(row.played) || 0
      teamMap[k].won    += parseInt(row.won)    || 0
      teamMap[k].gf     += parseInt(row.gf)     || 0
      teamMap[k].ga     += parseInt(row.ga)     || 0
      teamMap[k].pts    += parseInt(row.pts)    || 0
    })
    setTeamStats(Object.values(teamMap).sort((a, b) => b.pts - a.pts).slice(0, 10))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title">Statistik</h1>
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap bg-pitch-mid p-1 rounded-xl w-fit">
        <button onClick={() => setSelected('all')}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all ${selected === 'all' ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white'}`}>
          Semua
        </button>
        {seasons.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all ${selected === s.id ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white'}`}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Team performance */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Star size={17} className="text-brand-400" />
            <span className="font-display font-semibold">Performa Tim</span>
          </div>
          {teamStats.length === 0 ? (
            <div className="p-8 text-center text-white/20 text-sm">Belum ada data</div>
          ) : (
            <div className="divide-y divide-white/5">
              {teamStats.map((t, i) => (
                <div key={t.team_name} className="flex items-center gap-3 px-5 py-3 table-row-hover">
                  <span className="w-6 text-center font-mono text-xs text-white/30">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center text-xs font-bold font-display text-brand-400">
                    {t.team_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{t.team_name}</div>
                    <div className="text-xs text-white/40">{t.played} main · {t.won} menang · {t.gf} gol</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-lg text-brand-400">{t.pts}</div>
                    <div className="text-xs text-white/30">pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
