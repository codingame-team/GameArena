import { describe, it, expect, vi, beforeEach } from 'vitest'
import useGameRunner from './useGameRunner'
import axios from 'axios'

vi.mock('axios')

describe('useGameRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('collectFullHistory collects entries until finished and falls back to /history when needed', async () => {
    // Simulate two POST responses: one history_entry, then a finished response
    axios.post.mockResolvedValueOnce({ data: { history_entry: { turn: 1, stdout: 's1', stderr: '' } } })
    axios.post.mockResolvedValueOnce({ data: { finished: true, history: [{ turn: 1, stdout: 's1' }], stdout: 'GLOBAL', stderr: '' } })

    const appendLog = vi.fn()
    const collectingRef = { current: false }
    const animatingRef = { current: false }
    const pausedRef = { current: false }
    const stoppedRef = { current: false }
    const animationDelayRef = { current: 0 }
    const setIsCollecting = vi.fn()

    const hook = useGameRunner({
      API_BASE: '',
      appendLog,
      collectingRef,
      animatingRef,
      pausedRef,
      stoppedRef,
      animationDelayRef,
      setIsCollecting,
      setIsAnimating: () => {},
      setIsPaused: () => {},
      setHistory: () => {},
      setFullHistory: () => {},
      setCombinedLogs: () => {},
      setCurrentIndex: () => {}
    })

    const collected = await hook.collectFullHistory('gid')
    expect(Array.isArray(collected)).toBe(true)
    // Ensure setIsCollecting was toggled on and off
    expect(setIsCollecting).toHaveBeenCalled()
    // ensure axios.post was called at least once
    expect(axios.post).toHaveBeenCalled()
  })

  it('animateCollected updates setters and respects globals', async () => {
    const collected = [
      { __global_stdout: 'G1' },
      { stdout: 's1', stderr: 'e1' }
    ]
    const animatingRef = { current: false }
    const pausedRef = { current: false }
    const stoppedRef = { current: false }
    const animationDelayRef = { current: 0 }

    const setIsAnimating = vi.fn()
    const setIsPaused = vi.fn()
    const setHistory = vi.fn()
    const setCombinedLogs = vi.fn()
    const setCurrentIndex = vi.fn()

    const hook = useGameRunner({
      API_BASE: '',
      appendLog: () => {},
      collectingRef: { current: false },
      animatingRef,
      pausedRef,
      stoppedRef,
      animationDelayRef,
      setIsCollecting: () => {},
      setIsAnimating,
      setIsPaused,
      setHistory,
      setFullHistory: () => {},
      setCombinedLogs,
      setCurrentIndex
    })

    await hook.animateCollected(collected, -1)

    expect(setIsAnimating).toHaveBeenCalled()
    expect(setHistory).toHaveBeenCalled()
    expect(setCombinedLogs).toHaveBeenCalled()
    expect(setCurrentIndex).toHaveBeenCalled()
  })
})
