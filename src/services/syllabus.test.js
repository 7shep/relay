import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDocument = vi.hoisted(() => vi.fn())

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument,
}))

import { readSyllabusFile } from './syllabus.js'

describe('syllabus file reader', () => {
  beforeEach(() => getDocument.mockReset())

  it('preserves PDF archive bytes when PDF.js detaches the parser buffer', async () => {
    getDocument.mockImplementation((options = {}) => {
      const { data } = options
      if (data) {
        const transferable = data instanceof ArrayBuffer ? data : data.buffer
        structuredClone(data, { transfer: [transferable] })
      }
      return {
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({ items: [{ str: 'CISC301' }] }),
          }),
        }),
      }
    })

    const source = new TextEncoder().encode('%PDF').buffer
    const result = await readSyllabusFile({
      name: 'syllabus.pdf',
      arrayBuffer: async () => source,
    })

    expect(getDocument).toHaveBeenCalledWith({ data: expect.any(ArrayBuffer) })
    expect(result).toMatchObject({
      originalBytesBase64: 'JVBERg==',
      byteLength: 4,
      text: 'CISC301',
      parseStatus: 'parsed',
    })
  })
})
