import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ChevronRight, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

function WaIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

export default function TeamsPage() {
  const [teams,   setTeams]   = useState([])
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(null)

  useEffect(() => { fetchTeams() }, [])

  async function fetchTeams() {
    const { data } = await supabase
      .from('teams')
      .select('*, owner:profiles!owner_id(username, avatar_url, whatsapp, efootball_id)')
      .eq('status', 'approved')
      .order('name')
    setTeams(data || [])
    setLoading(false)
  }

  function copyId(id) {
    navigator.clipboard.writeText(id)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title">Tim</h1>
        <p className="text-white/50 text-sm mt-1">{teams.length} tim terdaftar</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}</div>
      ) : (
        <div className="card overflow-hidden">
          {teams.length === 0 ? (
            <div className="p-10 text-center text-white/30">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada tim terdaftar</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {teams.map((team, i) => (
                <div key={team.id} className="flex items-center gap-4 px-5 py-3.5 table-row-hover">
                  <span className="w-6 text-center text-white/30 font-mono text-xs">{i + 1}</span>
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold font-display text-brand-400 overflow-hidden shrink-0">
                    {team.owner?.avatar_url
                      ? <img src={team.owner.avatar_url} alt={team.name} className="w-full h-full object-cover" />
                      : team.name[0].toUpperCase()}
                  </div>
                  <Link to={`/teams/${team.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-sm">{team.name}</span>
                      {team.owner?.whatsapp && (
                        <a href={`https://kirimwa.id/${team.owner.whatsapp.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-accent-green hover:text-accent-green/70 transition-colors shrink-0"
                          title="Chat WhatsApp"
                          onClick={e => e.stopPropagation()}>
                          <WaIcon size={16} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/40">@{team.owner?.username}</span>
                      {team.owner?.efootball_id && (
                        <button
                          onClick={e => { e.preventDefault(); copyId(team.owner.efootball_id) }}
                          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                          title="Copy ID eFootball">
                          <span className="font-mono">{team.owner.efootball_id}</span>
                          {copied === team.owner.efootball_id
                            ? <Check size={11} className="text-accent-green" />
                            : <Copy size={11} />}
                        </button>
                      )}
                    </div>
                  </Link>
                  <Link to={`/teams/${team.id}`}>
                    <ChevronRight size={15} className="text-white/30" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
