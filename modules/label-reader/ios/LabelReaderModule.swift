// Reads what is in a photo of a food pack, on the phone itself, with Apple's Vision framework:
// every piece of text with where it sits in the picture (so the app can tell which number is on which
// row of the nutrition table), and any barcodes. Nothing is sent anywhere.

import ExpoModulesCore
import UIKit
import Vision

internal final class PhotoUnreadableException: Exception {
  override var reason: String {
    "The photo could not be opened."
  }
}

public class LabelReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LabelReader")

    // uri: a photo on the phone (file://…).
    // maxSide: shrink the photo so its longest side is at most this many pixels first (0 = keep it as it is);
    //   the live camera checks smaller frames, which is much quicker.
    // deleteAfter: remove the photo once it has been read (the live camera's frames are not kept).
    // Returns { lines: [{ text, x, y, w, h }], barcodes: [String] }, with positions as fractions of the
    // picture, measured from its top-left corner.
    AsyncFunction("scan") { (uri: String, maxSide: Int, deleteAfter: Bool) -> [String: Any] in
      guard let url = URL(string: uri),
        let data = try? Data(contentsOf: url),
        let original = UIImage(data: data)
      else {
        throw PhotoUnreadableException()
      }
      if deleteAfter {
        try? FileManager.default.removeItem(at: url)
      }

      // Redrawing also turns the picture the right way up.
      let image = LabelReaderModule.upright(original, maxSide: CGFloat(maxSide))
      guard let cgImage = image.cgImage else {
        throw PhotoUnreadableException()
      }

      let textRequest = VNRecognizeTextRequest()
      textRequest.recognitionLevel = .accurate
      // Numbers must be read as they are printed, not "corrected" into words.
      textRequest.usesLanguageCorrection = false
      let barcodeRequest = VNDetectBarcodesRequest()

      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
      try handler.perform([textRequest, barcodeRequest])

      var lines: [[String: Any]] = []
      for observation in textRequest.results ?? [] {
        guard let best = observation.topCandidates(1).first else { continue }
        let box = observation.boundingBox  // measured from the bottom-left corner
        lines.append([
          "text": best.string,
          "x": Double(box.minX),
          "y": Double(1 - box.maxY),
          "w": Double(box.width),
          "h": Double(box.height),
        ])
      }

      var barcodes: [String] = []
      for observation in barcodeRequest.results ?? [] {
        if let value = observation.payloadStringValue {
          barcodes.append(value)
        }
      }

      return ["lines": lines, "barcodes": barcodes]
    }
  }

  // The photo drawn the right way up, and no bigger than maxSide pixels on its longest side (when maxSide > 0).
  private static func upright(_ image: UIImage, maxSide: CGFloat) -> UIImage {
    let size = image.size
    let longest = max(size.width, size.height)
    let factor = (maxSide > 0 && longest > maxSide) ? maxSide / longest : 1
    if factor == 1 && image.imageOrientation == .up {
      return image
    }
    let newSize = CGSize(width: floor(size.width * factor), height: floor(size.height * factor))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: newSize))
    }
  }
}
