// ===== BACKGROUND =====
let _bgPaused = false;
function pauseBgCanvas(){ _bgPaused = true; }
function resumeBgCanvas(){
    _bgPaused = false;
    restartBgCanvasLoop?.();
}
let refreshBgCssVarCache = null;
let restartBgCanvasLoop = null;
(function(){
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas?.getContext('2d');
    if(!ctx) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, rafId = null;
    let cachedRayColor = 'rgba(0,229,176,0.08)';
    let cachedBubbleBorder = 'rgba(0,229,176,0.25)';
    let cachedBubbleFill = 'rgba(0,229,176,0.04)';
    const bgLowPower = isLowPowerMobile();
    const rays = Array.from({length: bgLowPower ? 4 : 7}, (_, i) => ({
        x: 0.2 + i * 0.1,
        rot: (-30 + i * 12) * Math.PI / 180,
        width: 1 + Math.random(),
        height: 0.5 + Math.random() * 0.3,
        speed: 0.00045 + Math.random() * 0.00045,
        phase: Math.random() * Math.PI * 2
    }));
    const bubbles = Array.from({length: bgLowPower ? 10 : 22}, () => ({
        x: Math.random(),
        y: Math.random(),
        size: 6 + Math.random() * 36,
        speed: 0.000035 + Math.random() * 0.000055,
        drift: (Math.random() - 0.5) * 0.035,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.08 + Math.random() * 0.22
    }));
    const nodes = Array.from({length: bgLowPower ? 7 : 15}, () => ({
        x: 0.1 + Math.random() * 0.8,
        y: 0.1 + Math.random() * 0.8,
        size: 5 + Math.random() * 7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0012 + Math.random() * 0.001
    }));
    const links = nodes.slice(0, -1).map((node, i) => ({ from: node, to: nodes[(i + 3) % nodes.length], phase: Math.random() }));

    function resize(){
        dpr = Math.min(window.devicePixelRatio || 1, bgLowPower ? 1 : 1.5);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function refreshCssVarCache(){
        const style = getComputedStyle(document.documentElement);
        cachedRayColor = style.getPropertyValue('--ray-color').trim() || 'rgba(0,229,176,0.08)';
        cachedBubbleBorder = style.getPropertyValue('--bubble-border').trim() || 'rgba(0,229,176,0.25)';
        cachedBubbleFill = style.getPropertyValue('--bubble-fill').trim() || 'rgba(0,229,176,0.04)';
    }

    function startLoop(){
        if(rafId || reducedMotion || document.hidden || _bgPaused) return;
        rafId = requestAnimationFrame(draw);
    }

    refreshBgCssVarCache = refreshCssVarCache;
    restartBgCanvasLoop = startLoop;

    function stopLoop(){
        if(rafId){
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function draw(now = 0){
        rafId = null;
        if(_bgPaused || document.hidden) return;
        ctx.clearRect(0, 0, W, H);
        const useCanvasGlow = !isLikelyIOSDevice();

        rays.forEach(ray => {
            const pulse = 0.35 + Math.sin(now * ray.speed + ray.phase) * 0.28;
            ctx.save();
            ctx.translate(W * ray.x, H * 1.15);
            ctx.rotate(ray.rot);
            const grad = ctx.createLinearGradient(0, 0, 0, -H * ray.height);
            grad.addColorStop(0, cachedRayColor);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = pulse;
            ctx.fillStyle = grad;
            ctx.fillRect(-ray.width / 2, -H * ray.height, ray.width, H * ray.height);
            ctx.restore();
        });

        links.forEach(link => {
            const x1 = link.from.x * W, y1 = link.from.y * H;
            const x2 = link.to.x * W, y2 = link.to.y * H;
            ctx.globalAlpha = 0.24;
            ctx.strokeStyle = 'rgba(126,200,255,0.36)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const travel = (now * 0.00018 + link.phase) % 1;
            ctx.globalAlpha = 0.82;
            ctx.fillStyle = 'rgba(235,250,255,0.9)';
            if(useCanvasGlow){
                ctx.shadowBlur = 14;
                ctx.shadowColor = 'rgba(126,200,255,0.85)';
            }
            ctx.beginPath();
            ctx.arc(x1 + (x2 - x1) * travel, y1 + (y2 - y1) * travel, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        nodes.forEach(node => {
            const pulse = 0.65 + Math.sin(now * node.speed + node.phase) * 0.35;
            const r = node.size * pulse;
            const x = node.x * W, y = node.y * H;
            const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r * 1.9);
            grad.addColorStop(0, 'rgba(255,255,255,0.96)');
            grad.addColorStop(0.55, 'rgba(126,200,255,0.44)');
            grad.addColorStop(1, 'rgba(126,200,255,0)');
            ctx.globalAlpha = 0.58 + pulse * 0.22;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
            ctx.fill();
        });

        bubbles.forEach(b => {
            b.y -= b.speed * (reducedMotion ? 0.25 : 1) * 16.7;
            if(b.y < -0.12){
                b.y = 1.08;
                b.x = Math.random();
            }
            const x = (b.x + Math.sin(now * 0.00045 + b.phase) * b.drift) * W;
            const y = b.y * H;
            ctx.globalAlpha = b.opacity;
            ctx.fillStyle = cachedBubbleFill;
            ctx.strokeStyle = cachedBubbleBorder;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, b.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        startLoop();
    }

    resize();
    refreshCssVarCache();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if(document.hidden){
            stopLoop();
        } else {
            startLoop();
            // iOSバックグラウンドからの復帰: ウォーク中ならタイマーを再起動
            if(walkState.active) {
                clearInterval(walkState.timerInterval);
                walkState.timerInterval = setInterval(updateWalkUI, 1000);
                updateWalkUI();
            }
        }
    }, { passive: true });
    startLoop();
    window.addEventListener('beforeunload', stopLoop);
})();

// ===== WEB AUDIO =====
let audioCtx = null;
let masterGain = null;
let soundAnalyser = null;
let soundAnalyserData = null;
let soundVizFrame = 0;
let ambientStream = null;
let ambientSource = null;
let ambientAnalyser = null;
let ambientAnalyserData = null;
let ambientMonitorTimer = null;

const AMBIENT_SILENCE_THRESHOLD = 0.018;
const AMBIENT_SILENCE_GRACE_MS = 7000;
const AMBIENT_SAMPLE_MS = 1200;
const AMBIENT_PENALTY_STEP = 0.05;
let isMuted = false;
const MUTE_STORAGE_KEY = 'walrus_muted';

function ensureSoundAnalyser(){
    const ctx = getAudioCtx();
    if(!ctx) return null;
    if(soundAnalyser && soundAnalyser.context === ctx) return soundAnalyser;
    soundAnalyser = ctx.createAnalyser();
    soundAnalyser.fftSize = 256;
    soundAnalyser.smoothingTimeConstant = 0.82;
    soundAnalyser.minDecibels = -88;
    soundAnalyser.maxDecibels = -18;
    soundAnalyserData = new Uint8Array(soundAnalyser.frequencyBinCount);
    soundAnalyser.connect(ctx.destination);
    return soundAnalyser;
}

function getMasterGain(){
    if(!audioCtx) return null;
    const analyser = ensureSoundAnalyser();
    if(!masterGain){
        masterGain = audioCtx.createGain();
        masterGain.gain.value = isMuted ? 0 : 1;
    }
    try { masterGain.disconnect(); } catch(e){}
    masterGain.connect(analyser || audioCtx.destination);
    return masterGain;
}
function toggleMute(){
    isMuted = !isMuted;
    try { localStorage.setItem(MUTE_STORAGE_KEY, isMuted ? '1' : '0'); } catch(e){}
    if(masterGain) masterGain.gain.setTargetAtTime(isMuted ? 0 : 1, audioCtx.currentTime, 0.02);
    const btn = document.getElementById('muteSwitch');
    if(btn){
        btn.textContent = isMuted ? '🔇' : '🔊';
        btn.classList.toggle('muted', isMuted);
        btn.setAttribute('aria-label', isMuted ? '音をオンにする' : '消音にする');
    }
}
function detectMute(){
    try { return localStorage.getItem(MUTE_STORAGE_KEY) === '1'; } catch(e){ return false; }
}
window.addEventListener('pointerdown', () => {
    userGestureReady = true;
    try {
        // iOS Safari対策: ジェスチャー内でAudioContextを作成＆resume（同期的に行う必要がある）
        if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
        if(audioCtx.state === 'suspended') audioCtx.resume();
        getMasterGain(); // マスターGainを確実に初期化
    } catch(e){}
}, { passive: true });
function getAudioCtx(){
    if(!userGestureReady) return null;
    if(!audioCtx){ try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} }
    return audioCtx;
}
function playTone(freq, type='sine', dur=0.12, vol=0.08){
    try {
        const ctx = getAudioCtx(); if(!ctx) return;
        const mg = getMasterGain(); if(!mg) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(mg);
        osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        // iOS Safari: ノード停止後に必ずdisconnectしてAudioNodeリークを防ぐ
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(_){} };
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch(e){}
}

//AudioContextを pagehide で閉じる
window.addEventListener('pagehide', () => {
    try {
        if (audioCtx && audioCtx.state !== 'closed') {
            audioCtx.close();
        }
    } catch(e) {}

    audioCtx = null;
    masterGain = null;
    soundAnalyser = null;
    soundAnalyserData = null;
    cancelAnimationFrame(soundVizFrame);
    soundVizFrame = 0;
    stopAmbientMonitor();
}, { passive: true });


function sfxFeed()    { playTone(440,'sine',0.1,0.07); setTimeout(()=>playTone(660,'sine',0.08,0.06),80); }
function sfxPet()     { playTone(520,'sine',0.15,0.06); setTimeout(()=>playTone(780,'sine',0.1,0.05),100); }
function sfxPlay()    { [330,440,550,660].forEach((f,i)=>setTimeout(()=>playTone(f,'square',0.06,0.04),i*55)); }
function sfxLevelUp() {
    // iOS Safari対策: AudioContextがsuspendedなら再開してから再生
    try {
        const ac = getAudioCtx();
        const play = () => [440,554,659,880].forEach((f,i)=>setTimeout(()=>playTone(f,'triangle',0.18,0.08),i*90));
        if(ac && ac.state === 'suspended'){ ac.resume().then(play).catch(()=>{}); }
        else { play(); }
    } catch(e){}
}
function sfxBubble(r) { playTone(300+r*6,'sine',0.06,0.05); }
function sfxExchange(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.2,0.07),i*100)); }
function sfxBabyPop(){
    [740,980,1240].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.055,0.075),i*42));
    setTimeout(()=>playTone(420,'triangle',0.08,0.055),130);
}
function sfxKuu(){
    [620,760,690].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.14,0.055),i*95));
}

// ===== SOUND LAB =====
const SOUND_STORAGE_KEY = 'walrus_sound_slots';
const SOUND_MEMORY_KEY  = 'walrus_sound_memory';
const SOUND_DIET_RECENT_MAX = 8;

let activeZone = 'beach';
let soundSlots = { drum: null, bass: null, melody: null, fx: null };
let isTrackPlaying = false;
let soundLoopTimer = null;
let soundNextBarTime = 0;

// meters between potential sound drops
const SOUND_DROP_EVERY_M = 130;
let soundDropCheckpointM = 0;

const SOUND_DEF = {
    beach:  { drum:{name:'Wave Beat',emoji:'🌊'}, bass:{name:'Tide Bass',emoji:'🐋'}, melody:{name:'Seagull Cry',emoji:'🐦'}, fx:{name:'Ocean Mist',emoji:'💧'} },
    forest: { drum:{name:'Bark Knock',emoji:'🌿'}, bass:{name:'Root Hum',emoji:'🌲'}, melody:{name:'Bird Trill',emoji:'🪶'}, fx:{name:'Leaf Breeze',emoji:'🍃'} },
    city:   { drum:{name:'Street Snap',emoji:'🏙'}, bass:{name:'Metro Low',emoji:'🚇'}, melody:{name:'Neon Ping',emoji:'💡'}, fx:{name:'City Air',emoji:'🔊'} },
    ruins:  { drum:{name:'Echo Clap',emoji:'🏚'}, bass:{name:'Stone Drone',emoji:'🪨'}, melody:{name:'Ghost Bell',emoji:'🔔'}, fx:{name:'Dark Air',emoji:'🌫'} }
};
const ZONE_EMOJI = { beach:'🌊', forest:'🌿', city:'🏙', ruins:'🏚' };
const SLOT_KEYS = ['drum','bass','melody','fx'];

function createEmptySoundDiet(dateKey = getLocalDateKey()){
    return {
        dateKey,
        total: 0,
        zones: { beach: 0, forest: 0, city: 0, ruins: 0 },
        slots: { drum: 0, bass: 0, melody: 0, fx: 0 },
        recent: []
    };
}

function normalizeSoundDiet(diet){
    const base = createEmptySoundDiet();
    const next = (diet && typeof diet === 'object') ? diet : {};
    base.dateKey = typeof next.dateKey === 'string' ? next.dateKey : getLocalDateKey();
    base.total = Math.max(0, Number(next.total) || 0);
    Object.keys(base.zones).forEach(key => {
        base.zones[key] = Math.max(0, Number(next.zones?.[key]) || 0);
    });
    Object.keys(base.slots).forEach(key => {
        base.slots[key] = Math.max(0, Number(next.slots?.[key]) || 0);
    });
    base.recent = Array.isArray(next.recent) ? next.recent.slice(0, SOUND_DIET_RECENT_MAX) : [];
    return base;
}

function ensureSoundDietFresh(){
    const today = getLocalDateKey();
    if(!G.soundDiet || G.soundDiet.dateKey !== today){
        G.soundDiet = createEmptySoundDiet(today);
        saveG();
    }
    return G.soundDiet;
}

function pickDominantKey(counts, order){
    let winner = order[0] || '';
    let best = -1;
    order.forEach(key => {
        const score = Number(counts?.[key]) || 0;
        if(score > best){
            best = score;
            winner = key;
        }
    });
    return winner;
}

function getSoundFlavorLabel(zone, slotType){
    const map = {
        beach: {
            drum: currentLang === 'ja' ? '波打ちビート' : 'wave beat',
            bass: currentLang === 'ja' ? '潮の低音' : 'tide bass',
            melody: currentLang === 'ja' ? '雨音みたいな海風' : 'rainy sea breeze',
            fx: currentLang === 'ja' ? '雨音っぽいしぶき' : 'rainy ocean mist'
        },
        forest: {
            drum: currentLang === 'ja' ? '木の実ノック' : 'wood knock',
            bass: currentLang === 'ja' ? '根っこのうなり' : 'root hum',
            melody: currentLang === 'ja' ? '森のさえずり' : 'forest trill',
            fx: currentLang === 'ja' ? '葉っぱのささやき' : 'leaf whisper'
        },
        city: {
            drum: currentLang === 'ja' ? 'クラブ音みたいなキック' : 'club kick',
            bass: currentLang === 'ja' ? 'クラブ音みたいな低音' : 'club bass',
            melody: currentLang === 'ja' ? 'ネオンのきらめき' : 'neon ping',
            fx: currentLang === 'ja' ? '街の空気ノイズ' : 'city air noise'
        },
        ruins: {
            drum: currentLang === 'ja' ? '遺跡のこだま' : 'ruin clap',
            bass: currentLang === 'ja' ? '残響ドローン' : 'echo drone',
            melody: currentLang === 'ja' ? '幽かなベル' : 'ghost bell',
            fx: currentLang === 'ja' ? '深い残響ノイズ' : 'deep echo noise'
        }
    };
    return map[zone]?.[slotType] || (currentLang === 'ja' ? 'ふしぎな音' : 'strange sound');
}

function getSoundDietInsight(){
    const diet = ensureSoundDietFresh();
    const favoriteZone = pickDominantKey(diet.zones, ['beach','forest','city','ruins']);
    const favoriteSlot = pickDominantKey(diet.slots, SLOT_KEYS);
    const favoriteLabel = getSoundFlavorLabel(favoriteZone, favoriteSlot);
    let personality;
    let evolution;
    if((favoriteZone === 'city') && (favoriteSlot === 'drum' || favoriteSlot === 'bass')){
        personality = currentLang === 'ja' ? '夜ふかしビート好き' : 'night-owl beat lover';
        evolution = currentLang === 'ja' ? 'クラブ音で進化しそう' : 'might evolve through club sounds';
    } else if(favoriteZone === 'beach' && (favoriteSlot === 'fx' || favoriteSlot === 'melody')){
        personality = currentLang === 'ja' ? 'おだやかな雨音好き' : 'calm rain-sound lover';
        evolution = currentLang === 'ja' ? '雨音で進化しそう' : 'might evolve through rain sounds';
    } else if(favoriteZone === 'forest' && (favoriteSlot === 'melody' || favoriteSlot === 'fx')){
        personality = currentLang === 'ja' ? 'やさしい森音好き' : 'gentle forest-sound lover';
        evolution = currentLang === 'ja' ? '森の声で進化しそう' : 'might evolve through forest voices';
    } else if(favoriteZone === 'ruins' && (favoriteSlot === 'bass' || favoriteSlot === 'fx')){
        personality = currentLang === 'ja' ? 'ミステリアスな残響好き' : 'mysterious echo lover';
        evolution = currentLang === 'ja' ? '残響で進化しそう' : 'might evolve through echoes';
    } else {
        const byZone = {
            beach: currentLang === 'ja' ? 'のんびり潮風タイプ' : 'easygoing tide type',
            forest: currentLang === 'ja' ? '静かな森タイプ' : 'quiet forest type',
            city: currentLang === 'ja' ? 'せっかちシティタイプ' : 'restless city type',
            ruins: currentLang === 'ja' ? '深海ミステリータイプ' : 'deep-sea mystery type'
        };
        personality = byZone[favoriteZone] || (currentLang === 'ja' ? '気まぐれタイプ' : 'moody type');
        evolution = currentLang === 'ja' ? `${favoriteLabel}で育ちそう` : `seems shaped by ${favoriteLabel}`;
    }
    return { diet, favoriteZone, favoriteSlot, favoriteLabel, personality, evolution };
}

function registerSoundMeal(slotType, zone){
    const diet = ensureSoundDietFresh();
    diet.total += 1;
    if(Object.prototype.hasOwnProperty.call(diet.zones, zone)) diet.zones[zone] += 1;
    if(Object.prototype.hasOwnProperty.call(diet.slots, slotType)) diet.slots[slotType] += 1;
    diet.recent.unshift({ slotType, zone, ts: Date.now() });
    if(diet.recent.length > SOUND_DIET_RECENT_MAX) diet.recent.length = SOUND_DIET_RECENT_MAX;
    saveG();
    renderSoundDietCard();
}

function getSoundBpm(){
    let b = 88;
    if(G.happy > 72) b += 22;
    else if(G.happy < 28) b -= 22;
    if(G.hunger < 28) b -= 12;
    if(G.lv >= 4) b += 8;
    return Math.max(60, Math.min(130, Math.round(b)));
}
function getSoundVol(){
    const hMult = G.hunger < 25 ? 0.55 : 1.0;
    const hapMult = G.happy > 70 ? 1.15 : 1.0;
    return 0.14 * hMult * hapMult;
}

function setActiveZone(zone){
    activeZone = zone;
    document.querySelectorAll('.zone-chip').forEach(c => c.classList.remove('active'));
    const chip = document.getElementById('zone_' + zone);
    if(chip) chip.classList.add('active');
    haptic(12);
}

function renderSoundSlots(){
    const bpm = getSoundBpm();
    const bpmEl = document.getElementById('soundBpmVal');
    if(bpmEl) bpmEl.textContent = bpm;

    let anyFilled = false;
    SLOT_KEYS.forEach(slotType => {
        const el = document.getElementById('slot_' + slotType);
        if(!el) return;
        const piece = soundSlots[slotType];
        const contentEl = el.querySelector('.slot-content');
        el.classList.toggle('filled', !!piece);
        el.classList.toggle('playing', isTrackPlaying && !!piece);
        if(piece){
            anyFilled = true;
            const def = SOUND_DEF[piece.area]?.[slotType] || {};
            contentEl.innerHTML = `<span class="slot-emoji">${def.emoji||'🎵'}</span>
                <div><div class="slot-name">${def.name||piece.name}</div>
                <div class="slot-area-tag">${piece.area}</div></div>`;
        } else {
            const hint = currentLang === 'ja' ? '130mごとに集まるよ' : 'collect while walking';
            contentEl.innerHTML = `<span class="slot-empty-hint">${hint}</span>`;
        }
    });

    const btn = document.getElementById('soundPlayBtn');
    if(btn){
        btn.textContent = isTrackPlaying
            ? (currentLang === 'ja' ? '⏹ おなか休み' : '⏹ Digesting break')
            : (currentLang === 'ja' ? '▶ 音を食べる' : '▶ Feed sounds');
        btn.classList.toggle('playing', isTrackPlaying);
        btn.disabled = !anyFilled;
    }
}

function clearSlot(slotType){
    if(isTrackPlaying) return;
    soundSlots[slotType] = null;
    saveSoundSlots();
    renderSoundSlots();
    haptic(15);
}
function clearAllSlots(){
    if(isTrackPlaying) stopTrack();
    soundSlots = { drum:null, bass:null, melody:null, fx:null };
    saveSoundSlots();
    renderSoundSlots();
    setMsg(currentLang === 'ja' ? '🎵 スロットをクリアしたよ' : '🎵 Slots cleared');
}
function saveSoundSlots(){
    try{ localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(soundSlots)); }catch(e){}
}
function loadSoundSlots(){
    try{
        const raw = localStorage.getItem(SOUND_STORAGE_KEY);
        if(raw){ const s = JSON.parse(raw); soundSlots = { drum:s.drum||null, bass:s.bass||null, melody:s.melody||null, fx:s.fx||null }; }
    }catch(e){}
}

function sfxSoundPick(){
    try{
        const ctx = getAudioCtx(); if(!ctx) return;
        [600,900,750,1050].forEach((f,i)=>setTimeout(()=>playTone(f,'triangle',0.11,0.055),i*50));
    }catch(e){}
}

function collectSoundPiece(slotType, zone){
    const def = SOUND_DEF[zone]?.[slotType];
    if(!def) return;
    soundSlots[slotType] = { area:zone, ts:Date.now() };
    saveSoundSlots();
    renderSoundSlots();
    registerSoundMeal(slotType, zone);
    const insight = getSoundDietInsight();
    const msg = currentLang === 'ja'
        ? `🦭 ${ZONE_EMOJI[zone]}「${def.name}」をぱくっ。${insight.favoriteLabel}が好きみたい`
        : `🦭 Ate "${def.name}". Seems to like ${insight.favoriteLabel}.`;
    setMsg(msg);
    haptic([20,10,30]);
    sfxSoundPick();
}

function spawnSoundDrop(){
    if(!walkState.active) return;
    if(document.getElementById('mainScreen')?.classList.contains('hidden')) return;

    const slotType = SLOT_KEYS[Math.floor(Math.random() * 4)];
    const zone = activeZone;
    const def = SOUND_DEF[zone][slotType];

    const el = document.createElement('div');
    el.className = 'sound-pick-float';
    el.innerHTML = `<span class="spf-emoji">${def.emoji}</span><span class="spf-label">${slotType.toUpperCase()}</span>`;
    const vx = 10 + Math.random() * 72;
    const vy = 18 + Math.random() * 52;
    el.style.left = vx + 'vw';
    el.style.top  = vy + 'vh';
    el.style.setProperty('--sdx', ((Math.random()-0.5)*70) + 'px');
    document.body.appendChild(el);

    let picked = false;
    el.addEventListener('pointerdown', (e)=>{
        e.stopPropagation();
        if(picked) return;
        picked = true;
        collectSoundPiece(slotType, zone);
        spawnParticles([def.emoji,'🎵','✨'], e.clientX, e.clientY);
        el.style.transition = 'all 0.22s'; el.style.transform = 'scale(2.5)'; el.style.opacity = '0';
        setTimeout(()=>el.remove(), 240);
    }, { passive:false });

    setTimeout(()=>{
        if(!picked && el.parentNode){
            el.style.transition = 'opacity 0.38s'; el.style.opacity = '0';
            setTimeout(()=>el.remove(), 400);
        }
    }, 3600);
}

// ===== DESKTOP SOUND LAB =====
let desktopSoundCooldown = false;

function isDesktopSoundMode(){
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function unlockDesktopAudio(){
  userGestureReady = true;
  try {
    const ctx = getAudioCtx();
    if(ctx && ctx.state === 'suspended') ctx.resume();
  } catch(e){}
}

function spawnDesktopSoundDrop(x, y){
  if(!isDesktopSoundMode()) return;
  if(desktopSoundCooldown) return;
  if(isTrackPlaying) return;
  if(document.getElementById('mainScreen')?.classList.contains('hidden')) return;

  unlockDesktopAudio();

  desktopSoundCooldown = true;
  setTimeout(() => desktopSoundCooldown = false, 700);

  const slotType = SLOT_KEYS[Math.floor(Math.random() * SLOT_KEYS.length)];
  const zone = activeZone;
  const def = SOUND_DEF[zone]?.[slotType];
  if(!def) return;

  const el = document.createElement('div');
  el.className = 'sound-pick-float';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty('--sdx', `${Math.random() * 50 - 25}px`);
  el.innerHTML = `
    <span class="spf-emoji">${def.emoji}</span>
    <span class="spf-label">${def.name}</span>
  `;

  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    unlockDesktopAudio();
    collectSoundPiece(slotType, zone);
    el.remove();
  });

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

document.addEventListener('pointerdown', (e) => {
  if(!isDesktopSoundMode()) return;

  unlockDesktopAudio();

  const blocked = e.target.closest(
    'button, .sound-lab, .walk-panel, .utility-btn, .sound-pick-float, input, textarea, select, a'
  );
  if(blocked) return;

  spawnDesktopSoundDrop(e.clientX, e.clientY);
});

document.addEventListener('keydown', (e) => {
  if(!isDesktopSoundMode()) return;

  unlockDesktopAudio();

  if(e.code === 'Space'){
    e.preventDefault();
    toggleTrack();
  }

  if(e.key.toLowerCase() === 'r'){
    clearAllSlots();
  }
});




//SoundPiece
function collectWalkSoundPiece(){
    if(!walkState.active) return;

    const slotType = SLOT_KEYS[Math.floor(Math.random() * SLOT_KEYS.length)];
    const zone = activeZone;
    const def = SOUND_DEF[zone][slotType];

    // BGM用：最大4枠だけ。増やさず上書きする
    soundSlots[slotType] = {
        area: zone,
        type: slotType,
        name: def.name,
        emoji: def.emoji,
        ts: Date.now()
    };

    saveSoundSlots();
    renderSoundSlots();
    registerSoundMeal(slotType, zone);

    // 履歴用：最大20件まで
    walkState.collected = walkState.collected || [];
    walkState.collected.unshift({
        slot: slotType,
        zone,
        name: def.name,
        emoji: def.emoji,
        meters: Math.floor(walkState.totalMeters),
        ts: Date.now()
    });

    if(walkState.collected.length > 20){
        walkState.collected.length = 20;
    }

    const chip = document.getElementById('walkBlobChip');
    if(chip){
        chip.textContent = currentLang === 'ja'
            ? `🎵 ${Math.floor(walkState.totalMeters)}m地点：${def.emoji} ${def.name}`
            : `🎵 ${Math.floor(walkState.totalMeters)}m: ${def.emoji} ${def.name}`;
        chip.classList.add('saved');
    }

    showToast(
        currentLang === 'ja'
            ? `🦭 ${def.emoji} ${def.name} を食べた！`
            : `🦭 Ate ${def.emoji} ${def.name}!`
    );
}

function renderSoundDietCard(){
    const card = document.getElementById('soundDietCard');
    if(!card) return;
    const { diet, favoriteLabel, personality, evolution } = getSoundDietInsight();
    if(!diet.total){
        card.className = 'sound-memory-summary empty';
        card.innerHTML = currentLang === 'ja'
            ? `<div class="sound-memory-note">まだ音を味見していません。散歩して、この子の好物を見つけよう。</div>`
            : `<div class="sound-memory-note">No sound meals yet. Go for a walk and discover this one's taste.</div>`;
        return;
    }
    card.className = 'sound-memory-summary';
    const totalLabel = currentLang === 'ja'
        ? `今日 ${diet.total} くち`
        : `TODAY ${diet.total} BITE${diet.total > 1 ? 'S' : ''}`;
    const note = currentLang === 'ja'
        ? `「この子、${favoriteLabel}好きだな」`
        : `Seems to love ${favoriteLabel}.`;
    card.innerHTML = `
        <div class="sound-memory-head">
            <div class="sound-memory-title">${currentLang === 'ja' ? '今日の音ぐせ' : "Today's sound habit"}</div>
            <div class="sound-memory-total">${totalLabel}</div>
        </div>
        <div class="sound-memory-note">${note}</div>
        <div class="sound-memory-traits">
            <span class="sound-memory-chip">${personality}</span>
            <span class="sound-memory-chip">${evolution}</span>
        </div>
    `;
}

function computeAmbientLevel(data){
    if(!data?.length) return 0;
    let sum = 0;
    for(let i = 0; i < data.length; i += 1){
        const n = (data[i] - 128) / 128;
        sum += n * n;
    }
    return Math.sqrt(sum / data.length);
}

function setSoundStarvedUI(active){
    const main = document.getElementById('mainScreen');
    if(main) main.classList.toggle('sound-starved', !!active);
}

function isSoundStarved(now = Date.now()){
    return !!(walkState.active && walkState.isSilent && walkState.silentSince && (now - walkState.silentSince) >= AMBIENT_SILENCE_GRACE_MS);
}

function applySilencePenalty(now = Date.now()){
    if(!isSoundStarved(now)) return;
    const lastPenalty = walkState.lastSilencePenaltyAt || 0;
    if(lastPenalty && (now - lastPenalty) < 1000) return;
    walkState.lastSilencePenaltyAt = now;
    walkState.silencePenalty = (Number(walkState.silencePenalty) || 0) + AMBIENT_PENALTY_STEP;
    G.hunger = Math.max(0, G.hunger - AMBIENT_PENALTY_STEP);
    if(!walkState.lastSilenceWarnAt || (now - walkState.lastSilenceWarnAt) > 9000){
        walkState.lastSilenceWarnAt = now;
        setMsg(
            currentLang === 'ja'
                ? '静かすぎるよ… もう少し音を食べたいな'
                : 'It is too quiet... I need a little more sound to eat.',
            true
        );
    }
    saveG();
    updateUI();
    updateWalkUI();
}

function updateAmbientSilenceState(level){
    const now = Date.now();
    walkState.ambientLevel = level;
    const silent = level < AMBIENT_SILENCE_THRESHOLD;
    if(silent){
        if(!walkState.silentSince) walkState.silentSince = now;
        walkState.isSilent = true;
    } else {
        walkState.isSilent = false;
        walkState.silentSince = 0;
        walkState.lastSilencePenaltyAt = 0;
    }
    setSoundStarvedUI(isSoundStarved(now));
    applySilencePenalty(now);
    updateWalkHero();
}

async function startAmbientMonitor(){
    if(!walkState.active || ambientMonitorTimer) return;
    walkState.micState = 'requesting';
    try{
        if(!navigator.mediaDevices?.getUserMedia){
            walkState.micState = 'unsupported';
            updateWalkHero();
            return;
        }
        ambientStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        const ctx = getAudioCtx();
        if(!ctx){
            try { ambientStream.getTracks().forEach(track => track.stop()); } catch(e){}
            ambientStream = null;
            walkState.micState = 'unavailable';
            updateWalkHero();
            return;
        }
        ambientSource = ctx.createMediaStreamSource(ambientStream);
        ambientAnalyser = ctx.createAnalyser();
        ambientAnalyser.fftSize = 512;
        ambientAnalyser.smoothingTimeConstant = 0.88;
        ambientAnalyserData = new Uint8Array(ambientAnalyser.fftSize);
        ambientSource.connect(ambientAnalyser);
        walkState.micState = 'active';
        updateWalkHero();
        ambientMonitorTimer = setInterval(() => {
            if(!walkState.active || !ambientAnalyser || !ambientAnalyserData) return;
            ambientAnalyser.getByteTimeDomainData(ambientAnalyserData);
            updateAmbientSilenceState(computeAmbientLevel(ambientAnalyserData));
        }, AMBIENT_SAMPLE_MS);
    }catch(e){
        console.warn('Ambient monitor failed:', e);
        walkState.micState = 'denied';
        updateWalkHero();
    }
}

function stopAmbientMonitor(){
    if(ambientMonitorTimer){
        clearInterval(ambientMonitorTimer);
        ambientMonitorTimer = null;
    }
    try { ambientSource?.disconnect(); } catch(e){}
    if(ambientStream){
        try { ambientStream.getTracks().forEach(track => track.stop()); } catch(e){}
    }
    ambientStream = null;
    ambientSource = null;
    ambientAnalyser = null;
    ambientAnalyserData = null;
    walkState.ambientLevel = 0;
    walkState.isSilent = false;
    walkState.silentSince = 0;
    walkState.lastSilencePenaltyAt = 0;
    walkState.micState = 'idle';
    setSoundStarvedUI(false);
}


// Called from GPS update with total meters
function checkSoundDrop(totalMeters){
    if(!walkState.active) return;
    const drops = Math.floor(totalMeters / SOUND_DROP_EVERY_M);
    const prev  = Math.floor(soundDropCheckpointM / SOUND_DROP_EVERY_M);
    soundDropCheckpointM = totalMeters;
    //if(drops > prev && Math.random() < 0.72){
    //    setTimeout(spawnSoundDrop, 600 + Math.random() * 1400);
    //}
    if (drops > prev) {
        collectWalkSoundPiece();
    }
}


// ===== Audio synthesis =====
function _playDrum(ctx, area, t, barDur, bpm, vol){
    const beatDur = barDur / 4;
    const hb = beatDur / 2;
    // Patterns: 8 half-beat slots, value = strength (0=skip, >0=hit)
    const pats = {
        beach:  [1,0,0,0.5,0.55,0,0.7,0],
        forest: [1,0,0,0.35,0.5,0,0,0.2],
        city:   [1,0.35,0.5,0.35,1,0.35,0.5,0.7],
        ruins:  [1,0,0,0,0,0.6,0,0]
    };
    const pat = pats[area]||pats.beach;

    pat.forEach((str, i)=>{
        if(!str) return;
        const bt = t + i * hb;
        // Kick on beat 1 & 5
        if(i===0||i===4){
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(getMasterGain()||ctx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(160, bt);
            o.frequency.exponentialRampToValueAtTime(48, bt+0.18);
            g.gain.setValueAtTime(vol*str*0.85, bt);
            g.gain.exponentialRampToValueAtTime(0.001, bt+0.28);
            o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(_){} };
            o.start(bt); o.stop(bt+0.28);
        }
        // Snare on beat 5 (i=4) for city/ruins extra snap
        if(i===4 && (area==='city'||area==='ruins')){
            const sz = Math.floor(ctx.sampleRate * 0.11);
            const buf = ctx.createBuffer(1, sz, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for(let j=0;j<sz;j++) d[j]=Math.random()*2-1;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const flt = ctx.createBiquadFilter(); flt.type='bandpass'; flt.frequency.value=2800; flt.Q.value=0.6;
            const sg = ctx.createGain();
            src.connect(flt); flt.connect(sg); sg.connect(getMasterGain()||ctx.destination);
            sg.gain.setValueAtTime(vol*str*0.32, bt); sg.gain.exponentialRampToValueAtTime(0.001, bt+0.11);
            src.onended = () => { try { src.disconnect(); flt.disconnect(); sg.disconnect(); } catch(_){} };
            src.start(bt); src.stop(bt+0.11);
        }
        // Hi-hat (odd slots)
        if(i%2!==0 && str>0){
            const hsz = Math.floor(ctx.sampleRate * 0.035);
            const hbuf = ctx.createBuffer(1, hsz, ctx.sampleRate);
            const hd = hbuf.getChannelData(0);
            for(let j=0;j<hsz;j++) hd[j]=Math.random()*2-1;
            const hs = ctx.createBufferSource(); hs.buffer=hbuf;
            const hf = ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=7500;
            const hg = ctx.createGain();
            hs.connect(hf); hf.connect(hg); hg.connect(getMasterGain()||ctx.destination);
            hg.gain.setValueAtTime(vol*str*0.16, bt); hg.gain.exponentialRampToValueAtTime(0.001, bt+0.035);
            hs.onended = () => { try { hs.disconnect(); hf.disconnect(); hg.disconnect(); } catch(_){} };
            hs.start(bt); hs.stop(bt+0.035);
        }
    });
}

const BASS_NOTES_MAP = {
    beach:  [55,55,82,55],
    forest: [65,65,87,87],
    city:   [73,82,73,65],
    ruins:  [55,55,55,41]
};
function _playBass(ctx, area, t, barDur, vol){
    const notes = BASS_NOTES_MAP[area]||BASS_NOTES_MAP.beach;
    const nd = barDur / notes.length;
    notes.forEach((freq, i)=>{
        const nt = t + i * nd;
        const o = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
        flt.type='lowpass'; flt.frequency.value=320;
        o.connect(flt); flt.connect(g); g.connect(getMasterGain()||ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(freq, nt);
        g.gain.setValueAtTime(0, nt);
        g.gain.linearRampToValueAtTime(vol*0.65, nt+0.025);
        g.gain.setValueAtTime(vol*0.65, nt+nd*0.78);
        g.gain.linearRampToValueAtTime(0, nt+nd*0.96);
        o.onended = () => { try { o.disconnect(); flt.disconnect(); g.disconnect(); } catch(_){} };
        o.start(nt); o.stop(nt+nd);
    });
}

const MEL_SCALES = {
    beach:  [440,494,554,659,740],
    forest: [392,440,494,587,659],
    city:   [440,466,554,622,740],
    ruins:  [220,247,277,330,370]
};
const MEL_PATS = {
    beach:  [0,2,4,2,1,3,4,3],
    forest: [0,1,2,3,2,1,0,2],
    city:   [4,2,1,2,4,3,2,0],
    ruins:  [-1,0,2,1,0,-1,1,0]  // -1 = rest
};
function _playMelody(ctx, area, t, barDur, vol, lv){
    const scale = MEL_SCALES[area]||MEL_SCALES.beach;
    const pat   = MEL_PATS[area]||MEL_PATS.beach;
    const count = lv >= 3 ? 8 : 4;
    const nd = barDur / count;
    for(let i=0;i<count;i++){
        const idx = pat[i % pat.length];
        if(idx < 0) continue;
        const freq = scale[idx % scale.length];
        const nt = t + i * nd;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(getMasterGain()||ctx.destination);
        o.type = area==='ruins' ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(freq, nt);
        g.gain.setValueAtTime(0, nt);
        g.gain.linearRampToValueAtTime(vol*0.38, nt+0.012);
        g.gain.setValueAtTime(vol*0.38, nt+nd*0.62);
        g.gain.linearRampToValueAtTime(0, nt+nd*0.92);
        o.onended = () => { try { o.disconnect(); g.disconnect(); } catch(_){} };
        o.start(nt); o.stop(nt+nd);
        // Echo for ruins
        if(area==='ruins'){
            const eo = ctx.createOscillator(), eg = ctx.createGain();
            eo.connect(eg); eg.connect(getMasterGain()||ctx.destination);
            eo.type='sine'; eo.frequency.setValueAtTime(freq, nt+0.14);
            eg.gain.setValueAtTime(0, nt+0.14);
            eg.gain.linearRampToValueAtTime(vol*0.12, nt+0.16);
            eg.gain.linearRampToValueAtTime(0, nt+nd);
            eo.onended = () => { try { eo.disconnect(); eg.disconnect(); } catch(_){} };
            eo.start(nt+0.14); eo.stop(nt+nd+0.14);
        }
    }
}

const FX_DEF = {
    beach:  { freq:190, type:'sine',     mod:5,   fcut:350 },
    forest: { freq:330, type:'sine',     mod:2,   fcut:500 },
    city:   { freq:58,  type:'sawtooth', mod:0.8, fcut:200 },
    ruins:  { freq:75,  type:'sine',     mod:0.3, fcut:250 }
};
function _playFx(ctx, area, t, barDur, vol){
    const d = FX_DEF[area]||FX_DEF.beach;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    const flt = ctx.createBiquadFilter(), g = ctx.createGain();
    flt.type='lowpass'; flt.frequency.value=d.fcut;
    lfo.frequency.value=d.mod; lfoG.gain.value=14;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    o.connect(flt); flt.connect(g); g.connect(getMasterGain()||ctx.destination);
    o.type=d.type; o.frequency.setValueAtTime(d.freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol*0.22, t+0.25);
    g.gain.setValueAtTime(vol*0.22, t+barDur-0.25);
    g.gain.linearRampToValueAtTime(0, t+barDur);
    o.onended = () => { try { lfo.disconnect(); lfoG.disconnect(); o.disconnect(); flt.disconnect(); g.disconnect(); } catch(_){} };
    lfo.start(t); lfo.stop(t+barDur);
    o.start(t); o.stop(t+barDur);
}

function _scheduleBar(ctx, barT, barDur, bpm, vol){
    if(soundSlots.drum)   _playDrum(ctx, soundSlots.drum.area,   barT, barDur, bpm, vol);
    if(soundSlots.bass)   _playBass(ctx, soundSlots.bass.area,   barT, barDur, vol);
    if(soundSlots.melody) _playMelody(ctx, soundSlots.melody.area, barT, barDur, vol, G.lv);
    if(soundSlots.fx)     _playFx(ctx, soundSlots.fx.area,   barT, barDur, vol);
}

function sampleBand(data, start, end){
    const safeStart = Math.max(0, start | 0);
    const safeEnd = Math.max(safeStart + 1, Math.min(data.length, end | 0));
    let total = 0;
    for(let i = safeStart; i < safeEnd; i++) total += data[i];
    return total / (safeEnd - safeStart);
}

function normalizeBandEnergy(value, floor = 26, ceil = 170){
    return clampNumber((value - floor) / (ceil - floor), 0, 1, 0);
}

function clearSoundReactiveStage(){
    const stage = document.getElementById('petStage');
    if(!stage) return;
    stage.classList.remove('sound-feeding');
    stage.style.removeProperty('--sound-react');
    stage.style.removeProperty('--sound-low');
    stage.style.removeProperty('--sound-mid');
    stage.style.removeProperty('--sound-high');
    stage.style.removeProperty('--sound-hue');
}

function syncSoundReactiveStage(forceIdle = false){
    const stage = document.getElementById('petStage');
    if(!stage) return;
    if(forceIdle || !isTrackPlaying || !soundAnalyser || !soundAnalyserData){
        clearSoundReactiveStage();
        return;
    }
    const low = normalizeBandEnergy(sampleBand(soundAnalyserData, 1, 6), 28, 172);
    const mid = normalizeBandEnergy(sampleBand(soundAnalyserData, 6, 22), 24, 164);
    const high = normalizeBandEnergy(sampleBand(soundAnalyserData, 22, 64), 22, 156);
    const react = clampNumber(low * 0.96 + mid * 0.28, 0, 1, 0);
    const hue = Math.round(182 + high * 34 - low * 12 + mid * 8);
    stage.classList.add('sound-feeding');
    stage.style.setProperty('--sound-react', react.toFixed(3));
    stage.style.setProperty('--sound-low', low.toFixed(3));
    stage.style.setProperty('--sound-mid', mid.toFixed(3));
    stage.style.setProperty('--sound-high', high.toFixed(3));
    stage.style.setProperty('--sound-hue', String(hue));
}

function startSoundReactiveStage(){
    const analyser = ensureSoundAnalyser();
    if(!analyser || !soundAnalyserData){
        clearSoundReactiveStage();
        return;
    }
    cancelAnimationFrame(soundVizFrame);
    const render = () => {
        if(!isTrackPlaying || !soundAnalyser || !soundAnalyserData){
            clearSoundReactiveStage();
            soundVizFrame = 0;
            return;
        }
        soundAnalyser.getByteFrequencyData(soundAnalyserData);
        syncSoundReactiveStage();
        soundVizFrame = requestAnimationFrame(render);
    };
    render();
}

function toggleTrack(){
    if(isTrackPlaying) stopTrack(); else startTrack();
}

function startTrack(){
    const hasAny = SLOT_KEYS.some(k => soundSlots[k] !== null);
    if(!hasAny){
        showToast(currentLang==='ja' ? '⚠ まず散歩で音を拾ってね！' : '⚠ Collect sounds while walking first!', true);
        return;
    }

    userGestureReady = true;

    const ctx = getAudioCtx();
    if(!ctx){
        showToast(currentLang==='ja' ? '⚠ 画面をタップして音声を有効に' : '⚠ Tap screen to enable audio', true);
        return;
    }

    if(ctx.state === 'suspended'){
        ctx.resume().catch(()=>{});
    }

    getMasterGain();

    isTrackPlaying = true;

    const bpm = getSoundBpm();
    const barDur = (60 / bpm) * 4;
    const lookAhead = 0.12;
    const scheduleAhead = 0.65;

    soundNextBarTime = ctx.currentTime + 0.08;

    const scheduler = () => {
        if(!isTrackPlaying) return;

        const vol = getSoundVol();

        while(soundNextBarTime < ctx.currentTime + scheduleAhead){
            _scheduleBar(ctx, soundNextBarTime, barDur, bpm, vol);
            soundNextBarTime += barDur;
        }

        soundLoopTimer = setTimeout(scheduler, lookAhead * 1000);
    };

    scheduler();
    startSoundReactiveStage();

    renderSoundSlots();
    setMsg(currentLang==='ja' ? `🎵 演奏スタート！ BPM ${bpm}` : `🎵 Track playing! BPM ${bpm}`);
    haptic([20,10,40]);
}

function stopTrack(){
    isTrackPlaying = false;
    if(soundLoopTimer){ clearTimeout(soundLoopTimer); soundLoopTimer=null; }
    cancelAnimationFrame(soundVizFrame);
    soundVizFrame = 0;
    clearSoundReactiveStage();
    renderSoundSlots();
    setMsg(currentLang==='ja' ? '🎵 演奏停止' : '🎵 Track stopped');
}

function saveMemoryTrack(){
    const hasAny = SLOT_KEYS.some(k => soundSlots[k]!==null);
    if(!hasAny){
        showToast(currentLang==='ja' ? '⚠ スロットが空です' : '⚠ No sounds in slots', true);
        return;
    }
    const zones = [...new Set(SLOT_KEYS.filter(k=>soundSlots[k]).map(k=>soundSlots[k].area))];
    const date = new Date().toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
    const zEmoji = zones.map(z=>ZONE_EMOJI[z]||'').join('');
    const name = `${date} ${zEmoji} Mix`;
    const track = { ts:Date.now(), name, date, zones, slots:{...soundSlots} };

    try{
        const raw = localStorage.getItem(SOUND_MEMORY_KEY);
        const mems = raw ? JSON.parse(raw) : [];
        mems.unshift(track);
        if(mems.length>10) mems.length=10;
        localStorage.setItem(SOUND_MEMORY_KEY, JSON.stringify(mems));
    }catch(e){}

    renderSoundMemory();
    showToast(currentLang==='ja' ? '💾 思い出トラックを保存したよ！' : '💾 Memory track saved!');
    haptic([20,10,30]);
}

// cache for onclick in rendered HTML
let _soundMemCache = [];

function loadMemoryTrack(idx){
    const track = _soundMemCache[idx];
    if(!track) return;
    if(isTrackPlaying) stopTrack();
    soundSlots = { drum:track.slots.drum||null, bass:track.slots.bass||null, melody:track.slots.melody||null, fx:track.slots.fx||null };
    saveSoundSlots();
    renderSoundSlots();
    setMsg(currentLang==='ja' ? `📼「${track.name}」をロードしたよ` : `📼 Loaded "${track.name}"`);
    haptic(20);
}

function renderSoundMemory(){
    const list = document.getElementById('soundMemoryList');
    if(!list) return;
    let mems = [];
    try{ const raw=localStorage.getItem(SOUND_MEMORY_KEY); if(raw) mems=JSON.parse(raw); }catch(e){}
    _soundMemCache = mems.slice(0,6);
    if(!_soundMemCache.length){
        list.innerHTML = `<div style="font-size:0.66rem;color:rgba(255,255,255,0.2);text-align:center;padding:5px">${currentLang==='ja'?'思い出トラックはまだないよ':'No memory tracks yet'}</div>`;
        return;
    }
    list.innerHTML = _soundMemCache.map((tr,i)=>{
        const zEmoji = (tr.zones||[]).map(z=>ZONE_EMOJI[z]||'').join('');
        return `<div class="sound-memory-item" onclick="loadMemoryTrack(${i})">
            <span class="smi-date">${tr.date}</span>
            <span class="smi-name">${tr.name}</span>
            <span class="smi-zones">${zEmoji}</span>
            <span class="smi-play">▶</span>
        </div>`;
    }).join('');
}

// ===== HAPTIC =====
function haptic(ms=20){ try{ if(userGestureReady && navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

// ===== TOAST =====
let toastTimer = null;
function showToast(msg, error=false){
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (error?' error':'');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

// ===== I18N =====
const APP_VERSION = '2026-05-04-html-split';
const APP_VERSION_STORAGE_KEY = 'walrus_app_version';
const LANG_STORAGE_KEY = 'walrus_lang';
const THEME_STORAGE_KEY = 'walrus_theme';
const BABY_MODE_STORAGE_KEY = 'walrus_baby_mode';
const PWA_INSTALL_BANNER_KEY = 'walrus_pwa_install_banner_seen';
const PORTFOLIO_ORDER_KEY = 'walrus_portfolio_order';
const PORTFOLIO_BLOB_KEY = 'walrus_portfolio_blobs';
const COLLECTOR_BLOB_KEY = 'walrus_collector_blobs';
const NEWBORN_GUIDE_SEEN_KEY = 'walrus_newborn_guide_seen';
const I18N_LEGACY = {
    ja: {
        cache_refresh: '更新',
        cache_refreshing: '更新中…',
        app_title: 'WalMate',
        load_title: 'Walrusを孵化させています…',
        load_sub: 'たじゅまるの秘密基地へようこそ',
        hatch_wait: '卵が揺れている…',
        hatch_hint: 'まもなく孵化します',
        hatch_step_1: '揺れを見守る',
        hatch_step_2: 'ヒビを待つ',
        hatch_step_3: '連打で孵化',
        newborn_guide_title: 'FIRST STEP',
        newborn_guide_copy: 'まずは <strong>散歩</strong> に行こう。<strong>満腹50%以上</strong> なら出発できて、歩くと <strong>音</strong> と <strong>経験値</strong> が集まるよ。',
        main_title: 'WalMate',
        main_sub: '散歩して音を集めて、Walrusを進化させよう',
        sound_lab_title: '🎵 サウンドキッチン',
        sound_memory_title: '④ 音の記憶',
        sound_track_title: '📼 思い出トラック',
        feed: '餌やり',
        pet: 'なでなで',
        play: '遊ぶ',
        bubble_pop: 'バブルポップ',
        walrus_save: 'Walrus保存',
        walrus_load: 'Walrus復元',
        walrus_exchange: 'Walrus交流',
        walrus_diary: 'Walrus日記',
        stat_hunger: '🐟 満腹',
        stat_happy: '💗 ハッピー',
        stat_exp: '⭐ 経験値',
        unlock2_tag: 'Lv.2 解禁',
        unlock2_title: 'たじゅまる 自己紹介',
        unlock2_body1: "<div class=\"walrus-about\"><div class=\"walrus-talk\"><div class=\"walrus-avatar\" id=\"aboutWalrusAvatar\" aria-hidden=\"true\"></div><div class=\"walrus-speech\" id=\"aboutWalrusSpeech\"><span class=\"walrus-speech-kicker\">ABOUT FROM WALRUS</span>ぼくの相棒は <strong>たじゅまる（tajumaru.sui）</strong>。Sui と Walrus を触りながら、ゲーム、記事、NFT、オンチェーン実験を少しずつ育てているビルダーだよ。気になるカードを押すと、ぼくが見どころを案内するね。</div></div><div class=\"profile-chips\"><span class=\"profile-chip\">🌊 Walrus沼 住民</span><span class=\"profile-chip\">🛠 Sui Builder</span><span class=\"profile-chip\">🎮 Interactive Pet</span></div></div>",
        unlock2_body2: "<div class=\"section-caption\">Portfolio Projects - クリックすると Walrus が解説します。</div><div class=\"walrus-projects\"><button class=\"walrus-project-card active\" type=\"button\" onclick=\"showAboutProject(this)\" data-speech=\"この育成ゲームそのものがポートフォリオの入口。育てる、保存する、交流する、日記を書くまでを1画面で遊べるようにしているよ。\"><span class=\"walrus-project-icon\">🎮</span><span class=\"walrus-project-title\">Walrus育成ゲーム</span><span class=\"walrus-project-meta\">Game / PWA / Walrus</span></button><button class=\"walrus-project-card\" type=\"button\" onclick=\"showAboutProject(this)\" data-speech=\"NoteではSuiやWalrusで試したことを、あとから読み返せるログにしているよ。技術メモと沼トークのあいだくらいの温度感。\"><span class=\"walrus-project-icon\">📝</span><span class=\"walrus-project-title\">Sui / Walrus Note</span><span class=\"walrus-project-meta\">Writing / Research</span></button><button class=\"walrus-project-card\" type=\"button\" onclick=\"showAboutProject(this)\" data-speech=\"NFTコレクションはたじゅまるの遊び心の棚。Poopie Face、Tajumarte、SunSun、それぞれ違うノリで見てもらえるよ。\"><span class=\"walrus-project-icon\">🖼</span><span class=\"walrus-project-title\">NFT Collections</span><span class=\"walrus-project-meta\">Art / Community</span></button></div><div class=\"walrus-about-note\">好きなものは <a href=\"https://walrus.xyz\" target=\"_blank\" rel=\"noopener noreferrer\">Walrus Protocol</a>、ちょっと妙なアイデア、そしてオンチェーンで遊ぶ余白。技術ネタもネタ投稿も歓迎です。</div><div class=\"social-pills\"><a class=\"social-pill\" href=\"https://x.com/tajumaruxxx\" target=\"_blank\" rel=\"noopener noreferrer\">𝕏 @tajumaruxxx</a><a class=\"social-pill\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">📝 Note / tajumaru</a></div>",
        unlock3_tag: 'Lv.3 解禁',
        unlock3_title: '好きなこと・活動',
        unlock3_body1: "<div class=\"section-caption\">Lv.3 では Walrus のスクラップブックが開きます。たじゅまるが見つけた Sui / Walrus ネタを、ぼくが『これ好き』『あとで読み返したい』の温度で集めてるモードです。</div><div class=\"scrapbook-grid\"><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb note-thumb-a\"><span class=\"thumb-badge\">NOTE PICK</span><div class=\"thumb-title\">Walrus視点の<br>深海メモ採集</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Collected by Walrus</div><div class=\"showcase-meta\">Sui / Walrus / Field Notes</div><div class=\"showcase-copy\">記事そのものより、『この発見おもしろい』を先に拾っていく感じ。あとで見返すと、深海で拾った小さなログがちゃんと地図になります。</div><div class=\"scrapbook-tags\"><span class=\"scrapbook-tag\">#Sui</span><span class=\"scrapbook-tag\">#Walrus</span><span class=\"scrapbook-tag\">#Discovery</span></div><a class=\"showcase-link\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">記事を見にいく →</a></div></article><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb note-thumb-b\"><span class=\"thumb-badge\">SCRAP LOG</span><div class=\"thumb-title\">今日ひろった<br>Sui / Walrus 小ネタ</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Walrus Shelf Memo</div><div class=\"showcase-meta\">Builder Diary / Swamp Dispatch</div><div class=\"showcase-copy\">検証していて気づいたこと、Note に残したい話題、誰かに見せたいリンクの予感。その日の『おっ』を Walrus が棚に並べてるイメージです。</div><div class=\"scrapbook-tags\"><span class=\"scrapbook-tag\">#NotePick</span><span class=\"scrapbook-tag\">#DevLog</span><span class=\"scrapbook-tag\">#SwampFind</span></div><a class=\"showcase-link\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">@tajumaru をのぞく →</a></div></article></div>",
        unlock3_body2: "<div class=\"section-caption\">コレクションモードも、ただ並べるだけじゃなくて『Walrus が集めて飾ってる棚』に進化。作品ごとに違うノリをメモ付きで置いてあります。</div><div class=\"scrapbook-grid\"><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb nft-thumb-a has-art\"><img class=\"showcase-art\" src=\"./poopie-face-1.webp\" alt=\"Poopie Face thumbnail\" loading=\"lazy\" decoding=\"async\" /><span class=\"thumb-badge badge-chip\">COLLECTED</span><div class=\"thumb-title title-chip\">Poopie Face💩</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Walrus Collection Log</div><div class=\"showcase-meta\">Chaotic Cute</div><div class=\"showcase-copy\">かわいさと勢いで突然ぶつかってくるタイプ。説明より先に『連れて帰りたくなるか』で判断する、Walrus の即決枠です。</div><a class=\"showcase-link alt-link\" href=\"https://www.tradeport.xyz/sui/collection/0x56301d99f63ec982086a5d80087e186f4812334eb9dc10f17e77b8a7e5fc99a8?bottomTab=trades&tab=items\" target=\"_blank\" rel=\"noopener noreferrer\">TradePortで見る →</a></div></article><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb nft-thumb-b has-art\"><img class=\"showcase-art\" src=\"./tajumarte-banner.webp\" alt=\"Tajumarte thumbnail\" loading=\"lazy\" decoding=\"async\" /><span class=\"thumb-badge badge-chip\">DISPLAY PICK</span><div class=\"thumb-title title-chip\">Tajumarte</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Gallery Shelf</div><div class=\"showcase-meta\">Gallery Mode</div><div class=\"showcase-copy\">少しアート寄りで、深海ギャラリーに飾られてそうなムード。Walrus 的には『静かに強い』枠として確保しておきたい作品です。</div><a class=\"showcase-link alt-link\" href=\"https://www.tradeport.xyz/sui/collection/0xaad44f5565ff1b02f50dff6ae9cf671541f819f0fe89646b05bf725664623ab2?bottomTab=trades&tab=items\" target=\"_blank\" rel=\"noopener noreferrer\">コレクションを見る →</a></div></article><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb nft-thumb-c has-art\"><img class=\"showcase-art\" src=\"./sunsun.jpg\" alt=\"SunSun thumbnail\" loading=\"lazy\" decoding=\"async\" /><span class=\"thumb-badge badge-chip\">BRIGHT FIND</span><div class=\"thumb-title title-chip\">SunSun</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Warm Light Slot</div><div class=\"showcase-meta\">Bright Energy</div><div class=\"showcase-copy\">深海ムードの棚に差し込む日差し担当。温度差のある一枚を混ぜることで、集めてる感じがぐっと生っぽくなります。</div><a class=\"showcase-link alt-link\" href=\"https://www.tradeport.xyz/sui/collection/0x5c1a7e0e538823c2829fc692fd8ae08eccf58f59b6be64f2c411901fc6994ae9?tab=mint&bottomTab=trades\" target=\"_blank\" rel=\"noopener noreferrer\">ミントページへ →</a></div></article></div>",
        unlock4_tag: '✦ Lv.4 — LEGEND!',
        unlock4_title: 'Legend Walrus 達成おめでとう！',
        unlock4_body: "<div class=\"legend-cta\"><div class=\"legend-cta-title\">育成完了。ここからは Legend の第2章です。</div><div class=\"legend-cta-copy\">最高レベルに到達したあなたは、もう本物の Walrus 仲間。<br><strong>進化</strong>で Mythic な姿にするか、<strong>カスタマイズ</strong>で色やアクセサリーを選んで、自分だけの Legend Walrus に育てよう。</div><div id=\"legendLab\" class=\"legend-lab\"></div><div class=\"legend-cta-actions\"><a class=\"legend-cta-btn x-btn\" href=\"https://x.com/tajumaruxxx\" target=\"_blank\" rel=\"noopener noreferrer\">𝕏 をフォローする</a><a class=\"legend-cta-btn note-btn\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">Note を読みにいく</a></div><div class=\"buddy-tip\">たじゅまると友達になると、Walrus の話題がだいたい 1.7 倍くらい増えます。<br><span style=\"color:rgba(255,255,255,0.34);font-size:0.94em\">Built on Walrus Protocol · Walgo.xyz</span></div></div>",
        legend_lab_title: 'Legend Lab',
        legend_lab_idle: '未選択',
        legend_lab_evolved: 'Mythic進化中',
        legend_lab_custom: 'カスタム中',
        legend_evolve: '進化',
        legend_devolve: '進化解除',
        legend_evolve_hint: 'Mythic Legend へ進化',
        legend_devolve_hint: '通常Legendに戻す',
        legend_customize: 'カスタマイズ',
        legend_customize_hint: '色・アクセサリーを選ぶ',
        legend_color: 'Color',
        legend_accessory: 'Accessory',
        legend_lab_note: '選んだ姿はこの端末に保存され、次回もそのまま表示されます。',
        legend_preview_kicker: 'Preview unlocked',
        legend_preview_copy: 'Evolve / Customize を押す前に、Legend の次章をちょっとだけ先にのぞけます。',
        legend_preview_mythic: 'Mythic Aura',
        legend_preview_mythic_hint: '進化すると深海オーラが増し、特別な発光をまといます。',
        legend_preview_custom_hint: 'Aurora や Coral など、複数カラーを先取りチェック。',
        legend_preview_accessory: 'Accessory tease',
        legend_preview_accessory_hint: '光輪や小物で、Legendらしい雰囲気を仕上げよう。',
        legend_color_gold: 'Gold',
        legend_color_aurora: 'Aurora',
        legend_color_coral: 'Coral',
        legend_color_midnight: 'Midnight',
        legend_acc_none: 'なし',
        legend_acc_pearl: '真珠',
        legend_acc_scarf: 'スカーフ',
        legend_acc_halo: '光輪',
        legend_acc_sunglasses: '黒サングラス',
        legend_evolved_msg: '✦ Mythic Legendへ進化！ 深海のオーラが増したよ',
        legend_devolved_msg: '✦ 進化を解除したよ。通常Legendに戻った！',
        legend_custom_msg: '✦ カスタマイズ解禁！ 好きな姿に変えてみよう',
        legend_color_msg: '色を変更したよ',
        legend_accessory_msg: 'アクセサリーを変更したよ',
        social_popup_badge: "🫧 Lv.4 Clear Bonus",
        social_popup_title: "たじゅまると友達になろう！",
        social_popup_copy: "育成完了、おめでとう！<br>ここまで来たあなたは、もう立派な Walrus 仲間。<br>X と Note に浮上して、たじゅまるの沼トークをのぞきに行こう。",
        social_popup_x: "Xで友達になる",
        social_popup_note: "Noteを読みに行く",
        social_popup_close: "あとで見る",
        legend_ascension_kicker: 'Legend Ascension',
        legend_ascension_title: 'YOU CREATED A LEGEND',
        legend_ascension_copy: 'Stored on Walrus Network. 育てた相棒は、深海の伝説として刻まれました。',
        legend_ascension_footer: 'Stored Eternally',
        legend_ascension_chip_1: 'Lv.4 Legend Walrus',
        legend_ascension_chip_2: 'Built on Walrus Network',
        legend_ascension_cta_primary: '証明書を開く',
        legend_ascension_cta_secondary: 'スクショできた',
        reset: '🔄 リセット',
        footer: 'Built with ❤️ for Walrus Protocol · たじゅまる.sui',
        game_score: 'スコア',
        game_remain: '残り',
        game_end: '⬅ やめる',
        game_clear: '🎉 クリア！',
        game_perfect: 'PERFECT!!',
        game_perfect_bonus: 'Perfect報酬：経験値 1.5倍',
        back_to_main: '本編に戻る 🦭',
        legend_cert_title: '🦭 Legend Certificate',
        share_x: 'Xでシェア ✨',
        copy_link: 'リンクをコピー',
        close: '閉じる',
        exchange_modal_title: '🤝 Walrus交流',
        my_code: '📤 マイコード',
        friend_exchange: '🦭 友達と交流',
        exchange_history: '📋 交流履歴',
        my_code_hint: 'このコードを友達に送ろう！<br>友達がコードを入力すると、あなたのWalrusが遊びに行くよ 🦭',
        gen_share_code: '<span>🌐</span> シェアコードを発行・更新',
        copy_code: '📋 コードをコピー',
        friend_hint: '友達のシェアコードを入力して交流しよう！<br>お互いのWalrusがハッピーになるよ 💚',
        friend_placeholder: '友達のシェアコード（blobId）を貼り付けてね…',
        exchange_now: '<span>🤝</span> 交流する！',
        exchange_note: '選んだ交換あそびで報酬が変わるよ<br>日記に自動記録されるよ 📔',
        history_hint: '最近交流したWalrusたちの記録です 🦭',
        your_walrus: 'あなたのWalrus',
        friend_walrus: '友達のWalrus',
        visiting_happy: '💗 ハッピー +15',
        visiting_exp: '⭐ 経験値 +10',
        visiting_done: 'やったー！ 🦭',
        diary_title: '📔 今日の日記',
        diary_placeholder: '今日の思い出を書いてね… 🦭',
        diary_save: '💾 保存する',
        diary_update: '✏️ 上書き保存',
        diary_view: '📖 日記帳を見る',
        diary_book: '📔 Walrus日記帳',
        diary_save_walrus: '🌐 Walrusに保存',
        diary_load_walrus: '📥 Walrusから復元',
        exchange_sub_no_code: 'コードを発行して繋がろう！',
        exchange_sub_ready: '友達と繋がろう！',
        walrus_load_modal_title: '📥 Walrusから復元',
        walrus_load_hint: '読み込みたい BlobId を入力してね。<br>前回保存した ID もそのまま呼び出せるよ 🦭',
        walrus_load_saved_label: 'LAST SAVE',
        walrus_load_saved_empty: 'まだ保存がありません',
        walrus_load_input_label: '読み込む BlobId',
        walrus_load_placeholder: 'BlobId を貼り付けてね…',
        walrus_load_preview_empty: 'BlobId を入力するとここに表示されます',
        walrus_load_confirm: '<span>📥</span> この BlobId で復元する',
        walrus_load_use_saved: '🫧 前回保存した BlobId を使う',
        diary_sub_write: '今日の思い出を書く',
        theme_toggle_deep: '🌙 深海',
        theme_toggle_lagoon: '☀ 海中ラグーン',
        theme_toggle_ukiyo: '🎏 和モード',
        portfolio_discovery_drag: 'ドラッグで並べ替え',
        portfolio_discovery_tap: 'タップでWalrus解説',
        rating_title: 'Walrus Rating',
        rating_fun: 'Fun',
        rating_tech: 'Tech',
        collector_listen: '🗣 要約を読む',
        collector_stop: '⏹ 読み上げ停止',
        collector_save_blob: '🌐 Blob保存',
        collector_update_blob: '♻ Blob更新',
        collector_blob_saving: 'Walrus保存中…',
        collector_copy_blob: '📋 Blobリンクをコピー',
        collector_blob_ready: '保存済みBlob',
        collector_blob_none: 'まだWalrus Blobは未保存です。',
        collector_speaking: 'Walrusが要約を読み上げ中…',
        collector_saved: 'CollectorカードをWalrus Blobに保存したよ！',
        collector_copied: 'Blobリンクをコピーしたよ！',
        collector_speech_unsupported: 'このブラウザでは音声読み上げに未対応です',
        collector_blob_missing: '先にBlob保存してね',
        portfolio_save_blob: '🌐 配布Blob化',
        portfolio_update_blob: '♻ Blob更新',
        portfolio_copy_blob: '📋 BlobIdコピー',
        portfolio_blob_ready: '配布Blob準備OK',
        portfolio_blob_none: 'このカードはまだWalrus配布前です。',
        portfolio_blob_saving: 'Blob化中…',
        portfolio_saved: 'ポートフォリオカードをWalrusで配布できるようにしたよ！',
        portfolio_copied: 'Portfolio BlobIdをコピーしたよ！',
        portfolio_blob_missing: '先に配布Blob化してね',
        action_feed_title: '餌やり',
        action_pet_title: 'なでなで',
        action_play_title: '遊ぶ'
    },
    en: {
        cache_refresh: 'Refresh',
        cache_refreshing: 'Refreshing...',
        app_title: "WalMate",
        load_title: 'Hatching your Walrus...',
        load_sub: "Welcome to Tajumaru's secret base",
        hatch_wait: 'The egg is shaking...',
        hatch_hint: 'Hatching soon',
        hatch_step_1: 'Watch it shake',
        hatch_step_2: 'Wait for cracks',
        hatch_step_3: 'Tap to hatch',
        newborn_guide_title: 'FIRST STEP',
        newborn_guide_copy: 'Start with a <strong>walk</strong>. You can leave only when <strong>hunger is 50%+</strong>, and walking collects <strong>sounds</strong> plus <strong>EXP</strong>.',
        main_title: "WalMate",
        main_sub: 'Walk, collect sounds, and evolve your Walrus',
        sound_lab_title: '🎵 Sound Kitchen',
        sound_memory_title: '④ Sound Memory',
        sound_track_title: '📼 Memory Tracks',
        feed: 'Feed',
        pet: 'Pet',
        play: 'Play',
        bubble_pop: 'Bubble Pop',
        walrus_save: 'Save to Walrus',
        walrus_load: 'Load from Walrus',
        walrus_exchange: 'Walrus Exchange',
        walrus_diary: 'Walrus Diary',
        stat_hunger: '🐟 Hunger',
        stat_happy: '💗 Happy',
        stat_exp: '⭐ EXP',
        unlock2_tag: 'Lv.2 Unlock',
        unlock2_title: 'About Tajumaru',
        unlock2_body1: "<div class=\"walrus-about\"><div class=\"walrus-talk\"><div class=\"walrus-avatar\" id=\"aboutWalrusAvatar\" aria-hidden=\"true\"></div><div class=\"walrus-speech\" id=\"aboutWalrusSpeech\"><span class=\"walrus-speech-kicker\">ABOUT FROM WALRUS</span>My buddy is <strong>Tajumaru (tajumaru.sui)</strong>, a builder growing games, writing, NFTs, and on-chain experiments around Sui and Walrus. Tap a project card and I will introduce the good part.</div></div><div class=\"profile-chips\"><span class=\"profile-chip\">🌊 Walrus Swamp Resident</span><span class=\"profile-chip\">🛠 Sui Builder</span><span class=\"profile-chip\">🎮 Interactive Pet</span></div></div>",
        unlock2_body2: "<div class=\"section-caption\">Portfolio Projects - tap a card and the Walrus will explain it.</div><div class=\"walrus-projects\"><button class=\"walrus-project-card active\" type=\"button\" onclick=\"showAboutProject(this)\" data-speech=\"This pet game is the portfolio entrance: raising, saving, exchanging, and diary writing all live in one playful screen.\"><span class=\"walrus-project-icon\">🎮</span><span class=\"walrus-project-title\">Walrus Pet Game</span><span class=\"walrus-project-meta\">Game / PWA / Walrus</span></button><button class=\"walrus-project-card\" type=\"button\" onclick=\"showAboutProject(this)\" data-speech=\"On Note, Tajumaru keeps Sui and Walrus experiments readable as field notes: part technical memo, part swamp dispatch.\"><span class=\"walrus-project-icon\">📝</span><span class=\"walrus-project-title\">Sui / Walrus Notes</span><span class=\"walrus-project-meta\">Writing / Research</span></button><button class=\"walrus-project-card\" type=\"button\" onclick=\"showAboutProject(this)\" data-speech=\"The NFT collections are Tajumaru's playful display shelf. Poopie Face, Tajumarte, and SunSun each carry a different mood.\"><span class=\"walrus-project-icon\">🖼</span><span class=\"walrus-project-title\">NFT Collections</span><span class=\"walrus-project-meta\">Art / Community</span></button></div><div class=\"walrus-about-note\">Favorite things: <a href=\"https://walrus.xyz\" target=\"_blank\" rel=\"noopener noreferrer\">Walrus Protocol</a>, strange ideas, and the open space where on-chain experiments become playful. Tech talk and odd discoveries are welcome.</div><div class=\"social-pills\"><a class=\"social-pill\" href=\"https://x.com/tajumaruxxx\" target=\"_blank\" rel=\"noopener noreferrer\">𝕏 @tajumaruxxx</a><a class=\"social-pill\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">📝 Note / tajumaru</a></div>",
        unlock3_tag: 'Lv.3 Unlock',
        unlock3_title: 'Things I Like / Activities',
        unlock3_body1: "<div class=\"section-caption\">Lv.3 opens the Walrus scrapbook. This is where I collect Sui / Walrus finds with a very specific energy: not just articles, but little things worth saving for later.</div><div class=\"scrapbook-grid\"><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb note-thumb-a\"><span class=\"thumb-badge\">NOTE PICK</span><div class=\"thumb-title\">Deep Sea Notes<br>from the Walrus View</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Collected by Walrus</div><div class=\"showcase-meta\">Sui / Walrus / Field Notes</div><div class=\"showcase-copy\">Less like a formal archive, more like keeping the best “wait, this is interesting” moments in one place until they turn into a map.</div><div class=\"scrapbook-tags\"><span class=\"scrapbook-tag\">#Sui</span><span class=\"scrapbook-tag\">#Walrus</span><span class=\"scrapbook-tag\">#Discovery</span></div><a class=\"showcase-link\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">Read on Note →</a></div></article><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb note-thumb-b\"><span class=\"thumb-badge\">SCRAP LOG</span><div class=\"thumb-title\">Today’s Tiny<br>Sui / Walrus Finds</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Walrus Shelf Memo</div><div class=\"showcase-meta\">Builder Diary / Swamp Dispatch</div><div class=\"showcase-copy\">Experiments, loose thoughts, future article seeds, and links that feel too good to lose. It is a shelf of “oh, keep that one.”</div><div class=\"scrapbook-tags\"><span class=\"scrapbook-tag\">#NotePick</span><span class=\"scrapbook-tag\">#DevLog</span><span class=\"scrapbook-tag\">#SwampFind</span></div><a class=\"showcase-link\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">Visit @tajumaru →</a></div></article></div>",
        unlock3_body2: "<div class=\"section-caption\">Collection Mode also levels up here. Instead of a plain list, the shelf now feels like a Walrus-curated display with little notes attached to each find.</div><div class=\"scrapbook-grid\"><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb nft-thumb-a has-art\"><img class=\"showcase-art\" src=\"./poopie-face-1.webp\" alt=\"Poopie Face thumbnail\" loading=\"lazy\" decoding=\"async\" /><span class=\"thumb-badge badge-chip\">COLLECTED</span><div class=\"thumb-title title-chip\">Poopie Face💩</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Walrus Collection Log</div><div class=\"showcase-meta\">Chaotic Cute</div><div class=\"showcase-copy\">The kind of piece that wins immediately on energy. Less explanation, more instinctive “yes, this belongs on the shelf.”</div><a class=\"showcase-link alt-link\" href=\"https://www.tradeport.xyz/sui/collection/0x56301d99f63ec982086a5d80087e186f4812334eb9dc10f17e77b8a7e5fc99a8?bottomTab=trades&tab=items\" target=\"_blank\" rel=\"noopener noreferrer\">View on TradePort →</a></div></article><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb nft-thumb-b has-art\"><img class=\"showcase-art\" src=\"./tajumarte-banner.webp\" alt=\"Tajumarte thumbnail\" loading=\"lazy\" decoding=\"async\" /><span class=\"thumb-badge badge-chip\">DISPLAY PICK</span><div class=\"thumb-title title-chip\">Tajumarte</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Gallery Shelf</div><div class=\"showcase-meta\">Gallery Mode</div><div class=\"showcase-copy\">A quieter, art-leaning piece that gives the display shelf room to breathe while still feeling unmistakably Tajumaru.</div><a class=\"showcase-link alt-link\" href=\"https://www.tradeport.xyz/sui/collection/0xaad44f5565ff1b02f50dff6ae9cf671541f819f0fe89646b05bf725664623ab2?bottomTab=trades&tab=items\" target=\"_blank\" rel=\"noopener noreferrer\">See collection →</a></div></article><article class=\"showcase-card scrapbook-card\"><div class=\"showcase-thumb nft-thumb-c has-art\"><img class=\"showcase-art\" src=\"./sunsun.jpg\" alt=\"SunSun thumbnail\" loading=\"lazy\" decoding=\"async\" /><span class=\"thumb-badge badge-chip\">BRIGHT FIND</span><div class=\"thumb-title title-chip\">SunSun</div></div><div class=\"showcase-body\"><div class=\"scrapbook-kicker\">Warm Light Slot</div><div class=\"showcase-meta\">Bright Energy</div><div class=\"showcase-copy\">The shelf needs contrast too. This one feels like sunlight cutting into the deep sea and waking the whole row up.</div><a class=\"showcase-link alt-link\" href=\"https://www.tradeport.xyz/sui/collection/0x5c1a7e0e538823c2829fc692fd8ae08eccf58f59b6be64f2c411901fc6994ae9?tab=mint&bottomTab=trades\" target=\"_blank\" rel=\"noopener noreferrer\">Open mint page →</a></div></article></div>",
        unlock4_tag: '✦ Lv.4 — LEGEND!',
        unlock4_title: 'Congrats on reaching Legend Walrus!',
        unlock4_body: "<div class=\"legend-cta\"><div class=\"legend-cta-title\">Raise complete. Now begins Legend chapter two.</div><div class=\"legend-cta-copy\">You reached the top level, which means you’re officially a Walrus companion now.<br>Choose <strong>Evolve</strong> for a Mythic form, or <strong>Customize</strong> colors and accessories to make your Legend Walrus feel like yours.</div><div id=\"legendLab\" class=\"legend-lab\"></div><div class=\"legend-cta-actions\"><a class=\"legend-cta-btn x-btn\" href=\"https://x.com/tajumaruxxx\" target=\"_blank\" rel=\"noopener noreferrer\">Follow on 𝕏</a><a class=\"legend-cta-btn note-btn\" href=\"https://note.com/tajumaru\" target=\"_blank\" rel=\"noopener noreferrer\">Read the Note posts</a></div><div class=\"buddy-tip\">Becoming Tajumaru’s friend increases the odds of unexpected Walrus talk by about 1.7x.<br><span style=\"color:rgba(255,255,255,0.34);font-size:0.94em\">Built on Walrus Protocol · Walgo.xyz</span></div></div>",
        legend_lab_title: 'Legend Lab',
        legend_lab_idle: 'Not chosen',
        legend_lab_evolved: 'Mythic evolved',
        legend_lab_custom: 'Custom mode',
        legend_evolve: 'Evolve',
        legend_devolve: 'Undo evolve',
        legend_evolve_hint: 'Become Mythic Legend',
        legend_devolve_hint: 'Return to normal Legend',
        legend_customize: 'Customize',
        legend_customize_hint: 'Pick color and accessory',
        legend_color: 'Color',
        legend_accessory: 'Accessory',
        legend_lab_note: 'Your look is saved on this device and stays after reload.',
        legend_preview_kicker: 'Preview unlocked',
        legend_preview_copy: 'Get a quick glimpse of Legend chapter two before you even tap Evolve or Customize.',
        legend_preview_mythic: 'Mythic Aura',
        legend_preview_mythic_hint: 'Evolution adds a deeper sea glow and a more special presence.',
        legend_preview_custom_hint: 'Sneak a look at colors like Aurora and Coral before choosing.',
        legend_preview_accessory: 'Accessory tease',
        legend_preview_accessory_hint: 'Halos and extras help push the Legend mood even further.',
        legend_color_gold: 'Gold',
        legend_color_aurora: 'Aurora',
        legend_color_coral: 'Coral',
        legend_color_midnight: 'Midnight',
        legend_acc_none: 'None',
        legend_acc_pearl: 'Pearl',
        legend_acc_scarf: 'Scarf',
        legend_acc_halo: 'Halo',
        legend_acc_sunglasses: 'Black shades',
        legend_evolved_msg: '✦ Evolved into Mythic Legend! The deep-sea aura grew stronger',
        legend_devolved_msg: '✦ Evolution undone. Back to normal Legend!',
        legend_custom_msg: '✦ Customizing unlocked! Try a look you like',
        legend_color_msg: 'Color changed',
        legend_accessory_msg: 'Accessory changed',
        social_popup_badge: "🫧 Lv.4 Clear Bonus",
        social_popup_title: "Let’s be friends with Tajumaru!",
        social_popup_copy: "Congrats on finishing the raise!<br>You are officially part of the Walrus crew now.<br>Surface on X and Note and peek into Tajumaru’s favorite swamp conversations.",
        social_popup_x: "Be friends on X",
        social_popup_note: "Read on Note",
        social_popup_close: "Maybe later",
        legend_ascension_kicker: 'Legend Ascension',
        legend_ascension_title: 'YOU CREATED A LEGEND',
        legend_ascension_copy: 'Stored on Walrus Network. Your companion has been etched into the deep as a legend.',
        legend_ascension_footer: 'Stored Eternally',
        legend_ascension_chip_1: 'Lv.4 Legend Walrus',
        legend_ascension_chip_2: 'Built on Walrus Network',
        legend_ascension_cta_primary: 'Open certificate',
        legend_ascension_cta_secondary: 'Screenshot done',
        reset: '🔄 Reset',
        footer: 'Built with ❤️ for Walrus Protocol · tajumaru.sui',
        game_score: 'Score',
        game_remain: 'Left',
        game_end: '⬅ End',
        game_clear: '🎉 Clear!',
        game_perfect: 'PERFECT!!',
        game_perfect_bonus: 'Perfect bonus: EXP x1.5',
        back_to_main: 'Back to game 🦭',
        legend_cert_title: '🦭 Legend Certificate',
        share_x: 'Share on X ✨',
        copy_link: 'Copy link',
        close: 'Close',
        exchange_modal_title: '🤝 Walrus Exchange',
        my_code: '📤 My Code',
        friend_exchange: '🦭 Exchange',
        exchange_history: '📋 History',
        my_code_hint: 'Send this code to a friend!<br>When they enter it, your Walrus goes to visit them 🦭',
        gen_share_code: '<span>🌐</span> Generate / Update Share Code',
        copy_code: '📋 Copy Code',
        friend_hint: 'Paste your friend’s share code and connect!<br>Both Walruses become happier 💚',
        friend_placeholder: "Paste your friend's share code (blobId)...",
        exchange_now: '<span>🤝</span> Connect!',
        exchange_note: 'Rewards change depending on the exchange play<br>It is also auto-saved to your diary 📔',
        history_hint: 'Recent Walrus visits and exchanges 🦭',
        your_walrus: 'Your Walrus',
        friend_walrus: "Friend's Walrus",
        visiting_happy: '💗 Happy +15',
        visiting_exp: '⭐ EXP +10',
        visiting_done: 'Yay! 🦭',
        diary_title: "📔 Today's Diary",
        diary_placeholder: 'Write down today’s memory... 🦭',
        diary_save: '💾 Save',
        diary_update: '✏️ Update',
        diary_view: '📖 Open Diary',
        diary_book: '📔 Walrus Diary',
        diary_save_walrus: '🌐 Save to Walrus',
        diary_load_walrus: '📥 Load from Walrus',
        exchange_sub_no_code: 'Generate a code and connect!',
        exchange_sub_ready: 'Connect with friends!',
        walrus_load_modal_title: '📥 Load from Walrus',
        walrus_load_hint: 'Enter the BlobId you want to restore.<br>You can also pull in your last saved ID instantly 🦭',
        walrus_load_saved_label: 'LAST SAVE',
        walrus_load_saved_empty: 'No Walrus save yet',
        walrus_load_input_label: 'BlobId to Load',
        walrus_load_placeholder: 'Paste a BlobId...',
        walrus_load_preview_empty: 'The BlobId preview appears here',
        walrus_load_confirm: '<span>📥</span> Restore from this BlobId',
        walrus_load_use_saved: '🫧 Use the last saved BlobId',
        diary_sub_write: "Write today's memory",
        theme_toggle_deep: '🌙 DEEP',
        theme_toggle_lagoon: '☀ LAGOON',
        theme_toggle_ukiyo: '🎏 UKIYO',
        portfolio_discovery_drag: 'Drag to reorder',
        portfolio_discovery_tap: 'Tap for Walrus commentary',
        rating_title: 'Walrus Rating',
        rating_fun: 'Fun',
        rating_tech: 'Tech',
        collector_listen: '🗣 Read summary',
        collector_stop: '⏹ Stop voice',
        collector_save_blob: '🌐 Save Blob',
        collector_update_blob: '♻ Update Blob',
        collector_blob_saving: 'Saving to Walrus...',
        collector_copy_blob: '📋 Copy Blob link',
        collector_blob_ready: 'Saved Blob',
        collector_blob_none: 'This card is not saved to Walrus Blob yet.',
        collector_speaking: 'Walrus is reading the summary...',
        collector_saved: 'Collector card saved to Walrus Blob!',
        collector_copied: 'Blob link copied!',
        collector_speech_unsupported: 'Speech synthesis is not supported in this browser',
        collector_blob_missing: 'Save the Blob first',
        portfolio_save_blob: '🌐 Publish Blob',
        portfolio_update_blob: '♻ Update Blob',
        portfolio_copy_blob: '📋 Copy BlobId',
        portfolio_blob_ready: 'Distribution Blob ready',
        portfolio_blob_none: 'This card is not published to Walrus yet.',
        portfolio_blob_saving: 'Publishing...',
        portfolio_saved: 'Portfolio card is now distributable via Walrus!',
        portfolio_copied: 'Portfolio BlobId copied!',
        portfolio_blob_missing: 'Publish this card first',
        action_feed_title: 'Feed',
        action_pet_title: 'Pet',
        action_play_title: 'Play'
    }
};

function setNestedValue(target, path, value){
    const parts = path.split('.');
    let cursor = target;
    for(let i=0; i<parts.length-1; i++){
        cursor[parts[i]] = cursor[parts[i]] || {};
        cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length-1]] = value;
}

function getNestedValue(target, path){
    return path.split('.').reduce((cursor, part) => (
        cursor && Object.prototype.hasOwnProperty.call(cursor, part) ? cursor[part] : undefined
    ), target);
}

function i18nPathForKey(key){
    const direct = {
        app_title: 'app.title',
        footer: 'app.footer',
        reset: 'common.reset',
        close: 'common.close',
        share_x: 'common.shareX',
        copy_link: 'common.copyLink',
        feed: 'actions.feed',
        pet: 'actions.pet',
        play: 'actions.play',
        bubble_pop: 'actions.bubblePop',
        my_code: 'exchange.tabs.myCode',
        friend_exchange: 'exchange.tabs.friend',
        exchange_history: 'exchange.tabs.history',
        your_walrus: 'visiting.yourWalrus',
        friend_walrus: 'visiting.friendWalrus'
    };
    if(direct[key]) return direct[key];
    if(key.startsWith('cache_')) return `system.cache.${key.replace('cache_', '')}`;
    if(key.startsWith('load_')) return `screens.load.${key.replace('load_', '')}`;
    if(key.startsWith('hatch_')) return `screens.hatch.${key.replace('hatch_', '')}`;
    if(key.startsWith('main_')) return `screens.main.${key.replace('main_', '')}`;
    if(key.startsWith('stat_')) return `stats.${key.replace('stat_', '')}`;
    if(key.startsWith('walrus_')) return `actions.walrus.${key.replace('walrus_', '')}`;
    if(/^unlock[234]_/.test(key)) return key.replace(/^unlock([234])_(.+)$/, (_, lv, name) => `unlocks.lv${lv}.${name}`);
    if(key.startsWith('legend_')) return `legend.${key.replace('legend_', '')}`;
    if(key.startsWith('social_popup_')) return `socialPopup.${key.replace('social_popup_', '')}`;
    if(key.startsWith('game_')) return `game.${key.replace('game_', '')}`;
    if(key.startsWith('exchange_sub_')) return `exchange.sub.${key.replace('exchange_sub_', '')}`;
    if(key.startsWith('exchange_')) return `exchange.${key.replace('exchange_', '')}`;
    if(key.startsWith('friend_')) return `exchange.friend.${key.replace('friend_', '')}`;
    if(key.startsWith('history_')) return `exchange.history.${key.replace('history_', '')}`;
    if(key.startsWith('visiting_')) return `visiting.${key.replace('visiting_', '')}`;
    if(key.startsWith('diary_sub_')) return `diary.sub.${key.replace('diary_sub_', '')}`;
    if(key.startsWith('diary_')) return `diary.${key.replace('diary_', '')}`;
    if(key.startsWith('theme_toggle_')) return `theme.toggle.${key.replace('theme_toggle_', '')}`;
    if(key.startsWith('action_')) return `tama.actionTitles.${key.replace(/^action_(.+)_title$/, '$1')}`;
    return `misc.${key}`;
}

function buildStructuredI18n(localeTable){
    const structured = { flat: localeTable };
    Object.entries(localeTable).forEach(([key, value]) => {
        setNestedValue(structured, i18nPathForKey(key), value);
    });
    return structured;
}

const I18N = {
    ja: buildStructuredI18n(I18N_LEGACY.ja),
    en: buildStructuredI18n(I18N_LEGACY.en)
};
let currentLang = 'ja';
let currentTheme = 'deep';
let babyModeEnabled = false;
let socialPopupPending = false;
let activeCollectorSpeechId = '';
let portfolioDragState = null;
let legendAscensionTimers = [];

function readI18n(localeTable, key){
    if(!localeTable) return undefined;
    if(key.includes('.')){
        const nested = getNestedValue(localeTable, key);
        if(nested !== undefined) return nested;
    }
    if(localeTable.flat && Object.prototype.hasOwnProperty.call(localeTable.flat, key)){
        return localeTable.flat[key];
    }
    return getNestedValue(localeTable, i18nPathForKey(key));
}

function t(key, vars = {}){
    const table = I18N[currentLang] || I18N.ja;
    const fallback = readI18n(I18N.ja, key) ?? key;
    const raw = readI18n(table, key) ?? fallback;
    return String(raw).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

function detectLanguage(){
    try {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if(saved === 'ja' || saved === 'en') return saved;
    } catch(e){}
    return navigator.language && navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function detectTheme(){
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if(saved === 'deep' || saved === 'lagoon' || saved === 'ukiyo') return saved;
    } catch(e){}
    return 'deep';
}

function detectBabyMode(){
    try { return localStorage.getItem(BABY_MODE_STORAGE_KEY) === '1'; } catch(e){}
    return false;
}

function getLvName(lv){
    if(lv >= 4 && G && G.legendEvolution) return 'Mythic Legend Walrus';
    return ['','Baby Walrus','Child Walrus','Adult Walrus','Legend Walrus'][lv] || '';
}

function localeCode(){
    return currentLang === 'ja' ? 'ja-JP' : 'en-US';
}

function getPortfolioConfig(){
    return [
        { id: 'pet-game', fun: 5, tech: 5 },
        { id: 'note-lab', fun: 4, tech: 4 },
        { id: 'nft-collections', fun: 5, tech: 3 }
    ];
}

function getCollectorStorage(){
    try {
        return JSON.parse(localStorage.getItem(COLLECTOR_BLOB_KEY) || '{}') || {};
    } catch(e){
        return {};
    }
}

function setCollectorStorage(map){
    try { localStorage.setItem(COLLECTOR_BLOB_KEY, JSON.stringify(map)); } catch(e){}
}

function getPortfolioBlobStorage(){
    try {
        return JSON.parse(localStorage.getItem(PORTFOLIO_BLOB_KEY) || '{}') || {};
    } catch(e){
        return {};
    }
}

function setPortfolioBlobStorage(map){
    try { localStorage.setItem(PORTFOLIO_BLOB_KEY, JSON.stringify(map)); } catch(e){}
}

function getPortfolioOrder(){
    try {
        const saved = JSON.parse(localStorage.getItem(PORTFOLIO_ORDER_KEY) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch(e){
        return [];
    }
}

function setPortfolioOrder(ids){
    try { localStorage.setItem(PORTFOLIO_ORDER_KEY, JSON.stringify(ids)); } catch(e){}
}

function renderWalrusStars(value){
    const clamped = Math.max(0, Math.min(5, Number(value) || 0));
    return Array.from({ length: 5 }, (_, i) => `<span class="${i < clamped ? 'filled' : ''}">★</span>`).join('');
}

function setLanguage(lang){
    currentLang = lang === 'en' ? 'en' : 'ja';
    try { localStorage.setItem(LANG_STORAGE_KEY, currentLang); } catch(e){}
    applyLanguage();
}

function applyTheme(){
    document.documentElement.dataset.theme = currentTheme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--meta-theme').trim() || '#030c1a';
    if(metaTheme) metaTheme.setAttribute('content', themeColor);
    const themeSwitch = document.getElementById('themeSwitch');
    if(themeSwitch){
        const nextThemeKey = currentTheme === 'deep'
            ? 'theme_toggle_lagoon'
            : currentTheme === 'lagoon'
                ? 'theme_toggle_ukiyo'
                : 'theme_toggle_deep';
        themeSwitch.textContent = t(nextThemeKey);
    }
}

function setTheme(theme){
    currentTheme = theme === 'lagoon' || theme === 'ukiyo' ? theme : 'deep';
    try { localStorage.setItem(THEME_STORAGE_KEY, currentTheme); } catch(e){}
    applyTheme();
    refreshBgCssVarCache?.();
    restartBgCanvasLoop?.();
}

function toggleLanguage(){
    setLanguage(currentLang === 'ja' ? 'en' : 'ja');
}

function toggleTheme(){
    const nextTheme = currentTheme === 'deep'
        ? 'lagoon'
        : currentTheme === 'lagoon'
            ? 'ukiyo'
            : 'deep';
    setTheme(nextTheme);
}

function applyBabyMode(){
    const btn = document.getElementById('babyModeSwitch');
    if(!btn) return;
    btn.classList.toggle('active', babyModeEnabled);
    btn.textContent = currentLang === 'ja'
        ? (babyModeEnabled ? 'BABY ON' : 'BABY OFF')
        : (babyModeEnabled ? 'BABY ON' : 'BABY OFF');
    btn.setAttribute('aria-pressed', babyModeEnabled ? 'true' : 'false');
    btn.title = currentLang === 'ja'
        ? (babyModeEnabled ? '赤ちゃんモード中：タップで派手に反応' : '赤ちゃんモードOFF：通常の反応')
        : (babyModeEnabled ? 'Baby mode on: taps trigger big reactions' : 'Baby mode off: normal reactions');
}

function setBabyMode(enabled){
    babyModeEnabled = !!enabled;
    try { localStorage.setItem(BABY_MODE_STORAGE_KEY, babyModeEnabled ? '1' : '0'); } catch(e){}
    applyBabyMode();
    if(!babyModeEnabled){
        const stage = document.getElementById('petStage');
        if(stage && stage.classList.contains('baby-delight')) updateUI();
    }
}

function toggleBabyMode(){
    setBabyMode(!babyModeEnabled);
    setMsg(currentLang === 'ja'
        ? (babyModeEnabled ? '赤ちゃんモード ON！ 画面をタップしてね' : '赤ちゃんモード OFF。通常モードだよ')
        : (babyModeEnabled ? 'Baby mode ON! Tap the screen' : 'Baby mode OFF. Back to normal'));
}

function buildVersionedUrl(){
    const url = new URL(window.location.href);
    url.searchParams.set('v', APP_VERSION);
    url.searchParams.set('ts', Date.now().toString());
    return url.toString();
}

function registerServiceWorker(){
    if(!('serviceWorker' in navigator)) return;
    if(window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

    const register = () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.warn('Service worker registration failed:', err);
        });
    };

    if('requestIdleCallback' in window){
        requestIdleCallback(register, { timeout: 2500 });
    } else {
        window.addEventListener('load', () => setTimeout(register, 800), { once:true });
    }
}

let deferredPwaInstallPrompt = null;
let pwaInstallSetupDone = false;

function isPwaStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function isLowPowerMobile(){
    return isIosDevice() || window.innerWidth < 520 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
}

function hasSeenPwaInstallBanner(){
    try{ return localStorage.getItem(PWA_INSTALL_BANNER_KEY) === '1'; }catch(e){ return false; }
}

function markPwaInstallBannerSeen(){
    try{ localStorage.setItem(PWA_INSTALL_BANNER_KEY, '1'); }catch(e){}
}

function updatePwaInstallBannerCopy(){
    const title = document.getElementById('pwaInstallTitle');
    const text = document.getElementById('pwaInstallText');
    const btn = document.getElementById('pwaInstallBtn');
    if(!title || !text || !btn) return;
    const ios = isIosDevice() && !deferredPwaInstallPrompt;
    if(currentLang === 'ja'){
        title.textContent = 'Walrusをホーム画面に追加';
        text.textContent = ios ? '共有ボタンから「ホーム画面に追加」を選ぶと、すぐ遊びに戻れます。' : 'すぐ戻れるように、アプリとして追加できます。';
        btn.textContent = ios ? '手順を見る' : '追加';
    } else {
        title.textContent = 'Add Walrus to Home Screen';
        text.textContent = ios ? 'Use Share, then Add to Home Screen to jump back anytime.' : 'Install it as an app so you can jump back anytime.';
        btn.textContent = ios ? 'Show steps' : 'Install';
    }
}

function shouldShowPwaInstallBanner(){
    return !isPwaStandalone() && !hasSeenPwaInstallBanner();
}

function showPwaInstallBanner(){
    if(!shouldShowPwaInstallBanner()) return;
    const banner = document.getElementById('pwaInstallBanner');
    if(!banner) return;
    updatePwaInstallBannerCopy();
    banner.classList.add('show');
}

function closePwaInstallBanner(remember = true){
    const banner = document.getElementById('pwaInstallBanner');
    if(banner) banner.classList.remove('show');
    if(remember) markPwaInstallBannerSeen();
}

async function installPwaFromBanner(){
    if(deferredPwaInstallPrompt){
        const promptEvent = deferredPwaInstallPrompt;
        deferredPwaInstallPrompt = null;
        promptEvent.prompt();
        try{ await promptEvent.userChoice; }catch(e){}
        closePwaInstallBanner(true);
        return;
    }
    const msg = currentLang === 'ja'
        ? 'iPhone/iPadは共有ボタン →「ホーム画面に追加」から追加できます'
        : 'On iPhone/iPad, use Share → Add to Home Screen';
    showToast(msg);
}

function setupPwaInstallPrompt(){
    if(pwaInstallSetupDone) return;
    pwaInstallSetupDone = true;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaInstallPrompt = e;
        setTimeout(showPwaInstallBanner, 900);
    });
    window.addEventListener('appinstalled', () => {
        deferredPwaInstallPrompt = null;
        closePwaInstallBanner(true);
    });
    setTimeout(showPwaInstallBanner, 4200);
}

async function clearCacheAndReload(){
    const btn = document.getElementById('cacheResetBtn');
    if(btn){
        btn.disabled = true;
        btn.textContent = t('cache_refreshing');
    }
    try {
        if('serviceWorker' in navigator){
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
        }
        if('caches' in window){
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
    } catch(e){
        console.warn('Cache clear failed:', e);
    }
    window.location.replace(buildVersionedUrl());
}

function ensureFreshVersion(){
    try{
        const savedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);
        // バージョンが変わったときだけリダイレクト。
        // 旧: URLの ?v= パラメータも毎回チェックしていたため
        //     ホーム画面起動のたびに不要なリダイレクトが発生していた。
        if(savedVersion !== APP_VERSION){
            localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
            window.location.replace(buildVersionedUrl());
            return true;
        }
    } catch(e){
        console.warn('Version sync failed:', e);
    }
    return false;
}

function setButtonHTML(id, html){
    const el = document.getElementById(id);
    if(el && !el.disabled) el.innerHTML = html;
}

function applyLanguage(){
    document.documentElement.lang = currentLang;
    document.title = t('app_title');
    const setText = (node, value) => { if(node) node.textContent = value; };
    const setHtml = (node, value) => { if(node) node.innerHTML = value; };
    const langSwitch = document.getElementById('langSwitch');
    if(langSwitch) langSwitch.textContent = currentLang === 'ja' ? 'EN' : 'JP';
    const themeSwitch = document.getElementById('themeSwitch');
    if(themeSwitch){
        const nextThemeKey = currentTheme === 'deep'
            ? 'theme_toggle_lagoon'
            : currentTheme === 'lagoon'
                ? 'theme_toggle_ukiyo'
                : 'theme_toggle_deep';
        themeSwitch.textContent = t(nextThemeKey);
    }
    const cacheResetBtn = document.getElementById('cacheResetBtn');
    if(cacheResetBtn){
        cacheResetBtn.textContent = t('cache_refresh');
        cacheResetBtn.disabled = false;
    }

    const q = (selector) => document.querySelector(selector);
    if(q('#loadScreen .load-title')) q('#loadScreen .load-title').textContent = t('load_title');
    if(q('#loadScreen .load-sub')) q('#loadScreen .load-sub').textContent = t('load_sub');
    if(document.getElementById('hatchMsg')) document.getElementById('hatchMsg').textContent = t('hatch_wait');
    if(document.getElementById('hatchHint')) document.getElementById('hatchHint').textContent = t('hatch_hint');
    if(document.getElementById('hatchStep0Label')) document.getElementById('hatchStep0Label').textContent = t('hatch_step_1');
    if(document.getElementById('hatchStep1Label')) document.getElementById('hatchStep1Label').textContent = t('hatch_step_2');
    if(document.getElementById('hatchStep2Label')) document.getElementById('hatchStep2Label').textContent = t('hatch_step_3');
    if(document.getElementById('newbornGuideTitle')) document.getElementById('newbornGuideTitle').textContent = t('newborn_guide_title');
    if(document.getElementById('newbornGuideCopy')) document.getElementById('newbornGuideCopy').innerHTML = t('newborn_guide_copy');
    if(q('#mainScreen .main-title')) q('#mainScreen .main-title').textContent = t('main_title');
    if(q('#mainScreen .main-sub')) q('#mainScreen .main-sub').textContent = t('main_sub');
    if(document.getElementById('soundLabTitle')) document.getElementById('soundLabTitle').textContent = t('sound_lab_title');
    if(document.getElementById('soundDietLabel')) document.getElementById('soundDietLabel').textContent = t('sound_memory_title');
    if(document.getElementById('soundTrackLabel')) document.getElementById('soundTrackLabel').textContent = t('sound_track_title');
    if(document.getElementById('btnFeedLabel')) document.getElementById('btnFeedLabel').textContent = t('feed');
    if(document.getElementById('btnPetLabel')) document.getElementById('btnPetLabel').textContent = t('pet');
    if(document.getElementById('btnPlayLabel')) document.getElementById('btnPlayLabel').textContent = t('play');
    setButtonHTML('btnMiniGame', `<span class="act-icon">🫧</span>${t('bubble_pop')}`);
    setButtonHTML('btnSave', `<span class="act-icon">🌐</span>${t('walrus_save')}`);
    setButtonHTML('btnLoad', `<span class="act-icon">📥</span>${t('walrus_load')}`);
    if(document.getElementById('btnExchangeOpenLabel')) document.getElementById('btnExchangeOpenLabel').textContent = t('walrus_exchange');
    if(document.getElementById('btnDiaryLabel')) document.getElementById('btnDiaryLabel').textContent = t('walrus_diary');
    const statNames = document.querySelectorAll('.stat-name');
    if(statNames[0]) statNames[0].textContent = t('stat_hunger');
    if(statNames[1]) statNames[1].textContent = t('stat_happy');
    if(statNames[2]) statNames[2].textContent = t('stat_exp');

    const sec1 = document.getElementById('sec1');
    if(sec1){
        sec1.classList.add('rich-card');
        const sec1Bodies = sec1.querySelectorAll('.ubody');
        setText(sec1.querySelector('.utag'), t('unlock2_tag'));
        setText(sec1.querySelector('.utitle'), t('unlock2_title'));
        setHtml(sec1Bodies[0], t('unlock2_body1'));
        setHtml(sec1Bodies[1], t('unlock2_body2'));
        initPortfolioCards();
    }
    const sec2 = document.getElementById('sec2');
    if(sec2){
        sec2.classList.add('rich-card');
        const sec2Bodies = sec2.querySelectorAll('.ubody');
        setText(sec2.querySelector('.utag'), t('unlock3_tag'));
        setText(sec2.querySelector('.utitle'), t('unlock3_title'));
        setHtml(sec2Bodies[0], t('unlock3_body1'));
        setHtml(sec2Bodies[1], t('unlock3_body2'));
        initCollectorModeCards();
    }
    const sec3 = document.getElementById('sec3');
    if(sec3){
        sec3.classList.add('rich-card', 'legend-panel');
        setText(sec3.querySelector('.utag'), t('unlock4_tag'));
        setText(sec3.querySelector('.utitle'), t('unlock4_title'));
        setHtml(sec3.querySelector('.ubody'), t('unlock4_body'));
        renderLegendLab();
    }

    if(document.getElementById('resetBtn')) document.getElementById('resetBtn').textContent = t('reset');
    if(document.getElementById('socialPopupBadge')) document.getElementById('socialPopupBadge').textContent = t('social_popup_badge');
    if(document.getElementById('socialPopupTitle')) document.getElementById('socialPopupTitle').textContent = t('social_popup_title');
    if(document.getElementById('socialPopupCopy')) document.getElementById('socialPopupCopy').innerHTML = t('social_popup_copy');
    if(document.getElementById('socialPopupX')) document.getElementById('socialPopupX').textContent = t('social_popup_x');
    if(document.getElementById('socialPopupNote')) document.getElementById('socialPopupNote').textContent = t('social_popup_note');
    if(document.getElementById('socialPopupClose')) document.getElementById('socialPopupClose').textContent = t('social_popup_close');
    if(document.getElementById('legendAscensionKicker')) document.getElementById('legendAscensionKicker').textContent = t('legend_ascension_kicker');
    if(document.getElementById('legendAscensionTitle')) document.getElementById('legendAscensionTitle').innerHTML = t('legend_ascension_title').replace(' A LEGEND', '<br>A LEGEND');
    if(document.getElementById('legendAscensionCopy')) document.getElementById('legendAscensionCopy').innerHTML = t('legend_ascension_copy');
    if(document.getElementById('legendAscensionFooter')) document.getElementById('legendAscensionFooter').textContent = t('legend_ascension_footer');
    if(document.getElementById('legendAscensionChip1')) document.getElementById('legendAscensionChip1').textContent = t('legend_ascension_chip_1');
    if(document.getElementById('legendAscensionChip2')) document.getElementById('legendAscensionChip2').textContent = t('legend_ascension_chip_2');
    if(document.getElementById('legendAscensionPrimary')) document.getElementById('legendAscensionPrimary').textContent = t('legend_ascension_cta_primary');
    if(document.getElementById('legendAscensionSecondary')) document.getElementById('legendAscensionSecondary').textContent = t('legend_ascension_cta_secondary');
    if(document.getElementById('mainFooter')) document.getElementById('mainFooter').textContent = t('footer');
    if(document.getElementById('miniGameHeader')) document.getElementById('miniGameHeader').textContent = '🫧 Bubble Pop 🫧';
    const miniScoreLabel = document.querySelector('#miniGameScreen .game-ui div:first-child');
    const miniRemainLabel = document.querySelector('#miniGameScreen .game-ui div:last-child');
    if(miniScoreLabel?.childNodes?.[0]) miniScoreLabel.childNodes[0].textContent = `${t('game_score')} `;
    if(miniRemainLabel?.childNodes?.[0]) miniRemainLabel.childNodes[0].textContent = `${t('game_remain')} `;
    if(document.getElementById('miniGameEndBtn')) document.getElementById('miniGameEndBtn').textContent = t('game_end');
    setText(document.querySelector('#miniResult .mini-result-inner div'), t('game_clear'));
    if(document.getElementById('miniResultCloseBtn')) document.getElementById('miniResultCloseBtn').textContent = t('back_to_main');

    if(document.getElementById('legendCertTitle')) document.getElementById('legendCertTitle').textContent = t('legend_cert_title');
    if(document.getElementById('legendShareBtn')) document.getElementById('legendShareBtn').textContent = t('share_x');
    if(document.getElementById('legendCopyBtn')) document.getElementById('legendCopyBtn').textContent = t('copy_link');
    if(document.getElementById('legendCloseBtn')) document.getElementById('legendCloseBtn').textContent = t('close');

    if(document.getElementById('diaryModalTitle')) document.getElementById('diaryModalTitle').textContent = t('diary_title');
    if(document.getElementById('diaryInput')) document.getElementById('diaryInput').placeholder = t('diary_placeholder');
    const diaryBtns = document.querySelectorAll('#diaryModal .diary-btn-row button');
    if(diaryBtns[0]) diaryBtns[0].textContent = t('diary_save');
    if(diaryBtns[1]) diaryBtns[1].textContent = t('diary_view');
    if(document.getElementById('diaryViewTitle')) document.getElementById('diaryViewTitle').textContent = t('diary_book');
    if(document.getElementById('btnDiarySave') && !document.getElementById('btnDiarySave').disabled) document.getElementById('btnDiarySave').textContent = t('diary_save_walrus');
    if(document.getElementById('btnDiaryLoad') && !document.getElementById('btnDiaryLoad').disabled) document.getElementById('btnDiaryLoad').textContent = t('diary_load_walrus');

    if(document.getElementById('exchangeModalTitle')) document.getElementById('exchangeModalTitle').textContent = t('exchange_modal_title');
    if(document.getElementById('tabMyCode')) document.getElementById('tabMyCode').textContent = t('my_code');
    if(document.getElementById('tabFriend')) document.getElementById('tabFriend').textContent = t('friend_exchange');
    if(document.getElementById('tabHistory')) document.getElementById('tabHistory').textContent = t('exchange_history');
    const panels = document.querySelectorAll('#exchangeModal .exchange-panel');
    if(panels[0]){
        setHtml(panels[0].querySelector('.exchange-hint'), t('my_code_hint'));
        if(document.getElementById('btnGenCode') && !document.getElementById('btnGenCode').disabled) document.getElementById('btnGenCode').innerHTML = t('gen_share_code');
        const subBtn = panels[0].querySelector('.exchange-sub-btn');
        if(subBtn) subBtn.textContent = t('copy_code');
    }
    if(panels[1]){
        setHtml(panels[1].querySelector('.exchange-hint'), t('friend_hint'));
        if(document.getElementById('friendCodeInput')) document.getElementById('friendCodeInput').placeholder = t('friend_placeholder');
        if(document.getElementById('btnExchange') && !document.getElementById('btnExchange').disabled) document.getElementById('btnExchange').innerHTML = t('exchange_now');
        const note = panels[1].querySelector('div[style*="font-size:0.7rem"]');
        if(note) note.innerHTML = t('exchange_note');
    }
    if(panels[2]){
        setHtml(panels[2].querySelector('.exchange-hint'), t('history_hint'));
    }
    updateExchangePlayUI();

    if(document.getElementById('walrusLoadModalTitle')) document.getElementById('walrusLoadModalTitle').textContent = t('walrus_load_modal_title');
    if(document.getElementById('blobPreviewTitle')) document.getElementById('blobPreviewTitle').textContent = currentLang === 'ja' ? '🌊 Blobプレビュー' : '🌊 Blob Preview';
    if(document.getElementById('walrusLoadHint')) document.getElementById('walrusLoadHint').innerHTML = t('walrus_load_hint');
    if(document.getElementById('walrusLoadSavedLabel')) document.getElementById('walrusLoadSavedLabel').textContent = t('walrus_load_saved_label');
    if(document.getElementById('walrusLoadInputLabel')) document.getElementById('walrusLoadInputLabel').textContent = t('walrus_load_input_label');
    if(document.getElementById('walrusLoadBlobInput')) document.getElementById('walrusLoadBlobInput').placeholder = t('walrus_load_placeholder');
    if(document.getElementById('btnWalrusLoadConfirm') && !document.getElementById('btnWalrusLoadConfirm').disabled) document.getElementById('btnWalrusLoadConfirm').innerHTML = t('walrus_load_confirm');
    if(document.getElementById('btnWalrusLoadUseSaved')) document.getElementById('btnWalrusLoadUseSaved').textContent = t('walrus_load_use_saved');
    syncWalrusLoadPreview();

    const visitingLabels = document.querySelectorAll('.visiting-walrus-label');
    if(visitingLabels[0]) visitingLabels[0].textContent = t('your_walrus');
    if(!document.getElementById('visitFriendLabel')?.dataset.dynamic && visitingLabels[1]) visitingLabels[1].textContent = t('friend_walrus');
    const rewardChips = document.querySelectorAll('.visiting-reward-chip');
    if(rewardChips[0]) rewardChips[0].textContent = t('visiting_happy');
    if(rewardChips[1]) rewardChips[1].textContent = t('visiting_exp');
    if(document.getElementById('visitingCloseBtn')) document.getElementById('visitingCloseBtn').textContent = t('visiting_done');

    const feedBtn = document.querySelector('.tama-btn-a');
    const petBtn = document.querySelector('.tama-btn-b');
    const playBtn = document.querySelector('.tama-btn-c');
    if(feedBtn) feedBtn.title = t('action_feed_title');
    if(petBtn) petBtn.title = t('action_pet_title');
    if(playBtn) playBtn.title = t('action_play_title');

    updatePwaInstallBannerCopy();
    initAboutWalrusNarrator();
    applyBabyMode();
    applyWalkLanguage();
    updateUI();
}

function initAboutWalrusNarrator(){
    const avatar = document.getElementById('aboutWalrusAvatar');
    renderWalrusMarkup(avatar, G?.lv || 1, 'happy', 'happy', true);
}

function initPortfolioCards(){
    const container = document.querySelector('#sec1 .walrus-projects');
    if(!container) return;
    const cards = Array.from(container.querySelectorAll('.walrus-project-card'));
    if(!cards.length) return;
    const config = getPortfolioConfig();
    cards.forEach((card, index) => {
        const item = config[index] || config[0];
        card.dataset.projectId = item.id;
        if(!card.querySelector('.walrus-project-head')){
            const icon = card.querySelector('.walrus-project-icon');
            if(icon){
                const head = document.createElement('div');
                head.className = 'walrus-project-head';
                icon.parentNode.insertBefore(head, icon);
                head.appendChild(icon);
                const handle = document.createElement('span');
                handle.className = 'walrus-drag-handle';
                handle.textContent = '⋮⋮';
                handle.setAttribute('aria-label', t('portfolio_discovery_drag'));
                handle.setAttribute('title', t('portfolio_discovery_drag'));
                head.appendChild(handle);
            }
        }
        const handle = card.querySelector('.walrus-drag-handle');
        if(handle){
            handle.onpointerdown = startPortfolioDrag;
            handle.setAttribute('title', t('portfolio_discovery_drag'));
            handle.setAttribute('aria-label', t('portfolio_discovery_drag'));
        }
        const ratingWrap = card.querySelector('.walrus-rating-wrap') || document.createElement('div');
        ratingWrap.className = 'walrus-rating-wrap';
        ratingWrap.innerHTML = `
            <div class="walrus-rating-title">${t('rating_title')}</div>
            <div class="walrus-rating-row"><span class="walrus-rating-label">${t('rating_fun')}</span><span class="walrus-rating-stars">${renderWalrusStars(item.fun)}</span></div>
            <div class="walrus-rating-row"><span class="walrus-rating-label">${t('rating_tech')}</span><span class="walrus-rating-stars">${renderWalrusStars(item.tech)}</span></div>`;
        if(!ratingWrap.parentNode) card.appendChild(ratingWrap);
        card.querySelector('.portfolio-blob-controls')?.remove();
    });
    let discovery = container.previousElementSibling;
    if(!discovery || !discovery.classList.contains('walrus-project-discovery')){
        discovery = document.createElement('div');
        discovery.className = 'walrus-project-discovery';
        container.parentNode.insertBefore(discovery, container);
    }
    discovery.innerHTML = `
        <span class="walrus-discovery-pill">↕ ${t('portfolio_discovery_drag')}</span>
        <span class="walrus-discovery-pill">🦭 ${t('portfolio_discovery_tap')}</span>`;
    applyPortfolioOrder(container);
}

function applyPortfolioOrder(container = document.querySelector('#sec1 .walrus-projects')){
    if(!container) return;
    const order = getPortfolioOrder();
    if(!order.length) return;
    const cards = Array.from(container.querySelectorAll('.walrus-project-card'));
    const byId = new Map(cards.map(card => [card.dataset.projectId, card]));
    order.forEach(id => {
        const card = byId.get(id);
        if(card) container.appendChild(card);
    });
}

function startPortfolioDrag(event){
    const handle = event.currentTarget;
    const card = handle?.closest('.walrus-project-card');
    const container = card?.parentElement;
    if(!card || !container) return;
    event.preventDefault();
    portfolioDragState = { card, container, pointerId: event.pointerId };
    card.classList.add('dragging');
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onPortfolioDragMove);
    window.addEventListener('pointerup', endPortfolioDrag);
    window.addEventListener('pointercancel', endPortfolioDrag);
}

function onPortfolioDragMove(event){
    if(!portfolioDragState) return;
    event.preventDefault();
    const { card, container } = portfolioDragState;
    const cards = Array.from(container.querySelectorAll('.walrus-project-card:not(.dragging)'));
    let targetCard = null;
    for(const item of cards){
        const rect = item.getBoundingClientRect();
        if(event.clientY >= rect.top && event.clientY <= rect.bottom && event.clientX >= rect.left && event.clientX <= rect.right){
            targetCard = item;
            break;
        }
    }
    container.querySelectorAll('.walrus-project-card').forEach(item => item.classList.remove('drag-target'));
    if(!targetCard) return;
    targetCard.classList.add('drag-target');
    const rect = targetCard.getBoundingClientRect();
    if(event.clientY < rect.top + rect.height / 2){
        container.insertBefore(card, targetCard);
    } else {
        container.insertBefore(card, targetCard.nextSibling);
    }
}

function endPortfolioDrag(){
    if(!portfolioDragState) return;
    const { card, container } = portfolioDragState;
    card.classList.remove('dragging');
    container.querySelectorAll('.walrus-project-card').forEach(item => item.classList.remove('drag-target'));
    setPortfolioOrder(Array.from(container.querySelectorAll('.walrus-project-card')).map(item => item.dataset.projectId));
    portfolioDragState = null;
    window.removeEventListener('pointermove', onPortfolioDragMove);
    window.removeEventListener('pointerup', endPortfolioDrag);
    window.removeEventListener('pointercancel', endPortfolioDrag);
}

function initCollectorModeCards(){
    const body = document.querySelectorAll('#sec2 .ubody')[0];
    if(!body) return;
    const cards = Array.from(body.querySelectorAll('.showcase-card'));
    const blobMap = getCollectorStorage();
    cards.forEach((card, index) => {
        const id = index === 0 ? 'note-pick' : 'dev-log';
        const title = card.querySelector('.thumb-title')?.textContent?.replace(/\s+/g, ' ').trim() || `collector-${index + 1}`;
        const summary = card.querySelector('.showcase-copy')?.textContent?.trim() || '';
        const noteLink = card.querySelector('.showcase-link')?.href || 'https://note.com/tajumaru';
        card.dataset.collectorId = id;
        card.dataset.collectorTitle = title;
        card.dataset.collectorSummary = summary;
        card.dataset.collectorLink = noteLink;
        const savedBlobId = blobMap[id];
        const controls = card.querySelector('.collector-controls') || document.createElement('div');
        controls.className = 'collector-controls';
        controls.innerHTML = `
            <div class="collector-actions">
                <button class="collector-btn primary" type="button" onclick="toggleCollectorSpeech('${id}')">${activeCollectorSpeechId === id ? t('collector_stop') : t('collector_listen')}</button>
                <button class="collector-btn" id="collectorSaveBtn-${id}" type="button" onclick="saveCollectorBlob('${id}')">${savedBlobId ? t('collector_update_blob') : t('collector_save_blob')}</button>
                <button class="collector-btn alt" type="button" onclick="copyCollectorBlobLink('${id}')">${t('collector_copy_blob')}</button>
            </div>
            <div class="collector-status">${savedBlobId
                ? `${t('collector_blob_ready')}：<a href="${AGGREGATOR}/v1/blobs/${savedBlobId}" target="_blank" rel="noopener noreferrer">${savedBlobId.slice(0, 24)}…</a>`
                : t('collector_blob_none')}</div>`;
        if(!controls.parentNode) card.querySelector('.showcase-body')?.appendChild(controls);
        card.classList.toggle('is-speaking', activeCollectorSpeechId === id);
    });
}

function stopCollectorSpeech(){
    activeCollectorSpeechId = '';
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    initCollectorModeCards();
}

function toggleCollectorSpeech(id){
    const card = document.querySelector(`[data-collector-id="${id}"]`);
    if(!card) return;
    if(!('speechSynthesis' in window)){
        showToast(t('collector_speech_unsupported'), true);
        return;
    }
    if(activeCollectorSpeechId === id){
        stopCollectorSpeech();
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.dataset.collectorSummary || '');
    utterance.lang = localeCode();
    utterance.rate = currentLang === 'ja' ? 1 : 0.98;
    utterance.pitch = 1.03;
    utterance.onend = () => {
        if(activeCollectorSpeechId === id){
            activeCollectorSpeechId = '';
            initCollectorModeCards();
        }
    };
    utterance.onerror = () => {
        activeCollectorSpeechId = '';
        initCollectorModeCards();
    };
    activeCollectorSpeechId = id;
    card.classList.add('is-speaking');
    setMsg(t('collector_speaking'));
    window.speechSynthesis.speak(utterance);
    initCollectorModeCards();
}

async function savePortfolioBlob(id){
    const card = document.querySelector(`.walrus-project-card[data-project-id="${id}"]`);
    if(!card) return;
    pulseActionButtons(`#portfolioSaveBtn-${id}`);
    animPet('bounce');
    setMsg(currentLang === 'ja' ? '🌐 ポートフォリオカードをWalrus配布用Blobにしています…' : '🌐 Publishing this portfolio card as a Walrus Blob...');
    setBtnLoading(`portfolioSaveBtn-${id}`, true, t('portfolio_blob_saving'));
    const portfolioItem = getPortfolioConfig().find(item => item.id === id) || {};
    const payload = {
        type: 'portfolio-card',
        version: 1,
        id,
        title: card.querySelector('.walrus-project-title')?.textContent?.trim() || '',
        meta: card.querySelector('.walrus-project-meta')?.textContent?.trim() || '',
        summary: card.dataset.speech || '',
        fun: portfolioItem.fun || null,
        tech: portfolioItem.tech || null,
        owner: 'tajumaru.sui',
        lang: currentLang,
        savedAt: new Date().toISOString()
    };
    const blobId = await uploadToWalrus(JSON.stringify(payload, null, 2), `${id}-portfolio-card.json`);
    if(!blobId){
        setBtnLoading(`portfolioSaveBtn-${id}`, false, '');
        initPortfolioCards();
        showToast(currentLang === 'ja' ? '⚠ Blob化に失敗しました' : '⚠ Publishing failed', true);
        return;
    }
    const map = getPortfolioBlobStorage();
    map[id] = blobId;
    setPortfolioBlobStorage(map);
    showToast(`✅ ${t('portfolio_saved')}`);
    setMsg(currentLang === 'ja' ? '🌐 このカードはWalrus Blobで配布OK！' : '🌐 This card is ready to distribute as a Walrus Blob!');
    setBtnLoading(`portfolioSaveBtn-${id}`, false, '');
    initPortfolioCards();
}

async function copyPortfolioBlobId(id){
    const blobId = getPortfolioBlobStorage()[id];
    if(!blobId){
        showToast(t('portfolio_blob_missing'), true);
        return;
    }
    const ok = await copyText(blobId);
    showToast(ok ? `✅ ${t('portfolio_copied')}` : (currentLang === 'ja' ? 'コピーに失敗しました' : 'Copy failed'), !ok);
}

async function saveCollectorBlob(id){
    const card = document.querySelector(`[data-collector-id="${id}"]`);
    if(!card) return;
    pulseActionButtons(`#collectorSaveBtn-${id}`);
    animPet('bounce');
    setMsg(currentLang === 'ja' ? '🌐 CollectorカードをWalrusに保存中…' : '🌐 Saving collector card to Walrus...');
    setBtnLoading(`collectorSaveBtn-${id}`, true, t('collector_blob_saving'));
    const payload = {
        type: 'collector-note',
        id,
        title: card.dataset.collectorTitle || '',
        summary: card.dataset.collectorSummary || '',
        noteUrl: card.dataset.collectorLink || '',
        lang: currentLang,
        savedAt: new Date().toISOString()
    };
    const blobId = await uploadToWalrus(JSON.stringify(payload, null, 2), `${id}.json`);
    if(!blobId){
        setBtnLoading(`collectorSaveBtn-${id}`, false, '');
        initCollectorModeCards();
        return;
    }
    const map = getCollectorStorage();
    map[id] = blobId;
    setCollectorStorage(map);
    showToast(`✅ ${t('collector_saved')}`);
    setMsg(currentLang === 'ja' ? '🌐 CollectorカードをWalrusに永久保存したよ！' : '🌐 Collector card saved permanently on Walrus!');
    setBtnLoading(`collectorSaveBtn-${id}`, false, '');
    initCollectorModeCards();
}

function copyCollectorBlobLink(id){
    const blobId = getCollectorStorage()[id];
    if(!blobId){
        showToast(t('collector_blob_missing'), true);
        return;
    }
    navigator.clipboard.writeText(`${AGGREGATOR}/v1/blobs/${blobId}`)
        .then(() => showToast(`✅ ${t('collector_copied')}`))
        .catch(() => showToast(t('collector_copied')));
}

function showAboutProject(card){
    const speech = document.getElementById('aboutWalrusSpeech');
    const cards = document.querySelectorAll('.walrus-project-card');
    if(!speech || !cards.length) return;
    cards.forEach(item => item.classList.toggle('active', item === card));
    speech.classList.add('is-speaking');
    speech.innerHTML = `<span class="walrus-speech-kicker">WALRUS COMMENTARY</span>${card.dataset.speech || ''}`;
    window.setTimeout(() => speech.classList.remove('is-speaking'), 280);
}

// ===== LEGEND GROWTH =====
const LEGEND_COLORS = {
    gold:     { body:'#B89035', belly:'#D4B055', dot:'#C49840' },
    aurora:   { body:'#36A9B6', belly:'#8BE7D2', dot:'#63f2de' },
    coral:    { body:'#C96F8D', belly:'#FFB0A6', dot:'#ff8f6b' },
    midnight: { body:'#5355A8', belly:'#8BA7FF', dot:'#7fd4ff' }
};
const LEGEND_ACCESSORIES = ['none', 'pearl', 'scarf', 'halo', 'sunglasses'];

function ensureLegendState(){
    if(!G.custom || typeof G.custom !== 'object') G.custom = {};
    if(!LEGEND_COLORS[G.custom.color]) G.custom.color = 'gold';
    if(!LEGEND_ACCESSORIES.includes(G.custom.accessory)) G.custom.accessory = 'none';
    if(!G.legendPath) G.legendPath = '';
    G.legendEvolution = !!G.legendEvolution;
}

function getLegendStatusText(){
    ensureLegendState();
    if(G.legendEvolution) return t('legend_lab_evolved');
    if(G.legendPath === 'custom') return t('legend_lab_custom');
    return t('legend_lab_idle');
}

function renderLegendPreview(){
    const previewColors = ['gold', 'aurora', 'coral'].map(key => {
        const opt = LEGEND_COLORS[key];
        return `<span class="legend-preview-swatch" style="background:${opt.dot}" title="${t('legend_color_' + key)}"></span>`;
    }).join('');
    return `
        <div class="legend-preview">
            <div class="legend-preview-kicker">${t('legend_preview_kicker')}</div>
            <div class="legend-preview-copy">${t('legend_preview_copy')}</div>
            <div class="legend-preview-rail">
                <div class="legend-preview-card mythic">
                    <div class="legend-preview-glow mythic"></div>
                    <div class="legend-preview-card-title">${t('legend_preview_mythic')}</div>
                    <div class="legend-preview-card-note">${t('legend_preview_mythic_hint')}</div>
                </div>
                <div class="legend-preview-card custom">
                    <div class="legend-preview-swatches">${previewColors}</div>
                    <div class="legend-preview-card-title">${t('legend_customize')}</div>
                    <div class="legend-preview-card-note">${t('legend_preview_custom_hint')}</div>
                </div>
                <div class="legend-preview-card halo">
                    <div class="legend-preview-halo" aria-hidden="true"></div>
                    <div class="legend-preview-card-title">${t('legend_preview_accessory')}</div>
                    <div class="legend-preview-card-note">${t('legend_preview_accessory_hint')}</div>
                </div>
            </div>
        </div>`;
}

function renderLegendLab(){
    const lab = document.getElementById('legendLab');
    if(!lab || G.lv < 4) return;
    ensureLegendState();
    const colorBtns = Object.keys(LEGEND_COLORS).map(key => {
        const opt = LEGEND_COLORS[key];
        return `<button class="swatch-btn ${G.custom.color === key ? 'active':''}" onclick="selectLegendColor('${key}')" type="button"><span class="swatch-dot" style="background:${opt.dot}"></span>${t('legend_color_' + key)}</button>`;
    }).join('');
    const accessoryBtns = LEGEND_ACCESSORIES.map(key => (
        `<button class="accessory-btn ${G.custom.accessory === key ? 'active':''}" onclick="selectLegendAccessory('${key}')" type="button">${t('legend_acc_' + key)}</button>`
    )).join('');
    lab.innerHTML = `
        <div class="legend-lab-head">
            <div class="legend-lab-title">${t('legend_lab_title')}</div>
            <div class="legend-lab-status">${getLegendStatusText()}</div>
        </div>
        ${renderLegendPreview()}
        <div class="legend-choice-row">
            <button class="legend-choice-btn ${G.legendEvolution ? 'active':''}" onclick="chooseLegendPath('evolution')" type="button">${G.legendEvolution ? t('legend_devolve') : t('legend_evolve')}<span>${G.legendEvolution ? t('legend_devolve_hint') : t('legend_evolve_hint')}</span></button>
            <button class="legend-choice-btn ${G.legendPath === 'custom' ? 'active':''}" onclick="chooseLegendPath('custom')" type="button">${t('legend_customize')}<span>${t('legend_customize_hint')}</span></button>
        </div>
        <div class="customize-panel ${G.legendPath === 'custom' ? '' : 'hidden'}" id="customizePanel">
            <div>
                <div class="customize-label">${t('legend_color')}</div>
                <div class="swatch-row">${colorBtns}</div>
            </div>
            <div>
                <div class="customize-label">${t('legend_accessory')}</div>
                <div class="accessory-row">${accessoryBtns}</div>
            </div>
            <div class="legend-lab-note">${t('legend_lab_note')}</div>
        </div>`;
}

function chooseLegendPath(path){
    if(G.lv < 4) return;
    ensureLegendState();
    if(path === 'evolution'){
        if(G.legendEvolution){
            G.legendEvolution = false;
            G.legendPath = G.custom?.accessory !== 'none' || G.custom?.color !== 'gold' ? 'custom' : '';
            setMsg(t('legend_devolved_msg'));
            animPet('bounce');
            saveG();
            updateUI();
            return;
        }
        G.legendPath = 'evolution';
        G.legendEvolution = true;
        if(G.custom.color === 'gold') G.custom.color = 'aurora';
        setMsg(t('legend_evolved_msg'));
        animPet('legend-reveal');
        const c = getStageCenter();
        spawnParticles(['✦','💎','✨','🫧','✦'], c.x, c.y);
    } else {
        G.legendPath = 'custom';
        setMsg(t('legend_custom_msg'));
    }
    saveG();
    updateUI();
}

function selectLegendColor(color){
    if(G.lv < 4 || !LEGEND_COLORS[color]) return;
    ensureLegendState();
    G.legendPath = 'custom';
    G.legendEvolution = false;
    G.custom.color = color;
    saveG();
    updateUI();
    setMsg(`${t('legend_color_msg')} · ${t('legend_color_' + color)}`);
}

function selectLegendAccessory(accessory){
    if(G.lv < 4 || !LEGEND_ACCESSORIES.includes(accessory)) return;
    ensureLegendState();
    G.legendPath = 'custom';
    G.legendEvolution = false;
    G.custom.accessory = accessory;
    saveG();
    updateUI();
    setMsg(`${t('legend_accessory_msg')} · ${t('legend_acc_' + accessory)}`);
}

// ===== WALRUS SVG =====
const BODY  = ['','#5A8AA8','#7A78B8','#3A8FA8','#B89035'];
const BELLY = ['','#7AAAC8','#9898C8','#55AFCA','#D4B055'];

function getLegendLook(lv){
    if(lv < 4) return null;
    ensureLegendState();
    const colors = LEGEND_COLORS[G.custom.color] || LEGEND_COLORS.gold;
    return {
        body: colors.body,
        belly: colors.belly,
        accent: G.legendEvolution ? '#8BE7D2' : '#C49840',
        accessory: G.custom.accessory,
        evolved: G.legendEvolution
    };
}

function getSakuraLook(){
    if(!G?.sakuraPink) return null;
    return {
        body: '#F08AAE',
        belly: '#FFD1DE',
        accent: '#FFB7D1'
    };
}

function getLegendAccessorySvg(look){
    if(!look) return { back: '', front: '' };
    const pearl = `<g opacity="0.98"><circle cx="63" cy="128" r="5" fill="#f6f3df" stroke="#d4cba8" stroke-width="1"/><circle cx="137" cy="128" r="5" fill="#f6f3df" stroke="#d4cba8" stroke-width="1"/><circle cx="100" cy="137" r="6" fill="#fff7d8" stroke="#d4cba8" stroke-width="1"/></g>`;
    const scarf = `<g><path d="M66 121 Q100 139 134 121 L132 134 Q100 150 68 134 Z" fill="#ff7aaa" opacity="0.92"/><path d="M116 133 L137 160 L123 163 L107 139 Z" fill="#e4527e" opacity="0.95"/><path d="M67 121 Q100 132 133 121" fill="none" stroke="rgba(255,255,255,0.34)" stroke-width="1.6" stroke-linecap="round"/></g>`;
    const halo = `<ellipse cx="100" cy="36" rx="31" ry="8" fill="none" stroke="${look.accent}" stroke-width="3" opacity="0.8"><animate attributeName="opacity" values="0.45;0.95;0.45" dur="2.4s" repeatCount="indefinite"/></ellipse>`;
    const sunglasses = `<g opacity="0.98"><path d="M68 72 Q82 66 96 72 L96 84 Q82 90 68 84 Z" fill="#0a0d12" stroke="#2e3642" stroke-width="2"/><path d="M104 72 Q118 66 132 72 L132 84 Q118 90 104 84 Z" fill="#0a0d12" stroke="#2e3642" stroke-width="2"/><path d="M96 76 L104 76" stroke="#1f2732" stroke-width="2.4" stroke-linecap="round"/><path d="M62 75 L68 77" stroke="#2e3642" stroke-width="2.2" stroke-linecap="round"/><path d="M132 77 L138 75" stroke="#2e3642" stroke-width="2.2" stroke-linecap="round"/><path d="M71 74 Q82 70 93 74" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1.4" stroke-linecap="round"/><path d="M107 74 Q118 70 129 74" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1.4" stroke-linecap="round"/></g>`;
    if(look.accessory === 'halo') return { back: halo, front: '' };
    if(look.accessory === 'pearl') return { back: '', front: pearl };
    if(look.accessory === 'scarf') return { back: '', front: scarf };
    if(look.accessory === 'sunglasses') return { back: '', front: sunglasses };
    return { back: '', front: '' };
}

function hexToRgb(hex){
    const normalized = (hex || '').replace('#', '');
    if(normalized.length !== 6) return { r: 90, g: 138, b: 168 };
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16)
    };
}

function rgbToHex({ r, g, b }){
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function shadeHexColor(hex, amount = 0){
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex({ r: r + amount, g: g + amount, b: b + amount });
}

function mixHexColors(a, b, weight = 0.5){
    const c1 = hexToRgb(a);
    const c2 = hexToRgb(b);
    return rgbToHex({
        r: c1.r + (c2.r - c1.r) * weight,
        g: c1.g + (c2.g - c1.g) * weight,
        b: c1.b + (c2.b - c1.b) * weight
    });
}

function getPixelWalrusPalette(lv){
    const look = getLegendLook(lv);
    const sakuraLook = getSakuraLook();
    const body = sakuraLook?.body || look?.body || BODY[lv] || BODY[1];
    const belly = sakuraLook?.belly || look?.belly || BELLY[lv] || BELLY[1];
    const accent = sakuraLook?.accent || look?.accent || (lv >= 4 ? '#C49840' : '#7EC8FF');
    return {
        body,
        belly,
        accent,
        head: mixHexColors(body, belly, 0.38),
        outline: shadeHexColor(body, -52),
        shadow: shadeHexColor(body, -22),
        flipper: shadeHexColor(body, -10),
        nose: shadeHexColor(body, -92),
        tusk: '#fff8df',
        tuskEdge: '#d8cfae',
        blush: lv >= 4 ? 'rgba(255, 208, 128, 0.24)' : 'rgba(255, 122, 170, 0.32)'
    };
}

function getPixelWalrusAccessoryMarkup(look, crown){
    const back = [];
    const front = [];
    if(look?.evolved) back.push('<div class="pw-aura"></div>');
    if(look?.accessory === 'halo') back.push('<div class="pw-halo"></div>');
    if(crown){
        front.push(
            '<div class="pw-crown-base"></div>' +
            '<div class="pw-crown-spike pw-crown-spike-a"></div>' +
            '<div class="pw-crown-spike pw-crown-spike-b"></div>' +
            '<div class="pw-crown-spike pw-crown-spike-c"></div>' +
            '<div class="pw-crown-gem pw-crown-gem-a"></div>' +
            '<div class="pw-crown-gem pw-crown-gem-b"></div>' +
            '<div class="pw-crown-gem pw-crown-gem-c"></div>'
        );
    }
    if(look?.accessory === 'pearl') front.push('<div class="pw-pearl pw-pearl-a"></div><div class="pw-pearl pw-pearl-b"></div><div class="pw-pearl pw-pearl-c"></div>');
    if(look?.accessory === 'scarf') front.push('<div class="pw-scarf"></div><div class="pw-scarf-tail"></div>');
    if(look?.accessory === 'sunglasses') front.push('<div class="pw-sunglasses pw-sunglasses-l"></div><div class="pw-sunglasses pw-sunglasses-r"></div><div class="pw-sunglasses-bridge"></div>');
    return { back: back.join(''), front: front.join('') };
}

function getExpressionState(mood = getMood()){
    if(mood === 'sleepy') return 'sleepy';
    if(G.hunger >= 88 && G.happy >= 82) return 'ecstatic';
    if(G.hunger >= 82) return 'full';
    if(mood === 'happy') return 'happy';
    if(mood === 'sad') return G.hunger < 26 ? 'hungry' : 'sad';
    return 'normal';
}

function makeWalrusSvg(lv, mood='normal', expression = getExpressionState(mood)) {
    const look = getLegendLook(lv);
    const sakuraLook = getSakuraLook();
    const bc=sakuraLook?.body || look?.body || BODY[lv] || BODY[1], bl=sakuraLook?.belly || look?.belly || BELLY[lv] || BELLY[1];
    const tusks=lv>=2, tl=lv===2?15:lv===3?25:30, crown=lv>=4;
    const accessory = getLegendAccessorySvg(look);

    let leftEye='', rightEye='', eyeWhiteL='', eyeWhiteR='', blush='', mouth='';
    if(expression==='baby'){
        eyeWhiteL=`<path d="M82 67 C72 57 62 69 69 80 C73 87 82 93 82 93 C82 93 91 87 95 80 C102 69 92 57 82 67 Z" fill="#ff2b7a"><animate attributeName="opacity" values="0.86;1;0.86" dur="0.42s" repeatCount="indefinite"/></path>`;
        eyeWhiteR=`<path d="M118 67 C108 57 98 69 105 80 C109 87 118 93 118 93 C118 93 127 87 131 80 C138 69 128 57 118 67 Z" fill="#ff2b7a"><animate attributeName="opacity" values="1;0.86;1" dur="0.42s" repeatCount="indefinite"/></path>`;
        leftEye=`<circle cx="78" cy="73" r="3" fill="#fff44f"/><circle cx="86" cy="82" r="2.5" fill="white"/>`;
        rightEye=`<circle cx="114" cy="73" r="3" fill="#fff44f"/><circle cx="122" cy="82" r="2.5" fill="white"/>`;
        mouth=`<ellipse cx="100" cy="112" rx="11" ry="5.5" fill="rgba(0,0,0,0.38)"><animate attributeName="ry" values="3.2;9;3.2" dur="0.28s" repeatCount="indefinite"/></ellipse><ellipse cx="100" cy="116" rx="5" ry="2.4" fill="rgba(255,122,170,0.72)"><animate attributeName="ry" values="1.2;3.6;1.2" dur="0.28s" repeatCount="indefinite"/></ellipse>`;
        blush=`<ellipse cx="66" cy="102" rx="10" ry="5.8" fill="rgba(255,0,0,0.42)"/><ellipse cx="134" cy="102" rx="10" ry="5.8" fill="rgba(0,210,40,0.34)"/>
        <g fill="#fff44f" opacity="0.95"><path d="M61 69 L64 76 L71 79 L64 82 L61 89 L58 82 L51 79 L58 76 Z"><animateTransform attributeName="transform" type="scale" values="0.8;1.28;0.8" dur="0.55s" repeatCount="indefinite"/></path><path d="M137 60 L140 67 L147 70 L140 73 L137 80 L134 73 L127 70 L134 67 Z"><animateTransform attributeName="transform" type="scale" values="1.18;0.82;1.18" dur="0.48s" repeatCount="indefinite"/></path></g>`;
    } else if(expression==='ecstatic'){
        eyeWhiteL=`<ellipse cx="82" cy="75" rx="10" ry="9" fill="white"/>`;
        eyeWhiteR=`<ellipse cx="118" cy="75" rx="10" ry="9" fill="white"/>`;
        leftEye=`<path d="M74,76 Q82,62 90,76" stroke="#080e20" stroke-width="4" fill="none" stroke-linecap="round"/>`;
        rightEye=`<path d="M110,76 Q118,62 126,76" stroke="#080e20" stroke-width="4" fill="none" stroke-linecap="round"/>`;
        mouth=`<path d="M87,107 Q100,126 113,107" stroke="rgba(0,0,0,0.4)" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
        blush=`<ellipse cx="66" cy="102" rx="9" ry="5.2" fill="rgba(255,122,170,0.35)"/><ellipse cx="134" cy="102" rx="9" ry="5.2" fill="rgba(255,122,170,0.35)"/>`;
    } else if(expression==='full'){
        eyeWhiteL=`<circle cx="82" cy="76" r="10" fill="white"/>`;
        eyeWhiteR=`<circle cx="118" cy="76" r="10" fill="white"/>`;
        leftEye=`<circle cx="82" cy="77" r="4.6" fill="#080e20"/><circle cx="80" cy="75" r="1.8" fill="white"/>`;
        rightEye=`<circle cx="118" cy="77" r="4.6" fill="#080e20"/><circle cx="116" cy="75" r="1.8" fill="white"/>`;
        mouth=`<path d="M88,110 Q100,120 112,110" stroke="rgba(0,0,0,0.35)" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="114" rx="5" ry="2.5" fill="rgba(255,255,255,0.18)"/>`;
    } else if(expression==='happy'){
        eyeWhiteL=`<circle cx="82" cy="76" r="9.5" fill="white"/>`;
        eyeWhiteR=`<circle cx="118" cy="76" r="9.5" fill="white"/>`;
        leftEye=`<path d="M78,76 Q82,70 86,76" stroke="#080e20" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        rightEye=`<path d="M114,76 Q118,70 122,76" stroke="#080e20" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        mouth=`<path d="M90,109 Q100,118 110,109" stroke="rgba(0,0,0,0.35)" stroke-width="2" fill="none" stroke-linecap="round"/>`;
        blush=`<ellipse cx="68" cy="102" rx="7" ry="4.3" fill="rgba(255,122,170,0.22)"/><ellipse cx="132" cy="102" rx="7" ry="4.3" fill="rgba(255,122,170,0.22)"/>`;
    } else if(expression==='hungry'){
        eyeWhiteL=`<circle cx="82" cy="77" r="9.5" fill="white"/>`;
        eyeWhiteR=`<circle cx="118" cy="77" r="9.5" fill="white"/>`;
        leftEye=`<circle cx="82" cy="79" r="5.7" fill="#080e20"/><circle cx="80" cy="77" r="2" fill="white"/>`;
        rightEye=`<circle cx="118" cy="79" r="5.7" fill="#080e20"/><circle cx="116" cy="77" r="2" fill="white"/>`;
        mouth=`<path d="M90,115 Q100,104 110,115" stroke="rgba(0,0,0,0.35)" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
    } else if(expression==='sad'){
        eyeWhiteL=`<circle cx="82" cy="76" r="9.5" fill="white"/>`;
        eyeWhiteR=`<circle cx="118" cy="76" r="9.5" fill="white"/>`;
        leftEye=`<circle cx="82" cy="78" r="5.5" fill="#080e20"/><circle cx="80" cy="76" r="2" fill="white"/>`;
        rightEye=`<circle cx="118" cy="78" r="5.5" fill="#080e20"/><circle cx="116" cy="76" r="2" fill="white"/>`;
        mouth=`<path d="M90,113 Q100,107 110,113" stroke="rgba(0,0,0,0.35)" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } else if(expression==='sleepy'){
        leftEye=`<path d="M77,76 Q82,80 87,76" stroke="#080e20" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        rightEye=`<path d="M113,76 Q118,80 123,76" stroke="#080e20" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        mouth=`<path d="M92,111 Q100,117 108,111" stroke="rgba(0,0,0,0.22)" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    } else {
        eyeWhiteL=`<circle cx="82" cy="76" r="9.5" fill="white"/>`;
        eyeWhiteR=`<circle cx="118" cy="76" r="9.5" fill="white"/>`;
        leftEye=`<circle cx="82" cy="76" r="5.5" fill="#080e20"/><circle cx="80" cy="74" r="2" fill="white"/>`;
        rightEye=`<circle cx="118" cy="76" r="5.5" fill="#080e20"/><circle cx="116" cy="74" r="2" fill="white"/>`;
        mouth=`<path d="M90,111 Q100,116 110,111" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    }

    return `<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <defs>
        <radialGradient id="walrusGlow" cx="50%" cy="35%" r="80%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.45)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
    </defs>
    ${look?.evolved?`<ellipse cx="100" cy="116" rx="63" ry="72" fill="none" stroke="${look.accent}" stroke-width="1.8" stroke-dasharray="4,9" opacity="0.52">
        <animateTransform attributeName="transform" type="rotate" values="0 100 116;360 100 116" dur="8s" repeatCount="indefinite"/>
    </ellipse>`:''}
    ${crown?`<polygon points="100,6 85,28 100,23 115,28" fill="${look?.accent || '#C49840'}"/><circle cx="100" cy="6" r="5" fill="#E04848"/><circle cx="85" cy="28" r="3.5" fill="#E04848"/><circle cx="115" cy="28" r="3.5" fill="#E04848"/><line x1="85" y1="28" x2="115" y2="28" stroke="${look?.accent || '#C49840'}" stroke-width="2"/>
    <animateTransform attributeName="transform" type="rotate" values="-2 100 18;2 100 18;-2 100 18" dur="2s" repeatCount="indefinite"/>`:''}
    ${accessory.back}
    <ellipse cx="100" cy="162" rx="56" ry="46" fill="rgba(0,0,0,0.18)"/>
    <ellipse cx="100" cy="154" rx="52" ry="42" fill="${bc}"/>
    <ellipse cx="100" cy="148" rx="40" ry="30" fill="url(#walrusGlow)" opacity="0.28"/>
    <circle cx="100" cy="90" r="43" fill="rgba(0,0,0,0.14)"/>
    <circle cx="100" cy="86" r="40" fill="${bc}"/>
    <ellipse cx="100" cy="156" rx="28" ry="22" fill="${bl}" opacity="0.5"/>
    <ellipse cx="100" cy="98" rx="21" ry="15" fill="${bl}" opacity="0.55"/>
    ${blush}
    ${eyeWhiteL}${eyeWhiteR}
    ${leftEye}${rightEye}
    <circle cx="93" cy="99" r="5" fill="rgba(0,0,0,0.28)"/>
    <circle cx="107" cy="99" r="5" fill="rgba(0,0,0,0.28)"/>
    ${mouth}
    <line x1="52" y1="91" x2="79" y2="95" stroke="rgba(255,255,255,0.38)" stroke-width="1.3"/>
    <line x1="50" y1="97" x2="79" y2="97" stroke="rgba(255,255,255,0.38)" stroke-width="1.3"/>
    <line x1="52" y1="103" x2="79" y2="100" stroke="rgba(255,255,255,0.38)" stroke-width="1.3"/>
    <line x1="121" y1="95" x2="148" y2="91" stroke="rgba(255,255,255,0.38)" stroke-width="1.3"/>
    <line x1="121" y1="97" x2="150" y2="97" stroke="rgba(255,255,255,0.38)" stroke-width="1.3"/>
    <line x1="121" y1="100" x2="148" y2="103" stroke="rgba(255,255,255,0.38)" stroke-width="1.3"/>
    ${accessory.front}
    ${tusks?`<rect x="87" y="108" width="9" height="${tl}" rx="4.5" fill="#EDE5CE" stroke="#C8BB98" stroke-width="0.5"/><rect x="104" y="108" width="9" height="${tl}" rx="4.5" fill="#EDE5CE" stroke="#C8BB98" stroke-width="0.5"/>`:''}
    <ellipse cx="51" cy="162" rx="19" ry="9" fill="rgba(0,0,0,0.2)" transform="rotate(-24 51 162)"/>
    <ellipse cx="51" cy="160" rx="18" ry="8.5" fill="${bc}" transform="rotate(-24 51 160)"/>
    <ellipse cx="149" cy="162" rx="19" ry="9" fill="rgba(0,0,0,0.2)" transform="rotate(24 149 162)"/>
    <ellipse cx="149" cy="160" rx="18" ry="8.5" fill="${bc}" transform="rotate(24 149 160)"/>
    ${lv>=4?`<ellipse cx="100" cy="86" rx="40" ry="40" fill="none" stroke="${look?.accent || '#C49840'}" stroke-width="1.5" stroke-dasharray="5,7" opacity="0.55"/>`:''}
    </svg>`;
}

function makeWalrus(lv, mood='normal', expression = getExpressionState(mood)) {
    const look = getLegendLook(lv);
    const palette = getPixelWalrusPalette(lv);
    const accessory = getPixelWalrusAccessoryMarkup(look, lv >= 4);
    const tusks = lv >= 2;
    const babyStars = expression === 'baby'
        ? '<div class="pw-star pw-star-a"></div><div class="pw-star pw-star-b"></div>'
        : '';
    return `
    <div class="pixel-walrus" data-level="${lv}" data-expression="${expression}" aria-hidden="true"
        style="--pw-body:${palette.body};--pw-head:${palette.head};--pw-belly:${palette.belly};--pw-outline:${palette.outline};--pw-shadow:${palette.shadow};--pw-flipper:${palette.flipper};--pw-accent:${palette.accent};--pw-nose:${palette.nose};--pw-tusk:${palette.tusk};--pw-tusk-edge:${palette.tuskEdge};--pw-blush:${palette.blush};">
        <div class="pw-shadow"></div>
        ${accessory.back}
        <div class="pw-flipper pw-flipper-l"></div>
        <div class="pw-flipper pw-flipper-r"></div>
        <div class="pw-body"></div>
        <div class="pw-belly"></div>
        <div class="pw-head"></div>
        <div class="pw-muzzle"></div>
        <div class="pw-blush pw-blush-l"></div>
        <div class="pw-blush pw-blush-r"></div>
        <div class="pw-whisker pw-whisker-l"></div>
        <div class="pw-whisker pw-whisker-r"></div>
        <div class="pw-eye pw-eye-l"></div>
        <div class="pw-eye pw-eye-r"></div>
        <div class="pw-nose"></div>
        <div class="pw-mouth"></div>
        ${tusks ? '<div class="pw-tusk pw-tusk-l"></div><div class="pw-tusk pw-tusk-r"></div>' : ''}
        ${babyStars}
        ${accessory.front}
    </div>`;
}

/* ===== STATE ===== */
const DECAY_PER_MIN = { hunger: 1.8, happy: 1.2 };
const COOLDOWNS = { feed: 8000, pet: 5000, play: 12000 };
const GAME_STORAGE_KEY = 'walrus_taju4';
const SAKURA_PETALS_REQUIRED = 5;
const DEFAULT_GAME_STATE = Object.freeze({
    hunger: 70,
    happy: 50,
    lv: 1,
    exp: 0,
    lastSaved: 0,
    sakuraPetals: 0,
    sakuraPink: false,
    legendPath: '',
    legendEvolution: false,
    petName: 'たじゅまる',
    custom: { color: 'gold', accessory: 'none' },
    soundDiet: createEmptySoundDiet('1970-01-01')
});

function createGameState(overrides = {}){
    const merged = {
        ...DEFAULT_GAME_STATE,
        lastSaved: Date.now(),
        ...overrides,
        custom: {
            ...DEFAULT_GAME_STATE.custom,
            ...(overrides.custom || {})
        },
        soundDiet: normalizeSoundDiet(overrides.soundDiet || DEFAULT_GAME_STATE.soundDiet)
    };
    return normalizeGameState(merged);
}

function normalizeGameState(state){
    if(!state.custom || typeof state.custom !== 'object') state.custom = {};
    if(!LEGEND_COLORS[state.custom.color]) state.custom.color = DEFAULT_GAME_STATE.custom.color;
    if(!LEGEND_ACCESSORIES.includes(state.custom.accessory)) state.custom.accessory = DEFAULT_GAME_STATE.custom.accessory;
    if(!state.legendPath) state.legendPath = '';
    state.legendEvolution = !!state.legendEvolution;
    if(!state.petName || typeof state.petName !== 'string') state.petName = DEFAULT_GAME_STATE.petName;
    state.soundDiet = normalizeSoundDiet(state.soundDiet);
    state.hunger = clampNumber(state.hunger, 0, 100, DEFAULT_GAME_STATE.hunger);
    state.happy = clampNumber(state.happy, 0, 100, DEFAULT_GAME_STATE.happy);
    state.lv = clampNumber(state.lv, 1, 4, DEFAULT_GAME_STATE.lv);
    state.exp = Math.max(0, Number(state.exp) || DEFAULT_GAME_STATE.exp);
    state.sakuraPetals = clampNumber(state.sakuraPetals, 0, SAKURA_PETALS_REQUIRED, DEFAULT_GAME_STATE.sakuraPetals);
    state.sakuraPink = !!state.sakuraPink || state.sakuraPetals >= SAKURA_PETALS_REQUIRED;
    state.lastSaved = Number(state.lastSaved) || Date.now();
    return state;
}

const StateManager = {
    game: createGameState(),
    loadGame(){
        try{
            const raw = localStorage.getItem(GAME_STORAGE_KEY);
            if(raw) this.game = createGameState(JSON.parse(raw));
        }catch(e){}
        return this.game;
    },
    saveGame(){
        normalizeGameState(this.game);
        this.game.lastSaved = Date.now();
        try{ localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(this.game)); }catch(e){}
        return this.game;
    },
    replaceGame(nextState = {}){
        this.game = createGameState(nextState);
        G = this.game;
        return this.game;
    },
    resetGame(){
        return this.replaceGame();
    }
};
let G = StateManager.game;
let decayInterval = null;
let cdEndTimes = { feed: 0, pet: 0, play: 0 };

function clampNumber(value, min, max, fallback){
    const n = Number(value);
    if(!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function saveG(){
    StateManager.game = G;
    StateManager.saveGame();
}
function loadG(){
    G = StateManager.loadGame();
}

function applyTimeDecay(){
    const elapsed = (Date.now() - G.lastSaved) / 60000;
    const mins = Math.min(elapsed, 120);
    G.hunger = Math.max(0, G.hunger - DECAY_PER_MIN.hunger * mins);
    G.happy  = Math.max(0, G.happy  - DECAY_PER_MIN.happy  * mins);
    return Math.floor(mins);
}

function getLocalDateKey(date = new Date()){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMood(){
    if(G.hunger < 20) return 'sleepy';
    if(G.happy >= 80 && G.hunger >= 60) return 'happy';
    if(G.happy < 30 || G.hunger < 30) return 'sad';
    return 'normal';
}

function getPetClasses(){
    const mood = getMood();
    const expression = getExpressionState(mood);
    let cls = 'pet-stage';
    if(mood === 'sleepy') cls += ' sleepy';
    if(G.lv === 4) cls += ' legend-pet';
    if(expression === 'full') cls += ' full';
    if(expression === 'ecstatic') cls += ' ecstatic';
    return cls;
}

// Update tama device visual state
function updateTamaDevice(){
    const dev = document.getElementById('tamaDevice');
    if(!dev) return;
    if(G.lv >= 4){
        dev.classList.add('legend-device');
    } else {
        dev.classList.remove('legend-device');
    }
    // Update indicator dots (lv 1-4)
    for(let i=1;i<=4;i++){
        const dot = document.getElementById('dot'+i);
        if(dot) dot.classList.toggle('active', i <= G.lv);
    }
}

function renderWalrusMarkup(target, lv, mood = 'normal', expression = getExpressionState(mood), force = false){
    if(!target) return;
    const signature = `${lv}|${mood}|${expression}|${G.legendPath || ''}|${G.legendEvolution ? 1 : 0}|${G.custom?.color || ''}|${G.custom?.accessory || ''}|${G.sakuraPink ? 1 : 0}|${G.sakuraPetals || 0}`;
    if(!force && target.dataset.walrusSignature === signature) return;
    target.innerHTML = makeWalrus(lv, mood, expression);
    target.dataset.walrusSignature = signature;
}

function updateUI(){
    const mood = getMood();
    const expression = getExpressionState(mood);
    const xInLv = G.exp - (G.lv-1)*100;

    document.getElementById('barH').style.width  = Math.round(G.hunger)+'%';
    document.getElementById('barHa').style.width = Math.round(G.happy)+'%';
    document.getElementById('barX').style.width  = Math.min(xInLv,100)+'%';
    document.getElementById('valH').textContent  = Math.round(G.hunger)+'%';
    document.getElementById('valHa').textContent = Math.round(G.happy)+'%';
    document.getElementById('valX').textContent  = Math.round(xInLv)+'/100';

    document.getElementById('barH').className  = 'stat-bar bar-g' + (G.hunger < 30 ? ' low':'');
    document.getElementById('barHa').className = 'stat-bar bar-p' + (G.happy  < 30 ? ' low':'');
    document.getElementById('cardH').className  = 'stat-card' + (G.hunger < 25 ? ' warning':'');
    document.getElementById('cardHa').className = 'stat-card' + (G.happy  < 25 ? ' warning':'');

    const badge = document.getElementById('lvBadge');
    const displayName = G.petName || 'たじゅまる';
    badge.textContent = `✦ ${displayName} · Lv.${G.lv} · ${getLvName(G.lv)}`;
    badge.className = 'lv-badge' + (G.lv===4 ? ' legend':'');

    const alerts = document.getElementById('statusAlerts');
    alerts.innerHTML = '';
    if(G.hunger < 25) alerts.innerHTML += `<span class="alert-tag alert-hunger">${currentLang === 'ja' ? '🐟 お腹空いた！' : '🐟 Hungry!'}</span>`;
    if(G.happy  < 25) alerts.innerHTML += `<span class="alert-tag alert-happy">${currentLang === 'ja' ? '💔 つまらない…' : '💔 Bored...'}</span>`;
    if(mood === 'sleepy') alerts.innerHTML += `<span class="alert-tag alert-sleepy">${currentLang === 'ja' ? '😴 眠たい…' : '😴 Sleepy...'}</span>`;
    if(G.sakuraPink) alerts.innerHTML += `<span class="alert-tag alert-sakura">${currentLang === 'ja' ? '🌸 桜Walrus' : '🌸 Sakura Walrus'}</span>`;
    else if(G.sakuraPetals > 0) alerts.innerHTML += `<span class="alert-tag alert-sakura">🌸 ${G.sakuraPetals}/${SAKURA_PETALS_REQUIRED}</span>`;
    if(G.lv === 4) alerts.innerHTML += `<span class="alert-tag alert-legend">✦ LEGEND</span>`;
    if((G.soundDiet?.total || 0) > 0){
        const insight = getSoundDietInsight();
        alerts.innerHTML += `<span class="alert-tag alert-happy">🎵 ${insight.favoriteLabel}</span>`;
    }
    if(isSoundStarved()){
        alerts.innerHTML += `<span class="alert-tag alert-silence">${currentLang === 'ja' ? '🔇 静かすぎる…' : '🔇 Too quiet...'}</span>`;
    }

    const stage = document.getElementById('petStage');
    renderWalrusMarkup(stage, G.lv, mood, expression);
    const aboutAvatar = document.getElementById('aboutWalrusAvatar');
    renderWalrusMarkup(aboutAvatar, G.lv, 'happy', 'happy');
    if(!stage.classList.contains('bounce') && !stage.classList.contains('shake') && !stage.classList.contains('legend-reveal') && !stage.classList.contains('action-feed') && !stage.classList.contains('action-pet') && !stage.classList.contains('action-play')){
        stage.className = getPetClasses();
    }
    syncSoundReactiveStage();
    renderSoundDietCard();

    document.getElementById('zzzWrap').style.display = mood==='sleepy' ? 'block':'none';
    const showRing = G.lv >= 4;
    document.getElementById('legendRing').style.display      = showRing ? 'block':'none';
    document.getElementById('legendRingOuter').style.display = showRing ? 'block':'none';

    if(G.lv>=2) document.getElementById('sec1').classList.add('show');
    if(G.lv>=3) document.getElementById('sec2').classList.add('show');
    if(G.lv>=4) document.getElementById('sec3').classList.add('show');
    renderLegendLab();

    const diaryBtn = document.getElementById('btnDiary');
    if(diaryBtn){
        if(G.lv >= 4){
            diaryBtn.style.background = 'rgba(196,152,64,0.1)';
            diaryBtn.style.borderColor = 'rgba(196,152,64,0.35)';
            diaryBtn.style.color = 'var(--gold)';
            document.getElementById('diaryBtnSub').style.color = 'rgba(196,152,64,0.55)';
        } else {
            diaryBtn.style.background = 'rgba(255,122,170,0.07)';
            diaryBtn.style.borderColor = 'rgba(255,122,170,0.22)';
            diaryBtn.style.color = 'var(--pink)';
            document.getElementById('diaryBtnSub').style.color = 'rgba(255,122,170,0.5)';
        }
    }

    updateTamaDevice();
    updateDiaryBtnSub();
    updateExchangeBtnSub();
    refreshMyShareCode();
    renderWalrusStorageStatus();
    updateWalkHero();
    const bubble = document.getElementById('msgBubble');
    bubble.classList.toggle('mood-happy', expression === 'happy' || expression === 'ecstatic');
    bubble.classList.toggle('mood-sleepy', expression === 'sleepy');
    bubble.classList.toggle('mood-full', expression === 'full' || expression === 'ecstatic');
    saveG();
}

function setMsg(txt, warn=false){
    const el = document.getElementById('msgBubble');
    const expression = getExpressionState();
    el.style.opacity='0';
    setTimeout(()=>{
        el.textContent=txt;
        el.className='msg-bubble'+(warn?' warn':'');
        if(expression === 'happy' || expression === 'ecstatic') el.classList.add('mood-happy');
        if(expression === 'sleepy') el.classList.add('mood-sleepy');
        if(expression === 'full' || expression === 'ecstatic') el.classList.add('mood-full');
        el.style.opacity='1';
    },70);
}

function showNewbornGuide(){
    const guide = document.getElementById('newbornGuide');
    if(!guide) return;
    guide.classList.add('show');
    pulseActionButtons('#walkStartBtn');
    try { localStorage.setItem(NEWBORN_GUIDE_SEEN_KEY, '1'); } catch(e){}
}

function dismissNewbornGuide(){
    const guide = document.getElementById('newbornGuide');
    if(guide) guide.classList.remove('show');
}

/*
function getMoodMsg(){
    const mood=getMood();
    if(mood==='sleepy') return ['お腹空いたよ〜 🐟','誰か助けて…','ふらふらする…'];
    if(mood==='sad')    return ['もっと遊んでよ…','つまんないな','ちょっと寂しい…'];
    if(mood==='happy')  return ['最高にしあわせ！✨','クーーー！！💚','大好き！なでて！'];
    return ['クー！','ぷくぷく〜','ウォルラス！','なでて〜','クゥ〜','波が好きだよ🌊','気持ちいい〜'];
}
*/
/*
function getMoodMsg(){
    const mood=getMood();
    if(mood==='sleepy') return ['おなか空いたよ〜 🐟','眠くなってきた…','ふらふらするよ…'];
    if(mood==='sad')    return ['もっと遊んでよ…','ちょっとさみしいな','元気が出ないよ…'];
    if(mood==='happy')  return ['最高にしあわせ！ ✨','クーーー！！','だいすき！ なでて！'];
    return ['クー！','ぷかぷか〜','ウォルラス！','なでて〜','クゥ〜','波が気持ちいい〜','遊ぼうよ！'];
}
*/
function getMoodMsgSafe(){
    const mood=getMood();
    if(currentLang === 'ja'){
        if(mood==='sleepy') return ['おなか空いたよ〜 🐟','眠くなってきた…','ふらふらするよ…'];
        if(mood==='sad')    return ['もっと遊んでよ…','ちょっとさみしいな','元気が出ないよ…'];
        if(mood==='happy')  return ['最高にしあわせ！ ✨','クーーー！！','だいすき！ なでて！'];
        return ['クー！','ぷかぷか〜','ウォルラス！','なでて〜','クゥ〜','波が気持ちいい〜','遊ぼうよ！'];
    }
    if(mood==='sleepy') return ['hungry...','so sleepy...','need fish...'];
    if(mood==='sad')    return ['play with me...','feeling lonely','need some love'];
    if(mood==='happy')  return ['so happy!','KUUUU!!','love you!'];
    return ['kuu!','splash splash','walrus!','pet me!','kuu~','ocean vibes','let us play!'];
}
const getMoodMsg = getMoodMsgSafe;

function animPet(cls){
    const el = document.getElementById('petStage');
    el.style.animation='none'; void el.offsetWidth;
    el.className = 'pet-stage ' + cls + (G.lv===4?' legend-pet':'');
    const actionDurations = { 'action-feed': 960, 'action-pet': 1020, 'action-play': 1100 };
    setTimeout(()=>{
        if(cls !== 'legend-reveal') el.className = getPetClasses();
    }, cls==='legend-reveal' ? 1800 : (actionDurations[cls] || 420));
}

function pulseActionButtons(...selectors){
    selectors.forEach(selector => {
        const el = document.querySelector(selector);
        if(!el) return;
        el.classList.remove('tap-feedback');
        void el.offsetWidth;
        el.classList.add('tap-feedback');
        window.setTimeout(() => el.classList.remove('tap-feedback'), 220);
    });
}

function spawnParticles(emojis, x, y){
    emojis.forEach((em,i)=>{
        setTimeout(()=>{
            const p = document.createElement('div');
            p.className = 'fparticle';
            p.textContent = em;
            const dx = ((Math.random()-0.5)*80)+'px';
            p.style.left = (x + (Math.random()-0.5)*50)+'px';
            p.style.top  = (y + (Math.random()-0.5)*30 - 20)+'px';
            p.style.setProperty('--dx', dx);
            document.body.appendChild(p);
            setTimeout(()=>p.remove(), 1300);
        }, i*90);
    });
}

function spawnActionFx(type){
    const c = getStageCenter();
    const cfg = {
        feed: { color: '#f5d080', glow: 'rgba(245,208,128,0.42)', label: currentLang === 'ja' ? 'もぐもぐ!' : 'nom nom!', dots: ['🐟','✨','💚'], ring: 150 },
        pet:  { color: '#ff7aaa', glow: 'rgba(255,122,170,0.42)', label: currentLang === 'ja' ? 'すりすり♪' : 'cuddle!', dots: ['💗','💙','✨'], ring: 132 },
        play: { color: '#00c8f0', glow: 'rgba(0,200,240,0.45)', label: currentLang === 'ja' ? 'ぴょん!' : 'splash!', dots: ['🫧','⭐','💫'], ring: 166 }
    }[type];
    if(!cfg) return;
    createActionFx('ring', c.x, c.y + 4, cfg, { '--size': `${cfg.ring}px` });
    createActionFx('chip', c.x, c.y - 96, cfg);
    if(type === 'pet') {
        createActionFx('pat', c.x - 28, c.y - 32, cfg);
        createActionFx('pat', c.x + 28, c.y - 28, cfg);
    }
    for(let i=0;i<14;i++){
        const angle = (Math.PI * 2 * i / 14) + Math.random() * 0.35;
        const dist = 54 + Math.random() * 58;
        createActionFx('dot', c.x + (Math.random()-0.5)*22, c.y + (Math.random()-0.5)*18, cfg, {
            '--size': `${7 + Math.random() * 14}px`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist - 34}px`,
            '--dur': `${0.72 + Math.random() * 0.42}s`
        }, cfg.dots[i % cfg.dots.length]);
    }
}

function createActionFx(kind, x, y, cfg, vars = {}, text = ''){
    const el = document.createElement('div');
    el.className = `action-fx action-fx-${kind}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--color', cfg.color);
    el.style.setProperty('--glow', cfg.glow);
    Object.entries(vars).forEach(([key, value]) => el.style.setProperty(key, value));
    if(kind === 'chip') el.textContent = cfg.label;
    if(kind === 'dot') el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

function setBabyMsg(txt){
    const el = document.getElementById('msgBubble');
    if(!el) return;
    el.style.opacity='0';
    setTimeout(()=>{
        el.textContent = txt;
        el.className = 'msg-bubble baby-float';
        el.style.opacity = '1';
    }, 35);
}

function showPrimaryFlash(){
    const flash = document.createElement('div');
    flash.className = 'baby-primary-flash';
    document.body.appendChild(flash);
    setTimeout(()=>flash.remove(), 460);
}

function spawnBabyBubbles(x, y){
    const smallCount = 16;
    for(let i=0;i<smallCount;i++){
        const b = document.createElement('div');
        b.className = 'baby-bubble';
        const size = 9 + Math.random() * 22;
        const angle = Math.random() * Math.PI * 2;
        const dist = 48 + Math.random() * 98;
        b.style.left = (x + Math.cos(angle) * (18 + Math.random() * 28)) + 'px';
        b.style.top = (y + Math.sin(angle) * 18) + 'px';
        b.style.setProperty('--size', size + 'px');
        b.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
        b.style.setProperty('--dy', (-70 - Math.random() * 90) + 'px');
        b.style.setProperty('--dur', (0.85 + Math.random() * 0.75) + 's');
        document.body.appendChild(b);
        setTimeout(()=>b.remove(), 1800);
    }

    for(let i=0;i<5;i++){
        const b = document.createElement('div');
        b.className = 'baby-big-bubble';
        const size = 54 + Math.random() * 76;
        const side = i % 2 === 0 ? -1 : 1;
        b.style.left = (x + side * (56 + Math.random() * 76)) + 'px';
        b.style.top = (y - 52 + Math.random() * 86) + 'px';
        b.style.setProperty('--size', size + 'px');
        b.style.setProperty('--dx', (side * (24 + Math.random() * 64)) + 'px');
        b.style.setProperty('--dy', (-92 - Math.random() * 90) + 'px');
        b.style.setProperty('--dur', (1.35 + Math.random() * 0.65) + 's');
        document.body.appendChild(b);
        setTimeout(()=>{
            if(!b.parentNode) return;
            const pop = document.createElement('div');
            pop.className = 'baby-pop-text';
            pop.textContent = currentLang === 'ja' ? 'ぽんっ!' : 'pop!';
            const r = b.getBoundingClientRect();
            pop.style.left = (r.left + r.width / 2) + 'px';
            pop.style.top = (r.top + r.height / 2) + 'px';
            document.body.appendChild(pop);
            sfxBabyPop();
            setTimeout(()=>pop.remove(), 600);
            b.remove();
        }, 900 + i * 180);
    }
}

let babyDelightLocked = false;
function babyDelightBurst(fromTap = false){
    if(document.getElementById('mainScreen')?.classList.contains('hidden')) return;
    if(!babyModeEnabled) return;
    if(babyDelightLocked) return;
    babyDelightLocked = true;
    setTimeout(()=>{ babyDelightLocked = false; }, 360);

    const stage = document.getElementById('petStage');
    if(!stage) return;
    const c = getStageCenter();
    renderWalrusMarkup(stage, G.lv, 'happy', 'baby', true);
    stage.style.animation = 'none';
    void stage.offsetWidth;
    stage.className = 'pet-stage baby-delight' + (G.lv===4 ? ' legend-pet' : '');

    G.happy = Math.min(100, G.happy + (fromTap ? 4 : 2));
    G.exp += fromTap ? 2 : 1;
    setBabyMsg(currentLang === 'ja' ? 'ぴょんぴょん！ クー♪' : 'Boing boing! Kuu♪');
    spawnBabyBubbles(c.x, c.y + 18);
    spawnParticles(['💗','💛','💙','💚','✨','🫧'], c.x, c.y);
    showPrimaryFlash();
    sfxKuu();
    haptic([18, 20, 38]);

    setTimeout(()=>{
        if(stage.classList.contains('baby-delight')) stage.className = getPetClasses();
        updateUI();
        checkLevelUp();
    }, 1080);
}

function setupBabyTapReactions(){
    const main = document.getElementById('mainScreen');
    if(!main || main.dataset.babyTapReady === '1') return;
    main.dataset.babyTapReady = '1';
    main.addEventListener('click', (e)=>{
        if(main.classList.contains('hidden')) return;
        if(!babyModeEnabled) return;
        if(e.target.closest('#petStage')) return;
        if(e.target.closest('.diary-modal, .exchange-modal, .blob-preview-modal, .social-popup, .mini-result-modal, #miniGameScreen')) return;
        babyDelightBurst(false);
    }, { passive: true });
}

function createHatchBaby(){
    return makeWalrus(1, 'happy', 'baby');
}

function getStageCenter(){
    const r=document.getElementById('petStage').getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};
}

/* ===== COOLDOWN ===== */
function startCD(btnId, fillId, lblId, ms){
    const btn  = document.getElementById(btnId);
    const fill = document.getElementById(fillId);
    const lbl  = document.getElementById(lblId);
    btn.disabled=true; fill.style.width='100%';
    const endTime = Date.now() + ms;
    const tick=()=>{
        const remain = endTime - Date.now();
        if(remain<=0){
            fill.style.width='0%';
            if(lbl) lbl.textContent='';
            btn.disabled=false;
            return;
        }
        fill.style.width=(remain/ms*100)+'%';
        if(lbl) lbl.textContent = (remain/1000).toFixed(1)+'s';
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

/* ===== LEVEL UP ===== */
/*
function showLevelUpOverlay(lv){
    const overlay = document.getElementById('levelupOverlay');
    const text    = document.getElementById('levelupText');
    const isLegend = lv===4;
    text.textContent = isLegend ? `✦ LEGEND! ✦` : `✨ Lv.${lv} に進化！`;
    text.className = 'levelup-text' + (isLegend ? ' legend-text':'');
    overlay.className = 'levelup-overlay show';
    setTimeout(()=>overlay.classList.remove('show'), 2200);
}
*/
function showLevelUpOverlay(lv){
    const overlay = document.getElementById('levelupOverlay');
    const text    = document.getElementById('levelupText');
    const isLegend = lv===4;
    text.textContent = isLegend ? 'LEGEND!' : `Lv.${lv} UP!`;
    text.className = 'levelup-text' + (isLegend ? ' legend-text':'');
    overlay.className = 'levelup-overlay show';
    setTimeout(()=>overlay.classList.remove('show'), 2200);
}

function openSocialPopup(force = false){
    const popup = document.getElementById('socialPopup');
    if(!popup) return;
    if(!force){
        try {
            if(localStorage.getItem('walrus_social_popup_seen') === '1') return;
        } catch(e){}
    }
    popup.style.display = 'flex';
    socialPopupPending = false;
    try { localStorage.setItem('walrus_social_popup_seen', '1'); } catch(e){}
}
function closeSocialPopup(){
    const popup = document.getElementById('socialPopup');
    if(!popup) return;
    popup.style.display = 'none';
}

function clearLegendAscensionTimers(){
    legendAscensionTimers.forEach(id => clearTimeout(id));
    legendAscensionTimers = [];
}

function renderLegendAscensionWalrus(){
    const slot = document.getElementById('legendAscensionWalrus');
    if(!slot) return;
    const backupEvolution = G.legendEvolution;
    const backupPath = G.legendPath;
    G.legendEvolution = true;
    G.legendPath = 'evolution';
    const markup = makeWalrus(4, 'happy', 'happy');
    slot.innerHTML = isLikelyIOSDevice()
        ? markup.replace(/<animateTransform[\s\S]*?<\/animateTransform>/g, '').replace(/<animate[\s\S]*?<\/animate>/g, '')
        : markup;
    G.legendEvolution = backupEvolution;
    G.legendPath = backupPath;
}

function closeLegendAscension(){
    clearLegendAscensionTimers();
    const overlay = document.getElementById('legendAscension');
    if(!overlay) return;
    overlay.className = 'legend-ascension';
    overlay.style.display = 'none';
}

function openLegendAfterglow(){
    closeLegendAscension();
    createLegendCertificate();
}

function showLegendAscension(){
    const overlay = document.getElementById('legendAscension');
    if(!overlay) return;
    clearLegendAscensionTimers();
    renderLegendAscensionWalrus();
    overlay.style.display = 'flex';
    if(isLikelyIOSDevice()){
        overlay.className = 'legend-ascension show ios-safe ready';
        return;
    }
    overlay.className = 'legend-ascension show';
    const step1 = setTimeout(() => overlay.classList.add('phase-light'), 80);
    const step2 = setTimeout(() => overlay.classList.add('phase-title', 'phase-walrus'), 500);
    const step3 = setTimeout(() => overlay.classList.add('ready'), 1700);
    legendAscensionTimers.push(step1, step2, step3);
}

function scrollToUnlockedSection(lv){
    // sec1 = Lv2, sec2 = Lv3, sec3 = Lv4
    const secId = lv >= 2 && lv <= 4 ? 'sec' + (lv - 1) : null;
    if(!secId) return;
    setTimeout(()=>{
        const el = document.getElementById(secId);
        if(el){
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Flash highlight effect
            el.style.transition = 'box-shadow 0.3s';
            el.style.boxShadow = '0 0 0 2px rgba(0,229,176,0.6), 0 0 30px rgba(0,229,176,0.25)';
            setTimeout(()=>{ el.style.boxShadow = ''; }, 2000);
        }
    }, 2400); // after level-up overlay fades
}

/*
function checkLevelUp(){
    if(G.exp >= G.lv*100 && G.lv<4){
        G.lv++;
        sfxLevelUp();
        haptic(50);
        showLevelUpOverlay(G.lv);
        setMsg(`✨ レベルアップ！ Lv.${G.lv} · ${LV_NAMES[G.lv]} になったよ！`);
        if(G.lv===4){
            socialPopupPending = true;
            setTimeout(()=>animPet('legend-reveal'), 200);
            setTimeout(()=>createLegendCertificate(), 2000);
            setTimeout(()=>{
                const certModal = document.getElementById('legendCertModal');
                if(socialPopupPending && certModal && certModal.style.display !== 'flex') openSocialPopup();
            }, 3600);
        } else {
            animPet('bounce');
        }
        const c=getStageCenter();
        spawnParticles(['✨','⭐','💫','✨','⭐'],c.x,c.y);
        // ★ Auto-scroll to newly unlocked section
        scrollToUnlockedSection(G.lv);
        return true;
    }
    return false;
}
*/
function checkLevelUp(){
    if(G.exp >= G.lv*100 && G.lv<4){
        G.lv++;
        sfxLevelUp();
        haptic(50);
        if(G.lv !== 4) showLevelUpOverlay(G.lv);
        setMsg(G.lv===4
            ? (currentLang === 'ja' ? '✦ Legend到達。Walrus の伝説が刻まれた！' : 'Legend reached. Your Walrus has been etched into legend!')
            : (currentLang === 'ja' ? `✨ レベルアップ！ Lv.${G.lv} · ${getLvName(G.lv)} になったよ！` : `Level up! Lv.${G.lv} ${getLvName(G.lv)}`));
        if(G.lv===4){
            socialPopupPending = false;
            showLegendAscension();
            setTimeout(()=>animPet('legend-reveal'), 560);
        } else {
            animPet('bounce');
        }
        const c=getStageCenter();
        spawnParticles(['✨','⭐','💎','✨','🫧'],c.x,c.y);
        scrollToUnlockedSection(G.lv);
        return true;
    }
    return false;
}

/* ===== ACTIONS ===== */
function doFeed(){
    dismissNewbornGuide();
    pulseActionButtons('#btnFeed', '.tama-btn-a');
    sfxFeed(); haptic(15);
    G.hunger=Math.min(100,G.hunger+28); G.exp+=15;
    setMsg(currentLang === 'ja' ? 'おいしい！ 満腹になった 🐟' : 'Yum! Nice and full 🐟');
    animPet('action-feed');
    const c=getStageCenter(); spawnParticles(['💚','⭐','💚','🐟'],c.x,c.y);
    spawnActionFx('feed');
    startCD('btnFeed','cdFeed','lblFeed',COOLDOWNS.feed);
    checkLevelUp(); updateUI();
}
function doPet(){
    dismissNewbornGuide();
    pulseActionButtons('#btnPet', '.tama-btn-b');
    sfxPet(); haptic(12);
    G.happy=Math.min(100,G.happy+22); G.exp+=10;
    setMsg(currentLang === 'ja' ? 'クゥゥ〜 気持ちいい〜 💙' : 'Kuuu... that feels good 💙');
    animPet('action-pet');
    const c=getStageCenter(); spawnParticles(['💙','💙','💙'],c.x,c.y);
    spawnActionFx('pet');
    startCD('btnPet','cdPet','lblPet',COOLDOWNS.pet);
    checkLevelUp(); updateUI();
}
function doPlay(){
    dismissNewbornGuide();
    pulseActionButtons('#btnPlay', '.tama-btn-c');
    sfxPlay(); haptic(20);
    G.happy=Math.min(100,G.happy+18); G.hunger=Math.max(0,G.hunger-10); G.exp+=20;
    setMsg(currentLang === 'ja' ? 'わーい！ 一緒に遊んだよ ⚡' : 'Yay! We played together ⚡');
    animPet('action-play');
    const c=getStageCenter(); spawnParticles(['⭐','💫','⭐','💫'],c.x,c.y);
    spawnActionFx('play');
    startCD('btnPlay','cdPlay','lblPlay',COOLDOWNS.play);
    checkLevelUp(); updateUI();
}
function tapPet(){
    if(getMood()==='sleepy'){ setMsg(currentLang === 'ja' ? 'お腹空いてて元気ない…🐟' : 'Too hungry to move...🐟',true); haptic(30); return; }
    if(babyModeEnabled){
        babyDelightBurst(true);
        return;
    }
    haptic(10);
    G.happy=Math.min(100,G.happy+4); G.exp+=2;
    const msgs=getMoodMsg();
    setMsg(msgs[Math.floor(Math.random()*msgs.length)]);
    animPet('shake');
    const c=getStageCenter(); spawnParticles(['💚'],c.x,c.y);
    checkLevelUp(); updateUI();
}

function doReset(){
    if(!confirm(currentLang === 'ja'
        ? '本当にリセットしますか？ 進捗が全て消えます。'
        : 'Reset everything? All progress will be lost.'
    )) return;

    // まず画面を軽くする
    document.body.style.pointerEvents = 'none';
    showToast(currentLang === 'ja' ? 'リセット中…' : 'Resetting...');

    // 重い処理を次フレームに逃がす
    requestAnimationFrame(() => {
        try {
            stopCollectorSpeech();
            if(isTrackPlaying) stopTrack();

            if(decayInterval) {
                clearInterval(decayInterval);
                decayInterval = null;
            }

            if(eventInterval) {
                clearInterval(eventInterval);
                eventInterval = null;
            }

            if(typeof stopWalk === 'function' && walkState?.active) {
                stopWalk();
            }

            StateManager.resetGame();

            [
                GAME_STORAGE_KEY,
                'walrus_blobid',
                'legend_cert_blobid',
                'walrus_diary',
                'walrus_diary_blobid',
                'walrus_exchange_history',
                PORTFOLIO_ORDER_KEY,
                COLLECTOR_BLOB_KEY,
                NEWBORN_GUIDE_SEEN_KEY,
                WALK_LOG_KEY,
                WALK_BLOB_KEY
            ].forEach(key => {
                try { localStorage.removeItem(key); } catch(e) {}
            });

            socialPopupPending = false;
            legendCertShareUrl = '';

            // ✅ renderDiaryEntries / renderExchangeHistory / updateUI は不要
            // どうせ reload するので描画しない

            location.reload();

        } catch(e) {
            console.warn('reset failed', e);
            location.reload();
        }
    });
}

function startDecay(){
    if(decayInterval) clearInterval(decayInterval);
    decayInterval = setInterval(()=>{
        G.hunger = Math.max(0, G.hunger - DECAY_PER_MIN.hunger / 6);
        G.happy  = Math.max(0, G.happy  - DECAY_PER_MIN.happy  / 6);
        updateUI();
    }, 10000);
}

/* ===== GOLDEN FISH EVENT ===== */
let eventInterval = null;
const SAKURA_EVENT_ENABLED = true;
const SAKURA_EVENT_START = { month: 3, day: 25 };
const SAKURA_EVENT_END = { month: 5, day: 25 };

function isSakuraEventActive(date = new Date()){
    if(!SAKURA_EVENT_ENABLED) return false;
    const y = date.getFullYear();
    const start = new Date(y, SAKURA_EVENT_START.month - 1, SAKURA_EVENT_START.day, 0, 0, 0, 0);
    const end = new Date(y, SAKURA_EVENT_END.month - 1, SAKURA_EVENT_END.day, 23, 59, 59, 999);
    return date >= start && date <= end;
}

function triggerGoldenFish() {
    if (!document.getElementById('miniGameScreen').classList.contains('hidden')) return;
    const wrap = document.querySelector('.pet-stage-wrap');
    const fish = document.createElement('div');
    fish.className = 'golden-fish';
    fish.textContent = '🐟✨';
    fish.style.left = Math.random() * 60 + 20 + '%';
    fish.style.top = '30%';
    const dx = (Math.random() - 0.5) * 220 + 'px';
    const dy = -80 - Math.random() * 120 + 'px';
    fish.style.setProperty('--dx', dx);
    fish.style.setProperty('--dy', dy);
    wrap.appendChild(fish);
    let caught = false;
    fish.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        if (caught) return;
        caught = true;
        G.exp += 35; G.happy = Math.min(100, G.happy + 25);
        spawnParticles(['✨','⭐','🐟','💎','🌊'], e.clientX, e.clientY);
        animPet('bounce');
        setMsg(currentLang === 'ja' ? '🎉 黄金の魚ゲット！！ 大成功だよ🦭' : '🎉 You caught the golden fish!! Huge win 🦭');
        sfxLevelUp(); haptic(80);
        fish.style.transition = 'all 0.3s'; fish.style.transform = 'scale(2.5)'; fish.style.opacity = '0';
        setTimeout(() => fish.remove(), 300);
        checkLevelUp(); updateUI();
    });
    setTimeout(() => {
        if (!caught && fish.parentNode) { setMsg(currentLang === 'ja' ? '🐟 …逃げちゃった…' : '🐟 ...it got away...', true); fish.remove(); }
    }, 3800);
}

function triggerSakuraPetal() {
    if (!isSakuraEventActive() || G.sakuraPink) return;
    if (!document.getElementById('miniGameScreen').classList.contains('hidden')) return;
    if (document.getElementById('mainScreen').classList.contains('hidden')) return;
    const petal = document.createElement('div');
    petal.className = 'sakura-petal';
    petal.textContent = '🌸';
    petal.style.left = Math.random() * 84 + 8 + 'vw';
    petal.style.top = '-36px';
    petal.style.setProperty('--dx', ((Math.random() - 0.5) * Math.min(240, window.innerWidth * 0.42)) + 'px');
    petal.style.setProperty('--dy', (window.innerHeight * (0.58 + Math.random() * 0.34)) + 'px');
    document.body.appendChild(petal);
    let picked = false;
    petal.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        if(picked) return;
        picked = true;
        G.sakuraPetals = Math.min(SAKURA_PETALS_REQUIRED, (Number(G.sakuraPetals) || 0) + 1);
        G.happy = Math.min(100, G.happy + 6);
        spawnParticles(['🌸','✨','🌸'], e.clientX, e.clientY);
        haptic(35);
        sfxPet();
        petal.style.transition = 'all 0.24s ease';
        petal.style.transform = 'scale(2.2) rotate(18deg)';
        petal.style.opacity = '0';
        setTimeout(() => petal.remove(), 260);
        if(G.sakuraPetals >= SAKURA_PETALS_REQUIRED){
            G.sakuraPink = true;
            animPet('bounce');
            setMsg(currentLang === 'ja' ? '🌸 桜の力でピンクWalrusになったよ！' : '🌸 Sakura power turned Walrus pink!');
            const c = getStageCenter();
            spawnParticles(['🌸','💗','✨','🌸','💗'], c.x, c.y);
            sfxLevelUp();
        } else {
            setMsg(currentLang === 'ja' ? `🌸 桜の花びら ${G.sakuraPetals}/${SAKURA_PETALS_REQUIRED}` : `🌸 Sakura petals ${G.sakuraPetals}/${SAKURA_PETALS_REQUIRED}`);
        }
        updateUI();
    });
    setTimeout(() => {
        if(!picked && petal.parentNode) petal.remove();
    }, 5200);
}

function startRandomEvents() {
    if (eventInterval) clearInterval(eventInterval);
    if(isSakuraEventActive() && !G.sakuraPink){
        setTimeout(triggerSakuraPetal, 1800);
    }
    eventInterval = setInterval(() => {
        if (isSakuraEventActive() && !G.sakuraPink && Math.random() < 0.72) {
            triggerSakuraPetal();
            return;
        }
        if (Math.random() < 0.35) triggerGoldenFish();
    }, 60000 + Math.random() * 45000);
}

/* ===== MINI GAME ===== */
let miniState = null;
const MINI_PERFECT_SCORE = 650;
const MINI_PERFECT_EXP_MULTIPLIER = 1.5;

function startMiniGame(){
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('miniGameScreen').classList.remove('hidden');
    document.getElementById('miniResult').style.display='none';

    const canvas=document.getElementById('gameCanvas');
    const tapFxLayer=document.getElementById('tapFxLayer');
    const dpr=Math.min(window.devicePixelRatio||1, 1.5);
    const W=Math.min(window.innerWidth-32,400);
    const H=Math.min(window.innerHeight-200,520);
    const MAX_BUBBLES = 12;
    const INITIAL_BUBBLES = 7;
    const SPAWN_INTERVAL_MS = 180;
    const PARTICLES_PER_POP = 10;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    canvas.width=W*dpr; canvas.height=H*dpr;
    const ctx=canvas.getContext('2d');
    ctx.scale(dpr,dpr);
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#02101f');
    bg.addColorStop(1,'#0a2540');

    let score=0, timeLeft=45, combo=0;
    let bubbles=[], popParticles=[], scorePopups=[], rippleBursts=[];
    let lastSpawnTime=Date.now(), comboTimer=null;

    document.getElementById('miniScore').textContent='0';
    document.getElementById('miniTimer').textContent='45';
    document.getElementById('comboDisplay').textContent='';
    tapFxLayer.innerHTML = '';

    function spawnBubble(forceY){
        if(bubbles.length >= MAX_BUBBLES) return;
        const r=16+Math.random()*28;
        bubbles.push({ x:r+Math.random()*(W-r*2), y:forceY!==undefined?forceY:H+r+20, r, speed:1.4+Math.random()*2.4, dx:(Math.random()-0.5)*0.6, hue:Math.random()>0.5?170:185, opacity:0, wobble:Math.random()*Math.PI*2 });
    }
    for(let i=0;i<INITIAL_BUBBLES;i++) spawnBubble(H-60-Math.random()*(H-80));

    function draw(){
        ctx.clearRect(0,0,W,H);
        const useCanvasGlow = !isLikelyIOSDevice();
        ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

        for(let i=bubbles.length-1;i>=0;i--){
            const b=bubbles[i];
            b.opacity=Math.min(1,b.opacity+0.04);
            ctx.save();
            ctx.globalAlpha=b.opacity*0.82;
            if(useCanvasGlow){
                ctx.shadowBlur=14; ctx.shadowColor=`hsla(${b.hue},100%,75%,0.55)`;
            }
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
            const rg=ctx.createRadialGradient(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.1, b.x, b.y, b.r);
            rg.addColorStop(0, `hsla(${b.hue},100%,92%,0.95)`);
            rg.addColorStop(0.65, `hsla(${b.hue},100%,68%,0.65)`);
            rg.addColorStop(1, `hsla(${b.hue},80%,52%,0.25)`);
            ctx.fillStyle = rg; ctx.fill();
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
            ctx.strokeStyle = `hsla(${b.hue},100%,90%,0.6)`; ctx.lineWidth = 1.6; ctx.stroke();
            ctx.beginPath(); ctx.arc(b.x - b.r*0.35, b.y - b.r*0.38, b.r*0.32, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
            ctx.save();
            ctx.font = `bold ${Math.floor(b.r * 0.78)}px Fredoka One`;
            ctx.fillStyle = '#0a1f2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.fillText('W', b.x, b.y + 1);
            ctx.restore(); ctx.restore();

            b.wobble += 0.05;
            b.y -= b.speed; b.x += b.dx;
            b.x += Math.sin(b.wobble) * 0.28;
            b.dx += (Math.random()-0.5)*0.08;
            b.dx = Math.max(-1.2, Math.min(1.2, b.dx));
            if(b.y < -b.r - 10) bubbles.splice(i,1);
        }

        for(let i=popParticles.length-1;i>=0;i--){
            const p=popParticles[i];
            ctx.globalAlpha=p.life;
            ctx.fillStyle=`hsl(${p.hue},100%,82%)`;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
            p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=0.032; p.size*=0.97;
            if(p.life<=0) popParticles.splice(i,1);
        }
        ctx.globalAlpha=1;

        for(let i=scorePopups.length-1;i>=0;i--){
            const s=scorePopups[i];
            ctx.globalAlpha=s.life;
            ctx.font=`bold ${s.size}px Nunito`; ctx.fillStyle=s.color; ctx.textAlign='center';
            ctx.fillText(s.text,s.x,s.y);
            s.y-=1.8; s.life-=0.025;
            if(s.life<=0) scorePopups.splice(i,1);
        }
        ctx.globalAlpha=1;

        for(let i=rippleBursts.length-1;i>=0;i--){
            const r=rippleBursts[i];
            ctx.globalAlpha = r.life * 0.65;
            ctx.strokeStyle = `hsla(${r.hue},100%,88%,${r.life})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
            r.radius += 5.5;
            r.life -= 0.05;
            if(r.life <= 0) rippleBursts.splice(i,1);
        }
        ctx.globalAlpha=1;

        const now=Date.now();
        if(now-lastSpawnTime>SPAWN_INTERVAL_MS){
            spawnBubble();
            if(bubbles.length < MAX_BUBBLES - 2 && Math.random()>0.82) spawnBubble();
            lastSpawnTime=now;
        }
        document.getElementById('miniScore').textContent=score;
    }

    function gameLoop(){
        draw();
        if(miniState&&miniState.running) miniState.raf=requestAnimationFrame(gameLoop);
    }

    function spawnTapFlash(clientX, clientY){
        const rect = canvas.getBoundingClientRect();
        const fx = document.createElement('div');
        fx.className = 'tap-flash';
        fx.style.left = `${clientX - rect.left}px`;
        fx.style.top = `${clientY - rect.top}px`;
        tapFxLayer.appendChild(fx);
        setTimeout(()=>fx.remove(), 450);
    }

    function handleTap(e){
        e.preventDefault();
        const rect=canvas.getBoundingClientRect();
        const scaleX=W/rect.width, scaleY=H/rect.height;
        const point = e.touches ? e.touches[0] : e;
        let mx=(point.clientX-rect.left)*scaleX;
        let my=(point.clientY-rect.top)*scaleY;
        spawnTapFlash(point.clientX, point.clientY);

        let hit=false;
        for(let i=bubbles.length-1;i>=0;i--){
            const b=bubbles[i];
            const dx=b.x-mx, dy=b.y-my;
            if(dx*dx+dy*dy<(b.r+22)*(b.r+22)){
                combo++;
                clearTimeout(comboTimer);
                comboTimer=setTimeout(()=>{ combo=0; document.getElementById('comboDisplay').textContent=''; },1200);
                const base=Math.floor(b.r*1.6), mult=combo>=5?3:combo>=3?2:1, gained=base*mult;
                score+=gained;
                sfxBubble(b.r); haptic(8);
                if(combo>=2) document.getElementById('comboDisplay').textContent=combo>=5?`🔥 ${combo}x COMBO!!`:`💫 ${combo}x Combo!`;
                scorePopups.push({x:b.x,y:b.y-20,text:mult>1?`×${mult} ${gained}`:'+'+gained,color:mult>1?'#ff7aaa':'#00e5b0',life:1,size:mult>1?22:16});
                rippleBursts.push({x:b.x,y:b.y,radius:b.r*0.55,life:1,hue:b.hue});
                for(let k=0;k<PARTICLES_PER_POP;k++){
                    const angle=Math.random()*Math.PI*2, spd=3+Math.random()*7;
                    popParticles.push({x:b.x,y:b.y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd-2,life:1,hue:b.hue,size:3+Math.random()*4});
                }
                bubbles.splice(i,1); spawnBubble();
                hit=true; break;
            }
        }
        if(!hit&&combo>0){ combo=0; document.getElementById('comboDisplay').textContent=''; }
    }

    canvas.addEventListener('pointerdown',handleTap,{passive:false});

    const tid=setInterval(()=>{
        timeLeft--;
        document.getElementById('miniTimer').textContent=timeLeft;
        if(timeLeft<=0){ clearInterval(tid); if(miniState) miniState.running=false; finishMiniGame(score); }
    },1000);

    miniState={raf:null,tid,running:true};
    miniState.raf=requestAnimationFrame(gameLoop);

    window._miniCleanup=()=>{
        clearInterval(tid);
        clearTimeout(comboTimer); // ✅ 追加
        if(miniState&&miniState.raf) cancelAnimationFrame(miniState.raf);
        canvas.removeEventListener('pointerdown',handleTap);
        tapFxLayer.innerHTML = '';
        miniState=null;
    };
}

function finishMiniGame(finalScore){
    if(window._miniCleanup) window._miniCleanup();
    const happyBonus=Math.min(45,Math.floor(finalScore/3.5));
    const baseExpBonus=Math.min(60,Math.floor(finalScore/2.2));
    const isPerfect = finalScore >= MINI_PERFECT_SCORE;
    const expBonus  =isPerfect ? Math.round(baseExpBonus * MINI_PERFECT_EXP_MULTIPLIER) : baseExpBonus;
    G.happy=Math.min(100,G.happy+happyBonus); G.exp+=expBonus;
    const resultTitle = document.querySelector('#miniResult .mini-result-inner div');
    if(resultTitle) resultTitle.textContent = isPerfect ? t('game_perfect') : t('game_clear');
    document.getElementById('resultScoreText').innerHTML=`${currentLang === 'ja' ? 'スコア' : 'Score'}&nbsp;<span style="color:${isPerfect ? '#f5d080' : '#00e5b0'}">${finalScore}</span>`;
    document.getElementById('resultReward').innerHTML=`${currentLang === 'ja' ? 'ハッピー' : 'Happy'} <span style="color:#ff7aaa">+${happyBonus}</span><br>${currentLang === 'ja' ? '経験値' : 'EXP'} <span style="color:#00c8f0">+${expBonus}</span>${isPerfect ? `<br><span style="color:var(--gold-light);font-weight:800">${t('game_perfect_bonus')}</span>` : ''}`;
    document.getElementById('miniResult').style.display='flex';
    if(isPerfect){
        haptic([40,20,80,20,120]);
        sfxLevelUp();
    }
    checkLevelUp(); updateUI();
}

function endMiniGameEarly(){
    const s=parseInt(document.getElementById('miniScore').textContent)||0;
    finishMiniGame(s);
}

function closeMiniResult(){
    document.getElementById('miniResult').style.display='none';
    document.getElementById('miniGameScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    const c=getStageCenter(); spawnParticles(['🫧','💫','✨','🫧','⭐'],c.x,c.y);
    setMsg(currentLang === 'ja' ? '🫧 バブルポップお疲れ！ また遊ぼうね〜' : '🫧 Nice Bubble Pop run! Let’s play again soon');
}

/* ===== WALRUS INTEGRATION ===== */
const PUBLISHER  = "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";
let legendCertShareUrl = '';
let saveMomentHideTimer = null;

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
    setStorageText('saveMomentLocal', isJa ? '育成データ' : 'GAME DATA');
    setStorageText('saveMomentStorage', isJa ? 'WALRUS BLOB' : 'WALRUS BLOB');
    setStorageText('saveOnChainLabel', 'ON-CHAIN');
    setStorageText('saveOnChainText', isJa ? 'BlobIdだけ残る' : 'BlobId remains');
    setStorageText('saveOffChainLabel', 'OFF-CHAIN');
    setStorageText('saveOffChainText', isJa ? '中身はWalrusへ' : 'Data goes to Walrus');
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
    if(reward.happy) parts.push(`${currentLang === 'ja' ? 'ハッピー' : 'Happy'} ${reward.happy > 0 ? '+' : ''}${reward.happy}`);
    if(reward.exp) parts.push(`${currentLang === 'ja' ? '経験値' : 'EXP'} ${reward.exp > 0 ? '+' : ''}${reward.exp}`);
    if(reward.hunger) parts.push(`${currentLang === 'ja' ? '満腹' : 'Full'} ${reward.hunger > 0 ? '+' : ''}${reward.hunger}`);
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
        const res = await fetch(`${AGGREGATOR}/v1/blobs/${code}`, {
            method: 'GET', headers: { 'Accept': 'application/octet-stream, */*' }
        });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const js = text.indexOf('{'), je = text.lastIndexOf('}');
        if(js === -1 || je === -1) throw new Error('JSON not found');
        const friendData = JSON.parse(text.slice(js, je + 1));

        if(typeof friendData.lv === 'undefined' || typeof friendData.hunger === 'undefined'){
            throw new Error('Invalid Walrus data format');
        }

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
    const friendLvName = getLvName(friendLv) || 'Walrus';
    const play = getExchangePlay(exchangeEntry.playKey);
    const playText = exchangeEntry.playName
        ? { name: exchangeEntry.playName, desc: getExchangePlayText(exchangeEntry.playKey).desc }
        : getExchangePlayText(exchangeEntry.playKey);
    const reward = exchangeEntry.reward || play.reward;

    document.getElementById('visitMyWalrus').innerHTML = makeWalrus(G.lv, 'happy');
    document.getElementById('visitFriendWalrus').innerHTML = makeWalrus(friendLv, 'happy');
    const friendLabel = document.getElementById('visitFriendLabel');
    friendLabel.textContent = `Lv.${friendLv} ${friendLvName}`;
    friendLabel.dataset.dynamic = 'true';
    document.getElementById('visitingMsg').textContent = currentLang === 'ja' ? `Lv.${friendLv} ${friendLvName}と交換遊び！` : `Exchange play with Lv.${friendLv} ${friendLvName}!`;
    const playChip = document.getElementById('visitingPlayChip');
    if(playChip) playChip.textContent = `${play.icon} ${playText.name}`;
    const rewardWrap = document.querySelector('#visitingOverlay .visiting-rewards');
    if(rewardWrap){
        rewardWrap.innerHTML = [
            reward.happy ? `<div class="visiting-reward-chip pink">💗 ${currentLang === 'ja' ? 'ハッピー' : 'Happy'} +${reward.happy}</div>` : '',
            reward.exp ? `<div class="visiting-reward-chip">⭐ ${currentLang === 'ja' ? '経験値' : 'EXP'} +${reward.exp}</div>` : '',
            reward.hunger ? `<div class="visiting-reward-chip">🐟 ${currentLang === 'ja' ? '満腹' : 'Full'} ${reward.hunger > 0 ? '+' : ''}${reward.hunger}</div>` : ''
        ].filter(Boolean).join('');
    }
    document.getElementById('visitingDiaryNote').textContent = currentLang === 'ja' ? '📔 今日の日記に自動記録されたよ！' : '📔 Auto-recorded in today’s diary!';

    document.getElementById('visitingOverlay').style.display = 'flex';

    sfxExchange();
    haptic([30, 15, 60, 15, 30]);

    const c = getStageCenter();
    spawnParticles([...(play.particles || []),'🦭','💗'], c.x, c.y);
    spawnExchangePlayBurst(play);
    animPet('bounce');
    setMsg(currentLang === 'ja' ? `🤝 ${playText.name}成功！ Lv.${friendLv} ${friendLvName}と仲良くなったよ` : `🤝 ${playText.name} complete! You became friends with Lv.${friendLv} ${friendLvName}`);
}

function closeVisitingOverlay(){
    document.getElementById('visitingOverlay').style.display = 'none';
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
        const lvName = getLvName(h.friendLv) || 'Walrus';
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

/* ===== WALK FEATURE ===== */

function applyWalkLanguage() {
    const isJa = currentLang === 'ja';
    const setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
    setText('walkKicker', 'CORE LOOP');
    setText('walkPanelTitle', isJa ? '散歩しないと始まらない' : 'Nothing starts until you walk');
    setText('walkFlowWalk', isJa ? '散歩' : 'Walk');
    setText('walkFlowSound', isJa ? '音あつめ' : 'Collect Sounds');
    setText('walkFlowEvolution', isJa ? '進化' : 'Evolve');
    const heroCopy = document.getElementById('walkHeroCopy');
    if(heroCopy) heroCopy.innerHTML = isJa
        ? 'Walrusは外に出たがってる。<strong>満腹50%以上</strong>で出発して、歩くほど音と経験値が集まるよ。'
        : 'Your Walrus wants to go outside. Start only at <strong>50%+ hunger</strong>, then collect sounds and EXP as you walk.';
    setText('walkDesireLabel', 'Walrus Mood');
    setText('walkRuleLabel', 'Start Rule');
    setText('walkRuleValue', isJa ? '満腹 50%+' : 'Hunger 50%+');
    setText('walkLabelDist',  isJa ? '距離' : 'Distance');
    setText('walkLabelTime',  isJa ? '歩行時間' : 'Time');
    setText('walkLabelExp',   isJa ? '獲得EXP' : 'EXP Gained');
    const startBtn = document.getElementById('walkStartBtn');
    if(startBtn && !walkState.active) startBtn.textContent = isJa ? '🚶 散歩に出かける' : '🚶 Go for a Walk';
    if(startBtn && walkState.active)  startBtn.textContent = isJa ? '⏹ 散歩をやめる' : '⏹ Stop Walk';
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
        if(btn){ btn.classList.add('walking'); btn.textContent = currentLang === 'ja' ? '⏹ 散歩をやめる' : '⏹ Stop Walk'; }
        clearInterval(walkState.timerInterval);
        walkState.timerInterval = setInterval(updateWalkUI, 1000);
        updateWalkUI();
        startAmbientMonitor();
        if(navigator.geolocation) {
            walkState.watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
                    if(accuracy > 35) return;
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
                { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
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
    const desire = document.getElementById('walkDesireText');
    const ctaNote = document.getElementById('walkCtaNote');
    const btn = document.getElementById('walkStartBtn');

    if(desire) {
        if(isSoundStarved()) {
            desire.textContent = isJa
                ? '「静かすぎるよ… ポケットの外で音を食べたいな」'
                : '"It is too quiet... let me hear the world outside your pocket."';
        } else if(walkState.active) {
            desire.textContent = isJa
                ? '「いい音がありそう！ もっと先まで歩こう！」'
                : '"I hear something out there. Let us keep walking!"';
        } else if(G.hunger < WALK_MIN_HUNGER_TO_START) {
            desire.textContent = isJa
                ? '「お腹がすいた… 先に魚を食べてから散歩したいよ」'
                : '"I am too hungry... feed me first, then let us walk."';
        } else if(G.happy < 35) {
            desire.textContent = isJa
                ? '「外に出たいな。散歩したら元気になれそう！」'
                : '"I want to get outside. A walk will cheer me up!"';
        } else {
            desire.textContent = isJa
                ? '「ねえ、散歩いこう。音をひろいたいよ」'
                : '"Hey, let us go out. I want to collect some sounds."';
        }
    }

    if(ctaNote) {
        ctaNote.classList.toggle('warn', (!walkState.active && G.hunger < WALK_MIN_HUNGER_TO_START) || isSoundStarved());
        if(isSoundStarved()) {
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
        } else if(G.hunger < WALK_MIN_HUNGER_TO_START) {
            ctaNote.textContent = isJa
                ? `満腹${Math.round(G.hunger)}%。散歩にはあと${Math.max(0, WALK_MIN_HUNGER_TO_START - Math.round(G.hunger))}%必要です。`
                : `Hunger is ${Math.round(G.hunger)}%. You need ${Math.max(0, WALK_MIN_HUNGER_TO_START - Math.round(G.hunger))}% more to start a walk.`;
        } else {
            ctaNote.textContent = isJa
                ? `散歩を始めると満腹が少しずつ減るよ。出発条件は満腹${WALK_MIN_HUNGER_TO_START}%以上。`
                : `Walking slowly reduces hunger. Departure requires ${WALK_MIN_HUNGER_TO_START}%+ hunger.`;
        }
    }

    if(btn && !walkState.active) {
        btn.disabled = G.hunger < WALK_MIN_HUNGER_TO_START;
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
                ? `🐟 満腹${WALK_MIN_HUNGER_TO_START}%以上で散歩できます`
                : `🐟 You need ${WALK_MIN_HUNGER_TO_START}%+ hunger to start walking`,
            true
        );
        setMsg(
            currentLang === 'ja'
                ? 'まずは魚を食べてお腹を満たしてから散歩に行こう！'
                : 'Feed your Walrus first, then head out for a walk!',
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
    if(btn){ btn.disabled = false; btn.classList.add('walking'); btn.textContent = currentLang === 'ja' ? '⏹ 散歩をやめる' : '⏹ Stop Walk'; }
    setMsg(currentLang === 'ja' ? '🚶 散歩中！ 音を拾って進化の経験値を集めよう！' : '🚶 Walking! Collect sounds and EXP for evolution!');
    startAmbientMonitor();

    walkState.timerInterval = setInterval(updateWalkUI, 1000);

    walkState.watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude: lat, longitude: lon, accuracy } = pos.coords;
            if(accuracy > 35) return; // ignore low accuracy
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
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
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
                    { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
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
    if(btn){ btn.classList.remove('walking'); btn.textContent = currentLang === 'ja' ? '🚶 散歩に出かける' : '🚶 Go for a Walk'; }

    const km = walkState.totalMeters / 1000;
    if(km >= 0.01) {
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

/* ===== INIT ===== */
window.addEventListener('load', ()=>{
    registerServiceWorker();
    
    if(ensureFreshVersion()) {
        location.reload();  // 明示的にリロード
        return;
    }
    loadG();
    currentLang = detectLanguage();
    currentTheme = detectTheme();
    babyModeEnabled = detectBabyMode();
    isMuted = detectMute();
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

    setTimeout(()=>{
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
    }, hasSave ? 1400 : 1800);
});
