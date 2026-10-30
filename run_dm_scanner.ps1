Write-Host "Instagram Canli Bot Tarayici Baslatildi..." -ForegroundColor Cyan
Write-Host "Her 10 saniyede bir yeni gelen DM ve Yorumlar Gemini AI ile kontrol edilecek." -ForegroundColor Yellow
Write-Host "Durdurmak icin pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.`n" -ForegroundColor Gray

$endpoint = "https://insta-deployment-rho.vercel.app/api/instagram-cron?action=scan_dms"

while ($true) {
    try {
        $timestamp = (Get-Date).ToString("HH:mm:ss")
        $res = Invoke-RestMethod -Uri $endpoint -Method Get -TimeoutSec 15
        if ($res.ok) {
            $dmCount = $res.dmResults.replied_count
            $commentCount = $res.commentResults.replied_count
            if ($dmCount -gt 0 -or $commentCount -gt 0) {
                Write-Host "[$timestamp] 🎉 YENI YANIT VERILDI! ($dmCount DM, $commentCount Yorum)" -ForegroundColor Green
                foreach ($r in $res.dmResults.replies) {
                    Write-Host "  -> @$($r.recipient_username): $($r.incoming_message)" -ForegroundColor White
                    Write-Host "  <- Cevap: $($r.bot_reply.Substring(0, [Math]::Min(80, $r.bot_reply.Length)))...`n" -ForegroundColor DarkGreen
                }
            } else {
                Write-Host "[$timestamp] Kontrol edildi. Bekleyen yeni mesaj yok." -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Tarama uyarisi: $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Seconds 10
}
