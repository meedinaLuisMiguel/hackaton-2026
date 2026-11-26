const VOICE_SAMPLE_RATE = 16_000
export const MAX_VOICE_DURATION_SECONDS = 30

export async function convertVoiceRecordingToWav(recording: Blob): Promise<Blob> {
  const decoder = new AudioContext()

  try {
    const decoded = await decoder.decodeAudioData(await recording.arrayBuffer())
    if (decoded.duration <= 0 || decoded.duration > MAX_VOICE_DURATION_SECONDS) {
      throw new RangeError('Voice recordings must be 30 seconds or shorter.')
    }

    const frameCount = Math.floor(decoded.duration * VOICE_SAMPLE_RATE)
    const resampler = new OfflineAudioContext(1, frameCount, VOICE_SAMPLE_RATE)
    const source = resampler.createBufferSource()
    source.buffer = decoded
    source.connect(resampler.destination)
    source.start()
    const resampled = await resampler.startRendering()
    const samples = resampled.getChannelData(0)
    const wav = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(wav)

    writeAscii(view, 0, 'RIFF')
    view.setUint32(4, wav.byteLength - 8, true)
    writeAscii(view, 8, 'WAVE')
    writeAscii(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, VOICE_SAMPLE_RATE, true)
    view.setUint32(28, VOICE_SAMPLE_RATE * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeAscii(view, 36, 'data')
    view.setUint32(40, samples.length * 2, true)

    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
      view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true)
    }

    return new Blob([wav], { type: 'audio/wav' })
  } finally {
    await decoder.close()
  }
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
