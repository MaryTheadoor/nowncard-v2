$f = "C:\Users\AmosA\Projects\nowncard-v2\src\pages\EditorPage.tsx"
$lines = Get-Content $f
$out = @()
$inBgControls = $false

$positionerBlock = @'
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-muted w-16">Size</span>
                    <select value={card.bgSize || 'cover'} onChange={(e) => updateField('bgSize', e.target.value)} className="flex-1 px-2.5 py-2 bg-space border border-line rounded-lg text-sm focus:outline-none focus:border-accent">
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  {card.backgroundImage && (
                    <BackgroundPositioner
                      imageUrl={card.backgroundImage}
                      opacity={card.bgOpacity ?? 0.6}
                      position={card.bgPosition || 'center'}
                      zoom={(card.bgZoom ?? 100) / 100}
                      rotation={card.bgRotation ?? 0}
                      onPositionChange={(pos) => updateField('bgPosition', pos)}
                      onZoomChange={(z) => updateField('bgZoom', z === 100 ? undefined : z)}
                      onRotationChange={(r) => updateField('bgRotation', r)}
                      accentColor={card.accentColor || '#d4a34a'}
                    />
                  )}
'@

$bottomBarBlock = @'
      {/* Persistent bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-space/95 backdrop-blur-xl border-t border-line-soft px-3 md:px-6 py-2.5 flex items-center justify-between gap-1.5">
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm">Cancel</button>
        <div className="flex items-center gap-1.5">
          {card.slug?.trim() && (
            <>
              <button onClick={() => setShareOpen(true)} className="btn btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /> Copy Link</button>
              <a href={`/card/${slugify(card.slug)}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><ExternalLink className="w-3.5 h-3.5" /> View</a>
            </>
          )}
          <button onClick={handleSave} disabled={saving} className={`btn btn-md text-xs md:text-sm rounded-full gap-1.5 ${id ? 'btn-secondary border-accent text-accent hover:bg-accent hover:text-space' : 'btn-primary'}`}>
            {saving ? (<>Saving…<span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /></>) : 'Save'}
          </button>
        </div>
      </div>
'@

$skipOldBg = $false; $skipOldBar = $false; $barDone = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  $l = $lines[$i]

  # Editor tab state
  if ($l -match "const \[textHex") {
    $out += $l
    $out += "  const [editorTab, setEditorTab] = useState<'info' | 'visuals'>('info');"
    continue
  }

  # Tab nav + Info open before Basic Info
  if ($l -match "^\s*\{/\* Basic Info \*/\}") {
    $out += "          {/* Tab nav */}"
    $out += '          <div className="flex rounded-2xl border border-line overflow-hidden mb-6">'
    $out += "            <button onClick={() => setEditorTab('info')} className={`flex-1 py-3 text-sm font-bold transition ${editorTab === 'info' ? 'bg-accent text-space' : 'bg-tile-soft text-ink-muted hover:text-ink'}`}>"
    $out += "              Info"
    $out += "            </button>"
    $out += "            <button onClick={() => setEditorTab('visuals')} className={`flex-1 py-3 text-sm font-bold transition ${editorTab === 'visuals' ? 'bg-accent text-space' : 'bg-tile-soft text-ink-muted hover:text-ink'}`}>"
    $out += "              Visuals"
    $out += "            </button>"
    $out += "          </div>"
    $out += ""
    $out += "          {editorTab === 'info' && (<>"
    $out += ""
    $out += $l
    continue
  }

  # Close Info, open Visuals before Settings
  if ($l -match "^\s*\{/\* Settings \*/\}") {
    $out += "          </>)}"
    $out += "          {editorTab === 'visuals' && (<>"
    $out += $l
    continue
  }

  # Close Visuals, open Info before Contact
  if ($l -match "^\s*\{/\* Contact \*/\}") {
    $out += "          </>)}"
    $out += "          {editorTab === 'info' && (<>"
    $out += $l
    continue
  }

  # Close Info, open Visuals before Images
  if ($l -match "^\s*\{/\* Images \*/\}") {
    $out += "          </>)}"
    $out += "          {editorTab === 'visuals' && (<>"
    $out += $l
    continue
  }

  # Close Visuals before </main>
  if ($l -match "^\s*</main>") {
    $out += "          </>)}"
    $out += $l
    continue
  }

  # Back bg upload before tuning section
  if ($l -match "Background tuning controls.*always visible") {
    $out += $l
    $out += '                <div className="flex flex-col gap-2">'
    $out += '                  <label className="text-sm text-ink-muted">Back Background Photo</label>'
    $out += '                  <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(\`backBackgroundImage\`, e.target.files[0])} className="text-sm text-ink-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-line file:bg-tile file:text-ink file:text-sm file:font-semibold" />'
    $out += '                  {card.backBackgroundImage && ('
    $out += '                    <div className="flex items-center gap-2">'
    $out += '                      <img src={card.backBackgroundImage} alt="" className="w-24 h-16 rounded-lg object-cover border border-line" />'
    $out += '                      <button type="button" onClick={() => updateField(\`backBackgroundImage\`, undefined)} className="text-xs text-danger font-bold border border-line rounded-lg px-2 py-1 hover:border-danger transition">Remove</button>'
    $out += '                    </div>'
    $out += '                  )}'
    $out += '                </div>'
    continue
  }

  # Replace old background position/zoom/rotation controls with positioner
  if ($l -match "<span.*w-16.*Position</span>") {
    $out += $positionerBlock
    $skipOldBg = $true
    continue
  }
  if ($skipOldBg) {
    if ($l -match "^\s*<span.*text-ink-muted.*>.*°</span>") {
      $skipOldBg = $false
      $i += 2
      continue
    }
    continue
  }

  # Replace bottom bar
  if ($l -match "Persistent bottom action bar") {
    $out += $bottomBarBlock
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