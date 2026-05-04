// Split from app.js: walrus integrations and overlays

/* ===== WALRUS INTEGRATION ===== */
const PUBLISHER  = "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
let legendCertShareUrl = '';
let saveMomentHideTimer = null;
const FRIEND_VISIT_LOG_KEY = 'walmate_friend_visit_log';
const FRIEND_VISIT_PLAY = {
    key: 'friend-visit',
    icon: '🫧',
    particles: ['🫧', '💚', '✨', '🦭'],
    reward: { hunger: 10, happy: 12, exp: 14 }
};

function isLikelyIOSDevice(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
document.documentElement.classList.toggle('ios-device', isLikelyIOSDevice());

async function uploadToWalrus(data, filename="walrus-save.json"){
    try{
        const isSvg = filename.endsWith('.svg');
        const contentType = isSvg ? 'image/svg+xml' : 'application/octet-stream';
        const body = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=30`, {
            method: "PUT", headers: { 'Content-Type': contentType }, body: body
        });
        if(!res.ok){ const errText = await res.text().catch(()=>''); throw new Error(`HTTP ${res.status}: ${errText.slice(0,120)}`); }
        const json = await res.json();
        return json.newlyCreated?.blobObject?.blobId || json.alreadyCertified?.blobId || null;
    }catch(e){ console.warn("Walrus upload error:", e); return null; }
}

function setBtnLoading(id, loading, label){
    const btn = document.getElementById(id);
    if(!btn) return;
    if(loading){ btn.classList.add('loading'); btn.disabled = true; btn.innerHTML = `<div class="btn-spinner"></div>${label}`; }
    else { btn.classList.remove('loading'); btn.disabled = false; }
}

async function copyText(text){
    try{
        await navigator.clipboard.writeText(text);
        return true;
    }catch(e){
        try{
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            const copied = document.execCommand('copy');
            ta.remove();
            return copied;
        }catch(_fallbackError){
            return false;
        }
    }
}

function shortBlobId(blobId){
    if(!blobId) return '';
    return blobId.length > 30 ? `${blobId.slice(0, 16)}…${blobId.slice(-8)}` : blobId;
}

function parseWalrusBlobPayload(text){
    const js = text.indexOf('{');
    const je = text.lastIndexOf('}');
    if(js === -1 || je === -1) throw new Error('JSON not found');
    return JSON.parse(text.slice(js, je + 1));
}

async function fetchWalrusDataByBlobId(blobId){
    const cleanBlobId = typeof blobId === 'string' ? blobId.trim() : '';
    if(!cleanBlobId) throw new Error('Missing blobId');
    const res = await fetch(`${AGGREGATOR}/v1/blobs/${cleanBlobId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/octet-stream, */*' }
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const friendData = parseWalrusBlobPayload(text);
    if(typeof friendData.lv === 'undefined' || typeof friendData.hunger === 'undefined'){
        throw new Error('Invalid Walrus data format');
    }
    return friendData;
}

function getFriendVisitLog(){
    try {
        const raw = JSON.parse(localStorage.getItem(FRIEND_VISIT_LOG_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch(e){
        return {};
    }
}

function saveFriendVisitLog(log){
    try { localStorage.setItem(FRIEND_VISIT_LOG_KEY, JSON.stringify(log && typeof log === 'object' ? log : {})); } catch(e){}
}

function hasFriendVisitRewardToday(friendId, dateKey = getLocalDateKey()){
    const cleanFriendId = typeof friendId === 'string' ? friendId.trim() : '';
    if(!cleanFriendId) return false;
    const log = getFriendVisitLog();
    return log?.[cleanFriendId]?.dateKey === dateKey;
}

function markFriendVisitReward(friendId, meta = {}){
    const cleanFriendId = typeof friendId === 'string' ? friendId.trim() : '';
    if(!cleanFriendId) return;
    const log = getFriendVisitLog();
    log[cleanFriendId] = {
        ts: Date.now(),
        dateKey: meta.dateKey || getLocalDateKey(),
        blobId: meta.blobId || '',
        walrusName: meta.walrusName || ''
    };
    saveFriendVisitLog(log);
}

function setStorageText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
}

function renderWalrusStorageStatus(state='idle', blobIdOverride=''){
    const panel = document.getElementById('walrusStoragePanel');
    if(!panel) return;
    const blobId = blobIdOverride || localStorage.getItem('walrus_blobid') || '';
    const isJa = currentLang === 'ja';
    const hasBlob = !!blobId;
    const link = document.getElementById('storageOpenLink');
    const copyBtn = document.getElementById('storageCopyBtn');
    const status = document.getElementById('storageStatus');
    const mini = document.querySelector('.storage-mini');

    panel.classList.remove('saving', 'saved', 'error');
    if(state === 'saving') panel.classList.add('saving');
    if(state === 'saved' || (state === 'idle' && hasBlob)) panel.classList.add('saved');
    if(state === 'error') panel.classList.add('error');
    if(mini) mini.classList.toggle('saved-ok', hasBlob && state !== 'saving' && state !== 'error');

    setStorageText('storageMiniTitle', isJa ? 'Walrus Storage' : 'Walrus Storage');
    setStorageText('chainOnLabel', isJa ? 'ON-CHAIN' : 'ON-CHAIN');
    setStorageText('chainOnCopy', isJa ? 'BlobIdだけ見る' : 'BlobId points to it');
    setStorageText('chainOffLabel', isJa ? 'OFF-CHAIN' : 'OFF-CHAIN');
    setStorageText('chainOffCopy', isJa ? '中身はWalrus Blob' : 'Data sits in Walrus');

    if(status){
        if(state === 'saving'){
            status.textContent = isJa ? 'Walrusへ送信中… 完了するとBlobIdをコピーできます' : 'Sending to Walrus... BlobId copy appears when done';
        }else if(state === 'error'){
            status.textContent = isJa ? 'Walrus保存失敗。ローカルは保存済み' : 'Walrus failed. Local save kept';
        }else if(hasBlob){
            status.textContent = `${isJa ? 'Walrus保存完了！コピー・QR共有できます' : 'Saved to Walrus! Copy or share QR'} · ${shortBlobId(blobId)}`;
        }else{
            status.textContent = isJa ? 'まだWalrus未保存。保存するとBlobIdとQRが出ます' : 'Not saved to Walrus yet. Save to get BlobId and QR';
        }
    }
    if(link){
        if(hasBlob && state !== 'saving'){
            link.textContent = isJa ? 'プレビュー' : 'Preview';
            link.classList.add('show');
        }else{
            link.classList.remove('show');
        }
    }
    if(copyBtn){
        copyBtn.classList.toggle('show', hasBlob && state !== 'saving');
        copyBtn.textContent = isJa ? 'コピー' : 'Copy';
        copyBtn.title = isJa ? 'BlobIdをコピー' : 'Copy BlobId';
        copyBtn.setAttribute('aria-label', copyBtn.title);
    }
}

async function copySavedWalrusBlobId(){
    const blobId = localStorage.getItem('walrus_blobid') || '';
    if(!blobId){
        showToast(currentLang === 'ja' ? 'まだBlobIdがありません' : 'No BlobId yet', true);
        return;
    }
    const ok = await copyText(blobId);
    showToast(ok
        ? (currentLang === 'ja' ? '📋 BlobIdをコピーしたよ！' : '📋 BlobId copied!')
        : (currentLang === 'ja' ? 'コピーに失敗しました' : 'Copy failed'),
        !ok
    );
}

function getWalrusBlobUrl(blobId){
    return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

function getBlobQrUrl(blobId){
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(getWalrusBlobUrl(blobId))}`;
}

async function saveSoundCollectionToWalrus(){
    let collections = [];
    try{
        const raw = localStorage.getItem(SOUND_MEMORY_KEY);
        collections = raw ? JSON.parse(raw) : [];
    }catch(e){}
    if(!collections.length){
        showToast(currentLang === 'ja' ? '⚠ まだ音コレクションがありません' : '⚠ No sound collectibles yet', true);
        return;
    }

    const buttons = Array.from(document.querySelectorAll('.sound-sm-btn'));
    const walrusBtn = buttons.find(btn => (btn.textContent || '').includes('🌐'));
    if(walrusBtn){
        walrusBtn.disabled = true;
        walrusBtn.textContent = currentLang === 'ja' ? '保存中…' : 'Saving...';
    }

    const payload = {
        type: 'walrus-sound-collection',
        petName: G.petName || '',
        userIntro: G.userIntro || '',
        savedAt: new Date().toISOString(),
        total: collections.length,
        collections
    };
    const blobId = await uploadToWalrus(JSON.stringify(payload, null, 2), 'walrus-sound-collection.json');

    if(blobId){
        try { localStorage.setItem(SOUND_COLLECTION_BLOB_KEY, blobId); } catch(e){}
        showToast(currentLang === 'ja' ? '🌐 音コレクションをWalrusに保存したよ！' : '🌐 Sound collectibles saved to Walrus!');
        setMsg(currentLang === 'ja' ? `🌐 音のコレクションをWalrusに刻んだよ · ${shortBlobId(blobId)}` : `🌐 Sound collection etched to Walrus · ${shortBlobId(blobId)}`);
    } else {
        showToast(currentLang === 'ja' ? '⚠ 音コレクションのWalrus保存に失敗しました' : '⚠ Failed to save sound collection to Walrus', true);
    }

    if(walrusBtn){
        walrusBtn.disabled = false;
        walrusBtn.textContent = '🌐';
    }
}

function parseWalrusBlobText(text){
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if(jsonStart === -1 || jsonEnd === -1) throw new Error('JSON not found');
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
}

function getLocalWalrusPreviewState(){
    try{
        const raw = localStorage.getItem(GAME_STORAGE_KEY);
        if(raw) return createGameState(JSON.parse(raw));
    }catch(e){}
    return createGameState(G || {});
}

function previewLvName(data){
    if(data.lv >= 4 && data.legendEvolution) return 'Mythic Legend Walrus';
    return ['','Baby Walrus','Child Walrus','Adult Walrus','Legend Walrus'][data.lv] || 'Walrus';
}

function previewPercent(value){
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function renderBlobPreview(data, blobId, source='walrus'){
    const body = document.getElementById('blobPreviewBody');
    if(!body) return;
    const isJa = currentLang === 'ja';
    const state = createGameState(data || {});
    const xInLv = previewPercent(state.exp - (state.lv - 1) * 100);
    const savedDate = state.lastSaved
        ? new Date(state.lastSaved).toLocaleString(localeCode(), { dateStyle: 'medium', timeStyle: 'short' })
        : (isJa ? '不明' : 'Unknown');
    const blobUrl = getWalrusBlobUrl(blobId);
    const sourceText = source === 'walrus'
        ? (isJa ? 'Walrusから読み込み' : 'Loaded from Walrus')
        : (isJa ? 'ローカル保存から表示' : 'Showing local save');
    const proofText = isJa ? 'この子はもう消えない' : 'Your Walrus lives on decentralized storage';
    const badges = [
        state.sakuraPink ? (isJa ? '桜Walrus' : 'Sakura Walrus') : '',
        state.legendEvolution ? 'Mythic' : '',
        state.legendPath === 'custom' ? (isJa ? 'カスタム中' : 'Custom') : ''
    ].filter(Boolean);
    const badgeHtml = badges.length
        ? `<div class="blob-preview-badges">${badges.map(label => `<span class="blob-preview-badge">${escapeHtml(label)}</span>`).join('')}</div>`
        : '';
    // ウォークログをlocalStorageから取得してPreviewに表示
    const _walkLogs = (() => {
        try { const r = localStorage.getItem('walrus_walk_logs'); return r ? JSON.parse(r) : []; } catch(e) { return []; }
    })();
    const _walkTotalKm  = _walkLogs.reduce((s, l) => s + (l.km  || 0), 0);
    const _walkTotalExp = _walkLogs.reduce((s, l) => s + (l.exp || 0), 0);
    const walkSectionHtml = _walkLogs.length ? `
        <div class="blob-preview-split" style="margin-top:2px">
            <div class="blob-preview-chip">
                <strong>🚶 ${isJa ? '散歩まとめ' : 'Walk Summary'}</strong>
                <span>${_walkLogs.length}${isJa ? '回' : ' sessions'} · ${_walkTotalKm.toFixed(2)} km · +${_walkTotalExp} EXP</span>
            </div>
            <div class="blob-preview-chip off">
                <strong>${isJa ? '最終散歩' : 'Last Walk'}</strong>
                <span>${escapeHtml(_walkLogs[0].date)} · ${_walkLogs[0].km.toFixed(2)} km</span>
            </div>
        </div>
        <div class="blob-preview-walk-log">${
            _walkLogs.slice(0, 3).map(l =>
                `<div class="blob-preview-walk-row">
                    <span class="bpw-date">${escapeHtml(l.date)}</span>
                    <span class="bpw-km">${l.km.toFixed(2)} km</span>
                    <span class="bpw-exp">+${l.exp} EXP</span>
                </div>`
            ).join('')
        }</div>` : '';

    body.className = '';
    body.innerHTML = `
        <div class="blob-preview-shell">
            <div class="blob-preview-hero">
                <div class="blob-preview-avatar">${makeWalrus(state.lv, 'happy', 'happy')}</div>
                <div>
                    <div class="blob-preview-kicker">${isJa ? 'Walrus Storage' : 'Walrus Storage'}</div>
                    <div class="blob-preview-title">Lv.${state.lv} · ${escapeHtml(previewLvName(state))}</div>
                    <div class="blob-preview-sub">
                        ${escapeHtml(sourceText)}<br>
                        BlobId: ${escapeHtml(shortBlobId(blobId))}
                    </div>
                    <div class="blob-preview-proof">${escapeHtml(proofText)}</div>
                    ${badgeHtml}
                </div>
            </div>
            <div class="blob-preview-grid">
                ${makeBlobPreviewStat(isJa ? '満腹' : 'Hunger', `${previewPercent(state.hunger)}%`, previewPercent(state.hunger))}
                ${makeBlobPreviewStat(isJa ? 'ハッピー' : 'Happy', `${previewPercent(state.happy)}%`, previewPercent(state.happy))}
                ${makeBlobPreviewStat(isJa ? '経験値' : 'EXP', `${xInLv}/100`, xInLv)}
            </div>
            <div class="blob-preview-split">
                <div class="blob-preview-chip">
                    <strong>ON-CHAIN</strong>
                    <span>${isJa ? 'アプリはBlobIdを手がかりに、この保存データを呼び戻します。' : 'The app uses the BlobId as the pointer to bring this save back.'}</span>
                </div>
                <div class="blob-preview-chip off">
                    <strong>OFF-CHAIN</strong>
                    <span>${isJa ? '育成データ本体はWalrus Blobとして保存されています。' : 'The pet save itself is stored as a Walrus Blob.'}</span>
                </div>
            </div>
            <div class="blob-preview-split">
                <div class="blob-preview-chip">
                    <strong>${isJa ? '保存日時' : 'Saved At'}</strong>
                    <span>${escapeHtml(savedDate)}</span>
                </div>
                <div class="blob-preview-chip off">
                    <strong>${isJa ? '見た目' : 'Look'}</strong>
                    <span>${escapeHtml(getBlobLookLabel(state))}</span>
                </div>
            </div>
            ${walkSectionHtml}
            <div class="blob-preview-qr">
                <img src="${getBlobQrUrl(blobId)}" alt="Walrus Blob QR" loading="lazy" decoding="async">
                <div>
                    <div class="blob-preview-qr-title">${isJa ? 'QRでBlobをシェア' : 'Share this Blob by QR'}</div>
                    <div class="blob-preview-qr-copy">${isJa ? 'スマホで読み取ると、このWalrus BlobのURLを開けます。展示・LT・ポートフォリオ共有に便利です。' : 'Scan this to open the Walrus Blob URL. Handy for demos, talks, and portfolio sharing.'}</div>
                </div>
            </div>
            <div class="blob-preview-actions">
                <button class="blob-preview-action primary" type="button" onclick="copySavedWalrusBlobId()">${isJa ? 'BlobIdをコピー' : 'Copy BlobId'}</button>
                <a class="blob-preview-action" href="${blobUrl}" target="_blank" rel="noopener noreferrer">${isJa ? '生データを開く' : 'Open raw data'}</a>
            </div>
        </div>`;
}

function makeBlobPreviewStat(label, value, percent){
    return `
        <div class="blob-preview-stat">
            <div class="blob-preview-label">${escapeHtml(label)}</div>
            <div class="blob-preview-value">${escapeHtml(value)}</div>
            <div class="blob-preview-bar"><div class="blob-preview-fill" style="width:${previewPercent(percent)}%"></div></div>
        </div>`;
}

function getBlobLookLabel(state){
    const isJa = currentLang === 'ja';
    const color = state.custom?.color || 'gold';
    const accessory = state.custom?.accessory || 'none';
    if(state.sakuraPink) return isJa ? '桜カラー' : 'Sakura color';
    if(state.legendEvolution) return 'Mythic Legend';
    if(accessory !== 'none') return `${color} / ${accessory}`;
    return color;
}

async function openWalrusBlobPreview(){
    const blobId = localStorage.getItem('walrus_blobid') || '';
    if(!blobId){
        showToast(currentLang === 'ja' ? 'まだBlobIdがありません' : 'No BlobId yet', true);
        return;
    }
    const modal = document.getElementById('walrusBlobPreviewModal');
    const body = document.getElementById('blobPreviewBody');
    setStorageText('blobPreviewTitle', currentLang === 'ja' ? '🌊 Blobプレビュー' : '🌊 Blob Preview');
    if(modal) modal.classList.add('show');
    if(body){
        body.className = 'blob-preview-loading';
        body.textContent = currentLang === 'ja' ? 'Walrus Blobを読み込み中…' : 'Loading Walrus Blob...';
    }
    try{
        const res = await fetch(getWalrusBlobUrl(blobId), { method: 'GET', headers: { 'Accept': 'application/octet-stream, */*' } });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = parseWalrusBlobText(await res.text());
        renderBlobPreview(data, blobId, 'walrus');
    }catch(e){
        console.warn('Blob preview fallback:', e);
        renderBlobPreview(getLocalWalrusPreviewState(), blobId, 'local');
    }
}

function closeWalrusBlobPreview(){
    const modal = document.getElementById('walrusBlobPreviewModal');
    if(modal) modal.classList.remove('show');
}

function setSaveMomentText(){
    const isJa = currentLang === 'ja';
    setStorageText('saveMomentTitle', isJa ? 'Walrusへ保存中' : 'Saving to Walrus');
    setStorageText('saveMomentLocal', isJa ? 'DATA' : 'DATA');
    setStorageText('saveMomentStorage', isJa ? 'WALRUS' : 'WALRUS');
    setStorageText('saveOnChainLabel', 'ON-CHAIN');
    setStorageText('saveOnChainText', isJa ? 'FRAGMENT' : 'FRAGMENT');
    setStorageText('saveOffChainLabel', 'OFF-CHAIN');
    setStorageText('saveOffChainText', isJa ? 'ABSORB' : 'ABSORB');
    setStorageText('saveMomentResult', '');
}

function resetSaveMomentNode(){
    const current = document.getElementById('saveMoment');
    if(!current || !current.parentNode) return current;
    const fresh = current.cloneNode(true);
    current.parentNode.replaceChild(fresh, current);
    return fresh;
}

function showSaveMoment(){
    setSaveMomentText();
    const overlay = document.getElementById('walrusSaveOverlay');
    const moment = resetSaveMomentNode();
    if(saveMomentHideTimer){
        clearTimeout(saveMomentHideTimer);
        saveMomentHideTimer = null;
    }
    if(!overlay || !moment) return;
    overlay.classList.toggle('ios-lite', isLikelyIOSDevice());
    overlay.classList.remove('show');
    overlay.style.animation = 'none';
    overlay.style.display = 'none';
    moment.classList.remove('done');
    moment.style.animation = 'none';
    moment.style.transform = 'translateY(8px) scale(0.98)';
    void overlay.offsetWidth;
    void moment.offsetWidth;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.style.display = '';
            overlay.style.animation = '';
            moment.style.animation = '';
            moment.style.transform = '';
            overlay.classList.add('show');
        });
    });
}

function finishSaveMoment(blobId, ok=true){
    const isJa = currentLang === 'ja';
    const overlay = document.getElementById('walrusSaveOverlay');
    const moment = document.getElementById('saveMoment');
    if(saveMomentHideTimer){
        clearTimeout(saveMomentHideTimer);
        saveMomentHideTimer = null;
    }
    if(moment) moment.classList.toggle('done', ok);
    setStorageText('saveMomentTitle', ok ? (isJa ? '保存された！' : 'Saved!') : (isJa ? 'Walrus保存失敗' : 'Save failed'));
    setStorageText('saveMomentResult', ok ? `BlobId: ${shortBlobId(blobId)}` : (isJa ? 'ローカル保存は残っています' : 'Local save is kept'));
    //saveMomentHideTimer = setTimeout(() => {
    //    if(overlay) overlay.classList.remove('show');
    //    if(moment) moment.classList.remove('done');
    //    saveMomentHideTimer = null;
    //}, ok ? 1500 : 1200);
    saveMomentHideTimer = setTimeout(() => {
        hideSaveMoment();
        saveMomentHideTimer = null;
    }, ok ? 1500 : 1200);
}

function hideSaveMoment(){
    const overlay = document.getElementById('walrusSaveOverlay');
    const moment = document.getElementById('saveMoment');
    if(!overlay) return;

    overlay.classList.remove('show');

    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.animation = '';
        overlay.classList.remove('ios-lite');

        if(moment){
            moment.classList.remove('done');
            moment.style.animation = '';
            moment.style.transform = '';
        }
    }, 260);
}

function syncWalrusLoadPreview(){
    const input = document.getElementById('walrusLoadBlobInput');
    const preview = document.getElementById('walrusLoadBlobPreview');
    const savedChip = document.getElementById('walrusLoadSavedChip');
    const savedValue = document.getElementById('walrusLoadSavedValue');
    const savedId = localStorage.getItem('walrus_blobid');
    if(savedValue){
        savedValue.textContent = savedId || t('walrus_load_saved_empty');
    }
    if(savedChip){
        savedChip.classList.toggle('empty', !savedId);
    }
    if(!input || !preview) return;
    const value = input.value.trim();
    if(value){
        preview.textContent = value;
        preview.classList.remove('empty');
    }else{
        preview.textContent = t('walrus_load_preview_empty');
        preview.classList.add('empty');
    }
}

function openWalrusLoadModal(){
    const input = document.getElementById('walrusLoadBlobInput');
    if(input){
        input.value = localStorage.getItem('walrus_blobid') || '';
    }
    syncWalrusLoadPreview();
    document.getElementById('walrusLoadModal').style.display = 'flex';
}

function closeWalrusLoadModal(){
    document.getElementById('walrusLoadModal').style.display = 'none';
}

function useSavedWalrusBlob(){
    const savedId = localStorage.getItem('walrus_blobid');
    if(!savedId){
        showToast(currentLang === 'ja' ? 'まだWalrus保存がありません' : 'No Walrus save found yet', true);
        return;
    }
    const input = document.getElementById('walrusLoadBlobInput');
    if(input){
        input.value = savedId;
        input.focus();
        input.setSelectionRange(savedId.length, savedId.length);
    }
    syncWalrusLoadPreview();
}

function confirmLoadFromWalrus(){
    const input = document.getElementById('walrusLoadBlobInput');
    const blobId = input ? input.value.trim() : '';
    loadFromWalrus(blobId);
}

async function saveToWalrus(){
    showSaveMoment();
    renderWalrusStorageStatus('saving');
    setBtnLoading('btnSave', true, currentLang === 'ja' ? 'Walrus保存中…' : 'Saving to Walrus...');
    saveG();
    const blobId = await uploadToWalrus(JSON.stringify(G));
    if(blobId){
        localStorage.setItem('walrus_blobid', blobId);
        renderWalrusStorageStatus('saved', blobId);
        finishSaveMoment(blobId, true);
        showToast(currentLang === 'ja' ? '✅ Walrusに保存完了！' : '✅ Saved to Walrus!');
        setMsg(currentLang === 'ja' ? '保存完了！BlobIdでいつでも呼び戻せるよ' : 'Saved! The BlobId can bring this back anytime');
        updateUI();
    } else {
        renderWalrusStorageStatus('error');
        finishSaveMoment('', false);
        showToast(currentLang === 'ja' ? '⚠ Walrus保存失敗（ローカルは保存済）' : '⚠ Walrus save failed (local save kept)', true);
        setMsg(currentLang === 'ja' ? 'Walrus保存失敗… ローカルには保存したよ' : 'Walrus save failed... local data is still safe', true);
    }
    setBtnLoading('btnSave', false, '');
    document.getElementById('btnSave').innerHTML = `<span class="act-icon">🌐</span>${t('walrus_save')}`;
}

async function saveUserIntroToWalrus(){
    const input = document.getElementById('introInput');
    const value = ((input?.value || G?.userIntro || '') + '').trim().slice(0, 420);
    if(!value){
        showToast(t('intro_empty'), true);
        return;
    }

    G.userIntro = value;
    G.userIntroSavedAt = Date.now();
    saveG();
    hydrateUserIntroEditor();

    const btn = document.getElementById('introWalrusBtn');
    if(btn){
        btn.disabled = true;
        btn.innerHTML = currentLang === 'ja' ? '🌐 保存中…' : '🌐 Saving...';
    }

    const payload = {
        type: 'walrus-user-intro',
        petName: G.petName || '',
        intro: G.userIntro,
        savedAt: new Date().toISOString(),
        level: G.lv
    };
    const blobId = await uploadToWalrus(JSON.stringify(payload, null, 2), 'walrus-user-intro.json');

    if(blobId){
        G.userIntroBlobId = blobId;
        G.userIntroSavedAt = Date.now();
        saveG();
        renderUserIntroStatus();
        setMsg(t('intro_saved_walrus'));
        showToast(t('intro_saved_walrus'));
    } else {
        showToast(currentLang === 'ja' ? '⚠ 自己紹介のWalrus保存に失敗しました' : '⚠ Failed to save intro to Walrus', true);
    }

    if(btn){
        btn.disabled = false;
        btn.innerHTML = currentLang === 'ja' ? '🌐 Walrusに保存' : '🌐 Save to Walrus';
    }
}

async function saveProfileDeckToWalrus(){
    const copy = getProfileEditorCopy();
    const modalOpen = document.getElementById('profileDeckModal')?.style.display === 'flex';
    G.userIntro = (document.getElementById('introInput')?.value || '').trim().slice(0, 420);
    G.userIntroSavedAt = Date.now();
    G.profileDeck = collectProfileDeckDraft();
    G.profileDeckSavedAt = Date.now();
    saveG();
    renderProfileDeckSurface();

    const btn = document.getElementById('profileDeckWalrusBtn');
    if(btn){
        btn.disabled = true;
        btn.innerHTML = copy.savingWalrus;
    }

    const payload = {
        type: 'walrus-profile-deck',
        petName: G.petName || '',
        intro: G.userIntro || '',
        profileDeck: getProfileDeckData(G.profileDeck),
        savedAt: new Date().toISOString(),
        level: G.lv
    };
    const blobId = await uploadToWalrus(JSON.stringify(payload, null, 2), 'walrus-profile-deck.json');

    if(blobId){
        G.userIntroBlobId = blobId;
        G.userIntroSavedAt = Date.now();
        G.profileDeckBlobId = blobId;
        G.profileDeckSavedAt = Date.now();
        saveG();
        renderProfileDeckSurface();
        if(modalOpen){
            closeProfileDeckModal();
        }
        setMsg(copy.savedWalrus);
        showToast(copy.savedWalrus);
    } else {
        showToast(currentLang === 'ja' ? '⚠ プロフィールのWalrus保存に失敗しました' : '⚠ Failed to save profile to Walrus', true);
    }

    if(btn){
        btn.disabled = false;
        btn.innerHTML = copy.saveWalrus;
    }
}

async function loadFromWalrus(blobIdOverride){
    const savedId = localStorage.getItem('walrus_blobid');
    const blobId = (blobIdOverride || '').trim() || savedId;
    if(!blobId){ showToast(currentLang === 'ja' ? 'BlobId を入力してね' : 'Please enter a BlobId', true); return; }
    if(!confirm(currentLang === 'ja' ? 'Walrusから復元しますか？ 現在の進行状況は上書きされます' : 'Load from Walrus? Your current progress will be overwritten.')) return;
    setBtnLoading('btnLoad', true, currentLang === 'ja' ? 'Walrus復元中…' : 'Loading from Walrus...');
    const modalBtn = document.getElementById('btnWalrusLoadConfirm');
    if(modalBtn){
        modalBtn.disabled = true;
        modalBtn.innerHTML = currentLang === 'ja' ? '<span>🫧</span> 復元中…' : '<span>🫧</span> Restoring...';
    }
    try{
        const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`, { method: 'GET', headers: { 'Accept': 'application/octet-stream, */*' } });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const jsonStart = text.indexOf('{'), jsonEnd = text.lastIndexOf('}');
        if(jsonStart === -1 || jsonEnd === -1) throw new Error(currentLang === 'ja' ? 'JSONが見つかりません' : 'JSON not found');
        const loaded = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        StateManager.replaceGame({ ...G, ...loaded, lastSaved: Date.now() });
        localStorage.setItem('walrus_blobid', blobId);
        saveG(); updateUI();
        closeWalrusLoadModal();
        showToast(currentLang === 'ja' ? '📥 Walrusから復元完了！' : '📥 Restored from Walrus!');
        setMsg(currentLang === 'ja' ? '📥 Walrusから復元したよ！ おかえり〜 🦭' : '📥 Restored from Walrus! Welcome back 🦭');
    }catch(e){
        console.warn("Walrus load error:", e);
        try{
            const local = localStorage.getItem(GAME_STORAGE_KEY);
            if(local){
                const loaded = JSON.parse(local);
                StateManager.replaceGame({ ...G, ...loaded, lastSaved: Date.now() });
                updateUI();
                showToast(
                    currentLang === 'ja'
                        ? '⚠ Walrus復元に失敗したため、ローカル保存から復元しました'
                        : '⚠ Walrus restore failed, so local data was restored instead',
                    true
                );
                setMsg(
                    currentLang === 'ja'
                        ? '⚠ 指定したBlobIdは復元できなかったため、ローカルデータを開いたよ'
                        : '⚠ The requested BlobId could not be restored, so local data was opened instead',
                    true
                );
            }
            else throw new Error(currentLang === 'ja' ? 'ローカルデータなし' : 'No local data');
        }catch(e2){ showToast(currentLang === 'ja' ? '⚠ 復元に失敗しました' : '⚠ Restore failed', true); setMsg(currentLang === 'ja' ? '復元失敗… 保存データが見つかりません' : 'Restore failed... no save data found', true); }
    }
    setBtnLoading('btnLoad', false, '');
    document.getElementById('btnLoad').innerHTML = `<span class="act-icon">📥</span>${t('walrus_load')}`;
    if(modalBtn){
        modalBtn.disabled = false;
        modalBtn.innerHTML = t('walrus_load_confirm');
    }
    syncWalrusLoadPreview();
}

/* ===== LEGEND CERTIFICATE ===== */
function makeLegendCertificateWalrusSvg(){
    const mood = getMood();
    const expression = getExpressionState(mood);
    return makeWalrusSvg(G.lv, mood, expression)
        .replace('<svg ', '<svg x="210" y="122" width="180" height="190" ');
}

function renderLegendCertificate(certSVG, shareUrl=''){
    legendCertShareUrl = shareUrl || '';
    document.getElementById('certPreview').innerHTML = certSVG;
    document.getElementById('certBlobId').innerHTML = shareUrl
        ? `${currentLang === 'ja' ? '永久リンク' : 'Permanent link'}：<br><a href="${shareUrl}" target="_blank" style="color:#00e5b0;word-break:break-all;">${shareUrl}</a>`
        : (currentLang === 'ja'
            ? '証明書を表示しました。リンク生成に失敗したため、この端末ではローカル表示のみです。'
            : 'Certificate preview is ready. Link generation failed, so this device is showing a local-only preview.');
    document.getElementById('legendCertModal').style.display = 'flex';
}

async function createLegendCertificate(){
    const certificateWalrus = makeLegendCertificateWalrusSvg();
    const certSVG = `<svg width="600" height="420" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="420" fill="#0a1f2e" rx="20"/>
        <rect x="12" y="12" width="576" height="396" fill="none" stroke="#C49840" stroke-width="2" rx="16" stroke-dasharray="8,6"/>
        <text x="300" y="72" font-family="serif" font-size="40" fill="#C49840" text-anchor="middle" font-weight="bold">LEGEND WALRUS</text>
        <text x="300" y="106" font-family="sans-serif" font-size="18" fill="#00e5b0" text-anchor="middle">${t('app_title')}</text>
        <rect x="210" y="130" width="180" height="180" rx="90" fill="rgba(196,152,64,0.08)" stroke="#C49840" stroke-width="1.5"/>
        ${certificateWalrus}
        <text x="300" y="330" font-family="sans-serif" font-size="17" fill="#e4f2f8" text-anchor="middle">${currentLang === 'ja' ? 'Lv.4 Legend Walrus 達成' : 'Reached Lv.4 Legend Walrus'}</text>
        <text x="300" y="357" font-family="sans-serif" font-size="14" fill="#88ccff" text-anchor="middle">${currentLang === 'ja' ? '満腹' : 'Hunger'} ${Math.round(G.hunger)}%　${currentLang === 'ja' ? 'ハッピー' : 'Happy'} ${Math.round(G.happy)}%</text>
        <text x="300" y="384" font-family="sans-serif" font-size="12" fill="#666" text-anchor="middle">${new Date().toLocaleDateString(localeCode())} · Built on Walrus Protocol</text>
        <polygon points="40,50 55,75 70,50 55,32" fill="#C49840" opacity="0.6"/>
        <polygon points="530,50 545,75 560,50 545,32" fill="#C49840" opacity="0.6"/>
    </svg>`;

    renderLegendCertificate(certSVG);
    if(isLikelyIOSDevice()){
        showToast(currentLang === 'ja' ? 'iPhoneでは証明書を表示のみで開きます' : 'Certificate opened in preview-only mode on iPhone');
        return;
    }
    const blobId = await uploadToWalrus(certSVG, "legend-certificate.svg");
    if(blobId){
        localStorage.setItem('legend_cert_blobid', blobId);
        renderLegendCertificate(certSVG, `${AGGREGATOR}/v1/blobs/${blobId}`);
    } else {
        showToast(currentLang === 'ja' ? '証明書リンクの生成に失敗しました' : 'Failed to generate certificate link', true);
    }
}

async function ensureLegendCertificateShareUrl(){
    const existingUrl = (() => {
        const certBlobId = localStorage.getItem('legend_cert_blobid');
        if(certBlobId) return `${AGGREGATOR}/v1/blobs/${certBlobId}`;
        const gameBlobId = localStorage.getItem('walrus_blobid');
        if(gameBlobId) return `${AGGREGATOR}/v1/blobs/${gameBlobId}`;
        return legendCertShareUrl || '';
    })();
    if(existingUrl) return existingUrl;

    const certificateWalrus = makeLegendCertificateWalrusSvg();
    const certSVG = `<svg width="600" height="420" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="420" fill="#0a1f2e" rx="20"/>
        <rect x="12" y="12" width="576" height="396" fill="none" stroke="#C49840" stroke-width="2" rx="16" stroke-dasharray="8,6"/>
        <text x="300" y="72" font-family="serif" font-size="40" fill="#C49840" text-anchor="middle" font-weight="bold">LEGEND WALRUS</text>
        <text x="300" y="106" font-family="sans-serif" font-size="18" fill="#00e5b0" text-anchor="middle">${t('app_title')}</text>
        <rect x="210" y="130" width="180" height="180" rx="90" fill="rgba(196,152,64,0.08)" stroke="#C49840" stroke-width="1.5"/>
        ${certificateWalrus}
        <text x="300" y="330" font-family="sans-serif" font-size="17" fill="#e4f2f8" text-anchor="middle">${currentLang === 'ja' ? 'Lv.4 Legend Walrus 達成' : 'Reached Lv.4 Legend Walrus'}</text>
        <text x="300" y="357" font-family="sans-serif" font-size="14" fill="#88ccff" text-anchor="middle">${currentLang === 'ja' ? '満腹' : 'Hunger'} ${Math.round(G.hunger)}%　${currentLang === 'ja' ? 'ハッピー' : 'Happy'} ${Math.round(G.happy)}%</text>
        <text x="300" y="384" font-family="sans-serif" font-size="12" fill="#666" text-anchor="middle">${new Date().toLocaleDateString(localeCode())} · Built on Walrus Protocol</text>
        <polygon points="40,50 55,75 70,50 55,32" fill="#C49840" opacity="0.6"/>
        <polygon points="530,50 545,75 560,50 545,32" fill="#C49840" opacity="0.6"/>
    </svg>`;
    const blobId = await uploadToWalrus(certSVG, "legend-certificate.svg");
    if(!blobId) return '';
    localStorage.setItem('legend_cert_blobid', blobId);
    const shareUrl = `${AGGREGATOR}/v1/blobs/${blobId}`;
    legendCertShareUrl = shareUrl;
    renderLegendCertificate(certSVG, shareUrl);
    return shareUrl;
}

async function shareLegendCert(){
    const url = await ensureLegendCertificateShareUrl();
    const text = currentLang === 'ja'
        ? `Legend Walrus証明書をWalrusに永久保存したよ🦭✨${url ? `\n${url}` : ''}\n#WalrusProtocol #Sui @tajumaruxxx`
        : `I permanently saved my Legend Walrus certificate on Walrus 🦭✨${url ? `\n${url}` : ''}\n#WalrusProtocol #Sui @tajumaruxxx`;
    if(!url){
        showToast(currentLang === 'ja' ? 'リンク未生成のため、投稿文のみ共有します' : 'Sharing post text only because no link is available');
    }
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,'_blank');
}

function copyCertLink(){
    const url = legendCertShareUrl || (() => {
        const blobId = localStorage.getItem('legend_cert_blobid');
        return blobId ? `${AGGREGATOR}/v1/blobs/${blobId}` : '';
    })();
    if(!url){
        showToast(currentLang === 'ja' ? 'まだコピーできるリンクがありません' : 'No shareable link is available yet', true);
        return;
    }
    navigator.clipboard.writeText(url)
        .then(()=>showToast(currentLang === 'ja' ? '📋 リンクをコピーしました！' : '📋 Link copied!'))
        .catch(()=>showToast(currentLang === 'ja' ? 'コピーに失敗' : 'Copy failed', true));
}

function closeLegendCertModal(){ document.getElementById('legendCertModal').style.display='none'; }

/* ===== WALRUS DIARY ===== */
function getDiaryEntries(){
    try {
        const s = localStorage.getItem('walrus_diary');
        return normalizeDiaryEntries(s ? JSON.parse(s) : []);
    } catch(e){ return []; }
}
function saveDiaryEntries(entries){
    try { localStorage.setItem('walrus_diary', JSON.stringify(normalizeDiaryEntries(entries))); } catch(e){}
}

function normalizeDiaryEntries(entries){
    if(!Array.isArray(entries)) return [];
    return entries.map(normalizeDiaryEntry).filter(Boolean).slice(0, 100);
}

function normalizeDiaryEntry(entry){
    if(!entry || typeof entry !== 'object') return null;
    const date = typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        ? entry.date
        : null;
    const text = typeof entry.text === 'string'
        ? entry.text.trim().slice(0, 500)
        : null;
    if(!date || !text) return null;
    return {
        date,
        text,
        lv: clampNumber(entry.lv, 1, 4, 1),
        ts: Number(entry.ts) || Date.now()
    };
}

function openDiaryWrite(){
    const isLegend = G.lv >= 4;
    const inner = document.getElementById('diaryModalInner');
    inner.className = 'diary-modal-inner' + (isLegend?' legend':'');
    document.getElementById('diaryModalTitle').textContent = isLegend ? '✦ Legend Diary' : t('diary_title');
    const now = new Date();
    const dateStr = now.toLocaleDateString(localeCode(), {year:'numeric',month:'long',day:'numeric',weekday:'long'});
    document.getElementById('diaryDateLabel').textContent = dateStr;
    const todayKey = getLocalDateKey(now);
    const entries = getDiaryEntries();
    const todayEntry = entries.find(e => e.date === todayKey);
    const ta = document.getElementById('diaryInput');
    ta.value = todayEntry ? todayEntry.text : '';
    updateDiaryCharCount();
    document.querySelector('.diary-save-btn').textContent = todayEntry ? t('diary_update') : t('diary_save');
    document.getElementById('diaryModal').style.display = 'flex';
    setTimeout(()=>ta.focus(), 380);
}

function updateDiaryCharCount(){
    const len = document.getElementById('diaryInput').value.length;
    document.getElementById('diaryCharCount').textContent = `${len}/500`;
}

function closeDiaryModal(){ document.getElementById('diaryModal').style.display = 'none'; }

function saveDiaryEntry(){
    const text = document.getElementById('diaryInput').value.trim();
    if(!text){ showToast(currentLang === 'ja' ? '日記を書いてから保存してね！' : 'Write something before saving your diary!', true); return; }
    const entries = getDiaryEntries();
    const todayKey = getLocalDateKey();
    const idx = entries.findIndex(e => e.date === todayKey);
    const entry = { date: todayKey, text, lv: G.lv, ts: Date.now() };
    if(idx >= 0) entries[idx] = entry;
    else entries.unshift(entry);
    saveDiaryEntries(entries);
    showToast(currentLang === 'ja' ? '📔 今日の日記を保存したよ！' : '📔 Saved today’s diary!');
    setMsg(G.lv>=4
        ? (currentLang === 'ja' ? '✦ Legend Diaryに今日の思い出を刻んだよ！' : '✦ Today’s memory was etched into the Legend Diary!')
        : (currentLang === 'ja' ? '📔 今日の思い出を記録したよ！' : '📔 Today’s memory was recorded!'));
    closeDiaryModal();
    G.exp += 5;
    checkLevelUp(); updateUI();
}

function updateDiaryBtnSub(){
    const sub = document.getElementById('diaryBtnSub');
    if(!sub) return;
    const todayKey = getLocalDateKey();
    const hasToday = getDiaryEntries().some(e => e.date === todayKey);
    sub.textContent = hasToday
        ? (currentLang === 'ja' ? '✏️ 今日は記入済み — タップで編集' : '✏️ Already written today — tap to edit')
        : t('diary_sub_write');
}

function escapeHtml(s){
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDiaryHtml(s){
    return escapeHtml(s).replace(/\n/g,'<br>');
}

function hashDiarySeed(entry){
    const src = `${entry.date}|${entry.lv}|${entry.text || ''}`;
    let hash = 0;
    for(let i=0;i<src.length;i++) hash = (hash * 31 + src.charCodeAt(i)) >>> 0;
    return hash;
}

function getDiaryScrapTags(entry){
    const text = (entry.text || '').toLowerCase();
    const tagDefs = currentLang === 'ja'
        ? [
            { test: /walrus/, label: '#Walrus' },
            { test: /\bsui\b/, label: '#Sui' },
            { test: /note|記事|メモ/, label: '#NotePick' },
            { test: /nft|mint|tradeport/, label: '#NFT' },
            { test: /ゲーム|game|play/, label: '#GameLog' },
            { test: /作っ|build|dev|検証|実装/, label: '#BuildLog' }
        ]
        : [
            { test: /walrus/, label: '#Walrus' },
            { test: /\bsui\b/, label: '#Sui' },
            { test: /note|article|memo/, label: '#NotePick' },
            { test: /nft|mint|tradeport/, label: '#NFT' },
            { test: /game|play/, label: '#GameLog' },
            { test: /build|dev|test|ship/, label: '#BuildLog' }
        ];
    const found = tagDefs.filter(tag => tag.test.test(text)).map(tag => tag.label);
    if(!found.length) found.push(currentLang === 'ja' ? '#WalrusDiary' : '#WalrusDiary');
    if(entry.lv >= 4 && !found.includes('#Legend')) found.push('#Legend');
    return found.slice(0, 4);
}

function makeWalrusDiaryComment(entry){
    const seed = hashDiarySeed(entry);
    const tags = getDiaryScrapTags(entry);
    const jpComments = [
        `この日のメモ、${tags[0]} の匂いが濃いね。あとで読み返しても「その時おもしろかった理由」がちゃんと残ってるやつ。`,
        `Walrus視点だと、これは発見をしまっておくポケットみたいな一枚。小ネタでも温度があると、スクラップとして強いよ。`,
        `ここに残ってるのは出来事そのものより、${tags[0]} を見つけたときの反応かも。そういう日記、ぼくはかなり好き。`,
        `採集ログとして見るとすごく良い感じ。『何を集めたか』だけじゃなく、『どう感じたか』まで拾えてるのがいいね。`
    ];
    const enComments = [
        `This one carries strong ${tags[0]} energy. It keeps the reason the moment felt interesting, not just the fact that it happened.`,
        `From the Walrus view, this is a pocket-sized find worth pinning to the scrapbook. Small detail, good temperature, very keepable.`,
        `What stays here is not only the event but the reaction to finding it. That makes the diary feel collected instead of merely stored.`,
        `As a field note, this works really well. It saves both the discovery and the mood around it, which is exactly scrapbook logic.`
    ];
    const pool = currentLang === 'ja' ? jpComments : enComments;
    return pool[seed % pool.length];
}

function openDiaryView(){
    closeDiaryModal();
    const isLegend = G.lv >= 4;
    document.getElementById('diaryViewInner').className = 'diary-view-inner' + (isLegend?' legend':'');
    document.getElementById('diaryViewTitle').textContent = isLegend ? '✦ Legend Diary' : t('diary_book');
    renderDiaryEntries();
    document.getElementById('diaryViewModal').style.display = 'flex';
}

function renderDiaryEntries(){
    const entries = getDiaryEntries();
    const list = document.getElementById('diaryEntriesList');
    if(!entries.length){
        list.innerHTML = currentLang === 'ja'
            ? '<div class="diary-empty">まだ日記がありません 📔<br>最初の思い出を書いてみよう！🦭</div>'
            : '<div class="diary-empty">No diary entries yet 📔<br>Write your first memory! 🦭</div>';
        return;
    }
    list.innerHTML = entries.map(e => {
        const isLeg = e.lv >= 4;
        const [y,m,d] = e.date.split('-');
        const dateObj = new Date(+y, +m-1, +d);
        const dateLabel = dateObj.toLocaleDateString(localeCode(),{year:'numeric',month:'long',day:'numeric'});
        const lvLabel = getLvName(e.lv) || '';
        const tags = getDiaryScrapTags(e);
        const comment = makeWalrusDiaryComment(e);
        return `<div class="diary-entry-card scrapbook-entry${isLeg?' legend-entry':''}">
            <div class="diary-entry-meta">
                <div class="diary-entry-date">${isLeg?'✦ ':''}${dateLabel}</div>
                <div class="diary-entry-lv">${isLeg?'👑 ':''}${lvLabel}</div>
            </div>
            <div class="diary-entry-kicker">${currentLang === 'ja' ? 'Walrus Scrapbook Entry / 採集ログ' : 'Walrus Scrapbook Entry'}</div>
            <div class="diary-entry-text">${formatDiaryHtml(e.text)}</div>
            <div class="diary-entry-tags">${tags.map(tag => `<span class="diary-entry-tag">${tag}</span>`).join('')}</div>
            <div class="diary-walrus-comment"><strong>${currentLang === 'ja' ? 'Walrus comment' : 'Walrus comment'}:</strong> ${escapeHtml(comment)}</div>
        </div>`;
    }).join('');
}

function closeDiaryViewModal(){ document.getElementById('diaryViewModal').style.display = 'none'; }

async function saveDiaryToWalrus(){
    const btn = document.getElementById('btnDiarySave');
    const entries = getDiaryEntries();
    if(!entries.length){ showToast(currentLang === 'ja' ? '日記がまだありません' : 'No diary entries yet', true); return; }
    btn.disabled = true; btn.textContent = currentLang === 'ja' ? '🌐 保存中…' : '🌐 Saving...';
    const blobId = await uploadToWalrus(JSON.stringify({ walrus_diary: entries, version: 1 }), 'walrus-diary.json');
    if(blobId){ localStorage.setItem('walrus_diary_blobid', blobId); showToast(currentLang === 'ja' ? '✅ 日記をWalrusに永久保存！' : '✅ Diary saved permanently on Walrus!'); setMsg(currentLang === 'ja' ? '🌐 日記をWalrusに保存したよ！ 永久記録 🦭' : '🌐 Diary saved to Walrus! Permanent record 🦭'); }
    else { showToast(currentLang === 'ja' ? '⚠ Walrus保存失敗' : '⚠ Walrus save failed', true); }
    btn.disabled = false; btn.textContent = t('diary_save_walrus');
}

async function loadDiaryFromWalrus(){
    const blobId = localStorage.getItem('walrus_diary_blobid');
    if(!blobId){ showToast(currentLang === 'ja' ? 'Walrusの日記データがありません' : 'No Walrus diary data found', true); return; }
    if(!confirm(currentLang === 'ja' ? 'Walrusから日記を復元しますか？ ローカルの日記は上書きされます' : 'Load diary from Walrus? Your local diary will be overwritten.')) return;
    const btn = document.getElementById('btnDiaryLoad');
    btn.disabled = true; btn.textContent = currentLang === 'ja' ? '📥 復元中…' : '📥 Loading...';
    try{
        const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`,{method:'GET',headers:{'Accept':'application/octet-stream,*/*'}});
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const js = text.indexOf('{'), je = text.lastIndexOf('}');
        if(js===-1||je===-1) throw new Error('JSON not found');
        const data = JSON.parse(text.slice(js, je+1));
        if(data.walrus_diary && Array.isArray(data.walrus_diary)){
            const normalizedEntries = normalizeDiaryEntries(data.walrus_diary);
            if(!normalizedEntries.length) throw new Error('No valid diary entries');
            saveDiaryEntries(normalizedEntries); renderDiaryEntries(); updateUI();
            showToast(currentLang === 'ja' ? '📥 日記をWalrusから復元！' : '📥 Diary restored from Walrus!');
        } else throw new Error('Invalid format');
    } catch(e){ console.warn('Diary load error:', e); showToast(currentLang === 'ja' ? '⚠ 復元に失敗しました' : '⚠ Restore failed', true); }
    btn.disabled = false; btn.textContent = t('diary_load_walrus');
}

/* ===== WALRUS EXCHANGE ===== */
const EXCHANGE_PLAYS = {
    snack: {
        icon: '🐟',
        ja: { name: 'おさかなシェア', desc: 'おやつを半分こ。満腹もハッピーも少し上がるよ。' },
        en: { name: 'Fish Snack Share', desc: 'Split a snack together. Happy and Full both rise a bit.' },
        reward: { happy: 14, exp: 8, hunger: 8 },
        particles: ['🐟','💚','✨','🐟','💗']
    },
    bubble: {
        icon: '🫧',
        ja: { name: 'ぷくぷくダンス', desc: '泡のまわりで一緒にダンス。ハッピーが大きく上がるよ。' },
        en: { name: 'Bubble Dance', desc: 'Dance around bubbles together. Happy rises a lot.' },
        reward: { happy: 18, exp: 10, hunger: -4 },
        particles: ['🫧','💙','✨','🫧','⭐']
    },
    treasure: {
        icon: '💎',
        ja: { name: '宝物交換', desc: 'きらきらの宝物を見せ合うよ。経験値が多めにもらえる。' },
        en: { name: 'Treasure Swap', desc: 'Show each other shiny treasures. Earn more EXP.' },
        reward: { happy: 10, exp: 18, hunger: 0 },
        particles: ['💎','⭐','✨','💎','💚']
    },
    'friend-visit': {
        icon: FRIEND_VISIT_PLAY.icon,
        ja: { name: '一緒にぷかぷかした！', desc: 'Friend QR から友達Walrusがふわっと遊びに来た。' },
        en: { name: 'Floated together!', desc: 'A friend Walrus drifted in through the Friend QR.' },
        reward: FRIEND_VISIT_PLAY.reward,
        particles: FRIEND_VISIT_PLAY.particles
    }
};
let selectedExchangePlay = 'snack';

function getExchangePlay(key = selectedExchangePlay){
    return EXCHANGE_PLAYS[key] || EXCHANGE_PLAYS.snack;
}

function getExchangePlayText(key = selectedExchangePlay){
    const play = getExchangePlay(key);
    return play[currentLang === 'ja' ? 'ja' : 'en'];
}

function formatExchangeReward(reward){
    const parts = [];
    if(reward.hunger) parts.push(`ENERGY ${reward.hunger > 0 ? '+' : ''}${reward.hunger}`);
    if(reward.happy) parts.push(`BOND ${reward.happy > 0 ? '+' : ''}${reward.happy}`);
    if(reward.exp) parts.push(`MEMORY ${reward.exp > 0 ? '+' : ''}${reward.exp}`);
    return parts.join(' / ');
}

function updateExchangePlayUI(){
    const label = document.getElementById('exchangePlayLabel');
    if(label) label.textContent = currentLang === 'ja' ? '交換あそびを選ぶ' : 'Choose Exchange Play';
    document.querySelectorAll('.exchange-play-btn').forEach(btn => {
        const key = btn.dataset.play;
        const play = getExchangePlay(key);
        const text = getExchangePlayText(key);
        btn.classList.toggle('active', key === selectedExchangePlay);
        const name = btn.querySelector('.exchange-play-name');
        const reward = btn.querySelector('.exchange-play-reward');
        if(name) name.textContent = text.name;
        if(reward) reward.textContent = formatExchangeReward(play.reward);
    });
    const preview = document.getElementById('exchangePreview');
    if(preview){
        const play = getExchangePlay();
        const text = getExchangePlayText();
        preview.innerHTML = `<div class="exchange-preview-icon">${play.icon}</div><div class="exchange-preview-text"><strong>${text.name}</strong><br>${text.desc}</div>`;
    }
}

function selectExchangePlay(key){
    selectedExchangePlay = EXCHANGE_PLAYS[key] ? key : 'snack';
    updateExchangePlayUI();
}

function getExchangeHistory(){
    try { const s = localStorage.getItem('walrus_exchange_history'); return s ? JSON.parse(s) : []; } catch(e) { return []; }
}
function saveExchangeHistory(h){
    try { localStorage.setItem('walrus_exchange_history', JSON.stringify(h.slice(0, 30))); } catch(e) {}
}

function openExchangeModal(){
    refreshMyShareCode();
    renderExchangeHistory();
    updateExchangePlayUI();
    document.getElementById('friendCodeInput').value = '';
    switchExchangeTab('mycode');
    document.getElementById('exchangeModal').style.display = 'flex';
}

function closeExchangeModal(){
    document.getElementById('exchangeModal').style.display = 'none';
}

function switchExchangeTab(tab){
    const MAP = { mycode: 'MyCode', friend: 'Friend', history: 'History' };
    Object.keys(MAP).forEach(t => {
        const suffix = MAP[t];
        document.getElementById('panel' + suffix).classList.toggle('active', t === tab);
        document.getElementById('tab'   + suffix).classList.toggle('active', t === tab);
    });
}

function refreshMyShareCode(){
    const blobId = localStorage.getItem('walrus_blobid');
    const el = document.getElementById('myShareCode');
    if(blobId){
        el.textContent = blobId;
        el.classList.remove('empty');
    } else {
        el.textContent = currentLang === 'ja'
            ? 'まずWalrusを保存してシェアコードを発行しよう！\n（上のボタンで発行できるよ）'
            : 'Save to Walrus first, then generate your share code!\n(Use the button above.)';
        el.classList.add('empty');
    }
}

async function generateShareCode(){
    const btn = document.getElementById('btnGenCode');
    btn.disabled = true;
    btn.innerHTML = `<div class="btn-spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,0.2);border-top:2px solid #030c1a;border-radius:50%;animation:spin 0.8s linear infinite;"></div> ${currentLang === 'ja' ? 'Walrus保存中…' : 'Saving to Walrus...'}`;
    saveG();
    const blobId = await uploadToWalrus(JSON.stringify(G));
    if(blobId){
        localStorage.setItem('walrus_blobid', blobId);
        updateUI();
        showToast(currentLang === 'ja' ? '✅ シェアコード発行完了！' : '✅ Share code generated!');
    } else {
        showToast(currentLang === 'ja' ? '⚠ Walrus保存に失敗しました' : '⚠ Failed to save to Walrus', true);
    }
    btn.disabled = false;
    btn.innerHTML = t('gen_share_code');
}

function copyShareCode(){
    const blobId = localStorage.getItem('walrus_blobid');
    if(!blobId){ showToast(currentLang === 'ja' ? 'まずシェアコードを発行してね！' : 'Generate a share code first!', true); return; }
    navigator.clipboard.writeText(blobId)
        .then(() => showToast(currentLang === 'ja' ? '📋 シェアコードをコピーしたよ！' : '📋 Share code copied!'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = blobId;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            showToast(currentLang === 'ja' ? '📋 コピーしました！' : '📋 Copied!');
        });
}

async function exchangeWithFriend(){
    const code = document.getElementById('friendCodeInput').value.trim();
    if(!code){ showToast(currentLang === 'ja' ? 'シェアコードを入力してね' : 'Enter a share code', true); return; }
    const playKey = selectedExchangePlay;
    const play = getExchangePlay(playKey);
    const playText = getExchangePlayText(playKey);
    const reward = play.reward;

    const myCode = localStorage.getItem('walrus_blobid');
    if(code === myCode){ showToast(currentLang === 'ja' ? '自分のコードとは交流できないよ！' : 'You cannot exchange with your own code!', true); return; }

    const history = getExchangeHistory();
    const recentExchange = history.find(h => h.code === code.slice(0,24));
    if(recentExchange && Date.now() - recentExchange.ts < 5 * 60 * 1000){
        showToast(currentLang === 'ja' ? '同じWalrusとの交流は5分待ってね ⏱' : 'Please wait 5 minutes before exchanging with the same Walrus ⏱', true); return;
    }

    const btn = document.getElementById('btnExchange');
    btn.disabled = true;
    btn.innerHTML = `<div class="btn-spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,0.2);border-top:2px solid #030c1a;border-radius:50%;animation:spin 0.8s linear infinite;"></div> ${currentLang === 'ja' ? '交換あそび中…' : 'Playing exchange...'}`;

    try{
        const friendData = await fetchWalrusDataByBlobId(code);

        G.happy = Math.min(100, G.happy + reward.happy);
        G.hunger = Math.min(100, Math.max(0, G.hunger + reward.hunger));
        G.exp += reward.exp;

        const newEntry = {
            ts: Date.now(),
            code: code.slice(0, 24),
            friendLv: Math.max(1, Math.min(4, friendData.lv || 1)),
            friendHunger: Math.round(friendData.hunger || 50),
            friendHappy: Math.round(friendData.happy || 50),
            playKey,
            playName: playText.name,
            playIcon: play.icon,
            reward
        };
        history.unshift(newEntry);
        saveExchangeHistory(history);

        const entries = getDiaryEntries();
        const todayKey = getLocalDateKey();
        const friendLvName = getLvName(newEntry.friendLv) || 'Walrus';
        const rewardText = formatExchangeReward(reward);
        const diaryAutoText = currentLang === 'ja'
            ? `🤝 Lv.${newEntry.friendLv} ${friendLvName}と「${playText.name}」で交換遊びしたよ！\n${playText.desc}\n（${rewardText}）`
            : `🤝 Played "${playText.name}" with Lv.${newEntry.friendLv} ${friendLvName}!\n${playText.desc}\n(${rewardText})`;
        const todayIdx = entries.findIndex(e => e.date === todayKey);
        if(todayIdx >= 0){
            if(!entries[todayIdx].text.includes(playText.name))
                entries[todayIdx].text += '\n\n' + diaryAutoText;
        } else {
            entries.unshift({ date: todayKey, text: diaryAutoText, lv: G.lv, ts: Date.now() });
        }
        saveDiaryEntries(entries);

        closeExchangeModal();
        showVisitingAnimation(newEntry);
        checkLevelUp(); updateUI();

    } catch(e){
        console.warn('Exchange error:', e);
        if(e.message.includes('404') || e.message.includes('400')){
            showToast(currentLang === 'ja' ? '⚠ コードが見つかりません。確認してね' : '⚠ Code not found. Please check it.', true);
        } else if(e.message.includes('Invalid')){
            showToast(currentLang === 'ja' ? '⚠ Walrusデータの形式が違います' : '⚠ Invalid Walrus data format', true);
        } else {
            showToast(currentLang === 'ja' ? '⚠ 交流に失敗しました。時間をおいて試してね' : '⚠ Exchange failed. Please try again later.', true);
        }
    }

    btn.disabled = false;
    btn.innerHTML = t('exchange_now');
}

function showVisitingAnimation(exchangeEntry){
    const friendLv = Math.max(1, Math.min(4, exchangeEntry.friendLv || 1));
    const friendName = (exchangeEntry.friendName || '').trim();
    const friendLvName = friendName || getLvName(friendLv) || 'Walrus';
    const play = getExchangePlay(exchangeEntry.playKey);
    const playText = exchangeEntry.playName
        ? { name: exchangeEntry.playName, desc: exchangeEntry.playDesc || getExchangePlayText(exchangeEntry.playKey).desc }
        : getExchangePlayText(exchangeEntry.playKey);
    const reward = exchangeEntry.reward || play.reward;

    document.getElementById('visitMyWalrus').innerHTML = makeWalrus(G.lv, 'happy');
    document.getElementById('visitFriendWalrus').innerHTML = makeWalrus(friendLv, 'happy');
    const friendLabel = document.getElementById('visitFriendLabel');
    friendLabel.textContent = `Lv.${friendLv} ${friendLvName}`;
    friendLabel.dataset.dynamic = 'true';
    document.getElementById('visitingMsg').textContent = exchangeEntry.visitMessage || (currentLang === 'ja' ? `Lv.${friendLv} ${friendLvName}と交換遊び！` : `Exchange play with Lv.${friendLv} ${friendLvName}!`);
    const playChip = document.getElementById('visitingPlayChip');
    if(playChip) playChip.textContent = `${play.icon} ${playText.name}`;
    const rewardWrap = document.querySelector('#visitingOverlay .visiting-rewards');
    if(rewardWrap){
        rewardWrap.innerHTML = [
            reward.hunger ? `<div class="visiting-reward-chip">◇ ENERGY ${reward.hunger > 0 ? '+' : ''}${reward.hunger}</div>` : '',
            reward.happy ? `<div class="visiting-reward-chip pink">✦ BOND +${reward.happy}</div>` : '',
            reward.exp ? `<div class="visiting-reward-chip">◎ MEMORY +${reward.exp}</div>` : '',
            !reward.hunger && !reward.happy && !reward.exp ? `<div class="visiting-reward-chip">🫧 ${currentLang === 'ja' ? '今日はもう遊んだよ' : 'Already visited today'}</div>` : ''
        ].filter(Boolean).join('');
    }
    document.getElementById('visitingDiaryNote').textContent = exchangeEntry.diaryNote || (currentLang === 'ja' ? '📔 今日の日記に自動記録されたよ！' : '📔 Auto-recorded in today’s diary!');

    document.getElementById('visitingOverlay').style.display = 'flex';

    sfxExchange();
    haptic([30, 15, 60, 15, 30]);

    const c = getStageCenter();
    spawnParticles([...(play.particles || []),'🦭','💗'], c.x, c.y);
    spawnExchangePlayBurst(play);
    animPet('bounce');
    setMsg(exchangeEntry.resultMessage || (currentLang === 'ja' ? `🤝 ${playText.name}成功！ Lv.${friendLv} ${friendLvName}と仲良くなったよ` : `🤝 ${playText.name} complete! You became friends with Lv.${friendLv} ${friendLvName}`));
    if(exchangeEntry.autoCloseMs){
        clearTimeout(window.__friendVisitOverlayTimer);
        window.__friendVisitOverlayTimer = setTimeout(() => closeVisitingOverlay(), exchangeEntry.autoCloseMs);
    }
}

function closeVisitingOverlay(){
    clearTimeout(window.__friendVisitOverlayTimer);
    document.getElementById('visitingOverlay').style.display = 'none';
}

function appendFriendVisitDiaryEntry(meta){
    const todayKey = getLocalDateKey();
    const entries = getDiaryEntries();
    const todayIdx = entries.findIndex(e => e.date === todayKey);
    const rewardText = formatExchangeReward(meta.reward || {});
    const diaryAutoText = meta.repeatVisit
        ? (currentLang === 'ja'
            ? `🫧 ${meta.friendName} のWalrusがまた遊びに来たよ。今日はもう一緒にぷかぷか済み。`
            : `🫧 ${meta.friendName}'s Walrus drifted by again. You already floated together today.`)
        : (currentLang === 'ja'
            ? `🦭 ${meta.friendName} のWalrusが遊びに来た！\n${meta.playDesc}\n（${rewardText}）`
            : `🦭 ${meta.friendName}'s Walrus came to visit!\n${meta.playDesc}\n(${rewardText})`);
    if(todayIdx >= 0){
        if(!entries[todayIdx].text.includes(diaryAutoText)) entries[todayIdx].text += `\n\n${diaryAutoText}`;
    } else {
        entries.unshift({ date: todayKey, text: diaryAutoText, lv: G.lv, ts: Date.now() });
    }
    saveDiaryEntries(entries);
}

async function handleIncomingFriendVisit(friendId){
    const cleanFriendId = typeof friendId === 'string' ? friendId.trim() : '';
    if(!cleanFriendId) return { ok:false, reason:'missing' };
    const myFriendId = getOrCreateFriendIdForCurrentWalrus();
    if(myFriendId && cleanFriendId === myFriendId){
        showToast(currentLang === 'ja' ? '自分のFriend QRです' : 'This is your own Friend QR', true);
        setMsg(currentLang === 'ja' ? '自分のWalrusはいつもそばにいるよ' : 'Your own Walrus is already right here', true);
        return { ok:false, reason:'self' };
    }

    const blobId = resolveFriendId(cleanFriendId);
    if(!blobId){
        showToast(currentLang === 'ja' ? '友達Walrusを読み込めませんでした' : 'Could not load that friend Walrus', true);
        setMsg(currentLang === 'ja' ? 'Friend ID の解決に失敗しました' : 'Failed to resolve that Friend ID', true);
        return { ok:false, reason:'resolve_failed' };
    }

    const myBlobId = (localStorage.getItem('walrus_blobid') || '').trim();
    if(myBlobId && myBlobId === blobId){
        showToast(currentLang === 'ja' ? '自分のFriend QRです' : 'This is your own Friend QR', true);
        setMsg(currentLang === 'ja' ? '自分のWalrusはいつもそばにいるよ' : 'Your own Walrus is already right here', true);
        return { ok:false, reason:'self' };
    }

    try {
        const friendData = await fetchWalrusDataByBlobId(blobId);
        const dateKey = getLocalDateKey();
        const repeatedToday = hasFriendVisitRewardToday(cleanFriendId, dateKey);
        const reward = repeatedToday ? { hunger: 0, happy: 0, exp: 0 } : { ...FRIEND_VISIT_PLAY.reward };
        const friendLv = Math.max(1, Math.min(4, Number(friendData.lv) || 1));
        const friendName = (friendData.petName || '').trim() || (getLvName(friendLv) || 'Walrus');

        addWalMateFriend(cleanFriendId, {
            walrusName: friendName,
            level: friendLv
        });

        if(!repeatedToday){
            G.hunger = Math.min(100, Math.max(0, G.hunger + reward.hunger));
            G.happy = Math.min(100, G.happy + reward.happy);
            G.exp += reward.exp;
            markFriendVisitReward(cleanFriendId, { dateKey, blobId, walrusName: friendName });
        }

        const history = getExchangeHistory();
        history.unshift({
            ts: Date.now(),
            code: shortBlobId(blobId).slice(0, 24),
            friendId: cleanFriendId,
            friendLv,
            friendName,
            friendHunger: Math.round(friendData.hunger || 50),
            friendHappy: Math.round(friendData.happy || 50),
            playKey: FRIEND_VISIT_PLAY.key,
            playName: repeatedToday
                ? (currentLang === 'ja' ? 'また遊びに来たよ' : 'Dropped by again')
                : (currentLang === 'ja' ? '一緒にぷかぷかした！' : 'Floated together!'),
            playIcon: FRIEND_VISIT_PLAY.icon,
            reward,
            repeatedToday
        });
        saveExchangeHistory(history);

        appendFriendVisitDiaryEntry({
            friendName,
            reward,
            repeatVisit: repeatedToday,
            playDesc: currentLang === 'ja'
                ? '紹介ページの Friend QR から、ふわっと遊びに来てくれた。'
                : 'A Walrus drifted in from a Friend QR on the intro page.'
        });

        showVisitingAnimation({
            friendLv,
            friendName,
            playKey: FRIEND_VISIT_PLAY.key,
            playName: repeatedToday
                ? (currentLang === 'ja' ? 'また遊びに来たよ' : 'Dropped by again')
                : (currentLang === 'ja' ? '一緒にぷかぷかした！' : 'Floated together!'),
            playDesc: currentLang === 'ja'
                ? '紹介ページの Friend QR から、ふわっと遊びに来てくれた。'
                : 'A Walrus drifted in from the Friend QR on the intro page.',
            reward,
            visitMessage: repeatedToday
                ? (currentLang === 'ja' ? `${friendName} のWalrusがまた遊びに来たよ` : `${friendName}'s Walrus drifted by again`)
                : (currentLang === 'ja' ? `${friendName} のWalrusが遊びに来た！` : `${friendName}'s Walrus came to visit!`),
            diaryNote: repeatedToday
                ? (currentLang === 'ja' ? '🫧 今日はもう交流済み。軽くあいさつしたよ！' : '🫧 Already visited today, so this was just a quick hello!')
                : (currentLang === 'ja' ? '📔 交流履歴と今日の日記に自動記録されたよ！' : '📔 Logged to your visit history and diary automatically!'),
            resultMessage: repeatedToday
                ? (currentLang === 'ja' ? `🫧 ${friendName} のWalrusがまた顔を見せてくれたよ` : `🫧 ${friendName}'s Walrus stopped by again`)
                : (currentLang === 'ja' ? `🤝 ${friendName} のWalrusと仲良くなったよ` : `🤝 You connected with ${friendName}'s Walrus`),
            autoCloseMs: 3800
        });

        checkLevelUp();
        updateUI();
        return { ok:true, reason: repeatedToday ? 'repeat' : 'visited', blobId, friendName };
    } catch(e){
        console.warn('Friend visit error:', e);
        showToast(currentLang === 'ja' ? '友達Walrusを読み込めませんでした' : 'Could not load that friend Walrus', true);
        setMsg(currentLang === 'ja' ? '友達Walrusの訪問に失敗しました' : 'Friend visit failed to load', true);
        return { ok:false, reason:'load_failed', error:e };
    }
}

function spawnExchangePlayBurst(play){
    const overlay = document.getElementById('visitingOverlay');
    if(!overlay) return;
    const emojis = play.particles || ['💚','✨','⭐'];
    const rect = overlay.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.42;
    for(let i=0;i<18;i++){
        const p = document.createElement('div');
        p.className = 'fparticle';
        p.textContent = emojis[i % emojis.length];
        const angle = (i / 18) * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--ex', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--ey', Math.sin(angle) * dist + 'px');
        p.style.animation = 'exchangeBurst 1s ease-out forwards';
        document.body.appendChild(p);
        setTimeout(()=>p.remove(), 1100);
    }
}

function renderExchangeHistory(){
    const history = getExchangeHistory();
    const container = document.getElementById('exchangeHistoryContainer');
    if(!history.length){
        container.innerHTML = currentLang === 'ja'
            ? '<div class="diary-empty" style="padding:20px 0">まだ交流履歴がないよ<br>友達のコードを入力して交流しよう！🦭</div>'
            : '<div class="diary-empty" style="padding:20px 0">No exchange history yet<br>Enter a friend’s code to connect! 🦭</div>';
        return;
    }
    container.innerHTML = history.map(h => {
        const d = new Date(h.ts).toLocaleDateString(localeCode(), {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const lvName = (h.friendName || '').trim() || getLvName(h.friendLv) || 'Walrus';
        const isLeg = h.friendLv >= 4;
        const play = getExchangePlay(h.playKey);
        const playName = h.playName || getExchangePlayText(h.playKey).name;
        const reward = h.reward || { happy: 15, exp: 10, hunger: 0 };
        const safePlayIcon = escapeHtml(h.playIcon || play.icon || (isLeg?'👑':'🦭'));
        const safeLvName = escapeHtml(lvName);
        const safePlayName = escapeHtml(playName);
        const safeRewardText = escapeHtml(formatExchangeReward(reward));
        return `<div class="exchange-history-item">
            <div class="exchange-history-icon">${safePlayIcon}</div>
            <div class="exchange-history-text">
                <span style="color:${isLeg?'var(--gold)':'var(--teal)'};font-weight:700">Lv.${h.friendLv} ${safeLvName}</span> · ${safePlayName}<br>
                <span style="color:rgba(255,255,255,0.28);font-size:0.68rem">${d} · ${safeRewardText}</span>
            </div>
        </div>`;
    }).join('');
}

function updateExchangeBtnSub(){
    const sub = document.getElementById('exchangeBtnSub');
    if(!sub) return;
    const history = getExchangeHistory();
    const blobId = localStorage.getItem('walrus_blobid');
    if(!blobId){
        sub.textContent = t('exchange_sub_no_code');
    } else if(history.length === 0){
        sub.textContent = t('exchange_sub_ready');
    } else {
        sub.textContent = currentLang === 'ja' ? `${history.length}回交流済み ✨` : `${history.length} exchanges ✨`;
    }
}

function playHatchSplashCanvas(){
    if(isLowPowerMobile()){
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;z-index:260;pointer-events:none;background:rgba(190,245,255,0.24);animation:hatchMobileFlash 520ms ease-out forwards;';
        document.body.appendChild(flash);
        const lite = document.createElement('div');
        lite.className = 'hatch-lite-splash';
        const ring = document.createElement('div');
        ring.className = 'hatch-lite-ring';
        lite.appendChild(ring);
        const count = isIosDevice() ? 8 : 10;
        for(let i=0;i<count;i++){
            const d = document.createElement('div');
            d.className = 'hatch-lite-drop';
            const angle = (-Math.PI * 0.92) + (i / Math.max(1, count - 1)) * Math.PI * 1.84;
            const dist = (isIosDevice() ? 62 : 74) + Math.random() * 26;
            d.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
            d.style.setProperty('--dy', `${Math.sin(angle) * dist - 10}px`);
            lite.appendChild(d);
        }
        document.body.appendChild(lite);
        setTimeout(()=>flash.remove(), 620);
        setTimeout(()=>lite.remove(), 980);
        return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    canvas.style.cssText = 'position:fixed;inset:0;z-index:260;pointer-events:none;width:100vw;height:100dvh;';
    document.body.appendChild(canvas);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 520 ? 1.15 : 1.5);
    const resize = () => {
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const W = window.innerWidth, H = window.innerHeight;
    const count = reduce ? 18 : (window.innerWidth < 520 ? 42 : 64);
    const drawDrop = (d) => {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(Math.atan2(d.vy, d.vx));
        ctx.scale(0.75, 1.45);
        ctx.beginPath();
        ctx.arc(0, 0, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };
    const droplets = Array.from({length: count}, (_, i) => {
        const angle = -Math.PI * 0.95 + (i / Math.max(1, count - 1)) * Math.PI * 1.9 + (Math.random() - 0.5) * 0.35;
        const speed = 8 + Math.random() * 20;
        return {
            x: W / 2 + (Math.random() - 0.5) * 80,
            y: H * 0.52 + (Math.random() - 0.5) * 70,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 5,
            r: 2 + Math.random() * 7,
            life: 1,
            hue: 184 + Math.random() * 28
        };
    });
    const start = performance.now();
    const draw = (now) => {
        const t = Math.min(1, (now - start) / 920);
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = (1 - t) * 0.45;
        ctx.fillStyle = 'rgba(190,245,255,0.32)';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        droplets.forEach(d => {
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.48;
            d.vx *= 0.985;
            d.life -= 0.022;
            if(d.life <= 0) return;
            ctx.globalAlpha = Math.max(0, d.life) * (1 - t * 0.38);
            if(!isLikelyIOSDevice()){
                ctx.shadowBlur = 18;
                ctx.shadowColor = `hsla(${d.hue},100%,78%,0.75)`;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fillStyle = `hsla(${d.hue},100%,86%,0.78)`;
            if(ctx.ellipse){
                ctx.beginPath();
                ctx.ellipse(d.x, d.y, d.r * 0.75, d.r * 1.45, Math.atan2(d.vy, d.vx), 0, Math.PI * 2);
                ctx.fill();
            } else {
                drawDrop(d);
            }
        });
        ctx.globalAlpha = (1 - t) * 0.85;
        if(!isLikelyIOSDevice()){
            ctx.shadowBlur = 34;
            ctx.shadowColor = 'rgba(126,200,255,0.9)';
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = 'rgba(228,250,255,0.86)';
        ctx.lineWidth = 3 + t * 7;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.52, 40 + t * Math.max(W, H) * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        if(t < 1) requestAnimationFrame(draw);
        else canvas.remove();
    };
    requestAnimationFrame(draw);
}

/* ===== HATCHING ===== */
function spawnCrackSparks(count = 10){
    const parts = document.getElementById('hatchParticles');
    if(!parts) return;
    const sparks = ['✦','✨','💧','🫧'];
    for(let i=0;i<count;i++){
        const p = document.createElement('div');
        p.className = 'crack-spark';
        p.textContent = sparks[i % sparks.length];
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
        const dist = 42 + Math.random() * 74;
        p.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
        p.style.animationDelay = (i * 32) + 'ms';
        parts.appendChild(p);
        setTimeout(() => p.remove(), 1000 + i * 32);
    }
}

function setHatchGuideStep(activeStep = 0){
    const steps = [
        document.getElementById('hatchStep0'),
        document.getElementById('hatchStep1'),
        document.getElementById('hatchStep2')
    ];
    steps.forEach((step, index) => {
        if(!step) return;
        step.classList.toggle('active', index === activeStep);
        step.classList.toggle('done', index < activeStep);
    });
}

/* ===== NAMING OVERLAY ===== */
const PET_NAME_KEY = 'walrus_pet_name';

function showNamingOverlay(onConfirm) {
    const overlay = document.getElementById('nameOverlay');
    const input   = document.getElementById('nameInput');
    const confirmBtn = document.getElementById('nameConfirmBtn');
    const countEl   = document.getElementById('nameInputCount');
    const titleEl   = document.getElementById('nameOverlayTitle');
    const subEl     = document.getElementById('nameOverlaySub');
    const echoEl    = document.getElementById('nameWalrusEcho');
    if(!overlay || !input || !confirmBtn) { onConfirm('たじゅまる'); return; }

    const isJa = currentLang === 'ja';
    if(titleEl) titleEl.textContent = isJa ? 'なまえをつけよう！' : 'Name your Walrus!';
    if(subEl)   subEl.textContent   = isJa
        ? 'きみだけの Walrus に、特別な名前を！（最大12文字）'
        : 'Give your Walrus a name! (up to 12 chars)';
    if(confirmBtn) confirmBtn.textContent = isJa ? '✨ この名前にする！' : '✨ Set this name!';
    input.placeholder = isJa ? 'たじゅまる' : 'WalKun';
    input.value = G.petName || (isJa ? 'たじゅまる' : 'WalKun');
    if(echoEl) echoEl.innerHTML = createHatchBaby();

    const updateCount = () => {
        if(countEl) countEl.textContent = `${[...input.value].length}/12`;
    };
    updateCount();
    input.addEventListener('input', updateCount);

    overlay.classList.remove('hidden');
    overlay.classList.add('pop-in');
    setTimeout(() => input.focus(), 300);

    const doConfirm = () => {
        const raw = input.value.trim();
        const name = raw.length > 0 ? [...raw].slice(0, 12).join('') : (isJa ? 'たじゅまる' : 'WalKun');
        if(raw.length === 0) {
            confirmBtn.classList.add('shake');
            setTimeout(() => confirmBtn.classList.remove('shake'), 400);
            input.value = '';
            input.focus();
            return;
        }
        G.petName = name;
        saveG();
        overlay.classList.add('hidden');
        overlay.classList.remove('pop-in');
        if(typeof onConfirm === 'function') onConfirm(name);
    };

    confirmBtn.onclick = doConfirm;
    input.onkeydown = (e) => { if(e.key === 'Enter') doConfirm(); };
}

// helper to get emoji for echo (uses existing createHatchBaby logic if possible)
function createHatchBabyEmoji() { return '🦭'; }

function showMainAfterHatch(){
    try {
        document.getElementById('hatchScreen')?.classList.add('hidden');
        document.getElementById('mainScreen')?.classList.remove('hidden');
        resumeBgCanvas();
        updateUI();
        startDecay();
        startRandomEvents();
    } catch(e) {
        console.warn('Hatch fallback failed:', e);
    }
}

function runHatching(){
    const eggWrap=document.getElementById('eggWrap');
    const eggSvg=document.getElementById('eggSvg');
    const hatchBaby=document.getElementById('hatchBaby');
    const hatchBurst=document.getElementById('hatchBurst');
    const hatchMsg=document.getElementById('hatchMsg');
    const hatchHint=document.getElementById('hatchHint');
    const hatchTapBtn=document.getElementById('hatchTapBtn');
    if(!eggWrap || !eggSvg || !hatchBaby || !hatchBurst || !hatchMsg || !hatchHint){
        showMainAfterHatch();
        return;
    }
    setHatchGuideStep(0);
    const lowPower = isLowPowerMobile();
    pauseBgCanvas();
    const hatchStep = (fn) => {
        try { fn(); }
        catch(e) {
            console.warn('Hatching step failed:', e);
            showMainAfterHatch();
        }
    };

    const tapsRequired = lowPower ? 3 : 4;
    let hatchTapCount = 0;
    let birthReady = false;
    const updateHatchTapCta = () => {
        if(!hatchTapBtn) return;
        hatchTapBtn.textContent = currentLang === 'ja'
            ? `👆 ${tapsRequired - hatchTapCount}回タップで生まれる！`
            : `👆 ${tapsRequired - hatchTapCount} taps to hatch!`;
    };
    const onBirthTap = () => {
        if(hatched || !birthReady) return;
        hatchTapCount = Math.min(tapsRequired, hatchTapCount + 1);
        eggSvg.style.animation = 'none';
        void eggSvg.offsetWidth;
        eggSvg.classList.add('cracked');
        eggSvg.style.transform = `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 4}px) scale(${1 + hatchTapCount * 0.02})`;
        spawnCrackSparks(lowPower ? 3 : 6);
        haptic(hatchTapCount >= tapsRequired ? [30,25,60] : 18);
        hatchMsg.textContent = currentLang === 'ja'
            ? `コツン！ あと${Math.max(0, tapsRequired - hatchTapCount)}回！`
            : `Crack! ${Math.max(0, tapsRequired - hatchTapCount)} more!`;
        hatchHint.textContent = currentLang === 'ja'
            ? 'タップで殻を割ってあげよう'
            : 'Tap to help break the shell';
        updateHatchTapCta();
        if(hatchTapCount >= tapsRequired){
            doBirth();
        }
    };

    // 誕生シーケンス（連打後に実行）
    let hatched = false;
    const doBirth = () => {
        if(hatched) return;
        hatched = true;
        birthReady = false;
        if(hatchTapBtn) hatchTapBtn.classList.add('hidden');
        eggWrap.style.cursor = '';
        eggWrap.removeEventListener('click', onBirthTap);
        hatchTapBtn?.removeEventListener('click', onBirthTap);
        hatchStep(()=>{
            hatchMsg.textContent=currentLang === 'ja' ? 'パカッ！！ 🌊' : 'Pop!! 🌊';
            setHatchGuideStep(2);
            const parts=document.getElementById('hatchParticles');
            const emojis=['✨','💧','🌊','💎','⭐','🫧'];
            eggWrap.classList.remove('crack-warning', 'pre-hatch');
            hatchMsg.classList.remove('excited');
            hatchBurst.classList.remove('flash');
            void hatchBurst.offsetWidth;
            hatchBurst.classList.add('flash');
            eggSvg.classList.add('hatching-out');
            document.getElementById('eggShellLeft').classList.add('show');
            document.getElementById('eggShellRight').classList.add('show');
            hatchBaby.innerHTML = createHatchBaby();
            hatchBaby.classList.add('show');
            const burstCount = lowPower ? 8 : 22;
            for(let i=0;i<burstCount;i++){
                const p=document.createElement('div');
                p.style.cssText='position:absolute;top:50%;left:50%;font-size:18px;pointer-events:none;';
                const angle=(i/burstCount)*Math.PI*2, dist=(lowPower ? 58 : 90)+Math.random()*(lowPower ? 36 : 70);
                p.style.setProperty('--bx', Math.cos(angle)*dist+'px');
                p.style.setProperty('--by', Math.sin(angle)*dist+'px');
                p.style.animation='hburstAnim 0.85s ease-out forwards';
                p.textContent=emojis[i%6];
                parts.appendChild(p);
                setTimeout(()=>p.remove(), 950);
            }
            haptic([80,40,80]);
            eggSvg.style.transition='all 0.55s ease';
            eggSvg.style.opacity='0';
            eggSvg.style.transform='translateY(-20px) scale(1.2)';
            setTimeout(()=>{
                document.getElementById('hatchMsg').textContent=currentLang === 'ja' ? 'クー！ 生まれたよ〜 🦭' : 'Kuu! I am born~ 🦭';
                sfxLevelUp();
                playHatchSplashCanvas();
                setTimeout(()=>{
                    showNamingOverlay((confirmedName) => {
                        showMainAfterHatch();
                        setTimeout(()=>{
                            setMsg(currentLang === 'ja'
                                ? `クー！ ${confirmedName}、よろしくね 🍣`
                                : `Kuu! Nice to meet you, ${confirmedName} 🍣`);
                            renderWalkLogs();
                            try {
                                if(localStorage.getItem(NEWBORN_GUIDE_SEEN_KEY) !== '1') showNewbornGuide();
                            } catch(e) {
                                showNewbornGuide();
                            }
                        },700);
                    });
                },1800);
            },700);
        });
    };

    setTimeout(()=>hatchStep(()=>{
        hatchMsg.textContent=currentLang === 'ja' ? 'SUIの卵にひびが…！' : 'Cracks are appearing on the SUI egg...!';
        hatchHint.textContent=currentLang === 'ja' ? '中から光が漏れている…' : 'Light is leaking from inside...';
        setHatchGuideStep(1);
        document.getElementById('crack1').style.opacity='1';
        eggWrap.classList.add('crack-warning');
        hatchMsg.classList.add('excited');
        eggSvg.classList.add('urgent');
        spawnCrackSparks(lowPower ? 3 : 8);
        haptic(35);
    }),2800);
    setTimeout(()=>hatchStep(()=>{
        hatchHint.textContent=currentLang === 'ja' ? 'コツン、コツン… 何かが動いてる！' : 'Tap, tap... something is moving!';
        spawnCrackSparks(lowPower ? 4 : 12);
        haptic([25,30]);
    }),4100);
    setTimeout(()=>hatchStep(()=>{
        hatchMsg.textContent=currentLang === 'ja' ? 'もうすぐ孵化する…！！' : 'It is about to hatch...!!';
        document.getElementById('crack2').style.opacity='1';
        eggWrap.classList.add('pre-hatch');
        eggSvg.classList.remove('urgent');
        eggSvg.classList.add('cracked');
        setHatchGuideStep(2);
        hatchHint.textContent=currentLang === 'ja' ? '殻が限界までふくらんでる！' : 'The shell is about to burst!';
        spawnCrackSparks(lowPower ? 5 : 18);
        haptic([35,35,45]);
        birthReady = true;
        if(hatchTapBtn){
            hatchTapBtn.classList.remove('hidden');
            updateHatchTapCta();
            hatchTapBtn.addEventListener('click', onBirthTap);
        }
        eggWrap.style.cursor = 'pointer';
        eggWrap.addEventListener('click', onBirthTap);
        hatchHint.textContent = currentLang === 'ja'
            ? 'タップ連打で殻を割ってあげよう！'
            : 'Tap repeatedly to break the shell!';
    }),5200);
}

