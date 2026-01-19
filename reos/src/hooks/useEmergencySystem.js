import { useCallback, useEffect, useMemo, useState } from 'react'
import { onValue, push, ref, update } from 'firebase/database'
import { db } from '../lib/firebase'

const ALERTS_PATH = 'alerts'

export function useEmergencySystem() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    if (!db) {
      // Mock mode: Sync with localStorage for cross-tab demo support
      const loadFromStorage = () => {
        const stored = localStorage.getItem('reos_alerts')
        if (stored) {
          try {
            setAlerts(JSON.parse(stored))
          } catch (e) {
            console.error('Failed to parse mock alerts', e)
          }
        }
      }

      loadFromStorage()

      const handleStorageChange = (e) => {
        if (e.key === 'reos_alerts') {
          loadFromStorage()
        }
      }

      window.addEventListener('storage', handleStorageChange)
      
      // Also poll for local changes (since storage event only fires on other tabs)
      const interval = setInterval(loadFromStorage, 1000)

      return () => {
        window.removeEventListener('storage', handleStorageChange)
        clearInterval(interval)
      }
    }
    const alertsRef = ref(db, ALERTS_PATH)

    const unsubscribe = onValue(alertsRef, snapshot => {
      const value = snapshot.val() || {}
      const list = Object.entries(value).map(([id, alert]) => ({
        id,
        ...alert,
      }))
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setAlerts(list)
    })

    return () => unsubscribe()
  }, [])

  const sendAlert = useCallback((flat, type, residentName, vitals) => {
    if (!db) {
      // Mock Update with localStorage sync
      const newAlert = {
        id: Date.now().toString(),
        flat,
        type,
        status: 'Active',
        residentName: residentName || 'Unknown',
        vitals,
        timestamp: Date.now(),
      }
      
      const currentAlerts = JSON.parse(localStorage.getItem('reos_alerts') || '[]')
      const updatedAlerts = [newAlert, ...currentAlerts]
      localStorage.setItem('reos_alerts', JSON.stringify(updatedAlerts))
      setAlerts(updatedAlerts)
      return Promise.resolve()
    }

    const alertsRef = ref(db, ALERTS_PATH)
    const payload = {
      flat,
      type,
      status: 'Active',
      residentName: residentName || 'Unknown',
      vitals: vitals || null,
      timestamp: Date.now(),
    }
    return push(alertsRef, payload)
  }, [])

  const resolveAlert = useCallback(id => {
    if (!db) {
      const currentAlerts = JSON.parse(localStorage.getItem('reos_alerts') || '[]')
      const updatedAlerts = currentAlerts.map(alert =>
        alert.id === id ? { ...alert, status: 'Resolved' } : alert
      )
      localStorage.setItem('reos_alerts', JSON.stringify(updatedAlerts))
      setAlerts(updatedAlerts)
      return Promise.resolve()
    }

    const alertRef = ref(db, `${ALERTS_PATH}/${id}`)
    return update(alertRef, { status: 'Resolved' })
  }, [])

  const activeAlerts = useMemo(
    () => alerts.filter(alert => alert.status === 'Active'),
    [alerts],
  )

  const isDemoMode = !db

  const resetDemo = useCallback(() => {
    if (!db) {
      localStorage.removeItem('reos_alerts')
      setAlerts([])
    }
  }, [])

  return {
    alerts,
    activeAlerts,
    sendAlert,
    resolveAlert,
    isDemoMode,
    resetDemo
  }
}

