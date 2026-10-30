Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "   NOVA FURNITURE — 7/24 BULUT BOT VE YAYIN MOTORU" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "1. Canli Instagram & Facebook DM/Yorum Kontrolu (Her 10 sn)" -ForegroundColor Yellow
Write-Host "2. Otomatik Otonom Gonderi & Reels Yayini (Zamanlanmis Saatlerde)`n" -ForegroundColor Green

$dmEndpoint = "https://insta-deployment-rho.vercel.app/api/instagram-cron?action=scan_dms"
$instaCron = "https://insta-deployment-rho.vercel.app/api/instagram-cron"
$fbCron = "https://insta-deployment-rho.vercel.app/api/facebook-cron"

$lastPostCheck = [DateTime]::MinValue

while ($true) {
    $now = Get-Date
    $timestamp = $now.ToString("HH:mm:ss")

    # A) Canli DM ve Yorum Tarama (Her 10 saniyede bir)
    try {
        $res = Invoke-RestMethod -Uri $dmEndpoint -Method Get -TimeoutSec 15
        if ($res.ok) {
            $dmCount = $res.dmResults.replied_count
            $commentCount = $res.commentResults.replied_count
            if ($dmCount -gt 0 -or $commentCount -gt 0) {
                Write-Host "[$timestamp] 🎉 YENI ETKILESIM YANITLANDI! ($dmCount DM, $commentCount Yorum)" -ForegroundColor Green
                foreach ($r in $res.dmResults.replies) {
                    Write-Host "  -> @$($r.recipient_username): $($r.incoming_message)" -ForegroundColor White
                    Write-Host "  <- Gemini AI Cevabi: $($r.bot_reply.Substring(0, [Math]::Min(100, $r.bot_reply.Length)))...`n" -ForegroundColor DarkGreen
                }
            }
        }
    } catch {
        Write-Host "[$timestamp] DM Tarama uyarisi: $($_.Exception.Message)" -ForegroundColor Red
    }

    # B) Otomatik Zamanlanmis Gonderi Yayini (Her 5 dakikada bir kontrol eder)
    if (($now - $lastPostCheck).TotalMinutes -ge 5) {
        $lastPostCheck = $now
        try {
            # Instagram Otonom Paylasim Kontrolu
            $igPostRes = Invoke-RestMethod -Uri $instaCron -Method Get -TimeoutSec 30
            if ($igPostRes.ok -and $igPostRes.published_count -gt 0) {
                Write-Host "[$timestamp] 📸 INSTAGRAM'DA YENI GONDERI YAYINLANDI!" -ForegroundColor Magenta
                foreach ($p in $igPostRes.published) {
                    Write-Host "  -> Baslik: $($p.title) ($($p.media_type))" -ForegroundColor White
                }
            }

            # Facebook Otonom Paylasim Kontrolu
            $fbPostRes = Invoke-RestMethod -Uri $fbCron -Method Get -TimeoutSec 30
            if ($fbPostRes.ok -and $fbPostRes.published_count -gt 0) {
                Write-Host "[$timestamp] 📘 FACEBOOK'TA YENI GONDERI YAYINLANDI!" -ForegroundColor Blue
                foreach ($p in $fbPostRes.published) {
                    Write-Host "  -> Baslik: $($p.title) ($($p.media_type))" -ForegroundColor White
                }
            }
        } catch {
            # Sessiz gec
        }
    }

    Start-Sleep -Seconds 10
}
