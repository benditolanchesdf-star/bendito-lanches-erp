/**
 * Hook de registro do Service Worker + detecção de instalação PWA
 */
'use client'

import { useEffect, useState } from 'react'

export function usePWA() {
  const [instalavel, setInstalavel] = useState(false)
  const [instalado, setInstalado] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [swRegistrado, setSwRegistrado] = useState(false)
  const [atualizacao, setAtualizacao] = useState(false)

  useEffect(() => {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        setSwRegistrado(true)
        // Detectar atualização disponível
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setAtualizacao(true)
            }
          })
        })
      }).catch(console.error)
    }

    // Detectar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalado(true)
    }

    // Capturar prompt de instalação
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setInstalavel(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: detectar se pode instalar
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = (window.navigator as any).standalone
    if (isIOS && !isStandalone) setInstalavel(true)

    window.addEventListener('appinstalled', () => {
      setInstalado(true)
      setInstalavel(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function instalar() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') setInstalado(true)
    return outcome === 'accepted'
  }

  function atualizarApp() {
    navigator.serviceWorker.getRegistration().then(reg => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    })
  }

  return { instalavel, instalado, instalar, swRegistrado, atualizacao, atualizarApp }
}

export default usePWA
