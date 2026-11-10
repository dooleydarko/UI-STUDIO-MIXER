import Cocoa
import CoreGraphics

func drawSquircleBackground(ctx: CGContext, rect: CGRect, c1: NSColor, c2: NSColor, borderColor: NSColor) {
    let radius = rect.width * 0.22
    let path = CGPath(roundedRect: rect.insetBy(dx: 16, dy: 16), cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()

    let colors = [c1.cgColor, c2.cgColor] as CFArray
    let space = CGColorSpaceCreateDeviceRGB()
    if let grad = CGGradient(colorsSpace: space, colors: colors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: rect.height), end: CGPoint(x: rect.width, y: 0), options: [])
    }
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addPath(path)
    ctx.setStrokeColor(borderColor.cgColor)
    ctx.setLineWidth(14)
    ctx.strokePath()
    ctx.restoreGState()
}

func drawUiStudioIcon(size: CGFloat) -> NSImage {
    let img = NSImage(size: NSSize(width: size, height: size))
    img.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        img.unlockFocus()
        return img
    }
    let scale = size / 512.0
    ctx.scaleBy(x: scale, y: scale)

    drawSquircleBackground(
        ctx: ctx,
        rect: CGRect(x: 0, y: 0, width: 512, height: 512),
        c1: NSColor(calibratedRed: 0.04, green: 0.04, blue: 0.06, alpha: 1.0),
        c2: NSColor(calibratedRed: 0.20, green: 0.07, blue: 0.42, alpha: 1.0),
        borderColor: NSColor(calibratedRed: 0.66, green: 0.33, blue: 0.97, alpha: 0.65)
    )

    // Back card (top-left in screen coords -> higher Y in CoreGraphics)
    let card1 = CGPath(roundedRect: CGRect(x: 112, y: 210, width: 210, height: 156), cornerWidth: 26, cornerHeight: 26, transform: nil)
    ctx.setFillColor(NSColor(calibratedRed: 0.12, green: 0.11, blue: 0.30, alpha: 0.95).cgColor)
    ctx.addPath(card1)
    ctx.fillPath()
    ctx.setStrokeColor(NSColor(calibratedRed: 0.66, green: 0.33, blue: 0.97, alpha: 1.0).cgColor)
    ctx.setLineWidth(10)
    ctx.addPath(card1)
    ctx.strokePath()

    // Pink dot & bar on card1
    ctx.setFillColor(NSColor(calibratedRed: 0.93, green: 0.28, blue: 0.60, alpha: 1.0).cgColor)
    ctx.fillEllipse(in: CGRect(x: 146, y: 314, width: 28, height: 28))
    ctx.setStrokeColor(NSColor(calibratedRed: 0.91, green: 0.84, blue: 1.0, alpha: 0.9).cgColor)
    ctx.setLineCap(.round)
    ctx.setLineWidth(12)
    ctx.move(to: CGPoint(x: 194, y: 328))
    ctx.addLine(to: CGPoint(x: 286, y: 328))
    ctx.strokePath()

    // Front card (bottom-right)
    let card2 = CGPath(roundedRect: CGRect(x: 190, y: 132, width: 214, height: 162), cornerWidth: 26, cornerHeight: 26, transform: nil)
    ctx.setFillColor(NSColor(calibratedRed: 0.06, green: 0.09, blue: 0.17, alpha: 0.96).cgColor)
    ctx.addPath(card2)
    ctx.fillPath()
    ctx.setStrokeColor(NSColor(calibratedRed: 0.06, green: 0.73, blue: 0.51, alpha: 1.0).cgColor)
    ctx.setLineWidth(10)
    ctx.addPath(card2)
    ctx.strokePath()

    // Checkmark on card2
    ctx.setStrokeColor(NSColor(calibratedRed: 0.13, green: 0.83, blue: 0.58, alpha: 1.0).cgColor)
    ctx.setLineWidth(16)
    ctx.setLineJoin(.round)
    ctx.move(to: CGPoint(x: 244, y: 212))
    ctx.addLine(to: CGPoint(x: 284, y: 174))
    ctx.addLine(to: CGPoint(x: 356, y: 246))
    ctx.strokePath()

    img.unlockFocus()
    return img
}

func drawEngineFoundryIcon(size: CGFloat) -> NSImage {
    let img = NSImage(size: NSSize(width: size, height: size))
    img.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else {
        img.unlockFocus()
        return img
    }
    let scale = size / 512.0
    ctx.scaleBy(x: scale, y: scale)

    drawSquircleBackground(
        ctx: ctx,
        rect: CGRect(x: 0, y: 0, width: 512, height: 512),
        c1: NSColor(calibratedRed: 0.01, green: 0.03, blue: 0.09, alpha: 1.0),
        c2: NSColor(calibratedRed: 0.03, green: 0.21, blue: 0.28, alpha: 1.0),
        borderColor: NSColor(calibratedRed: 0.02, green: 0.71, blue: 0.83, alpha: 0.75)
    )

    // Compute Pins
    ctx.setLineCap(.round)
    ctx.setLineWidth(12)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.13, green: 0.83, blue: 0.93, alpha: 1.0).cgColor)
    let pins: [(CGPoint, CGPoint)] = [
        (CGPoint(x: 256, y: 452), CGPoint(x: 256, y: 406)),
        (CGPoint(x: 256, y: 60), CGPoint(x: 256, y: 106)),
        (CGPoint(x: 84, y: 356), CGPoint(x: 124, y: 332)),
        (CGPoint(x: 428, y: 156), CGPoint(x: 388, y: 180)),
        (CGPoint(x: 84, y: 156), CGPoint(x: 124, y: 180)),
        (CGPoint(x: 428, y: 356), CGPoint(x: 388, y: 332)),
    ]
    for (p1, p2) in pins {
        ctx.move(to: p1)
        ctx.addLine(to: p2)
        ctx.strokePath()
    }

    // Hexagon Core
    let hex = CGMutablePath()
    let pts = [
        CGPoint(x: 256, y: 406),
        CGPoint(x: 388, y: 332),
        CGPoint(x: 388, y: 180),
        CGPoint(x: 256, y: 106),
        CGPoint(x: 124, y: 180),
        CGPoint(x: 124, y: 332),
    ]
    hex.move(to: pts[0])
    for p in pts.dropFirst() { hex.addLine(to: p) }
    hex.closeSubpath()

    ctx.setFillColor(NSColor(calibratedRed: 0.04, green: 0.09, blue: 0.16, alpha: 1.0).cgColor)
    ctx.addPath(hex)
    ctx.fillPath()

    ctx.setStrokeColor(NSColor(calibratedRed: 0.13, green: 0.83, blue: 0.93, alpha: 1.0).cgColor)
    ctx.setLineWidth(12)
    ctx.setLineJoin(.round)
    ctx.addPath(hex)
    ctx.strokePath()

    // Inner Turbine Circle
    let circleRect = CGRect(x: 184, y: 184, width: 144, height: 144)
    ctx.setFillColor(NSColor(calibratedRed: 0.03, green: 0.18, blue: 0.29, alpha: 1.0).cgColor)
    ctx.fillEllipse(in: circleRect)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.22, green: 0.90, blue: 0.72, alpha: 1.0).cgColor)
    ctx.setLineWidth(9)
    ctx.strokeEllipse(in: circleRect)

    // Lightning Bolt
    let bolt = CGMutablePath()
    bolt.move(to: CGPoint(x: 268, y: 318))
    bolt.addLine(to: CGPoint(x: 222, y: 248))
    bolt.addLine(to: CGPoint(x: 262, y: 248))
    bolt.addLine(to: CGPoint(x: 244, y: 194))
    bolt.addLine(to: CGPoint(x: 292, y: 262))
    bolt.addLine(to: CGPoint(x: 252, y: 262))
    bolt.closeSubpath()
    ctx.setFillColor(NSColor(calibratedRed: 0.13, green: 0.88, blue: 0.96, alpha: 1.0).cgColor)
    ctx.addPath(bolt)
    ctx.fillPath()

    img.unlockFocus()
    return img
}

func writePng(image: NSImage, to url: URL) throws {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "IconGen", code: 1)
    }
    try png.write(to: url)
}

func buildIconset(name: String, outDir: URL, drawer: (CGFloat) -> NSImage) throws {
    let iconsetDir = outDir.appendingPathComponent("\(name).iconset")
    try FileManager.default.createDirectory(at: iconsetDir, withIntermediateDirectories: true)
    let specs: [(String, CGFloat)] = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    for (filename, px) in specs {
        let img = drawer(px)
        try writePng(image: img, to: iconsetDir.appendingPathComponent(filename))
    }
}

let args = CommandLine.arguments
let outPath = args.count > 1 ? args[1] : FileManager.default.currentDirectoryPath
let outURL = URL(fileURLWithPath: outPath)

try buildIconset(name: "UIStudio", outDir: outURL, drawer: drawUiStudioIcon)
try buildIconset(name: "EngineFoundry", outDir: outURL, drawer: drawEngineFoundryIcon)
print("Generated iconsets in \(outURL.path)")
