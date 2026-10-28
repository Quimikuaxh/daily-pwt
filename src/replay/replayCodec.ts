import type { ReplayData } from './replayData'

// Aparte de `replayData.ts` (que va en la carga inicial, por la grabación): solo se carga al terminar un oficial o al abrir una repetición.

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

/** Con `Response` y no `Blob.stream()`: así funciona igual en el navegador y en Node (los tests). */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const output = (new Response(bytes as BodyInit).body as ReadableStream<BufferSource>).pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

/** JSON comprimido con gzip en base64 (unos 3-5 KB por repetición, RF-122). */
export async function encodeReplay(replay: ReplayData): Promise<string> {
  return toBase64(await pipe(new TextEncoder().encode(JSON.stringify(replay)), new CompressionStream('gzip')))
}

export async function decodeReplay(data: string): Promise<ReplayData> {
  const replay = JSON.parse(new TextDecoder().decode(await pipe(fromBase64(data), new DecompressionStream('gzip')))) as ReplayData
  if (replay?.version !== 1 || !Array.isArray(replay.steps) || replay.steps.length === 0) throw new Error('replay_corrupt')
  return replay
}
