import { useEffect, useState } from 'react'
import { Trophy, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function MyTrophiesPage() {
  const { user } = useAuth()
  const [trophies, setTrophies] = useState([])
  const [loading, setLoading] = useState(true)
  const [myTeamId, setMyTeamId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [user?.id])

  async function fetchData() {
    setLoading(true)
    if (user?.id) {
      const { data: teamData } = await supabase.from('teams').select('id').eq('owner_id', user.id).maybeSingle()
      const teamId = teamData?.id || null
      setMyTeamId(teamId)

      const { data: trophyData } = teamId
        ? await supabase
            .from('trophies')
            .select('id, title, image_url, created_at, team:teams(id, name, logo_url), season:seasons(id, name, season_group)')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false })
        : { data: [] }

      setTrophies(trophyData || [])
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="h-8 w-48 bg-surface-border rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="space-y-3">
            <div className="aspect-square bg-surface-border rounded-xl animate-pulse" />
            <div className="h-3 bg-surface-border rounded-full animate-pulse" />
            <div className="h-2 bg-surface-border rounded-full w-2/3 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!myTeamId) return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-muted transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="section-title">Trofi Saya</h1>
          <p className="text-ink-muted text-sm mt-1">Koleksi trofi tim Anda</p>
        </div>
      </div>
      <div className="card p-12 text-center">
        <Trophy size={40} className="text-ink-faint mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium text-ink">Anda belum memiliki tim</p>
        <p className="text-xs text-ink-faint mt-1">Daftarkan tim terlebih dahulu untuk mulai mengumpulkan trofi.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-muted transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="section-title">Trofi Saya</h1>
          <p className="text-ink-muted text-sm mt-1">Koleksi trofi tim Anda</p>
        </div>
      </div>

      {trophies.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy size={40} className="text-ink-faint mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-ink">Belum ada trofi</p>
          <p className="text-xs text-ink-faint mt-1">Terus berjuang untuk meraih kemenangan!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {trophies.map((item) => (
            <div key={item.id} className="space-y-3">
              <div className="aspect-square bg-surface-muted rounded-xl overflow-hidden shadow-md">
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-brand-600 font-semibold">{item.title}</p>
                <p className="text-sm text-ink-muted truncate">{item.season?.name || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
