# Service-report fonts

These fonts are bundled with the server PDF renderer. They are not fetched from
Google, a CDN or a customer-provided URL while generating a report. Sources were
retrieved on 2026-09-07; the URLs below track upstream branches, so the SHA-256
values identify the actual reviewed files rather than assuming future URL bytes
will remain unchanged.

## Sources and licenses

- `NotoSans-Regular.ttf`: unchanged upstream
  [Noto Sans Regular](https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf).
- `NotoSans-Bold.ttf`: unchanged upstream
  [Noto Sans Bold](https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf).
- `OFL-NotoSans.txt`: copied from the
  [Noto Fonts license](https://raw.githubusercontent.com/notofonts/noto-fonts/main/LICENSE).
- `NotoSansSC-Regular.ttf`: a static weight-400 instance generated from the official
  Google Fonts [Noto Sans SC variable font](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf).
  It was instantiated, not subsetted; the CJK glyph coverage was retained.
- `OFL-NotoSansSC.txt`: copied from the corresponding
  [Noto Sans SC OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt).

Both families ship under the SIL Open Font License 1.1. Preserve these license
files and their copyright/reserved-name notices when redistributing the fonts.
The bundled Noto Sans SC font is a generated derivative; it is not represented
as a byte-identical upstream static font.

## Reviewed artifact hashes

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| NotoSans-Regular.ttf | 569208 | `b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5` |
| NotoSans-Bold.ttf | 575740 | `c976e4b1b99edc88775377fcc21692ca4bfa46b6d6ca6522bfda505b28ff9d6a` |
| NotoSansSC-Regular.ttf | 10595948 | `095c79afac14e66cd8ebeb88db13f5ebce787d19d30634380c7aff68857e953a` |
| OFL-NotoSans.txt | 4377 | `0dab92d0544f7b233403f14b84a663bdbfa746982eda629e7f4f9ffe1b036feb` |
| OFL-NotoSansSC.txt | 4388 | `1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9` |

The unshipped variable input at
`.autopilot/runtime/service-reports/NotoSansSC-Variable.ttf` has SHA-256
`a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`.

## Static CJK generation

The generation tool was **fonttools 4.61.1**, installed only in the ignored local
QA directory `.autopilot/runtime/service-reports/font-tools`. It is not a Node
application dependency or a Production Python requirement. The command used the
workspace's bundled Python interpreter with that directory on `PYTHONPATH`:

```powershell
# Run from the repository root. Here, python denotes that bundled interpreter.
$reportPreviousPythonPath = $env:PYTHONPATH
try {
  $env:PYTHONPATH = (Resolve-Path '.autopilot/runtime/service-reports/font-tools').Path
  python -m fontTools.varLib.instancer `
    '.autopilot/runtime/service-reports/NotoSansSC-Variable.ttf' `
    wght=400 --output assets/report-fonts/NotoSansSC-Regular.ttf
} finally {
  $env:PYTHONPATH = $reportPreviousPythonPath
}
```

Do not regenerate fonts as part of a normal app build. Regeneration may update
font timestamps and therefore file hashes; any replacement needs a new hash
receipt, source/license check and all-locale rendered-PDF verification.
