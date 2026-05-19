$f = "C:\Users\AmosA\Projects\nowncard-v2\src\pages\EditorPage.tsx"
$c = Get-Content $f -Raw

# Simple regex replacements
$c = $c -replace [regex]::Escape("import { downloadVCard } from '@/lib/vcard';"), ""
$c = $c -replace [regex]::Escape("import type { Card, SocialLink } from '@/types';"), "import type { Card, SocialLink } from '@/types';`nimport BackgroundPositioner from '@/components/BackgroundPositioner';"
$c = $c -replace [regex]::Escape("const handleUpload = async (field: 'profileImage' | 'backgroundImage', file: File)"), "const handleUpload = async (field: 'profileImage' | 'backgroundImage' | 'backBackgroundImage', file: File)"

Set-Content $f $c -NoNewline

# Now line splicing
$lines = Get-Content $f
$out = @()
$positioner = Get-Content "C:\Users\AmosA\AppData\Local\Temp\opencode\positioner.txt" -Raw
$bottombar = Get-Content "C:\Users\AmosA\AppData\Local\Temp\opencode\bottombar.txt" -Raw
$skipOldBg = $false; $skipOldBar = $false; $barDone = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  $l = $lines[$i]

  # Add editorTab state
  if ($l -match "const \[textHex") {
    $out += $l
    $out += "  const [editorTab, setEditorTab] = useState<'info' | 'visuals'>('info');"
    continue
  }

  # Tab nav after Auto-Fill, before Basic Info
  if ($l -match "^\s*\{/\* Basic Info \*/\}") {
    $out += '          {/* Tab nav */}'
    $out += '          <div className="flex rounded-2xl border border-line overflow-hidden mb-6">'
    $out += "            <button onClick={() => setEditorTab('info')} className={`flex-1 py-3 text-sm font-bold transition ${editorTab === 'info' ? 'bg-accent text-space' : 'bg-tile-soft text-ink-muted hover:text-ink'}`}>"
    $out += '              Info'
    $out += '            </button>'
    $out += "            <button onClick={() => setEditorTab('visuals')} className={`flex-1 py-3 text-sm font-bold transition ${editorTab === 'visuals' ? 'bg-accent text-space' : 'bg-tile-soft text-ink-muted hover:text-ink'}`}>"
    $out += '              Visuals'
    $out += '            </button>'
    $out += '          </div>'
    $out += ''
    $out += $l
    continue
  }

  # Add display:none to section divs based on tab
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Settings') {
    $out += $l -replace '>', " style={{ display: editorTab === 'visuals' ? '' : 'none' }}>"
    continue
  }
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Typography') {
    $out += $l -replace '>', " style={{ display: editorTab === 'visuals' ? '' : 'none' }}>"
    continue
  }
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Contact') {
    $out += $l -replace '>', " style={{ display: editorTab === 'info' ? '' : 'none' }}>"
    continue
  }
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Addresses') {
    $out += $l -replace '>', " style={{ display: editorTab === 'info' ? '' : 'none' }}>"
    continue
  }
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Social Links') {
    $out += $l -replace '>', " style={{ display: editorTab === 'info' ? '' : 'none' }}>"
    continue
  }
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Payment Links') {
    $out += $l -replace '>', " style={{ display: editorTab === 'info' ? '' : 'none' }}>"
    continue
  }
  if ($l -match 'bg-tile border border-line rounded-2xl p-6 mb-6.*Images') {
    $out += $l -replace '>', " style={{ display: editorTab === 'visuals' ? '' : 'none' }}>"
    continue
  }

  # Back bg upload before tuning
  if ($l -match 'Background tuning controls.*always visible') {
    $out += $l
    $out += '                <div className="flex flex-col gap-2">'
    $out += '                  <label className="text-sm text-ink-muted">Back Background Photo</label>'
    $out += "                  <input type=\"file\" accept=\"image/*\" onChange={(e) => e.target.files?.[0] && handleUpload('backBackgroundImage', e.target.files[0])} className=\"text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold\" />"
    $out += '                  {card.backBackgroundImage && ('
    $out += '                    <div className="flex items-center gap-2">'
    $out += '                      <img src={card.backBackgroundImage} alt="" className="w-24 h-16 rounded-lg object-cover border border-line" />'
    $out += "                      <button type=\"button\" onClick={() => updateField('backBackgroundImage', undefined)} className=\"text-xs text-danger font-bold border border-line rounded-lg px-2 py-1 hover:border-danger transition\">Remove</button>"
    $out += '                    </div>'
    $out += '                  )}'
    $out += '                </div>'
    continue
  }

  # Replace old position/zoom/rotation with positioner
  if ($l -match "w-16.*Position<span") {
    $out += $positioner
    $skipOldBg = $true
    continue
  }
  if ($skipOldBg) {
    if ($l -match "^.*text-ink-muted.*>.*..</span>" -and $l -match "w-16") { continue }
    if ($l -match "^.*</div>$" -and $i -gt 0) {
      $skipOldBg = $false
    }
    continue
  }

  # Replace bottom bar
  if ($l -match "Persistent bottom action bar") {
    $out += $bottombar
    $skipOldBar = $true
    continue
  }
  if ($skipOldBar -and -not $barDone) {
    if ($l -match "ShareModal") { $barDone = $true; $out += $l; continue }
    continue
  }

  $out += $l
}

[System.IO.File]::WriteAllLines($f, $out)
Write-Output "Done: $($out.Count) lines"