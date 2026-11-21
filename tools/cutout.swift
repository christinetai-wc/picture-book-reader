// 用 macOS Vision 的「主體去背」把插畫裡的人物剪成透明 PNG。
// 用法：swift tools/cutout.swift <輸入圖> <輸出資料夾>
// 輸出：<名>_iN.png（每個主體，裁到主體範圍）、<名>_all.png（全部主體），並印出每個主體的範圍（0~1，左上原點）
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { print("用法：swift cutout.swift in.png outdir"); exit(1) }
let inURL = URL(fileURLWithPath: args[1]), outDir = URL(fileURLWithPath: args[2])
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let name = inURL.deletingPathExtension().lastPathComponent

guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil), let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("讀不到圖"); exit(1) }
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { print("\(name): 找不到主體"); exit(0) }
let ctx = CIContext()

func save(_ buf: CVPixelBuffer, _ file: String) {
  let ci = CIImage(cvPixelBuffer: buf)
  guard let out = ctx.createCGImage(ci, from: ci.extent) else { return }
  let url = outDir.appendingPathComponent(file)
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
  CGImageDestinationAddImage(dest, out, nil); CGImageDestinationFinalize(dest)
}

// 每個主體的範圍：從 instanceMask 算
let mask = obs.instanceMask
CVPixelBufferLockBaseAddress(mask, .readOnly)
let mw = CVPixelBufferGetWidth(mask), mh = CVPixelBufferGetHeight(mask), rb = CVPixelBufferGetBytesPerRow(mask)
let base = CVPixelBufferGetBaseAddress(mask)!.assumingMemoryBound(to: UInt8.self)
var boxes: [Int: (Int, Int, Int, Int, Int)] = [:]
for y in 0..<mh { for x in 0..<mw {
  let v = Int(base[y * rb + x]); if v == 0 { continue }
  var b = boxes[v] ?? (mw, mh, 0, 0, 0)
  b = (min(b.0, x), min(b.1, y), max(b.2, x), max(b.3, y), b.4 + 1); boxes[v] = b
} }
CVPixelBufferUnlockBaseAddress(mask, .readOnly)

for i in obs.allInstances.sorted() {
  if let buf = try? obs.generateMaskedImage(ofInstances: IndexSet(integer: i), from: handler, croppedToInstancesExtent: true) { save(buf, "\(name)_i\(i).png") }
  if let b = boxes[i] {
    print(String(format: "%@ i%d  x %.3f-%.3f  y %.3f-%.3f  面積 %.3f", name, i,
                 Double(b.0) / Double(mw), Double(b.2) / Double(mw), Double(b.1) / Double(mh), Double(b.3) / Double(mh), Double(b.4) / Double(mw * mh)))
  }
}
if let buf = try? obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false) { save(buf, "\(name)_all.png") }
