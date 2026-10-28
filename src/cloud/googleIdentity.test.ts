// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GOOGLE_CLIENT_ID } from './config'
import { releaseGoogleButton, renderGoogleButton, type GoogleCredential } from './googleIdentity'

// UT-111 · DEC-70: botón oficial de Google, cargado al abrir Cuenta; el nonce va con hash a Google y sin él a Supabase.
function fakeGoogle() {
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  window.google = { accounts: { id } }
  return id
}

/** Lanza el `load` del script de Google en cuanto se añade (jsdom no lo descarga). */
function loadScriptWhenAdded() {
  const observer = new MutationObserver(() => {
    const script = document.head.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (script) script.dispatchEvent(new Event('load'))
  })
  observer.observe(document.head, { childList: true })
  return observer
}

afterEach(() => {
  delete window.google
})

describe('botón de Google (UT-111)', () => {
  it('carga el script una vez, pinta el botón en español y devuelve el token con el nonce cuyo hash recibió Google; tras usarlo, uno nuevo', async () => {
    const id = fakeGoogle()
    const observer = loadScriptWhenAdded()
    const parent = document.createElement('div')
    const received: GoogleCredential[] = []
    const onCredential = (credential: GoogleCredential) => received.push(credential)
    await renderGoogleButton(parent, onCredential)
    observer.disconnect()
    expect(document.head.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')).toHaveLength(1)
    expect(id.renderButton).toHaveBeenCalledWith(parent, expect.objectContaining({ locale: 'es', text: 'signin_with' }))
    const options = id.initialize.mock.calls[0][0]
    expect(options.client_id).toBe(GOOGLE_CLIENT_ID)
    options.callback({ credential: 'id-token' })
    expect(received).toHaveLength(1)
    expect(received[0].token).toBe('id-token')
    expect(createHash('sha256').update(received[0].nonce).digest('hex')).toBe(options.nonce)
    // Otro botón (tras cerrar sesión): mismo script, nonce nuevo.
    await renderGoogleButton(parent, onCredential)
    expect(document.head.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')).toHaveLength(1)
    expect(id.initialize).toHaveBeenCalledTimes(2)
    expect(id.initialize.mock.calls[1][0].nonce).not.toBe(options.nonce)
    // Al cerrar la ventana, la credencial ya no llega.
    releaseGoogleButton(onCredential)
    id.initialize.mock.calls[1][0].callback({ credential: 'otro' })
    expect(received).toHaveLength(1)
  })
})
