// Background removal with Apple's on-device Vision framework (macOS 14+).
// Deterministic, local, no network. Usage: swift cutout.swift <in> <out.png>
// Writes an RGBA PNG at the input's full resolution: the foreground instances
// Vision finds are kept, everything else becomes transparent.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 3 else { FileHandle.standardError.write("usage: cutout <in> <out.png>\n".data(using: .utf8)!); exit(2) }
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
guard let src = CGImageSourceCreateWithURL(input as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read \(input.path)"); exit(1) }
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([request]) } catch { print("vision failed: \(error)"); exit(1) }
guard let result = request.results?.first, !result.allInstances.isEmpty else { print("no subject found"); exit(3) }
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
let ci = CIImage(cvPixelBuffer: buffer)
let ctx = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
guard let out = ctx.createCGImage(ci, from: ci.extent, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!),
      let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(dest, out, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }
print("ok \(cg.width)x\(cg.height) instances=\(result.allInstances.count)")
