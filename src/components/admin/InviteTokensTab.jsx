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
    const { error } = await supabase.from('invite_tokens').insert({
      token,
      label: label.trim() || null
    })
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
        <h2 className="font-display font-semibold text-base">Token Undangan</h2>
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
        <div className="card p-6 text-center text-white/30 text-sm">Memuat...</div>
      ) : tokens.length === 0 ? (
        <div className="card p-6 text-center text-white/30 text-sm">Belum ada token</div>
      ) : (
        <div className="card overflow-hidden divide-y divide-white/5">
          {tokens.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold tracking-widest text-brand-300">{t.token}</span>
                  {t.used && <span className="badge-gray text-xs">Terpakai</span>}
                  {!t.used && <span className="badge-green text-xs">Aktif</span>}
                </div>
                {t.label && <div className="text-xs text-white/40 mt-0.5">{t.label}</div>}
                {t.used && t.used_by_profile && (
                  <div className="text-xs text-white/30 mt-0.5">Dipakai oleh: @{t.used_by_profile.username}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!t.used && (
                  <button onClick={() => copyToken(t.token)} className="p-1.5 text-white/40 hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-colors" title="Salin">
                    {copied === t.token ? <Check size={15} className="text-accent-green" /> : <Copy size={15} />}
                  </button>
                )}
                <button onClick={() => deleteToken(t.id)} className="p-1.5 text-white/40 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors" title="Hapus">
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
