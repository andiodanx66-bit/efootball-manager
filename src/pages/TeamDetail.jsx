import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Swords, Gamepad2, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
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
      supabase.from('matches')
        .select('*, home_team:teams!home_team_id(id,name), away_team:teams!away_team_id(id,name), season:seasons(name,type)')
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
      <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> Kembali
      </button>

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
            <span className="flex items-center gap-1.5 text-xs text-white/40">
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

      {/* Match history */}
      <div>
        <h2 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
          <Swords size={16} className="text-brand-400" /> Riwayat Pertandingan
        </h2>
        {matches.length === 0 ? (
          <div className="card p-8 text-center text-white/30 text-sm">Belum ada pertandingan</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-white/5">
              {matches.map(m => {
                const isHome = m.home_team_id === id
                const myScore  = isHome ? m.home_score : m.away_score
                const oppScore = isHome ? m.away_score : m.home_score
                const result   = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D'
                const resultBadge = result === 'W' ? 'badge-green' : result === 'L' ? 'badge-red' : 'badge-gray'
                return (
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
