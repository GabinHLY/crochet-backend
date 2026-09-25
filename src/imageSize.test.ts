import { imageSize } from './imageSize'

describe('taille des images', () => {
  it('lit les dimensions PNG et JPEG', () => {
    const png = Buffer.alloc(32)
    png.writeUInt32BE(0x89504e47, 0)
    png.writeUInt32BE(640, 16)
    png.writeUInt32BE(480, 20)
    expect(imageSize(png)).toEqual({ width: 640, height: 480 })
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x76, 0x04, 0xb0, 0x03])
    expect(imageSize(jpeg)).toEqual({ width: 1200, height: 630 })
    expect(imageSize(Buffer.from('pas une image'))).toBeUndefined()
  })
})
