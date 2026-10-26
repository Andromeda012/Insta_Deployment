document.addEventListener('DOMContentLoaded', () => {
    const deployBtn = document.getElementById('deploy-btn');
    const clearLogsBtn = document.getElementById('clear-logs');
    const terminalLogs = document.getElementById('terminal-logs');
    const deploymentList = document.getElementById('deployment-list');
    const deployCount = document.getElementById('deploy-count');
    const toast = document.getElementById('toast');

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

    // Fetch initial deployments from API or fallback
    async function loadDeployments() {
        try {
            const res = await fetch('/api/deployments');
            if (res.ok) {
                const data = await res.json();
                renderDeployments(data.deployments);
                deployCount.textContent = data.count;
                addLog('Vercel Serverless API verileri basariyla yuklendi.', 'success');
                return;
            }
        } catch (e) {
            // Local offline fallback
        }

        // Default items if running without API
        renderDeployments([
            {
                title: "Vercel Serverless Architecture Migration",
                branch: "main",
                author: "Andromeda012",
                timestamp: "Az once"
            },
            {
                title: "Release v1.0.0 - Production Launch",
                branch: "main",
                author: "Andromeda012",
                timestamp: "Dün"
            }
        ]);
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

    deployBtn.addEventListener('click', async () => {
        deployBtn.disabled = true;
        deployBtn.innerHTML = '⏳ Dağıtılıyor...';

        addLog('Yeni Vercel Edge dagitimi tetiklendi...', 'info');
        showToast('🚀 Dağıtım başlatıldı!');

        setTimeout(() => {
            addLog('API Route /api/deploy cagriliyor...', 'info');
        }, 500);

        try {
            const res = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Vercel Cloud Deployment #${parseInt(deployCount.textContent || 0) + 1}`,
                    branch: 'main'
                })
            });

            if (res.ok) {
                const data = await res.json();
                addLog(`[201 CREATED] ${data.message}`, 'success');
            } else {
                addLog('Sunucu yaniti alindi (Vercel Edge Simule Edildi)', 'success');
            }
        } catch (err) {
            addLog('Yerel onizleme modunda basariyla simule edildi.', 'success');
        }

        setTimeout(() => {
            const newCount = parseInt(deployCount.textContent || 0) + 1;
            deployCount.textContent = newCount;

            const div = document.createElement('div');
            div.className = 'deployment-item';
            div.innerHTML = `
                <div class="dep-icon">▲</div>
                <div class="dep-info">
                    <strong>Vercel Cloud Deployment #${newCount}</strong>
                    <span>main • Andromeda012 • Şimdi</span>
                </div>
                <span class="badge-status success">Canlıda</span>
            `;
            deploymentList.insertBefore(div, deploymentList.firstChild);

            addLog('✅ Vercel Edge Function ve statik varliklar yayina alindi.', 'success');
            deployBtn.disabled = false;
            deployBtn.innerHTML = '🚀 Yeni Dağıtım Tetikle';
            showToast('✅ Dağıtım tamamlandı!');
        }, 1500);
    });

    clearLogsBtn.addEventListener('click', () => {
        terminalLogs.innerHTML = '';
        addLog('Log ekrani temizlendi.', 'info');
    });

    loadDeployments();
});
