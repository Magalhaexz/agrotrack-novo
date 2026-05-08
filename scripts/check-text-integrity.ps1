param(
  [string]$Root = '.\src'
)

$patterns = 'Ã|Â|â€|�|PerÃ|GestÃ|cabeÃ|observaÃ|SessÃ|nÃ|configuraÃ|operaÃ|movimentaÃ'

Get-ChildItem -Path $Root -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx,*.css |
  Select-String -Pattern $patterns |
  ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
