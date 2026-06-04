'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Wifi } from 'lucide-react'

export default function OfflinePage() {
  const [tentando, setTentando] = useState(false)

  function tentar() {
    setTentando(true)
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = '/'
      } else {
        setTentando(false)
      }
    }, 1500)
  }

  useEffect(() => {
    window.addEventListener('online', () => window.location.href = '/')
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="text-center max-w-xs">
        <div className="text-6xl mb-6">🍕</div>
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wifi size={28} className="text-gray-500"/>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Sem conexão</h1>
        <p className="text-gray-400 text-sm mb-8">
          Verifique sua conexão com a internet e tente novamente.
        </p>
        <button onClick={tentar} disabled={tentando}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 py-3 rounded-xl transition mx-auto disabled:opacity-60">
          <RefreshCw size={16} className={tentando ? 'animate-spin' : ''}/>
          {tentando ? 'Tentando...' : 'Tentar novamente'}
        </button>
      </div>
    </div>
  )
}
