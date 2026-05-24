import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const source = join(root, "public/brand/gladwell-logo-wordmark.png")
const background = { r: 10, g: 10, b: 20, alpha: 1 }

const meta = await sharp(source).metadata()
const aspect = (meta.width ?? 1) / (meta.height ?? 1)
const isSquare = Math.abs(aspect - 1) < 0.05

async function squareIcon(size) {
  if (isSquare) {
    return sharp(source).resize(size, size, { fit: "contain" }).png().toBuffer()
  }

  const paddingRatio = 0.14
  const inner = Math.round(size * (1 - paddingRatio * 2))

  const resized = await sharp(source)
    .resize(inner, inner, { fit: "inside" })
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer()
}

mkdirSync(join(root, "public"), { recursive: true })
mkdirSync(join(root, "app"), { recursive: true })

const outputs = [
  { path: join(root, "public/icon-dark-32x32.png"), size: 32 },
  { path: join(root, "public/icon-light-32x32.png"), size: 32 },
  { path: join(root, "public/apple-icon.png"), size: 180 },
  { path: join(root, "app/icon.png"), size: 512 },
]

for (const { path, size } of outputs) {
  const buffer = await squareIcon(size)
  await sharp(buffer).toFile(path)
  console.log(`Wrote ${path.replace(root + "/", "")}`)
}

console.log(
  `Favicons generated from public/brand/gladwell-logo-wordmark.png (${isSquare ? "square" : "wide"} source)`,
)
