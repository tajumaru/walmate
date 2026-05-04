// Split from app.js: walk feature

/* ===== WALK FEATURE ===== */

function applyWalkLanguage() {
    const isJa = currentLang === 'ja';
    const setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    setText('walkKicker', isJa ? 'WALRUS SCOPE' : 'WALRUS SCOPE');
    setText('walkPanelTitle', isJa ? '今日は漂ってる…' : 'Drifting today...');
    setText('walkFlowWalk', isJa ? '漂う' : 'Drift');
    setText('walkFlowSound', isJa ? '響き' : 'Echo');
    setText('walkFlowEvolution', isJa ? '変化' : 'Change');
    const heroCopy = document.getElementById('walkHeroCopy');
    if(heroCopy) heroCopy.innerHTML = isJa
        ? 'しばらく様子を見ていると、今の気分が少しずつ見えてくる。'
        : 'Watch for a moment and its mood starts to surface.';
    setText('walkDesireLabel', isJa ? 'Walrus Signal' : 'Walrus Signal');
    setText('walkRuleLabel', isJa ? 'Walk Key' : 'Walk Key');
    setText('walkRuleValue', 'ENERGY 50%+');
    setText('walkLabelDist',  isJa ? '距離' : 'Distance');
    setText('walkLabelTime',  isJa ? '歩行時間' : 'Time');
    setText('walkLabelExp',   isJa ? '獲得EXP' : 'EXP Gained');
    const startBtn = document.getElementById('walkStartBtn');
    if(startBtn && !walkState.active) startBtn.textContent = isJa ? '🌊 流れに乗る' : '🌊 Follow the current';
    if(startBtn && walkState.active)  startBtn.textContent = isJa ? '⏹ ひと休みする' : '⏹ Pause here';
    const saveBtn = document.getElementById('walkSaveBtn');
    if(saveBtn) saveBtn.textContent = isJa ? '🌊 Walrusへ' : '🌊 To Walrus';
    updateWalkHero();
}
const WALK_LOG_KEY   = 'walrus_walk_logs';
const WALK_BLOB_KEY  = 'walrus_walk_blobid';
const WALK_STATE_KEY = 'walrus_walk_state'; // バックグラウンド復帰用
const WALK_EXP_PER_KM = 50;   // 1km = 50 EXP
const WALK_HAPPY_PER_KM = 8;  // 1km = +8 happy
const WALK_MIN_HUNGER_TO_START = 50;
const WALK_HUNGER_COST_PER_KM = 18;

function getWalkUiIntervalMs(){
    return isThermalConstrainedDevice() ? 2000 : 1000;
}

function getWalkGeoOptions(){
    return isThermalConstrainedDevice()
        ? { enableHighAccuracy: false, maximumAge: 15000, timeout: 25000 }
        : { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 };
}

let walkState = {
    active: false,
    watchId: null,
    startTime: null,
    timerInterval: null,
    lastCoord: null,
    totalMeters: 0,
    expEarned: 0,
    hungerSpent: 0,
    collected: [],
    ambientLevel: 0,
    micState: 'idle',
    isSilent: false,
    silentSince: 0,
    silencePenalty: 0,
    lastSilencePenaltyAt: 0,
    lastSilenceWarnAt: 0
};

/* --- Walk state persistence (iOS background対策) --- */
function saveWalkState() {
    if(!walkState.active) return;
    try {
        localStorage.setItem(WALK_STATE_KEY, JSON.stringify({
            active: true,
            startTime: walkState.startTime,
            totalMeters: walkState.totalMeters,
            expEarned: walkState.expEarned,
            hungerSpent: walkState.hungerSpent
        }));
    } catch(e) {}
}
function clearWalkState() {
    try { localStorage.removeItem(WALK_STATE_KEY); } catch(e) {}
}
function restoreWalkState() {
    try {
        const raw = localStorage.getItem(WALK_STATE_KEY);
        if(!raw) return;
        const saved = JSON.parse(raw);
        if(!saved || !saved.active) return;
        walkState.active      = true;
        walkState.startTime   = saved.startTime;
        walkState.totalMeters = saved.totalMeters || 0;
        walkState.expEarned   = saved.expEarned   || 0;
        walkState.hungerSpent = saved.hungerSpent || 0;
        walkState.lastCoord   = null;
        walkState.ambientLevel = 0;
        walkState.isSilent = false;
        walkState.silentSince = 0;
        walkState.silencePenalty = 0;
        walkState.lastSilencePenaltyAt = 0;
        walkState.lastSilenceWarnAt = 0;
        const btn = document.getElementById('walkStartBtn');
        if(btn){ btn.classList.add('walking'); btn.textContent = currentLang === 'ja' ? '⏹ ひと休みする' : '⏹ Pause here'; }
        clearInterval(walkState.timerInterval);
        walkState.timerInterval = setInterval(updateWalkUI, getWalkUiIntervalMs());
        updateWalkUI();
        startAmbientMonitor();
        if(navigator.geolocation) {
            walkState.watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
                    if(accuracy > 35) return;
                    syncDailyWeatherFromCoords(lat, lon, { silent:true });
                    if(walkState.lastCoord) {
                        const d = haversineMeters(walkState.lastCoord.lat, walkState.lastCoord.lon, lat, lon);
                        if(d > 2 && d < 200) {
                            walkState.totalMeters += d;
                            applyWalkProgressEffects(d);
                            saveWalkState();
                            updateWalkUI();
                        }
                    }
                    walkState.lastCoord = { lat, lon };
                },
                (err) => { console.warn('GPS restore error:', err); },
                getWalkGeoOptions()
            );
        }
        showToast(currentLang === 'ja' ? '🚶 散歩を再開しました' : '🚶 Walk resumed');
    } catch(e) {}
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlambda/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatWalkTime(ms) {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
}

function getWalkHungerPenalty(totalMeters = walkState.totalMeters) {
    return Math.floor((totalMeters / 1000) * WALK_HUNGER_COST_PER_KM);
}

function applyWalkProgressEffects(distanceDelta) {
    if(distanceDelta <= 0) return;
    const nextPenalty = getWalkHungerPenalty(walkState.totalMeters);
    const hungerDelta = Math.max(0, nextPenalty - walkState.hungerSpent);
    if(hungerDelta > 0) {
        walkState.hungerSpent = nextPenalty;
        G.hunger = Math.max(0, G.hunger - hungerDelta);
    }
    const newExp = Math.floor(walkState.totalMeters / 1000 * WALK_EXP_PER_KM);
    const addedExp = newExp - walkState.expEarned;
    if(addedExp > 0) {
        walkState.expEarned = newExp;
        G.exp += addedExp;
        G.happy = Math.min(100, G.happy + (addedExp / WALK_EXP_PER_KM) * WALK_HAPPY_PER_KM);
        checkLevelUp();
        const c = getStageCenter();
        spawnParticles(['👟','✨','💚'], c.x, c.y);
    }
    updateUI();
}

function updateWalkHero() {
    const isJa = currentLang === 'ja';
    const panel = document.getElementById('walkPanel');
    const title = document.getElementById('walkPanelTitle');
    const heroCopy = document.getElementById('walkHeroCopy');
    const desire = document.getElementById('walkDesireText');
    const ctaNote = document.getElementById('walkCtaNote');
    const btn = document.getElementById('walkStartBtn');
    const statsRow = document.querySelector('.walk-stats-row');
    const isHungry = G.hunger < WALK_MIN_HUNGER_TO_START;
    const isBored = G.happy < 35;
    const soundStarved = isSoundStarved();

    if(panel){
        panel.classList.toggle('walk-active', walkState.active);
        panel.classList.toggle('walk-blocked', !walkState.active && isHungry);
        panel.classList.toggle('walk-drifting', !walkState.active && !isHungry && !isBored && !soundStarved);
    }
    if(statsRow){
        statsRow.classList.toggle('show-stats', walkState.active);
    }

    if(title){
        if(soundStarved){
            title.textContent = isJa ? '静けさに沈んでる…' : 'Sinking into silence...';
        } else if(walkState.active){
            title.textContent = isJa ? '流れに乗ってる…' : 'Riding the current...';
        } else if(isHungry){
            title.textContent = isJa ? 'お腹すいたみたい' : 'Looks hungry';
        } else if(isBored){
            title.textContent = isJa ? 'どこか行きたそう…' : 'Looks ready to wander...';
        } else {
            title.textContent = isJa ? '今日は漂ってる…' : 'Drifting today...';
        }
    }

    if(heroCopy){
        if(walkState.active){
            heroCopy.textContent = isJa ? '耳をすまして、外の音を追いかけている。' : 'It is listening closely and following sounds outside.';
        } else if(isHungry){
            heroCopy.textContent = isJa ? '今は移動より食事を優先したいらしい。' : 'Right now it seems to want food before movement.';
        } else if(isBored){
            heroCopy.textContent = isJa ? '少し退屈そう。外の気配を待っている。' : 'A little restless, waiting for the world outside.';
        } else if(soundStarved){
            heroCopy.textContent = isJa ? '静かすぎて、外の響きを思い出している。' : 'It misses the sound of the outside world.';
        } else {
            heroCopy.textContent = isJa ? '今はただ、ゆっくり潮に身をまかせている。' : 'For now, it is just drifting with the tide.';
        }
    }

    if(desire) {
        if(soundStarved) {
            desire.textContent = isJa
                ? '「静かすぎるよ… ポケットの外で音を食べたいな」'
                : '"It is too quiet... let me hear the world outside your pocket."';
        } else if(walkState.active) {
            desire.textContent = isJa
                ? '「いい音がありそう！ もっと先まで歩こう！」'
                : '"I hear something out there. Let us keep walking!"';
        } else if(isHungry) {
            desire.textContent = isJa
                ? '「お腹がすいた… 先に魚を食べてから散歩したいよ」'
                : '"I am too hungry... feed me first, then let us walk."';
        } else if(isBored) {
            desire.textContent = isJa
                ? '「外に出たいな。散歩したら元気になれそう！」'
                : '"I want to get outside. A walk will cheer me up!"';
        } else {
            desire.textContent = isJa
                ? '「ねえ、ちょっと様子を見に行かない？」'
                : '"Hey... want to come with me for a bit?"';
        }
    }

    if(ctaNote) {
        ctaNote.classList.toggle('warn', walkState.active && soundStarved);
        if(soundStarved) {
            ctaNote.textContent = isJa
                ? `静音ペナルティ中。少しずつ満腹が減ります (-${walkState.silencePenalty.toFixed(2)}%)`
                : `Silence penalty active. Hunger is slowly dropping (-${walkState.silencePenalty.toFixed(2)}%).`;
        } else if(walkState.active && walkState.micState === 'denied') {
            ctaNote.textContent = isJa
                ? '周囲の音を検知できません。マイクを許可すると無音ペナルティを判定できます。'
                : 'Ambient sound is unavailable. Allow microphone access to enable silence detection.';
        } else if(walkState.active) {
            ctaNote.textContent = isJa
                ? `歩くほど満腹が減るよ。今の散歩コスト: -${walkState.hungerSpent}%`
                : `Walking drains hunger. Current walk cost: -${walkState.hungerSpent}%`;
        } else if(isHungry) {
            ctaNote.textContent = isJa
                ? `散歩には満腹${WALK_MIN_HUNGER_TO_START}%以上が必要。今は${Math.round(G.hunger)}%。`
                : `Walking needs ${WALK_MIN_HUNGER_TO_START}%+ hunger. It is at ${Math.round(G.hunger)}% now.`;
        } else {
            ctaNote.textContent = isJa
                ? '歩き始めると、少しずつお腹が減っていく。'
                : 'Walking slowly drains hunger.';
        }
    }

    if(btn){
        if(walkState.active){
            btn.textContent = isJa ? '⏹ ひと休みする' : '⏹ Pause here';
            btn.disabled = false;
        } else if(isHungry){
            btn.textContent = isJa ? '🐟 まだ行けない' : '🐟 Not yet';
            btn.disabled = true;
        } else if(isBored){
            btn.textContent = isJa ? '🌊 一緒に行く？' : '🌊 Come with it?';
            btn.disabled = false;
        } else {
            btn.textContent = isJa ? '🌊 流れに乗る' : '🌊 Follow the current';
            btn.disabled = false;
        }
    }
}

function updateWalkUI() {
    const km = walkState.totalMeters / 1000;
    const dist = document.getElementById('walkDist');
    const exp  = document.getElementById('walkExp');
    const time = document.getElementById('walkTime');
    if(dist) dist.innerHTML = `${km.toFixed(2)}<small style="font-size:0.55rem"> km</small>`;
    if(exp)  exp.textContent = `+${walkState.expEarned}`;
    if(time && walkState.startTime) {
        time.textContent = formatWalkTime(Date.now() - walkState.startTime);
    }
    const saveBtn = document.getElementById('walkSaveBtn');
    if(saveBtn) saveBtn.disabled = walkState.totalMeters < 10;
    updateWalkHero();
}

function toggleWalk() {
    if(walkState.active) stopWalk();
    else startWalk();
}

function startWalk() {

    // ✅ 二重起動ガード
    if (walkState.active) {
        stopWalk();
    }

    // ✅ 前回の残骸を確実に掃除
    if (walkState.watchId !== null) {
        navigator.geolocation.clearWatch(walkState.watchId);
        walkState.watchId = null;
    }
    if (walkState.timerInterval) {
        clearInterval(walkState.timerInterval);
        walkState.timerInterval = null;
    }
    if (walkState._visibilityHandler) {
        document.removeEventListener('visibilitychange', walkState._visibilityHandler);
        walkState._visibilityHandler = null;
    }

    if(!navigator.geolocation) {
        showToast(currentLang === 'ja' ? '⚠ GPSが使えません' : '⚠ GPS not available', true);
        return;
    }
    if(G.hunger < WALK_MIN_HUNGER_TO_START) {
        showToast(
            currentLang === 'ja'
                ? `◇ ENERGY ${WALK_MIN_HUNGER_TO_START}%以上で散歩できます`
                : `◇ You need ${WALK_MIN_HUNGER_TO_START}%+ ENERGY before it can wander`,
            true
        );
        setMsg(
            currentLang === 'ja'
                ? 'まずは魚を食べてお腹を満たしてから散歩に行こう！'
                : 'Feed it first, then follow where it wants to go.',
            true
        );
        pulseActionButtons('#btnFeed', '.tama-btn-a');
        updateWalkHero();
        return;
    }
    walkState.active = true;
    walkState.startTime = Date.now();
    walkState.lastCoord = null;
    walkState.totalMeters = 0;
    walkState.expEarned = 0;
    walkState.hungerSpent = 0;
    walkState.ambientLevel = 0;
    walkState.micState = 'idle';
    walkState.isSilent = false;
    walkState.silentSince = 0;
    walkState.silencePenalty = 0;
    walkState.lastSilencePenaltyAt = 0;
    walkState.lastSilenceWarnAt = 0;
    saveWalkState();

    const btn = document.getElementById('walkStartBtn');
    if(btn){ btn.disabled = false; btn.classList.add('walking'); btn.textContent = currentLang === 'ja' ? '⏹ ひと休みする' : '⏹ Pause here'; }
    setMsg(currentLang === 'ja' ? '🌊 外の響きを追いはじめた。しばらく様子を見よう。' : '🌊 It started following the sounds outside. Let us watch for a bit.');
    startAmbientMonitor();

    walkState.timerInterval = setInterval(updateWalkUI, getWalkUiIntervalMs());

    walkState.watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude: lat, longitude: lon, accuracy } = pos.coords;
            if(accuracy > 35) return; // ignore low accuracy
            syncDailyWeatherFromCoords(lat, lon, { silent:true });
            if(walkState.lastCoord) {
                const d = haversineMeters(walkState.lastCoord.lat, walkState.lastCoord.lon, lat, lon);
                if(d > 2 && d < 200) { // filter noise & teleports
                    walkState.totalMeters += d;
                    applyWalkProgressEffects(d);
                    checkSoundDrop(walkState.totalMeters);
                    saveWalkState();
                    updateWalkUI();
                }
            }
            walkState.lastCoord = { lat, lon };
        },
        (err) => {
            console.warn('GPS error:', err);
            if(walkState.active) {
                showToast(currentLang === 'ja' ? '⚠ GPS取得エラー' : '⚠ GPS error', true);
            }
        },
        getWalkGeoOptions()
    );

     // ✅ 追加: バックグラウンド時にGPSを一時停止
    walkState._visibilityHandler = () => {
        if (!walkState.active) return;

        if (document.hidden) {
            // 画面オフ・他アプリに移ったとき → GPS停止
            if (walkState.watchId !== null) {
                navigator.geolocation.clearWatch(walkState.watchId);
                walkState.watchId = null;
            }
        } else {
            // 画面復帰時 → GPS再開
            if (walkState.watchId === null) {
                walkState.watchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
                        if(accuracy > 35) return; // ignore low accuracy
                        syncDailyWeatherFromCoords(lat, lon, { silent:true });
                        if(walkState.lastCoord) {
                            const d = haversineMeters(walkState.lastCoord.lat, walkState.lastCoord.lon, lat, lon);
                            if(d > 2 && d < 200) { // filter noise & teleports
                                walkState.totalMeters += d;
                                applyWalkProgressEffects(d);
                                checkSoundDrop(walkState.totalMeters);
                                saveWalkState();
                                updateWalkUI();
                            }
                        }
                        walkState.lastCoord = { lat, lon };
                    },
                    (err) => {
                        console.warn('GPS error:', err);
                        if(walkState.active) {
                            showToast(currentLang === 'ja' ? '⚠ GPS取得エラー' : '⚠ GPS error', true);
                        }
                    },
                    getWalkGeoOptions()
                );
            }
        }
    };
    document.addEventListener('visibilitychange', walkState._visibilityHandler);
}

function stopWalk() {
    walkState.active = false;
    clearWalkState();
    soundDropCheckpointM = 0;
    stopAmbientMonitor();
    if(walkState.watchId !== null) {
        navigator.geolocation.clearWatch(walkState.watchId);
        walkState.watchId = null;
    }
    clearInterval(walkState.timerInterval);

    const btn = document.getElementById('walkStartBtn');
    if(btn){ btn.classList.remove('walking'); btn.textContent = currentLang === 'ja' ? '🌊 流れに乗る' : '🌊 Follow the current'; }

    const km = walkState.totalMeters / 1000;
    if(km >= 0.01) {
        recordBehaviorAction?.('walkSessions');
        const log = {
            date: new Date().toLocaleDateString(localeCode(), { month:'short', day:'numeric' }),
            ts: Date.now(),
            km: parseFloat(km.toFixed(3)),
            exp: walkState.expEarned,
            duration: Date.now() - walkState.startTime
        };
        saveWalkLog(log);
        setMsg(currentLang === 'ja'
            ? `🚶 お疲れ！ ${km.toFixed(2)}km歩いて +${walkState.expEarned} EXP 獲得！`
            : `🚶 Nice walk! ${km.toFixed(2)}km → +${walkState.expEarned} EXP!`);
        haptic([30, 20, 50]);
        updateUI();
    } else {
        setMsg(currentLang === 'ja' ? '🚶 散歩終了。もっと歩いてね！' : '🚶 Walk ended. Go further next time!');
    }
    updateWalkUI();
    renderWalkLogs();

     // ✅ 追加: visibilitychangeリスナーの解除
    if (walkState._visibilityHandler) {
        document.removeEventListener('visibilitychange', walkState._visibilityHandler);
        walkState._visibilityHandler = null;
    }
    updateWalkHero();
}

function saveWalkLog(log) {
    try {
        const raw = localStorage.getItem(WALK_LOG_KEY);
        const logs = raw ? JSON.parse(raw) : [];
        logs.unshift(log);
        if(logs.length > 20) logs.length = 20;
        localStorage.setItem(WALK_LOG_KEY, JSON.stringify(logs));
    } catch(e) {}
}

function renderWalkLogs() {
    const list = document.getElementById('walkLogList');
    if(!list) return;
    let logs = [];
    try {
        const raw = localStorage.getItem(WALK_LOG_KEY);
        if(raw) logs = JSON.parse(raw);
    } catch(e) {}
    if(!logs.length) { list.innerHTML = ''; return; }
    list.innerHTML = logs.slice(0,5).map(l =>
        `<div class="walk-log-item">
            <span class="wlog-date">${l.date}</span>
            <span class="wlog-dist">${l.km.toFixed(2)} km</span>
            <span class="wlog-exp">+${l.exp} EXP</span>
        </div>`
    ).join('');

    const chip = document.getElementById('walkBlobChip');
    const blobId = localStorage.getItem(WALK_BLOB_KEY);
    if(chip && blobId) {
        chip.className = 'walk-blob-chip saved';
        chip.textContent = `🌊 Walrus保存済 · ${shortBlobId(blobId)}`;
    } else if(chip) {
        chip.className = 'walk-blob-chip';
        chip.textContent = '';
    }
}

async function saveWalkToWalrus() {
    let logs = [];
    try {
        const raw = localStorage.getItem(WALK_LOG_KEY);
        if(raw) logs = JSON.parse(raw);
    } catch(e) {}
    if(!logs.length && walkState.totalMeters < 10) {
        showToast(currentLang === 'ja' ? '⚠ ウォークログがありません' : '⚠ No walk logs yet', true);
        return;
    }

    const payload = {
        type: 'walrus_walk_log',
        owner: 'tajumaru.sui',
        saved: new Date().toISOString(),
        logs: logs,
        totalKm: logs.reduce((s, l) => s + l.km, 0).toFixed(3),
        totalExp: logs.reduce((s, l) => s + l.exp, 0)
    };

    const saveBtn = document.getElementById('walkSaveBtn');
    if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = '⏳…'; }

    const blobId = await uploadToWalrus(JSON.stringify(payload), 'walk-log.json');
    if(blobId) {
        localStorage.setItem(WALK_BLOB_KEY, blobId);
        showToast(currentLang === 'ja' ? '✅ ウォークログをWalrusへ保存！' : '✅ Walk log saved to Walrus!');
        setMsg(currentLang === 'ja' ? '🌊 散歩の記録がWalrusに刻まれたよ！' : '🌊 Walk log etched into Walrus!');
        renderWalkLogs();
    } else {
        showToast(currentLang === 'ja' ? '⚠ Walrus保存失敗' : '⚠ Walrus save failed', true);
    }
    if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = currentLang === 'ja' ? '🌊 Walrusへ' : '🌊 To Walrus'; }

    saveMemoryTrack();

    showToast(
        currentLang === 'ja'
            ? '🎵 今日の散歩BGMを生成したよ！'
            : '🎵 Today’s walk BGM generated!'
    );
}

