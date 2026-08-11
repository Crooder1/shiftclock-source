Pod::Spec.new do |s|
  s.name           = 'ShiftclockBle'
  s.version        = '0.1.0'
  s.summary        = 'Native BLE boundaries for the Shiftclock app'
  s.description    = 'A local Expo module scaffold for future Shiftclock BLE support.'
  s.license        = { :type => 'MIT' }
  s.author         = { 'Shiftclock' => '' }
  s.homepage       = 'https://github.com/Crooder1/shiftclock-source'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/Crooder1/shiftclock-source.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
