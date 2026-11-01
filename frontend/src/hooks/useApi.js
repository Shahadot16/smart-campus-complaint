import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../services/api'

/**
 * Loads data with `fetcher(...deps)` and re-runs when deps change.
 * Ignores responses from stale requests so fast filter changes never flash old data.
 */
export default function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const res = await fetcher()
      if (id !== requestId.current) return
      setData(res.data)
      setMeta(res.meta || null)
    } catch (err) {
      if (id !== requestId.current) return
      setError(errorMessage(err))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  return { data, meta, loading, error, reload: load, setData }
}
