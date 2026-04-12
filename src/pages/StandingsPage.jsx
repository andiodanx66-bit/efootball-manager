import { useEffect, useState } from 'react'
import { BarChart2, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function StandingsPage() {
  const [seasons,  setSeasons]  = useState([])
  const [selected, setSelected] = useState('')
  const [season,   setSeason]   = useState(null)
  const [standings, setStandings] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.from('seasons').select('*').eq('status', 'active').then(({ data }) => {
      const all = data || []
      setSeasons(all)
      if (all.length > 0) setSelected(all[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    const s = seasons.find(s => s.id === selected)
    setSeason(s)
    supabase.from('standings').select('*').eq('season_id', selected).then(({ data }) => {
      setStandings(data || [])
    })
  }, [selected])

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>

  const groups = [...new Set(standings.map(s => s.group_id).filter(Boolean))]
  const isGrouped = groups.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title">Klasemen</h1>
        <p className="text-white/50 text-sm mt-1">Poin, selisih gol, dan posisi tim</p>
      </div>

      {seasons.length === 0 ? (
        <div className="card p-12 text-center text-white/30">
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p>Belum ada kompetisi aktif</p>
        </div>
      ) : (
        <>
          {/* Season selector */}
          <div className="flex gap-1 flex-wrap bg-pitch-mid p-1 rounded-xl w-fit">
            {seasons.map(s => (
              <button key={s.id} onClick={() => setSelected(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all ${selected === s.id ? 'bg-brand-600 text-white' : 'text-white/50 hover:text-white'}`}>
                {s.name}
              </button>
            ))}
          </div>

          {isGrouped ? (
            <div className="space-y-4">
              {groups.map(g => (
                <div key={g} className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 bg-pitch-dark/50 flex items-center gap-2">
                    <span className="font-display font-bold text-accent-purple">GRUP {g}</span>
                  </div>
                  <StandingsTable rows={standings.filter(s => s.group_id === g)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 bg-pitch-dark/50">
                <span className="font-display font-bold text-sm text-brand-400 uppercase tracking-wider">{season?.name}</span>
              </div>
              <StandingsTable rows={standings} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StandingsTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-xs font-mono uppercase tracking-wider border-b border-white/5">
            <th className="text-left px-5 py-3 w-8">#</th>
            <th className="text-left px-2 py-3">Tim</th>
            <th className="px-3 py-3 text-center">M</th>
            <th className="px-3 py-3 text-center text-accent-green">W</th>
            <th className="px-3 py-3 text-center">D</th>
            <th className="px-3 py-3 text-center text-accent-red">L</th>
            <th className="px-3 py-3 text-center">GF</th>
            <th className="px-3 py-3 text-center">GA</th>
            <th className="px-3 py-3 text-center">GD</th>
            <th className="px-3 py-3 text-center text-brand-400 font-bold">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={r.team_id} className={`table-row-hover ${i < 4 ? 'border-l-2 border-l-brand-500/30' : ''}`}>
              <td className="px-5 py-3 text-white/40 font-mono text-xs text-center">{i + 1}</td>
              <td className="px-2 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-bold text-brand-400">
                    {r.team_name?.[0]}
                  </div>
                  <span className="font-medium">{r.team_name}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-center text-white/60">{r.played}</td>
              <td className="px-3 py-3 text-center text-accent-green font-medium">{r.won}</td>
              <td className="px-3 py-3 text-center text-white/60">{r.drawn}</td>
              <td className="px-3 py-3 text-center text-accent-red">{r.lost}</td>
              <td className="px-3 py-3 text-center text-white/60">{r.gf}</td>
              <td className="px-3 py-3 text-center text-white/60">{r.ga}</td>
              <td className="px-3 py-3 text-center text-white/50 font-mono text-xs">
                {r.gd > 0 ? `+${r.gd}` : r.gd}
              </td>
              <td className="px-3 py-3 text-center font-display font-bold text-lg text-brand-400">{r.pts}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={10} className="text-center py-10 text-white/20 text-sm">Belum ada data klasemen</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
