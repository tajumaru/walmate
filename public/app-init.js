// Split from app.js: app init

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', ()=>{
    if(isIosDevice()) document.documentElement.classList.add('ios-device');
    window.__setBootPhase?.('アセットを準備しています…', 0.18);
    registerServiceWorker();
    
    if(ensureFreshVersion()) {
        location.reload();  // 明示的にリロード
        return;
    }
    window.__setBootPhase?.('セーブデータを読んでいます…', 0.34);
    loadG();
    currentLang = detectLanguage();
    currentTheme = detectTheme();
    babyModeEnabled = detectBabyMode();
    isMuted = detectMute();
    window.__setBootPhase?.('画面を組み立てています…', 0.58);
    applyTheme();
    applyLanguage();
    applyBabyMode();
    // ミュートボタンの初期状態を反映
    const muteBtn = document.getElementById('muteSwitch');
    if(muteBtn){
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.classList.toggle('muted', isMuted);
    }
    setupBabyTapReactions();
    setupPwaInstallPrompt();
    const hasSave = G.lv>1 || G.exp>0 || Math.round(G.hunger)!==70;
    const awayMins = hasSave ? applyTimeDecay() : 0;
    window.__setBootPhase?.(hasSave ? 'Walrusを起こしています…' : 'たまごをあたためています…', 0.78);

    setTimeout(()=>{
        window.__setBootPhase?.('まもなく入れます…', 0.96);
        document.getElementById('loadScreen').classList.add('hidden');

        if(hasSave){
            document.getElementById('mainScreen').classList.remove('hidden');
            updateUI(); 
            startDecay();
            startRandomEvents();           // ← ここは変更なし
            renderWalkLogs();
            restoreWalkState();
            loadSoundSlots();
            renderSoundSlots();
            renderSoundMemory();
            if(awayMins>1){
                const h=Math.floor(awayMins/60), m=awayMins%60;
                const label = currentLang === 'ja'
                    ? (h>0?`${h}時間${m}分`:`${m}分`)
                    : (h>0?`${h}h ${m}m`:`${m}m`);
                document.getElementById('timeAway').textContent = currentLang === 'ja'
                    ? `⏱ ${label}ぶりの帰還！ ステータスが変化しました`
                    : `⏱ Welcome back after ${label}! Your status changed.`;
            }
        } else {
            // ===== ここを修正 =====
            const hatchScreen = document.getElementById('hatchScreen');
            hatchScreen.classList.remove('hidden');
            renderSoundSlots();
            renderSoundMemory();
            
            // 画面トランジションが終わるのを待ってから孵化アニメ開始
            setTimeout(() => {
                runHatching();
            }, 320);   // 320ms待機でほぼ確実にアニメが動く
        }
    }, hasSave ? 520 : 760);
});
