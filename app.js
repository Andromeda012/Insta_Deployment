document.addEventListener('DOMContentLoaded', () => {
    const deployBtn = document.getElementById('deploy-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const clearLogsBtn = document.getElementById('clear-logs');
    const terminalLogs = document.getElementById('terminal-logs');
    const deploymentList = document.getElementById('deployment-list');
    const deployCount = document.getElementById('deploy-count');
    const toast = document.getElementById('toast');

    let count = 2;

    const initialDeployments = [
        {
            title: "Frontend Prototip - Vercel Yayını",
            branch: "main",
            author: "Andromeda012",
            timestamp: "Az önce"
        },
        {
            title: "Yönetim Paneli Arayüz Kurulumu",
            branch: "main",
            author: "Andromeda012",
            timestamp: "Dün"
        }
    ];

    function showToast(message) {
        toast.textContent = message;
        toast.style.display = 'flex';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    function addLog(text, type = 'info') {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        const time = new Date().toLocaleTimeString('tr-TR');
        line.textContent = `[${time}] ${text}`;
        terminalLogs.appendChild(line);
        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }

    function renderDeployments(items) {
        deploymentList.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'deployment-item';
            div.innerHTML = `
                <div class="dep-icon">▲</div>
                <div class="dep-info">
                    <strong>${item.title}</strong>
                    <span>${item.branch} • ${item.author} • ${item.timestamp}</span>
                </div>
                <span class="badge-status success">Canlıda</span>
            `;
            deploymentList.appendChild(div);
        });
    }

    deployBtn.addEventListener('click', () => {
        deployBtn.disabled = true;
        deployBtn.innerHTML = '⏳ Dağıtılıyor...';

        addLog('Yeni prototip dağıtımı tetiklendi...', 'info');
        showToast('🚀 Dağıtım başlatıldı!');

        setTimeout(() => {
            addLog('Modüler bileşenler ve statik varlıklar optimize ediliyor...', 'info');
        }, 600);

        setTimeout(() => {
            addLog('Vercel Global Edge Network ile senkronize edildi.', 'success');
            count++;
            deployCount.textContent = count;

            const div = document.createElement('div');
            div.className = 'deployment-item';
            div.innerHTML = `
                <div class="dep-icon">▲</div>
                <div class="dep-info">
                    <strong>Yönetim Paneli Dağıtımı #${count}</strong>
                    <span>main • Andromeda012 • Şimdi</span>
                </div>
                <span class="badge-status success">Canlıda</span>
            `;
            deploymentList.insertBefore(div, deploymentList.firstChild);

            addLog('✅ Dağıtım tamamlandı! Prototip güncel.', 'success');
            deployBtn.disabled = false;
            deployBtn.innerHTML = '🚀 Yeni Dağıtım Tetikle';
            showToast('✅ Dağıtım başarıyla tamamlandı!');
        }, 1500);
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            addLog('Panel metrikleri ve veriler yenilendi.', 'info');
            showToast('🔄 Veriler güncellendi');
        });
    }

    clearLogsBtn.addEventListener('click', () => {
        terminalLogs.innerHTML = '';
        addLog('Log ekranı temizlendi.', 'info');
    });

    // Başlangıç yüklemesi
    renderDeployments(initialDeployments);
    deployCount.textContent = count;
});
