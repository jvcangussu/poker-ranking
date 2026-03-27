'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Group = {
  id: string
  code: string
  name: string
  created_at: string
}

export default function HomePage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGroups() {
      const { data, error } = await supabase
        .from('groups')
        .select('id, code, name, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        setError(error.message)
      } else {
        setGroups(data ?? [])
      }

      setLoading(false)
    }

    loadGroups()
  }, [])

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Poker Ranking</h1>

      {loading && <p>Carregando...</p>}
      {error && <p className="text-red-600">Erro: {error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <p>Nenhum grupo encontrado.</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="border rounded-xl p-4">
                <p><strong>Nome:</strong> {group.name}</p>
                <p><strong>Código:</strong> {group.code}</p>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  )
}