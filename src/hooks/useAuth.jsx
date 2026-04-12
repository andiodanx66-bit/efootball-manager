import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function signUp(email, password, username, teamName, token, whatsapp) {
    // Validasi token
    const { data: tokenData, error: tokenError } = await supabase
      .from('invite_tokens')
      .select('id, used')
      .eq('token', token.trim())
      .single()

    if (tokenError || !tokenData) return { data: null, error: { message: 'Token tidak valid.' } }
    if (tokenData.used) return { data: null, error: { message: 'Token sudah digunakan.' } }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    })

    if (!error && data.user) {
      try {
        await new Promise(r => setTimeout(r, 1000))

        const { data: existingProfile } = await supabase
          .from('profiles').select('id').eq('id', data.user.id).single()

        if (!existingProfile) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            username: username || email.split('@')[0],
            whatsapp: whatsapp || null,
            role: 'player'
          })
        }

        // Buat tim langsung approved
        if (teamName) {
          await supabase.from('teams').insert({
            name: teamName.trim(),
            owner_id: data.user.id,
            status: 'approved'
          })
        }

        // Mark token as used
        await supabase.from('invite_tokens')
          .update({ used: true, used_by: data.user.id })
          .eq('id', tokenData.id)

      } catch (err) {
        console.warn('Post-signup setup:', err.message)
      }
    }

    return { data, error }
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signUp, signIn, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
