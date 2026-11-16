Pod::Spec.new do |s|
  s.name           = 'LabelReader'
  s.version        = '1.0.0'
  s.summary        = "Reads the text and the barcodes in a photo, on the phone itself (Apple's Vision)."
  s.description    = "Omniload's label reader: text recognition and barcode detection with Apple's Vision framework. Nothing leaves the phone."
  s.license        = 'MIT'
  s.author         = 'Omniload'
  s.homepage       = 'https://github.com/ray05real/omnifit'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/ray05real/omnifit.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
