import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { loadBattleScreen } from './src/ui/battle/battleScreenLoader'

// @testing-library/react solo sabe que hay temporizadores falsos si existe el global `jest`; sin él, su asyncWrapper espera un
// setTimeout(0) que nunca se dispara y cualquier `await user.click(...)` con vi.useFakeTimers() se queda colgado.
Object.assign(globalThis, { jest: { advanceTimersByTime: (milliseconds: number) => vi.advanceTimersByTime(milliseconds) } })

// La pantalla de combate se carga aparte en la web (E2E-21); en los tests, ya cargada, como en la web tras traerla en reposo.
await loadBattleScreen()
