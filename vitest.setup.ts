import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// @testing-library/react solo sabe que hay temporizadores falsos si existe el global `jest`; sin él, su asyncWrapper espera un
// setTimeout(0) que nunca se dispara y cualquier `await user.click(...)` con vi.useFakeTimers() se queda colgado.
Object.assign(globalThis, { jest: { advanceTimersByTime: (milliseconds: number) => vi.advanceTimersByTime(milliseconds) } })
