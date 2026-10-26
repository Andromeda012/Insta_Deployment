// Module 2: Social Media Bot Control Panel
export function renderSocialModule(data) {
    const sc = data.social;

    return `
        <div class="page-header">
            <div class="page-title-group">
                <div class="breadcrumbs">
                    <span onclick="window.navigateTo('dashboard')">Ana Sayfa</span> / 
                    <span>Modül 2: Sosyal Medya & Bot Paneli</span>
                </div>
                <h1>Sosyal Medya Bot & Otomasyon Kontrol Paneli</h1>
                <p class="subtitle">Çok kanallı sosyal medya hesapları, otomatik içerik takvimi, akıllı DM botu ve etkileşim izleme.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-secondary" onclick="window.showToast('Tüm bot servisleri bağlantı testi yapıldı: 4 kanal aktif')">
                    ⚡ Bağlantıları Test Et
                </button>
                <button class="btn btn-primary" onclick="window.showModal('Yeni İçerik Planla', 'Sosyal medya içerik planlayıcı simülasyonu. Görsel, metin ve hedef platform seçimi yapılır.')">
                    + Yeni Gönderi Planla
                </button>
            </div>
        </div>

        <!-- Channel Cards Grid -->
        <div class="section-title-row">
            <h3>Bağlı Sosyal Medya Kanalları & Bot Durumları</h3>
            <span class="badge badge-success">Tüm Webhooklar Aktif</span>
        </div>

        <div class="channel-grid">
            ${sc.accounts.map(acc => `
                <div class="card channel-card">
                    <div class="channel-header">
                        <div class="channel-brand">
                            <span class="channel-icon">${acc.platform === 'Instagram' ? '📸' : acc.platform === 'TikTok' ? '🎵' : acc.platform === 'YouTube' ? '▶️' : '📘'}</span>
                            <div>
                                <h4>${acc.platform}</h4>
                                <small class="text-muted">${acc.handle}</small>
                            </div>
                        </div>
                        <span class="badge badge-success">${acc.status}</span>
                    </div>
                    <div class="channel-stats">
                        <div class="channel-stat-item">
                            <span>Takipçi:</span>
                            <strong>${acc.followers}</strong>
                        </div>
                        <div class="channel-stat-item">
                            <span>Planlanan:</span>
                            <strong>${acc.postsScheduled} Gönderi</strong>
                        </div>
                    </div>
                    <div class="channel-bot-info">
                        <span class="status-dot online"></span>
                        <span>${acc.botStatus}</span>
                    </div>
                    <div class="channel-footer">
                        <small>API Gecikmesi: ${acc.ping}</small>
                        <button class="btn-text" onclick="window.showToast('${acc.platform} bot parametreleri penceresi simüle edildi.')">Ayarlar</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Split Content: Scheduled Queue & Live Comments -->
        <div class="content-split" style="margin-top: 24px;">
            <!-- Scheduled Queue -->
            <div class="card panel">
                <div class="panel-header">
                    <div class="panel-title-wrap">
                        <h3>Yayın Takvimi & Otomatik Kuyruk</h3>
                        <span class="tag">Sıradaki 4 Gönderi</span>
                    </div>
                    <button class="btn btn-secondary" onclick="window.showToast('Yayın kuyruğu yeniden düzenleme modu')">Sırala</button>
                </div>
                <div class="queue-list">
                    ${sc.scheduledQueue.map(item => `
                        <div class="queue-item">
                            <div class="queue-thumb">🎬</div>
                            <div class="queue-info">
                                <strong>${item.title}</strong>
                                <div class="queue-meta">
                                    <span>Hedef: ${item.platform}</span> • 
                                    <span>Tarih: ${item.date}</span>
                                </div>
                            </div>
                            <span class="badge ${item.status === 'Onaylandı' ? 'badge-success' : item.status === 'Kuyrukta' ? 'badge-primary' : 'badge-secondary'}">
                                ${item.status}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Live Bot Logs & Comments -->
            <div class="card panel">
                <div class="panel-header">
                    <div class="panel-title-wrap">
                        <h3>Gelen Yorumlar & Akıllı DM Yanıtları</h3>
                        <span class="badge badge-accent">Son Yorumlar</span>
                    </div>
                </div>
                <div class="comments-stream">
                    ${sc.recentComments.map(c => `
                        <div class="comment-item">
                            <div class="comment-user">
                                <strong>${c.user}</strong>
                                <span class="badge badge-secondary">${c.platform}</span>
                                <small class="text-muted">${c.time}</small>
                            </div>
                            <p class="comment-text">"${c.comment}"</p>
                            <div class="bot-reply-bubble">
                                <span class="bot-badge">🤖 Bot:</span>
                                <span>${c.botReply}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Bot Activity Terminal -->
        <div class="card panel" style="margin-top: 24px;">
            <div class="panel-header">
                <h3>Bot Servis Logları & Olay Kayıtları</h3>
                <span class="tag">Graph Webhook v19.0</span>
            </div>
            <div class="terminal-window">
                ${sc.botLogs.map(log => `
                    <div class="log-line ${log.level}">
                        [${log.time}] [${log.service}] ${log.message}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
