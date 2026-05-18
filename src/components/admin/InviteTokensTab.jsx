import { useState, useEffect } from 'react'
import { Key, Plus, Copy, Check, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

function generateToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() +
         Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function InviteTokensTab() {
  const [tokens,  setTokens]  = useState([])
  const [label,   setLabel]   = useState('')
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(null)

  useEffect(() => { fetchTokens() }, [])

  async function fetchTokens() {
    const { data } = await supabase
      .from('invite_tokens')
      .select('*, used_by_profile:profiles!used_by(username)')
      .order('created_at', { ascending: false })
    setTokens(data || [])
    setLoading(false)
  }

  async function createToken() {
    const token = generateToken()
    const { error } = await supabase.from('invite_tokens').insert({ token, label: label.trim() || null })
    if (error) alert(error.message)
    else { setLabel(''); fetchTokens() }
  }

  async function deleteToken(id) {
    if (!confirm('Hapus token ini?')) return
    await supabase.from('invite_tokens').delete().eq('id', id)
    fetchTokens()
  }

  function copyToken(token) {
    navigator.clipboard.writeText(token)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Key size={16} className="text-accent-purple" />
        <h2 className="font-display font-semibold text-base" style={{color:'#0f172a'}}>Token Undangan</h2>
      </div>

      {/* Buat token baru */}
      <div className="card p-4 flex gap-3">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="input flex-1 text-sm"
          placeholder="Label (opsional, misal: nama pemain)"
        />
        <button onClick={createToken} className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
          <Plus size={15} /> Buat Token
        </button>
      </div>

      {/* List token */}
      {loading ? (
        <div className="card p-6 text-center text-sm" style={{color:'#94a3b8'}}>Memuat...</div>
      ) : tokens.length === 0 ? (
        <div className="card p-6 text-center text-sm" style={{color:'#94a3b8'}}>Belum ada token</div>
      ) : (
        <div className="card overflow-hidden divide-y" style={{borderColor:'#e2e8f0'}}>
          {tokens.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tracking-widest text-brand-600">{t.token}</span>
                  {t.used
                    ? <span className="badge-gray text-xs">Terpakai</span>
                    : <span className="badge-green text-xs">Aktif</span>}
                </div>
                {t.label && (
                  <div className="text-xs mt-0.5" style={{color:'#94a3b8'}}>{t.label}</div>
                )}
                {t.used && t.used_by_profile && (
                  <div className="text-xs mt-0.5" style={{color:'#94a3b8'}}>
                    Dipakai oleh: @{t.used_by_profile.username}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!t.used && (
                  <button
                    onClick={() => copyToken(t.token)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-brand-50"
                    style={{color:'#94a3b8'}}
                    title="Salin"
                  >
                    {copied === t.token
                      ? <Check size={15} className="text-accent-green" />
                      : <Copy size={15} />}
                  </button>
                )}
                <button
                  onClick={() => deleteToken(t.id)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                  style={{color:'#94a3b8'}}
                  title="Hapus"
                  onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color='#94a3b8'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
