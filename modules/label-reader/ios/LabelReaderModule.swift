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

    // uri: a photo on the phone (file://…). Returns { lines: [{ text, x, y, w, h }], barcodes: [String] },
    // with positions as fractions of the picture, measured from its top-left corner.
    AsyncFunction("scan") { (uri: String) -> [String: Any] in
      guard let url = URL(string: uri),
        let data = try? Data(contentsOf: url),
        let image = UIImage(data: data),
        let cgImage = image.cgImage
      else {
        throw PhotoUnreadableException()
      }

      let textRequest = VNRecognizeTextRequest()
      textRequest.recognitionLevel = .accurate
      // Numbers must be read as they are printed, not "corrected" into words.
      textRequest.usesLanguageCorrection = false
      let barcodeRequest = VNDetectBarcodesRequest()

      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: LabelReaderModule.orientation(of: image),
        options: [:]
      )
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

  // Photos from the camera are stored sideways with a note saying which way is up.
  private static func orientation(of image: UIImage) -> CGImagePropertyOrientation {
    switch image.imageOrientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
