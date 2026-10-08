$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskArtifactDirectory = Join-Path $PSScriptRoot '../.artifacts'
New-Item -ItemType Directory -Path $taskArtifactDirectory -Force | Out-Null
$taskSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $taskSpeech.SetOutputToWaveFile((Join-Path $taskArtifactDirectory 'question.wav'), $taskFormat)
  $taskSpeech.Speak('Give me one hint about finding two numbers that sum to the target.')
} finally { $taskSpeech.Dispose() }
Write-Output 'Synthetic spoken question written to .artifacts/question.wav'
Add-Type -AssemblyName System.Drawing
$taskBitmap = New-Object System.Drawing.Bitmap(1200, 500)
$taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
$taskFont = New-Object System.Drawing.Font('Arial', 24)
try {
  $taskGraphics.Clear([System.Drawing.Color]::White)
  $taskLines = @('Two Sum', 'Given numbers [2, 7, 11, 15] and target = 9,', 'find the indices of two numbers whose sum is the target.', 'Each number may be used only once.')
  for ($taskIndex = 0; $taskIndex -lt $taskLines.Count; $taskIndex++) {
    $taskGraphics.DrawString($taskLines[$taskIndex], $taskFont, [System.Drawing.Brushes]::Black, 40, (40 + $taskIndex * 75))
  }
  $taskBitmap.Save((Join-Path $taskArtifactDirectory 'ocr-fixture.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $taskFont.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose() }
Write-Output 'Synthetic screen-text image written to .artifacts/ocr-fixture.png'
