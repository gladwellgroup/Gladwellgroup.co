import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const source = join(root, "public/brand/gladwell-logo-wordmark.png")
const output = join(root, "public/og/gladwell-og.png")

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const background = { r: 10, g: 10, b: 20, alpha: 1 }
const paddingRatio = 0.1

const innerWidth = Math.round(OG_WIDTH * (1 - paddingRatio * 2))
const innerHeight = Math.round(OG_HEIGHT * (1 - paddingRatio * 2))

const resizedLogo = await sharp(source)
  .resize(innerWidth, innerHeight, { fit: "inside" })
  .toBuffer()

mkdirSync(join(root, "public/og"), { recursive: true })

await sharp({
  create: {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    channels: 4,
    background,
  },
})
  .composite([{ input: resizedLogo, gravity: "center" }])
  .png()
  .toFile(output)

console.log(`Wrote ${output.replace(root + "/", "")} (${OG_WIDTH}x${OG_HEIGHT})`)
