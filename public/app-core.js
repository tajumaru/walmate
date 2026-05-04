// Split from app.js: core systems

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
    const ultraLowPower = isThermalConstrainedDevice();
    const frameInterval = ultraLowPower ? 1000 / 12 : isLowPowerMobile() ? 1000 / 20 : 1000 / 30;
    let W = 0, H = 0, dpr = 1, rafId = null;
    let lastFrameTime = 0;
    let cachedRayColor = 'rgba(0,229,176,0.08)';
    let cachedBubbleBorder = 'rgba(0,229,176,0.25)';
    let cachedBubbleFill = 'rgba(0,229,176,0.04)';
    const bgLowPower = isLowPowerMobile();
    const rays = Array.from({length: ultraLowPower ? 2 : bgLowPower ? 4 : 7}, (_, i) => ({
        x: 0.2 + i * 0.1,
        rot: (-30 + i * 12) * Math.PI / 180,
        width: 1 + Math.random(),
        height: 0.5 + Math.random() * 0.3,
        speed: 0.00045 + Math.random() * 0.00045,
        phase: Math.random() * Math.PI * 2
    }));
    const bubbles = Array.from({length: ultraLowPower ? 5 : bgLowPower ? 10 : 22}, () => ({
        x: Math.random(),
        y: Math.random(),
        size: 6 + Math.random() * 36,
        speed: 0.000035 + Math.random() * 0.000055,
        drift: (Math.random() - 0.5) * 0.035,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.08 + Math.random() * 0.22
    }));
    const nodes = Array.from({length: ultraLowPower ? 4 : bgLowPower ? 7 : 15}, () => ({
        x: 0.1 + Math.random() * 0.8,
        y: 0.1 + Math.random() * 0.8,
        size: 5 + Math.random() * 7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0012 + Math.random() * 0.001
    }));
    const links = nodes.slice(0, -1).map((node, i) => ({ from: node, to: nodes[(i + 3) % nodes.length], phase: Math.random() }));

    function resize(){
        dpr = Math.min(window.devicePixelRatio || 1, ultraLowPower ? 0.9 : bgLowPower ? 1 : 1.5);
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
        if(lastFrameTime && (now - lastFrameTime) < frameInterval){
            startLoop();
            return;
        }
        lastFrameTime = now;
        ctx.clearRect(0, 0, W, H);
        const useCanvasGlow = !isLikelyIOSDevice() && !ultraLowPower;

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

        if(!ultraLowPower){
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
        }

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
            lastFrameTime = 0;
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
const AMBIENT_SAMPLE_MS = isThermalConstrainedDevice() ? 2400 : 1200;
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
function toggleMute(event){
    event?.stopPropagation?.();
    isMuted = !isMuted;
    try { localStorage.setItem(MUTE_STORAGE_KEY, isMuted ? '1' : '0'); } catch(e){}
    if(masterGain) masterGain.gain.setTargetAtTime(isMuted ? 0 : 1, audioCtx.currentTime, 0.02);
    const btn = document.getElementById('muteSwitch');
    if(btn){
        btn.textContent = isMuted ? '🔇' : '🔊';
        btn.classList.toggle('muted', isMuted);
        btn.setAttribute('aria-label', isMuted ? '音をオンにする' : '消音にする');
    }
    refreshWalrusMenu?.();
    closeWalrusMenu?.();
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
function sfxMysteryWalrus(variant = 'day'){
    const patterns = {
        dawn: [
            [620, 'sine', 0.16, 0.04, 0],
            [880, 'triangle', 0.18, 0.05, 90],
            [1040, 'sine', 0.12, 0.035, 180]
        ],
        day: [
            [540, 'sine', 0.12, 0.04, 0],
            [760, 'triangle', 0.14, 0.05, 80],
            [980, 'sine', 0.12, 0.035, 170]
        ],
        night: [
            [320, 'triangle', 0.2, 0.05, 0],
            [480, 'sine', 0.18, 0.04, 120],
            [720, 'triangle', 0.16, 0.03, 260]
        ],
        rain: [
            [460, 'sine', 0.1, 0.03, 0],
            [680, 'triangle', 0.12, 0.04, 70],
            [520, 'sine', 0.14, 0.025, 150],
            [860, 'sine', 0.1, 0.03, 240]
        ]
    };
    const notes = patterns[variant] || patterns.day;
    notes.forEach(([freq, type, dur, vol, delay]) => {
        setTimeout(() => playTone(freq, type, dur, vol), delay);
    });
}
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
const SOUND_COLLECTION_BLOB_KEY = 'walrus_sound_collection_blobid';
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
const DAILY_SPECIAL_SOUNDS = {
    rain_bass: {
        id: 'rain_bass',
        slotType: 'bass',
        zone: 'beach',
        emoji: '☔',
        nameJa: 'Rain Bass',
        nameEn: 'Rain Bass',
        noteJa: '雨の日だけ深海に落ちる、低くてやわらかい濡れ音。',
        noteEn: 'A soft low-end drop that only falls on rainy days.',
        condJa: '雨の日 / 音ルートで出会いやすい',
        condEn: 'Rainy day / easier on the sound path'
    },
    moon_ping: {
        id: 'moon_ping',
        slotType: 'melody',
        zone: 'ruins',
        emoji: '🌙',
        nameJa: 'Moon Ping',
        nameEn: 'Moon Ping',
        noteJa: '夜と満月にだけ反応する、きらっと跳ねる旋律。',
        noteEn: 'A bright melodic ping that wakes up at night and under full moons.',
        condJa: '夜 or 満月 / 深海イベントで出会いやすい',
        condEn: 'Night or full moon / easier during deep-sea nights'
    },
    dawn_bubble: {
        id: 'dawn_bubble',
        slotType: 'fx',
        zone: 'beach',
        emoji: '🌅',
        nameJa: 'Dawn Bubble',
        nameEn: 'Dawn Bubble',
        noteJa: '朝焼けの海面でだけ拾える、消えそうで残る泡の粒。',
        noteEn: 'A bubble-like FX you can only catch around daybreak.',
        condJa: '朝 / レベル3以上で出やすい',
        condEn: 'Morning / more common from level 3'
    }
};
const DAILY_PATHS = {
    sea: {
        emoji: '🌊',
        labelJa: '海を見に行く',
        labelEn: 'Watch the sea',
        rewardJa: 'ハッピー +16',
        rewardEn: 'Happy +16'
    },
    sound: {
        emoji: '🎧',
        labelJa: '音を拾いに行く',
        labelEn: 'Collect sounds',
        rewardJa: '限定音が出やすくなる',
        rewardEn: 'Daily sound gets easier to find'
    },
    bubble: {
        emoji: '🫧',
        labelJa: '泡を追いかける',
        labelEn: 'Chase bubbles',
        rewardJa: '経験値 +18',
        rewardEn: 'EXP +18'
    }
};

const dailyEvents = [
    {
        id: 'morning_glow',
        condition: 'morning',
        titleJa: '朝のひげが光っている',
        titleEn: 'Whiskers glowing at dawn',
        messageJa: '朝の光で、Walrusのひげが少し光っている…',
        messageEn: 'In the morning light, the Walrus whiskers shimmer a little...',
        hintJa: '朝だけ少し機嫌がいい',
        hintEn: 'A softer morning mood',
        moodDelta: 5,
        expDelta: 5,
        zone: 'beach',
        emoji: '🌅'
    },
    {
        id: 'midnight_whisper',
        condition: 'night',
        titleJa: '知らない海の夢',
        titleEn: 'A dream from an unknown sea',
        messageJa: 'Walrusが、知らない海の夢を見ていた…',
        messageEn: 'The Walrus seemed to dream of an unknown sea...',
        hintJa: '夜は少しだけ不穏',
        hintEn: 'Night leans a little uncanny',
        moodDelta: 2,
        expDelta: 8,
        zone: 'ruins',
        emoji: '🌌'
    },
    {
        id: 'rain_memory',
        condition: 'rain',
        titleJa: '雨粒の記憶',
        titleEn: 'Memory in raindrops',
        messageJa: '雨粒ごしに、Walrusが何かを思い出しかけている。',
        messageEn: 'Through the rain, the Walrus seems close to remembering something.',
        hintJa: '雨の日用の分岐',
        hintEn: 'Reserved for rainy branches',
        moodDelta: 4,
        expDelta: 6,
        zone: 'beach',
        emoji: '🌧'
    },
    {
        id: 'rare_visitor',
        condition: 'random_1_percent',
        titleJa: '1% 別のWalrusの影',
        titleEn: '1% shadow of another Walrus',
        messageJa: '一瞬だけ、別のWalrusの影が見えた。',
        messageEn: 'For a moment, you saw the shadow of another Walrus.',
        hintJa: 'とてもまれな訪問',
        hintEn: 'A very rare visit',
        moodDelta: 10,
        expDelta: 20,
        zone: 'ruins',
        emoji: '🫧'
    },
    {
        id: 'calm_current',
        condition: 'always',
        titleJa: '静かな海流',
        titleEn: 'Calm current',
        messageJa: '海は静かで、Walrusだけがこちらを見ている。',
        messageEn: 'The sea is quiet, and only the Walrus is watching you.',
        hintJa: '今日は自由に過ごせる',
        hintEn: 'A day to drift freely',
        moodDelta: 4,
        expDelta: 0,
        zone: 'beach',
        emoji: '🌊'
    }
];

const STORY_PHASES = [
    {
        stage: 1,
        titleJa: '卵の殻が、まだ少しあたたかい。',
        titleEn: 'The shell is still a little warm.',
        copyJa: '卵の中から、小さな音がした。生まれたばかりのWalrusは、海の名前をまだ知らない。',
        copyEn: 'A tiny sound came from inside the shell. The newborn Walrus still does not know the sea by name.',
        logJa: '卵の中から、小さな音がした',
        logEn: 'A tiny sound came from inside the shell'
    },
    {
        stage: 2,
        titleJa: '言葉の前の音を覚え始めた。',
        titleEn: 'It started learning sounds before words.',
        copyJa: '同じ響きを何度もまねしている。言葉を覚え始めたのかもしれない。',
        copyEn: 'It keeps imitating the same tones. It may be beginning to learn words.',
        logJa: 'Walrusは、言葉の前の音を集め始めた',
        logEn: 'The Walrus began collecting sounds that come before words'
    },
    {
        stage: 3,
        titleJa: '勝手に、どこかへ行きたがっている。',
        titleEn: 'It wants to go somewhere on its own.',
        copyJa: '最近は海の向こうを気にしている。こちらの知らない道を、もう見つけているのかもしれない。',
        copyEn: 'Lately it keeps looking beyond the sea. It may already know paths you do not.',
        logJa: 'Walrusは何かを思い出しかけている',
        logEn: 'The Walrus seems close to remembering something'
    },
    {
        stage: 4,
        titleJa: '眠る前に、きみを呼んだ気がした。',
        titleEn: 'Before sleeping, it sounded like it called for you.',
        copyJa: '深夜のあいだだけ、Walrusの声にこちらを呼ぶ響きが混じる。',
        copyEn: 'Only late at night, its voice seems to carry a sound meant for you.',
        logJa: 'Walrusが、こちらを呼ぶ響きを覚えた',
        logEn: 'The Walrus learned a sound that calls for you'
    },
    {
        stage: 5,
        titleJa: '秘密は、もう海の底だけのものじゃない。',
        titleEn: 'The secret no longer belongs only to the deep sea.',
        copyJa: 'ときどき、Walrusは知らない記憶を話し始める。まだ全部は聞き取れない。',
        copyEn: 'Sometimes the Walrus starts speaking of memories you do not know. You still cannot catch all of it.',
        logJa: '知らない記憶を見た…',
        logEn: 'You glimpsed an unfamiliar memory...'
    }
];

function hashStringToSeed(text){
    let hash = 2166136261;
    for(let i = 0; i < text.length; i += 1){
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createSeededRandom(seedText){
    let state = hashStringToSeed(seedText) || 1;
    return function(){
        state = Math.imul(state ^ (state >>> 15), state | 1);
        state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
        return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
}

function getMoonPhaseRatio(date = new Date()){
    const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14, 0);
    const synodicMonth = 29.530588853;
    const daysSince = (date.getTime() - knownNewMoonUtc) / 86400000;
    const phase = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
    return phase / synodicMonth;
}

function isFullMoonNight(date = new Date()){
    return Math.abs(getMoonPhaseRatio(date) - 0.5) < 0.06;
}

function getDailyTimeBand(hour = new Date().getHours()){
    if(hour >= 5 && hour <= 10) return 'dawn';
    if(hour >= 18 || hour <= 3) return 'night';
    return 'day';
}

function getDailyWeather(dateKey = getLocalDateKey()){
    const rng = createSeededRandom(`weather:${dateKey}`);
    return rng() < 0.32 ? 'rain' : 'clear';
}

function getTodayDailyContext(date = new Date()){
    const dateKey = getLocalDateKey(date);
    return {
        dateKey,
        hour: date.getHours(),
        weekday: date.getDay(),
        timeBand: getDailyTimeBand(date.getHours()),
        weather: getDailyWeather(dateKey),
        isFullMoon: isFullMoonNight(date)
    };
}

function isRainWeatherCode(code){
    const n = Number(code);
    return [51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(n);
}

function getDailyLimitedSoundDef(soundId = G?.daily?.limitedSoundId){
    return DAILY_SPECIAL_SOUNDS[soundId] || null;
}

function pickDailyLimitedSound(context){
    const candidates = [];
    if(context.weather === 'rain') candidates.push('rain_bass');
    if(context.timeBand === 'night' || context.isFullMoon) candidates.push('moon_ping');
    if(context.timeBand === 'dawn' || context.weekday === 0 || G.lv >= 3) candidates.push('dawn_bubble');
    if(!candidates.length) candidates.push('dawn_bubble');
    const rng = createSeededRandom(`limited:${context.dateKey}:${G.lv}`);
    return candidates[Math.floor(rng() * candidates.length)] || candidates[0];
}

function getDailyEventById(eventId){
    return dailyEvents.find(event => event.id === eventId) || dailyEvents.find(event => event.id === 'calm_current') || dailyEvents[0];
}

function pickDailyEvent(context, streak){
    const rareEvent = dailyEvents.find(event => event.condition === 'random_1_percent');
    const rareRng = createSeededRandom(`daily-rare:${context.dateKey}:${G.lv}:${streak}`);
    if(rareEvent && rareRng() < 0.01) return rareEvent;

    const conditions = getDailyConditionAliases(context);
    const pool = dailyEvents.filter(event => {
        if(event.condition === 'random_1_percent') return false;
        return !!conditions[event.condition];
    });
    const fallback = getDailyEventById('calm_current');
    const candidates = pool.length ? pool : [fallback];
    const rng = createSeededRandom(`daily-event:${context.dateKey}:${G.lv}:${streak}`);
    return candidates[Math.floor(rng() * candidates.length)] || fallback;
}

function applyDailyEventRewards(event, dateKey){
    const appliedDate = getStoredDailyEventDate?.();
    if(!event || appliedDate === dateKey) return false;
    if(event.moodDelta) G.happy = Math.min(100, G.happy + event.moodDelta);
    if(event.expDelta) G.exp += event.expDelta;
    setStoredDailyEventSnapshot?.(dateKey, event.id);
    addWalMateLog?.(event.messageJa, event.messageEn, 'daily', { id: event.id, dateKey });
    return true;
}

function ensureDailyState(){
    G.daily = normalizeDailyState(G.daily);
    const today = getLocalDateKey();
    if(G.daily.dateKey === today){
        const knownEvent = dailyEvents.some(event => event.id === G.daily.eventId);
        if(!knownEvent){
            const context = getTodayDailyContext();
            G.daily.eventId = pickDailyEvent(context, G.daily.streak)?.id || 'calm_current';
        }
        if(getStoredDailyEventDate?.() !== today){
            applyDailyEventRewards(getDailyEventById(G.daily.eventId), today);
            saveG();
        }
        return G.daily;
    }

    const prevLogin = G.daily.lastLoginDate;
    const diff = prevLogin ? getDateKeyDiff(prevLogin, today) : 0;
    if(diff > 1) recordMissedLoginDays?.(diff - 1);
    const streak = !prevLogin ? 1 : diff === 1 ? G.daily.streak + 1 : 1;
    const context = getTodayDailyContext();

    const pickedEvent = pickDailyEvent(context, streak);
    G.daily = normalizeDailyState({
        dateKey: today,
        lastLoginDate: today,
        streak,
        shownDateKey: '',
        eventId: pickedEvent?.id || 'calm_current',
        choiceId: '',
        limitedSoundId: pickDailyLimitedSound(context),
        limitedSoundCollected: false,
        weather: context.weather,
        weatherSource: 'seed',
        weatherSyncAt: 0,
        timeBand: context.timeBand,
        weekday: context.weekday,
        isFullMoon: context.isFullMoon
    });

    if(streak > 0 && streak % 7 === 0){
        G.happy = Math.min(100, G.happy + 8);
        if(G.lv >= 4 && G.custom?.accessory === 'none'){
            G.custom.accessory = 'pearl';
        }
        addWalMateLog?.(
            '7日目のしるしとして、真珠の気配が残った。',
            'A pearl-like trace remained as the seventh-day sign.',
            'streak',
            { id: `streak:${today}`, dateKey: today }
        );
    }
    applyDailyEventRewards(pickedEvent, today);

    saveG();
    return G.daily;
}

function getDailyEventMeta(daily = G.daily){
    const event = getDailyEventById(daily?.eventId || 'calm_current');
    return {
        id: event.id,
        emoji: event.emoji,
        titleJa: event.titleJa,
        titleEn: event.titleEn,
        copyJa: event.messageJa,
        copyEn: event.messageEn,
        hintJa: event.hintJa,
        hintEn: event.hintEn,
        zone: event.zone,
        moodDelta: event.moodDelta,
        expDelta: event.expDelta
    };
}

function refreshDailyDerivedState(overrides = {}){
    ensureDailyState();
    const merged = {
        dateKey: G.daily.dateKey,
        weather: overrides.weather || G.daily.weather,
        timeBand: overrides.timeBand || G.daily.timeBand,
        weekday: typeof overrides.weekday === 'number' ? overrides.weekday : G.daily.weekday,
        isFullMoon: typeof overrides.isFullMoon === 'boolean' ? overrides.isFullMoon : G.daily.isFullMoon
    };
    G.daily.weather = merged.weather;
    G.daily.weatherSource = overrides.weatherSource === 'gps' ? 'gps' : G.daily.weatherSource;
    G.daily.weatherSyncAt = Number(overrides.weatherSyncAt) || G.daily.weatherSyncAt;
    G.daily.timeBand = merged.timeBand;
    G.daily.weekday = merged.weekday;
    G.daily.isFullMoon = merged.isFullMoon;
    G.daily.eventId = pickDailyEvent(merged, G.daily.streak)?.id || 'calm_current';
    if(!G.daily.limitedSoundCollected){
        G.daily.limitedSoundId = pickDailyLimitedSound(merged);
    }
    saveG();
}

let dailyWeatherRequestInFlight = false;
let dailyWeatherLastCoord = null;

async function syncDailyWeatherFromCoords(lat, lon, options = {}){
    ensureDailyState();
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const now = Date.now();
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    if(!options.force && G.daily.weatherSource === 'gps' && (now - (G.daily.weatherSyncAt || 0)) < 45 * 60 * 1000){
        if(dailyWeatherLastCoord && Math.abs(dailyWeatherLastCoord.lat - roundedLat) < 0.02 && Math.abs(dailyWeatherLastCoord.lon - roundedLon) < 0.02){
            return;
        }
    }
    if(dailyWeatherRequestInFlight) return;
    dailyWeatherRequestInFlight = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), 9000) : 0;
    try{
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=weather_code,is_day,precipitation&timezone=auto&forecast_days=1`;
        const res = await fetch(url, { signal: controller?.signal });
        if(!res.ok) throw new Error(`weather ${res.status}`);
        const data = await res.json();
        const current = data?.current || {};
        const weather = (Number(current.precipitation) > 0 || isRainWeatherCode(current.weather_code)) ? 'rain' : 'clear';
        const timeBand = Number(current.is_day) === 0 ? 'night' : getDailyTimeBand(new Date().getHours());
        refreshDailyDerivedState({
            weather,
            weatherSource: 'gps',
            weatherSyncAt: now,
            timeBand,
            weekday: new Date().getDay(),
            isFullMoon: isFullMoonNight(new Date())
        });
        dailyWeatherLastCoord = { lat: roundedLat, lon: roundedLon };
        renderDailyBoard();
        if(options.announce){
            showToast(currentLang === 'ja'
                ? `📍 GPS天気を同期したよ: ${weather === 'rain' ? '雨' : '晴れ'}`
                : `📍 GPS weather synced: ${weather === 'rain' ? 'rain' : 'clear'}`);
        }
    }catch(err){
        if(!options.silent){
            console.warn('Weather sync failed:', err);
        }
    }finally{
        if(timer) clearTimeout(timer);
        dailyWeatherRequestInFlight = false;
    }
}

function syncDailyWeatherFromGPS(options = {}){
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            if(accuracy > 120) return;
            syncDailyWeatherFromCoords(latitude, longitude, options);
        },
        (err) => {
            if(!options.silent) console.warn('GPS weather sync error:', err);
        },
        { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 10000 }
    );
}

function chooseDailyPath(choiceId){
    ensureDailyState();
    if(!DAILY_PATHS[choiceId] || G.daily.choiceId) return;
    G.daily.choiceId = choiceId;
    if(choiceId === 'sea'){
        G.happy = Math.min(100, G.happy + 16);
    } else if(choiceId === 'bubble'){
        G.exp += 18;
    }
    checkLevelUp?.();
    saveG();
    updateUI();
    const choice = DAILY_PATHS[choiceId];
    const reward = currentLang === 'ja' ? choice.rewardJa : choice.rewardEn;
    setMsg(`${choice.emoji} ${currentLang === 'ja' ? choice.labelJa : choice.labelEn} · ${reward}`);
    addWalMateLog?.(
        `${choice.emoji} ${choice.labelJa}を選んだ。`,
        `${choice.emoji} Chose ${choice.labelEn}.`,
        'choice',
        { id: `choice:${G.daily.dateKey}` }
    );
    showToast(currentLang === 'ja' ? '今日のルートを決めたよ' : 'Today’s route is set');
}

function getDailyLimitedSpawnChance(){
    let chance = G.daily?.choiceId === 'sound' ? 0.5 : 0.24;
    if(G.daily?.eventId === 'rain_sound') chance += 0.12;
    if(G.daily?.eventId === 'night_deep' && G.daily?.limitedSoundId === 'moon_ping') chance += 0.1;
    return Math.min(0.78, chance);
}

function maybeRollDailyLimitedPiece(slotType){
    ensureDailyState();
    const dailySound = getDailyLimitedSoundDef();
    if(!dailySound || G.daily.limitedSoundCollected || dailySound.slotType !== slotType) return null;
    if(Math.random() > getDailyLimitedSpawnChance()) return null;
    G.daily.limitedSoundCollected = true;
    saveG();
    return {
        area: dailySound.zone,
        type: dailySound.slotType,
        name: currentLang === 'ja' ? dailySound.nameJa : dailySound.nameEn,
        emoji: dailySound.emoji,
        ts: Date.now(),
        specialId: dailySound.id
    };
}

function syncDailyActiveZone(){
    const daily = ensureDailyState();
    const eventZone = getDailyEventMeta(daily).zone;
    if(!eventZone) return;
    if(document.getElementById('zone_' + eventZone)){
        setActiveZone(eventZone);
    }
}

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
            const def = piece.specialId
                ? getDailyLimitedSoundDef(piece.specialId)
                : (SOUND_DEF[piece.area]?.[slotType] || {});
            const pieceName = piece.specialId
                ? (currentLang === 'ja' ? def?.nameJa : def?.nameEn)
                : (def.name || piece.name);
            const areaLabel = piece.specialId
                ? (currentLang === 'ja' ? '今日限定' : 'DAILY ONLY')
                : piece.area;
            contentEl.innerHTML = `<span class="slot-emoji">${def.emoji||'🎵'}</span>
                <div><div class="slot-name">${pieceName}</div>
                <div class="slot-area-tag">${areaLabel}</div></div>`;
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
    'button, .sound-lab, .walk-panel, .utility-btn, .walrus-menu-shell, #petStage, .sound-pick-float, input, textarea, select, a'
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
    const specialPiece = maybeRollDailyLimitedPiece(slotType);
    const def = specialPiece || {
        area: zone,
        type: slotType,
        name: SOUND_DEF[zone][slotType].name,
        emoji: SOUND_DEF[zone][slotType].emoji,
        ts: Date.now()
    };

    // BGM用：最大4枠だけ。増やさず上書きする
    soundSlots[slotType] = { ...def };

    saveSoundSlots();
    renderSoundSlots();
    registerSoundMeal(slotType, def.area || zone);

    // 履歴用：最大20件まで
    walkState.collected = walkState.collected || [];
    walkState.collected.unshift({
        slot: slotType,
        zone: def.area || zone,
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
        ambientAnalyser.fftSize = isThermalConstrainedDevice() ? 256 : 512;
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

function getSoundCollectionTimeWord(date = new Date()){
    const hour = date.getHours();
    if(hour < 5) return 'Midnight';
    if(hour < 10) return 'Morning';
    if(hour < 15) return 'Daylight';
    if(hour < 19) return 'Sunset';
    return 'Night';
}

function buildSoundCollectionName(track){
    const date = new Date(track?.ts || Date.now());
    const timeWord = getSoundCollectionTimeWord(date);
    const dominantZone = track?.zones?.[0] || 'beach';
    const dominantSlot = SLOT_KEYS.find(key => track?.slots?.[key]) || 'melody';
    if(dominantZone === 'city' && dominantSlot === 'bass') return 'Midnight Static';
    if(dominantZone === 'beach' && dominantSlot === 'fx') return 'Rain Pearl';
    if(dominantZone === 'ruins' && dominantSlot === 'drum') return 'Thunder Fang';
    if(dominantZone === 'ruins' && dominantSlot === 'fx') return 'Ghost Lagoon Echo';
    const map = {
        beach:  { drum:'Bubble', bass:'Pearl', melody:'Bubble', fx:'Echo' },
        forest: { drum:'Moss Knock', bass:'Root Hum', melody:'Bird Whisper', fx:'Leaf Mist' },
        city:   { drum:'Neon Beat', bass:'Static', melody:'Signal Spark', fx:'Static Echo' },
        ruins:  { drum:'Fang', bass:'Ghost Drone', melody:'Ghost Bell', fx:'Echo' }
    };
    return `${timeWord} ${map[dominantZone]?.[dominantSlot] || 'Echo'}`.trim();
}

function getSoundCollectionFlavor(track){
    const zone = track?.zones?.[0] || 'beach';
    const slot = SLOT_KEYS.find(key => track?.slots?.[key]) || 'melody';
    return getSoundFlavorLabel(zone, slot);
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
    const collectible = {
        id: `sound-${track.ts}`,
        ts: track.ts,
        name: buildSoundCollectionName(track),
        date,
        zones,
        slots: { ...soundSlots },
        flavor: getSoundCollectionFlavor(track),
        coverEmoji: zones[0] ? (ZONE_EMOJI[zones[0]] || '🎵') : '🎵',
        trackName: name
    };

    try{
        const raw = localStorage.getItem(SOUND_MEMORY_KEY);
        const mems = raw ? JSON.parse(raw) : [];
        mems.unshift(collectible);
        if(mems.length>18) mems.length=18;
        localStorage.setItem(SOUND_MEMORY_KEY, JSON.stringify(mems));
    }catch(e){}

    renderSoundMemory();
    showToast(currentLang==='ja' ? `💾 音コレクション「${collectible.name}」を保存したよ！` : `💾 Saved sound collectible "${collectible.name}"!`);
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
        list.innerHTML = `<div style="font-size:0.66rem;color:rgba(255,255,255,0.2);text-align:center;padding:5px">${currentLang==='ja'?'音コレクションはまだないよ':'No sound collectibles yet'}</div>`;
        return;
    }
    list.innerHTML = _soundMemCache.map((tr,i)=>{
        const zEmoji = (tr.zones||[]).map(z=>ZONE_EMOJI[z]||'').join('');
        return `<div class="sound-memory-item" onclick="loadMemoryTrack(${i})">
            <span class="smi-date">${tr.date}</span>
            <span class="smi-name">${tr.name}</span>
            <span class="smi-zones">${tr.coverEmoji || zEmoji} ${tr.flavor || ''}</span>
            <span class="smi-play">▶</span>
        </div>`;
    }).join('');
}

function renderDailyBoard(){
    const board = document.getElementById('dailyBoard');
    if(!board) return;
    const daily = ensureDailyState();
    const event = getDailyEventMeta(daily);
    const sound = getDailyLimitedSoundDef(daily.limitedSoundId);
    const isJa = currentLang === 'ja';
    const streakLabel = isJa ? `${daily.streak}日連続ログイン` : `${daily.streak}-day streak`;
    const weatherLabel = daily.weather === 'rain'
        ? (isJa ? '雨の潮' : 'Rain current')
        : (isJa ? '晴れの潮' : 'Clear current');
    const weatherSourceLabel = daily.weatherSource === 'gps'
        ? (isJa ? 'GPS天気' : 'GPS weather')
        : (isJa ? '仮の天気' : 'seed weather');
    const timeLabel = daily.timeBand === 'dawn'
        ? (isJa ? '朝の海' : 'Morning sea')
        : daily.timeBand === 'night'
            ? (isJa ? '夜の深海' : 'Night sea')
            : (isJa ? '昼の潮' : 'Day tide');
    const choiceMarkup = Object.entries(DAILY_PATHS).map(([key, choice]) => {
        const selected = daily.choiceId === key;
        const disabled = daily.choiceId ? 'disabled' : '';
        const label = isJa ? choice.labelJa : choice.labelEn;
        const reward = isJa ? choice.rewardJa : choice.rewardEn;
        return `<button class="daily-choice-btn ${selected ? 'selected' : ''}" type="button" onclick="chooseDailyPath('${key}')" ${disabled}>
            <span class="daily-choice-emoji">${choice.emoji}</span>
            <span class="daily-choice-copy">
                <strong>${label}</strong>
                <small>${reward}</small>
            </span>
        </button>`;
    }).join('');
    const soundTitle = sound ? (isJa ? sound.nameJa : sound.nameEn) : (isJa ? '今日の限定音' : 'Daily sound');
    const soundNote = sound ? (isJa ? sound.noteJa : sound.noteEn) : '';
    const soundCond = sound ? (isJa ? sound.condJa : sound.condEn) : '';
    const soundState = daily.limitedSoundCollected
        ? (isJa ? 'COLLECTED' : 'COLLECTED')
        : (isJa ? '未発見' : 'UNFOUND');
    const soundStateClass = daily.limitedSoundCollected ? 'found' : '';
    board.innerHTML = `<div class="daily-board-head">
            <div>
                <div class="daily-board-kicker">${isJa ? 'DAILY CURRENT' : 'DAILY CURRENT'}</div>
                <div class="daily-board-title">${isJa ? '今日の海流イベント' : 'Today’s current event'}</div>
            </div>
            <div class="daily-streak-chip">${streakLabel}</div>
        </div>
        <div class="daily-event-card">
            <div class="daily-event-topline">
                <span class="daily-event-badge">${event.emoji} ${isJa ? event.titleJa : event.titleEn}</span>
                <span class="daily-event-meta">${weatherSourceLabel} · ${weatherLabel} · ${timeLabel}</span>
            </div>
            <div class="daily-event-copy">${isJa ? event.copyJa : event.copyEn}</div>
            <div class="daily-event-hint">${isJa ? event.hintJa : event.hintEn}</div>
            <div class="daily-event-reward">${isJa ? `気分 +${event.moodDelta} / EXP +${event.expDelta}` : `Mood +${event.moodDelta} / EXP +${event.expDelta}`}</div>
        </div>
        <div class="daily-choice-card">
            <div class="daily-choice-title">${isJa ? '今日のWalrusは何したい？' : 'What does today’s Walrus want?'}</div>
            <div class="daily-choice-grid">${choiceMarkup}</div>
        </div>
        <div class="daily-sound-card">
            <div class="daily-sound-topline">
                <div class="daily-sound-title">${sound?.emoji || '🎵'} ${soundTitle}</div>
                <div class="daily-sound-state ${soundStateClass}">${soundState}</div>
            </div>
            <div class="daily-sound-copy">${soundNote}</div>
            <div class="daily-sound-hint">${soundCond}</div>
        </div>`;
}

function getIdleRandomEventMeta(idleEvent = getActiveIdleRandomEvent?.()){
    if(!idleEvent || idleEvent.id !== 'mystery_walrus') return null;
    const variantMap = {
        dawn: {
            emoji: '🌅',
            badgeJa: '朝焼けの謎Walrus',
            badgeEn: 'Dawn mystery Walrus',
            copyJa: '朝の光を吸って、真珠色のWalrusが少しだけ近くまで来ていたみたい。',
            copyEn: 'A pearl-tinted Walrus seems to have drifted close in the dawn light.',
            hintJa: 'うっすら桃色に発光中',
            hintEn: 'Soft pearl-pink glow',
            stageClass: 'mystery-dawn',
            bubbleClass: 'mystery-dawn'
        },
        day: {
            emoji: '☀️',
            badgeJa: '日中の謎Walrus',
            badgeEn: 'Daylight mystery Walrus',
            copyJa: '昼の潮にまぎれて、ミント色の謎Walrusが画面の外を泳いでいた気配がある。',
            copyEn: 'A mint-toned mystery Walrus may be circling just beyond the screen in daylight.',
            hintJa: 'ミント色の気配',
            hintEn: 'Mint-colored presence',
            stageClass: 'mystery-day',
            bubbleClass: 'mystery-day'
        },
        night: {
            emoji: '🌌',
            badgeJa: '深夜の謎Walrus',
            badgeEn: 'Midnight mystery Walrus',
            copyJa: '夜の深海で、群青色に光る謎Walrusがじっとこちらを見ていたらしい。',
            copyEn: 'In the midnight deep, an indigo-glowing mystery Walrus may have been watching.',
            hintJa: '群青の残光',
            hintEn: 'Indigo afterglow',
            stageClass: 'mystery-night',
            bubbleClass: 'mystery-night'
        },
        rain: {
            emoji: '🌧',
            badgeJa: '雨の日の謎Walrus',
            badgeEn: 'Rainy mystery Walrus',
            copyJa: '雨のしずくをまとって、水色にきらめく謎Walrusが現れた気配がある。',
            copyEn: 'A rain-lit mystery Walrus seems to have appeared in a pale blue shimmer.',
            hintJa: '雨色ブルーに変化',
            hintEn: 'Shifted into rain-blue',
            stageClass: 'mystery-rain',
            bubbleClass: 'mystery-rain'
        }
    };
    const variant = variantMap[idleEvent.variant] || variantMap.day;
    return {
        ...variant,
        titleJa: '1% 謎のWalrus出現',
        titleEn: '1% mystery Walrus sighting',
        statusJa: `${variant.emoji} 謎のWalrus`,
        statusEn: `${variant.emoji} Mystery Walrus`,
        toastJa: `1%イベント発生: ${variant.badgeJa}`,
        toastEn: `1% event: ${variant.badgeEn}`,
        messageJa: `👀 ${variant.badgeJa}。${variant.hintJa}`,
        messageEn: `👀 ${variant.badgeEn}. ${variant.hintEn}`
    };
}

function getDailyConditionAliases(context){
    return {
        morning: context.timeBand === 'dawn',
        night: context.timeBand === 'night',
        rain: context.weather === 'rain',
        always: true
    };
}

function applyIdleRandomEventVisuals(){
    const idleMeta = getIdleRandomEventMeta();
    const stage = document.getElementById('petStage');
    const bubble = document.getElementById('msgBubble');
    if(stage){
        stage.classList.remove('mystery-visitor', 'mystery-dawn', 'mystery-day', 'mystery-night', 'mystery-rain');
        if(idleMeta) stage.classList.add('mystery-visitor', idleMeta.stageClass);
    }
    if(bubble){
        bubble.classList.remove('mystery-event', 'mystery-dawn', 'mystery-day', 'mystery-night', 'mystery-rain');
        if(idleMeta) bubble.classList.add('mystery-event', idleMeta.bubbleClass);
    }
}

function showIdleRandomEventMoment(){
    const idleEvent = getActiveIdleRandomEvent?.();
    const idleMeta = getIdleRandomEventMeta(idleEvent);
    if(!idleEvent || !idleMeta || idleEvent.announced) return;
    setMsg(currentLang === 'ja' ? idleMeta.messageJa : idleMeta.messageEn);
    showToast(currentLang === 'ja' ? idleMeta.toastJa : idleMeta.toastEn);
    sfxMysteryWalrus(idleEvent.variant);
    G.idleEvent.announced = true;
    saveG();
}

function getOriginPathLabel(path, isJa = currentLang === 'ja'){
    const map = {
        feral: isJa ? '野生化Legend' : 'Feral Legend',
        shadow: isJa ? '闇進化Legend' : 'Shadow Legend',
        clingy: isJa ? '依存進化Legend' : 'Clingy Legend',
        balanced: isJa ? '通常Legend' : 'Balanced Legend'
    };
    return map[path] || map.balanced;
}

function getOriginPathCopy(path, isJa = currentLang === 'ja'){
    const map = {
        feral: isJa ? '放置が続いたぶん、ひとりで生きる力が強くなった。' : 'Long neglect made it tougher and more self-willed.',
        shadow: isJa ? 'ログインの空白が、静かな闇のオーラを育てた。' : 'Sparse logins nurtured a quieter, darker aura.',
        clingy: isJa ? 'たくさん構われたぶん、離れたくない気持ちが強く育った。' : 'So much attention made it grow deeply attached.',
        balanced: isJa ? '散歩だけじゃない、ふつうの暮らし方そのものが姿になった。' : 'It was shaped by everyday life, not just walking.'
    };
    return map[path] || map.balanced;
}

function showDailyLoginMoment(){
    const daily = ensureDailyState();
    if(daily.shownDateKey === daily.dateKey && getStoredDailyEventDate?.() === daily.dateKey) return;
    const event = getDailyEventMeta(daily);
    const sound = getDailyLimitedSoundDef(daily.limitedSoundId);
    syncDailyActiveZone();
    triggerDailyEventAnimation();
    setMsg(`${event.emoji} ${currentLang === 'ja' ? event.copyJa : event.copyEn}`);
    showToast(currentLang === 'ja' ? `今日の気配: ${event.titleJa}` : `Today’s sign: ${event.titleEn}`);
    if(sound){
        showToast(currentLang === 'ja'
            ? `🎵 今日の限定音: ${sound.nameJa}`
            : `🎵 Daily sound: ${sound.nameEn}`);
    }
    G.daily.shownDateKey = daily.dateKey;
    saveG();
    renderDailyBoard();
    syncStoryProgress(false);
}

function triggerDailyEventAnimation(){
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
    const stage = document.getElementById('petStage');
    if(!stage) return;
    stage.classList.remove('daily-awaken');
    void stage.offsetWidth;
    stage.classList.add('daily-awaken');
    window.setTimeout(() => stage.classList.remove('daily-awaken'), 900);
}

function getStoryPhase(){
    const stage = G.lv >= 4 && G.exp >= 360 ? 5 : G.lv >= 4 ? 4 : G.lv >= 3 ? 3 : G.lv >= 2 ? 2 : 1;
    return STORY_PHASES.find(item => item.stage === stage) || STORY_PHASES[0];
}

function renderStoryPanel(){
    const panel = document.getElementById('storyPanel');
    if(!panel) return;
    const phase = getStoryPhase();
    const isJa = currentLang === 'ja';
    const kickerEl = document.getElementById('storyPanelKicker');
    const stageEl = document.getElementById('storyPanelStage');
    const titleEl = document.getElementById('storyPanelTitle');
    const copyEl = document.getElementById('storyPanelCopy');
    if(kickerEl) kickerEl.textContent = 'STORY SIGNAL';
    if(stageEl) stageEl.textContent = `PHASE ${phase.stage}`;
    if(titleEl) titleEl.textContent = isJa ? phase.titleJa : phase.titleEn;
    if(copyEl) copyEl.textContent = isJa ? phase.copyJa : phase.copyEn;
}

function renderWalMateLogs(){
    const list = document.getElementById('messageLogList');
    if(!list) return;
    const title = document.getElementById('messageLogTitle');
    const sub = document.getElementById('messageLogSub');
    if(title) title.textContent = 'WALRUS LOG';
    if(sub) sub.textContent = currentLang === 'ja' ? '直近5件' : 'Last 5';
    const logs = getWalMateLogs?.() || [];
    if(!logs.length){
        list.innerHTML = `<div class="message-log-empty">${currentLang === 'ja' ? 'まだ記録はありません。' : 'No records yet.'}</div>`;
        return;
    }
    list.innerHTML = logs.slice(0, 5).map(item => {
        const text = currentLang === 'ja' ? item.textJa : item.textEn;
        const date = item.dateKey || getLocalDateKey(new Date(item.ts || Date.now()));
        return `<div class="message-log-item"><span class="message-log-date">${date}</span><span class="message-log-text">${escapeHtml(text || item.text || '')}</span></div>`;
    }).join('');
}

function syncStoryProgress(announce = false){
    const phase = getStoryPhase();
    const storedStage = getStoredStoryStage?.();
    if(phase.stage > storedStage){
        setStoredStoryStage?.(phase.stage);
        addWalMateLog?.(phase.logJa, phase.logEn, 'story', { id: `story:${phase.stage}` });
        if(announce){
            setMsg(currentLang === 'ja' ? phase.titleJa : phase.titleEn);
        }
    }
    renderStoryPanel();
    renderWalMateLogs();
}

function applyMotionPreferenceState(){
    const paused = document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.toggle('motion-paused', !!paused);
    if(paused){
        clearSoundReactiveStage?.();
        if(soundVizFrame){
            cancelAnimationFrame(soundVizFrame);
            soundVizFrame = 0;
        }
    } else if(isTrackPlaying){
        startSoundReactiveStage?.();
    }
}

function initMotionPreferenceControls(){
    applyMotionPreferenceState();
    document.addEventListener('visibilitychange', applyMotionPreferenceState, { passive: true });
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(media?.addEventListener){
        media.addEventListener('change', applyMotionPreferenceState);
    } else if(media?.addListener){
        media.addListener(applyMotionPreferenceState);
    }
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
const APP_VERSION = '2026-05-05-cache-bust-sw-refresh';
const APP_VERSION_STORAGE_KEY = 'walrus_app_version';
const LANG_STORAGE_KEY = 'walrus_lang';
const THEME_STORAGE_KEY = 'walrus_theme';
const SURFACE_THEME_STORAGE_KEY = 'walrus_surface_theme';
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
        load_title: 'WalMateを起動しています…',
        load_sub: 'たじゅまるの秘密基地へようこそ',
        hatch_wait: '卵が揺れている…',
        hatch_hint: 'まもなく孵化します',
        hatch_step_1: '揺れを見守る',
        hatch_step_2: 'ヒビを待つ',
        hatch_step_3: '連打で孵化',
        newborn_guide_title: "TODAY'S SIGNAL",
        newborn_guide_copy: '今日は <strong>散歩だけ</strong> じゃなくていい。まずは Walrus に<strong>ふれて</strong>海の気配を整えてから、<strong>OFFER</strong>、<strong>SYNC</strong>、<strong>DRIFT</strong> で信号を見てみよう。',
        main_title: 'WalMate',
        main_sub: '散歩して音を集めて、Walrusを進化させよう',
        sound_lab_title: '🎵 サウンドキッチン',
        sound_memory_title: '④ 音の記憶',
        sound_track_title: '📦 音のコレクション',
        feed: 'OFFER',
        pet: 'SYNC',
        play: 'DRIFT',
        bubble_pop: 'バブルポップ',
        walrus_save: '記憶に沈める',
        walrus_load: '呼び戻す',
        walrus_exchange: 'Walrus交流',
        walrus_diary: '記憶の断片',
        memory_actions_title: '記憶の水面',
        memory_actions_copy: '漂流のあとに、必要な記憶だけそっと扱う',
        walrus_save_sub: 'いまのWalrusを海に記録する',
        walrus_load_sub: '海に眠る記憶からWalrusを戻す',
        stat_hunger: '◇ ENERGY',
        stat_happy: '✦ BOND',
        stat_exp: '◎ MEMORY',
        unlock2_tag: 'Lv.2 解禁',
        unlock2_title: 'あなたの自己紹介',
        unlock2_body1: "<div class=\"intro-builder\"><div class=\"intro-card walrus-about\"><div class=\"walrus-talk\"><div class=\"walrus-avatar\" id=\"aboutWalrusAvatar\" aria-hidden=\"true\"></div><div class=\"walrus-speech\" id=\"aboutWalrusSpeech\"><span class=\"walrus-speech-kicker\">ABOUT FROM WALRUS</span><div class=\"intro-preview-copy\" id=\"introPreviewCopy\">ここに、あなたの自己紹介をWalrusが紹介します。</div></div></div></div></div><div id=\"profileDeckModal\" class=\"profile-deck-modal\" onclick=\"if(event.target===this) closeProfileDeckModal()\"><div class=\"profile-deck-modal-inner\"><div class=\"diary-modal-header\"><span id=\"profileDeckModalTitle\">プロフィールを編集</span><button class=\"diary-close-btn\" onclick=\"closeProfileDeckModal()\">✕</button></div><div id=\"profileDeckModalEditor\"></div></div></div></div>",
        unlock2_body2: "<div class=\"intro-card\"><div class=\"section-caption\">Portfolio Projects</div><div id=\"profileDeckMount\"></div><div class=\"walrus-projects\"><div class=\"walrus-project-card active\"><span class=\"walrus-project-icon\">🎮</span><span class=\"walrus-project-title\">Project</span><span class=\"walrus-project-meta\">Meta</span></div><div class=\"walrus-project-card\"><span class=\"walrus-project-icon\">📝</span><span class=\"walrus-project-title\">Project</span><span class=\"walrus-project-meta\">Meta</span></div><div class=\"walrus-project-card\"><span class=\"walrus-project-icon\">🖼</span><span class=\"walrus-project-title\">Project</span><span class=\"walrus-project-meta\">Meta</span></div></div><div class=\"walrus-about-note\" id=\"profileAboutNote\"></div><div class=\"social-pills\" id=\"profileSocialPills\"></div></div>",
        intro_saved_local: 'この端末に自己紹介を保存したよ',
        intro_saved_walrus: '自己紹介をWalrusに保存したよ！',
        intro_saved_walrus_status: 'Walrus保存済み',
        intro_empty: 'まず自己紹介を書いてね',
        intro_preview_empty: 'ここに、あなたの自己紹介をWalrusが紹介します。',
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
        diary_title: '✨ 記憶の断片',
        diary_placeholder: '今日の出来事を、ひと粒だけ残してみてね… 🫧',
        diary_save: '✨ 断片を残す',
        diary_update: '✨ 断片を書き直す',
        diary_view: '🌙 断片をたどる',
        diary_book: '🫧 記憶の断片',
        diary_save_walrus: '🌊 海に沈める',
        diary_load_walrus: '🫧 海から呼び戻す',
        exchange_sub_no_code: 'コードを発行して繋がろう！',
        exchange_sub_ready: '友達と繋がろう！',
        walrus_load_modal_title: '🫧 呼び戻す',
        walrus_load_hint: '海に眠る記憶の BlobId をたどって、Walrus を呼び戻せます。<br>前に沈めた記憶も、そのまま辿れます 🦭',
        walrus_load_saved_label: 'LAST MEMORY',
        walrus_load_saved_empty: 'まだ沈めた記憶はありません',
        walrus_load_input_label: 'たどる BlobId',
        walrus_load_placeholder: '海に眠る BlobId を貼り付けてね…',
        walrus_load_preview_empty: 'BlobId を入れると、ここに記憶の手がかりが浮かびます',
        walrus_load_confirm: '<span>🫧</span> この記憶を呼び戻す',
        walrus_load_use_saved: '✨ 前に沈めた BlobId を使う',
        diary_sub_write: '今日の出来事が、断片として残る',
        diary_fragment_note: '今日の出来事を、ひと粒だけ残してみてね。',
        theme_toggle_deep: '🌙 深海',
        theme_toggle_lagoon: '☀ 海中ラグーン',
        theme_toggle_ukiyo: '🎏 和モード',
        walrus_menu_kicker: 'WALRUS MENU',
        walrus_menu_copy: 'Walrusにふれると、海の気配を少しだけ整えられる。',
        walrus_menu_sound_label: '音設定',
        walrus_menu_sound_on: 'AMBIENT ON',
        walrus_menu_sound_off: 'AMBIENT OFF',
        walrus_menu_sound_meta_on: '環境音を静かにひらく',
        walrus_menu_sound_meta_off: '波の気配を休ませる',
        walrus_menu_theme_label: '表示モード',
        walrus_menu_theme_dive: '潜る',
        walrus_menu_theme_surface: '浮上する',
        walrus_menu_theme_meta_deep: 'いまは深海の静けさにいる',
        walrus_menu_theme_meta_surface: 'いまは海面の光にいる',
        walrus_menu_theme_meta_ukiyo: 'いまは和の水面に浮かんでいる',
        walrus_menu_language_label: '言語',
        walrus_menu_language_state_ja: '日本語',
        walrus_menu_language_state_en: 'ENGLISH',
        walrus_menu_language_meta_ja: '言葉の波を切り替える',
        walrus_menu_language_meta_en: 'Switch the voice of the sea',
        portfolio_discovery_drag: 'ドラッグで並べ替え',
        portfolio_discovery_tap: '',
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
        action_feed_title: 'OFFER / おそなえ',
        action_pet_title: 'SYNC / シンク',
        action_play_title: 'DRIFT / 漂流'
    },
    en: {
        cache_refresh: 'Refresh',
        cache_refreshing: 'Refreshing...',
        app_title: "WalMate",
        load_title: 'Starting WalMate...',
        load_sub: "Welcome to Tajumaru's secret base",
        hatch_wait: 'The egg is shaking...',
        hatch_hint: 'Hatching soon',
        hatch_step_1: 'Watch it shake',
        hatch_step_2: 'Wait for cracks',
        hatch_step_3: 'Tap to hatch',
        newborn_guide_title: "TODAY'S SIGNAL",
        newborn_guide_copy: 'Today does not have to begin with a <strong>walk</strong>. First touch your Walrus to tune the sea around you, then try <strong>OFFER</strong>, <strong>SYNC</strong>, or <strong>DRIFT</strong> and see what signal appears.',
        main_title: "WalMate",
        main_sub: 'Walk, collect sounds, and evolve your Walrus',
        sound_lab_title: '🎵 Sound Kitchen',
        sound_memory_title: '④ Sound Memory',
        sound_track_title: '📦 Sound Collection',
        feed: 'OFFER',
        pet: 'SYNC',
        play: 'DRIFT',
        bubble_pop: 'Bubble Pop',
        walrus_save: 'Sink Memory',
        walrus_load: 'Call Back',
        walrus_exchange: 'Walrus Exchange',
        walrus_diary: 'Memory Fragments',
        memory_actions_title: 'Memory Lagoon',
        memory_actions_copy: 'Handle only the memories you want to keep close after drifting.',
        walrus_save_sub: 'Record the current Walrus into the sea',
        walrus_load_sub: 'Bring Walrus back from the memory sleeping in the sea',
        stat_hunger: '◇ ENERGY',
        stat_happy: '✦ BOND',
        stat_exp: '◎ MEMORY',
        unlock2_tag: 'Lv.2 Unlock',
        unlock2_title: 'Your Intro',
        unlock2_body1: "<div class=\"intro-builder\"><div class=\"intro-card walrus-about\"><div class=\"walrus-talk\"><div class=\"walrus-avatar\" id=\"aboutWalrusAvatar\" aria-hidden=\"true\"></div><div class=\"walrus-speech\" id=\"aboutWalrusSpeech\"><span class=\"walrus-speech-kicker\">ABOUT FROM WALRUS</span><div class=\"intro-preview-copy\" id=\"introPreviewCopy\">Your Walrus will introduce you here.</div></div></div></div></div><div id=\"profileDeckModal\" class=\"profile-deck-modal\" onclick=\"if(event.target===this) closeProfileDeckModal()\"><div class=\"profile-deck-modal-inner\"><div class=\"diary-modal-header\"><span id=\"profileDeckModalTitle\">Edit profile</span><button class=\"diary-close-btn\" onclick=\"closeProfileDeckModal()\">✕</button></div><div id=\"profileDeckModalEditor\"></div></div></div></div>",
        unlock2_body2: "<div class=\"intro-card\"><div class=\"section-caption\">Portfolio Projects</div><div id=\"profileDeckMount\"></div><div class=\"walrus-projects\"><div class=\"walrus-project-card active\"><span class=\"walrus-project-icon\">🎮</span><span class=\"walrus-project-title\">Project</span><span class=\"walrus-project-meta\">Meta</span></div><div class=\"walrus-project-card\"><span class=\"walrus-project-icon\">📝</span><span class=\"walrus-project-title\">Project</span><span class=\"walrus-project-meta\">Meta</span></div><div class=\"walrus-project-card\"><span class=\"walrus-project-icon\">🖼</span><span class=\"walrus-project-title\">Project</span><span class=\"walrus-project-meta\">Meta</span></div></div><div class=\"walrus-about-note\" id=\"profileAboutNote\"></div><div class=\"social-pills\" id=\"profileSocialPills\"></div></div>",
        intro_saved_local: 'Saved your intro on this device',
        intro_saved_walrus: 'Saved your intro to Walrus!',
        intro_saved_walrus_status: 'Saved on Walrus',
        intro_empty: 'Write your intro first',
        intro_preview_empty: 'Your Walrus will introduce you here.',
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
        diary_title: '✨ Memory Fragments',
        diary_placeholder: 'Leave just one small fragment from today... 🫧',
        diary_save: '✨ Keep Fragment',
        diary_update: '✨ Rewrite Fragment',
        diary_view: '🌙 Trace Fragments',
        diary_book: '🫧 Memory Fragments',
        diary_save_walrus: '🌊 Sink into Sea',
        diary_load_walrus: '🫧 Call from Sea',
        exchange_sub_no_code: 'Generate a code and connect!',
        exchange_sub_ready: 'Connect with friends!',
        walrus_load_modal_title: '🫧 Call Back',
        walrus_load_hint: 'Trace the BlobId of a memory sleeping in the sea to bring your Walrus back.<br>You can also follow the last sunken memory instantly 🦭',
        walrus_load_saved_label: 'LAST MEMORY',
        walrus_load_saved_empty: 'No memory has been sunk yet',
        walrus_load_input_label: 'BlobId to trace',
        walrus_load_placeholder: 'Paste a BlobId sleeping in the sea...',
        walrus_load_preview_empty: 'A memory clue appears here once you enter a BlobId',
        walrus_load_confirm: '<span>🫧</span> Call back this memory',
        walrus_load_use_saved: '✨ Use the last sunken BlobId',
        diary_sub_write: 'Today can remain here as a fragment',
        diary_fragment_note: 'Leave just one small fragment from today.',
        theme_toggle_deep: '🌙 DEEP',
        theme_toggle_lagoon: '☀ LAGOON',
        theme_toggle_ukiyo: '🎏 UKIYO',
        walrus_menu_kicker: 'WALRUS MENU',
        walrus_menu_copy: 'Touch your Walrus to gently tune the sea around you.',
        walrus_menu_sound_label: 'Sound',
        walrus_menu_sound_on: 'AMBIENT ON',
        walrus_menu_sound_off: 'AMBIENT OFF',
        walrus_menu_sound_meta_on: 'Let the ambient sea breathe',
        walrus_menu_sound_meta_off: 'Let the waves rest for a while',
        walrus_menu_theme_label: 'Display Mode',
        walrus_menu_theme_dive: 'Dive',
        walrus_menu_theme_surface: 'Surface',
        walrus_menu_theme_meta_deep: 'You are resting in the deep sea hush',
        walrus_menu_theme_meta_surface: 'You are floating in surface light',
        walrus_menu_theme_meta_ukiyo: 'You are drifting in an ukiyo tide',
        walrus_menu_language_label: 'Language',
        walrus_menu_language_state_ja: 'JAPANESE',
        walrus_menu_language_state_en: 'ENGLISH',
        walrus_menu_language_meta_ja: 'Switch to the Japanese tide',
        walrus_menu_language_meta_en: 'Switch the voice of the sea',
        portfolio_discovery_drag: 'Drag to reorder',
        portfolio_discovery_tap: '',
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
        action_feed_title: 'OFFER',
        action_pet_title: 'SYNC',
        action_play_title: 'DRIFT'
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
let lastSurfaceTheme = 'lagoon';
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

function detectSurfaceTheme(){
    try {
        const saved = localStorage.getItem(SURFACE_THEME_STORAGE_KEY);
        if(saved === 'lagoon' || saved === 'ukiyo') return saved;
    } catch(e){}
    return 'lagoon';
}

function getLvName(lv){
    if(lv >= 4 && G && G.legendEvolution) return 'Mythic Legend Walrus';
    if(lv >= 4 && G?.behavior?.originPath) return getOriginPathLabel(G.behavior.originPath, false) + ' Walrus';
    return ['','Baby Walrus','Child Walrus','Adult Walrus','Legend Walrus'][lv] || '';
}

function localeCode(){
    return currentLang === 'ja' ? 'ja-JP' : 'en-US';
}

const WALMATE_USER_ID_KEY = 'walmate_user_id';
const WALMATE_FRIENDS_KEY = 'walmate_friends';
const WALMATE_FRIEND_SHARE_KEY = 'walmate_friend_share';
const WALMATE_FRIEND_RESOLVE_MAP_KEY = 'walmate_friend_resolve_map';
let friendQrCodeInstance = null;

function generateWalMateUserId(){
    if(window.crypto?.randomUUID){
        return `wm_${window.crypto.randomUUID().replace(/-/g, '')}`;
    }
    return `wm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function getWalMateUserId(){
    try {
        const userId = localStorage.getItem(WALMATE_USER_ID_KEY) || '';
        return userId.trim();
    } catch(e){
        return '';
    }
}

function ensureWalMateUserId(){
    const existing = getWalMateUserId();
    if(existing) return existing;
    const nextId = generateWalMateUserId();
    try { localStorage.setItem(WALMATE_USER_ID_KEY, nextId); } catch(e){}
    return nextId;
}

function normalizeWalMateFriendEntry(entry){
    if(!entry || typeof entry !== 'object') return null;
    const userId = typeof entry.userId === 'string' ? entry.userId.trim() : '';
    if(!userId) return null;
    const addedAt = typeof entry.addedAt === 'string' && entry.addedAt.trim()
        ? entry.addedAt.trim()
        : new Date().toISOString();
    const normalized = { userId, addedAt };
    if(typeof entry.profileName === 'string' && entry.profileName.trim()) normalized.profileName = entry.profileName.trim().slice(0, 80);
    if(typeof entry.walrusName === 'string' && entry.walrusName.trim()) normalized.walrusName = entry.walrusName.trim().slice(0, 80);
    if(Number.isFinite(Number(entry.level))) normalized.level = Math.max(1, Math.min(999, Number(entry.level) || 1));
    return normalized;
}

function getWalMateFriends(){
    try {
        const raw = JSON.parse(localStorage.getItem(WALMATE_FRIENDS_KEY) || '[]');
        if(!Array.isArray(raw)) return [];
        return raw.map(normalizeWalMateFriendEntry).filter(Boolean);
    } catch(e){
        return [];
    }
}

function saveWalMateFriends(friends){
    try {
        localStorage.setItem(
            WALMATE_FRIENDS_KEY,
            JSON.stringify((Array.isArray(friends) ? friends : []).map(normalizeWalMateFriendEntry).filter(Boolean))
        );
    } catch(e){}
}

function getWalMateFriendProfile(){
    return {
        userId: ensureWalMateUserId(),
        walrusName: (G?.petName || '').trim() || 'Walrus',
        level: Math.max(1, Number(G?.lv) || 1)
    };
}

function addWalMateFriend(userId, profile = {}){
    const friendUserId = typeof userId === 'string' ? userId.trim() : '';
    if(!friendUserId) return { ok:false, reason:'invalid' };
    const myUserId = ensureWalMateUserId();
    if(friendUserId === myUserId) return { ok:false, reason:'self' };
    const friends = getWalMateFriends();
    if(friends.some(friend => friend.userId === friendUserId)) return { ok:false, reason:'duplicate' };
    const entry = normalizeWalMateFriendEntry({
        userId: friendUserId,
        addedAt: new Date().toISOString(),
        profileName: profile.profileName,
        walrusName: profile.walrusName,
        level: profile.level
    });
    friends.unshift(entry);
    saveWalMateFriends(friends);
    return { ok:true, reason:'added', friend:entry };
}

function getFriendResolveMap(){
    try {
        const raw = JSON.parse(localStorage.getItem(WALMATE_FRIEND_RESOLVE_MAP_KEY) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch(e){
        return {};
    }
}

function saveFriendResolveMap(map){
    try {
        localStorage.setItem(WALMATE_FRIEND_RESOLVE_MAP_KEY, JSON.stringify(map && typeof map === 'object' ? map : {}));
    } catch(e){}
}

function base64UrlEncode(text){
    try {
        return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch(e){
        return '';
    }
}

function base64UrlDecode(text){
    try {
        const normalized = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '==='.slice((normalized.length + 3) % 4);
        return atob(padded);
    } catch(e){
        return '';
    }
}

function generateFriendId(blobId){
    const cleanBlobId = typeof blobId === 'string' ? blobId.trim() : '';
    if(!cleanBlobId) return '';
    const payload = {
        v: 1,
        b: cleanBlobId,
        t: Date.now(),
        n: Math.random().toString(36).slice(2, 10)
    };
    const encoded = base64UrlEncode(JSON.stringify(payload));
    return encoded ? `wf1_${encoded}` : '';
}

function decodeFriendIdPayload(friendId){
    const raw = typeof friendId === 'string' ? friendId.trim() : '';
    if(!raw.startsWith('wf1_')) return null;
    const decoded = base64UrlDecode(raw.slice(4));
    if(!decoded) return null;
    try {
        const payload = JSON.parse(decoded);
        const blobId = typeof payload?.b === 'string' ? payload.b.trim() : '';
        if(!blobId) return null;
        return payload;
    } catch(e){
        return null;
    }
}

function getStoredFriendShare(){
    try {
        const raw = JSON.parse(localStorage.getItem(WALMATE_FRIEND_SHARE_KEY) || 'null');
        return raw && typeof raw === 'object' ? raw : null;
    } catch(e){
        return null;
    }
}

function saveStoredFriendShare(friendShare){
    try {
        localStorage.setItem(WALMATE_FRIEND_SHARE_KEY, JSON.stringify(friendShare));
    } catch(e){}
}

function getOrCreateFriendIdForCurrentWalrus(){
    const blobId = (localStorage.getItem('walrus_blobid') || '').trim();
    if(!blobId) return '';
    const stored = getStoredFriendShare();
    if(stored?.friendId && stored?.blobId === blobId) return stored.friendId;
    const friendId = generateFriendId(blobId);
    if(!friendId) return '';
    saveStoredFriendShare({ friendId, blobId, updatedAt: Date.now() });
    const map = getFriendResolveMap();
    map[friendId] = { blobId, updatedAt: Date.now() };
    saveFriendResolveMap(map);
    return friendId;
}

function resolveFriendId(friendId){
    const cleanFriendId = typeof friendId === 'string' ? friendId.trim() : '';
    if(!cleanFriendId) return '';
    const map = getFriendResolveMap();
    const mappedBlobId = typeof map?.[cleanFriendId]?.blobId === 'string' ? map[cleanFriendId].blobId.trim() : '';
    if(mappedBlobId) return mappedBlobId;
    const payload = decodeFriendIdPayload(cleanFriendId);
    return typeof payload?.b === 'string' ? payload.b.trim() : '';
}

function getFriendInviteUrl(friendId = getOrCreateFriendIdForCurrentWalrus()){
    const url = new URL(window.location.origin + window.location.pathname);
    if(friendId) url.searchParams.set('friendId', friendId);
    return url.toString();
}

function getFriendQrCopy(){
    return currentLang === 'ja'
        ? {
            openButton: '🦭 Friend QR',
            title: 'FRIEND QR',
            subtitle: 'スキャンすると、そのまま友達Walrusが遊びに来るよ',
            close: '閉じる',
            copyLink: 'リンクをコピー',
            myId: 'FRIEND ID',
            friendCount: 'FRIENDS',
            qrError: 'QRの表示に失敗しました',
            saveFirst: 'Walrus保存後に Friend QR を作成できます',
            saveFirstDetail: '先にこのWalrusを保存すると、紹介ページ用の招待リンクが作れます。',
            linkCopied: '📋 招待リンクをコピーしたよ！',
            linkCopyFailed: 'コピーに失敗しました',
            addedToast: '✨ FRIEND ADDED ✨',
            duplicateToast: '👯 すでに友達だよ',
            selfToast: '🪞 自分自身は追加できないよ',
            invalidToast: '⚠ 友達QRを読み取れなかったよ',
            addedMsg: '🦭 新しい友達ができたよ！',
            duplicateMsg: '🦭 もう友達リストにいるよ',
            selfMsg: 'そのQRはあなた自身のものだよ'
        }
        : {
            openButton: '🦭 Friend QR',
            title: 'FRIEND QR',
            subtitle: 'Scan to let your Walrus drift over automatically',
            close: 'Close',
            copyLink: 'Copy Link',
            myId: 'FRIEND ID',
            friendCount: 'FRIENDS',
            qrError: 'Could not render the QR code',
            saveFirst: 'Save this Walrus first to create a Friend QR',
            saveFirstDetail: 'Once this Walrus is saved, an invite link for your intro page will be ready.',
            linkCopied: '📋 Invite link copied!',
            linkCopyFailed: 'Copy failed',
            addedToast: '✨ FRIEND ADDED ✨',
            duplicateToast: '👯 Already friends',
            selfToast: '🪞 That is your own QR',
            invalidToast: '⚠ Could not read that friend QR',
            addedMsg: '🦭 You made a new friend!',
            duplicateMsg: '🦭 This friend is already saved',
            selfMsg: 'That QR belongs to you'
        };
}

function formatFriendId(userId){
    const value = typeof userId === 'string' ? userId.trim() : '';
    if(!value) return '--';
    return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function refreshFriendQrMeta(){
    const meta = document.getElementById('friendQrMeta');
    if(!meta) return;
    const copy = getFriendQrCopy();
    const friendId = getOrCreateFriendIdForCurrentWalrus();
    meta.innerHTML = `<span><strong>${copy.myId}</strong> ${escapeHtml(formatFriendId(friendId || '--'))}</span><span><strong>${copy.friendCount}</strong> ${getWalMateFriends().length}</span>`;
}

function updateFriendQrModalCopy(){
    const copy = getFriendQrCopy();
    const title = document.getElementById('friendQrModalTitle');
    const subtitle = document.getElementById('friendQrModalCopy');
    const closeBtn = document.getElementById('friendQrCloseBtn');
    const copyBtn = document.getElementById('friendQrCopyBtn');
    if(title) title.textContent = copy.title;
    if(subtitle) subtitle.textContent = copy.subtitle;
    if(closeBtn) closeBtn.textContent = copy.close;
    if(copyBtn) copyBtn.textContent = copy.copyLink;
    refreshFriendQrMeta();
}

function renderFriendQrCode(){
    const mount = document.getElementById('friendQrCanvas');
    const urlLabel = document.getElementById('friendQrUrl');
    const copyBtn = document.getElementById('friendQrCopyBtn');
    if(!mount) return;
    const copy = getFriendQrCopy();
    const friendId = getOrCreateFriendIdForCurrentWalrus();
    const inviteUrl = friendId ? getFriendInviteUrl(friendId) : '';
    const size = Math.max(196, Math.min(248, window.innerWidth - 120));
    mount.innerHTML = '';
    if(urlLabel) urlLabel.textContent = inviteUrl || copy.saveFirst;
    if(copyBtn) copyBtn.disabled = !inviteUrl;
    refreshFriendQrMeta();
    if(!inviteUrl){
        mount.innerHTML = `<div class="friend-qr-fallback"><strong>${escapeHtml(copy.saveFirst)}</strong><br>${escapeHtml(copy.saveFirstDetail)}</div>`;
        return;
    }
    if(!window.QRCode){
        mount.innerHTML = `<div class="friend-qr-fallback">${escapeHtml(copy.qrError)}</div>`;
        return;
    }
    friendQrCodeInstance = new QRCode(mount, {
        text: inviteUrl,
        width: size,
        height: size,
        colorDark: '#081c30',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H
    });
    const img = mount.querySelector('img');
    const canvas = mount.querySelector('canvas');
    if(img){
        img.alt = 'WalMate friend QR';
        img.style.display = 'block';
        img.style.margin = '0 auto';
    }
    if(canvas){
        canvas.setAttribute('aria-label', 'WalMate friend QR');
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
    }
}

function openFriendQrModal(){
    ensureWalMateUserId();
    const modal = document.getElementById('friendQrModal');
    if(!modal) return;
    modal.style.display = 'flex';
    updateFriendQrModalCopy();
    renderFriendQrCode();
}

function closeFriendQrModal(){
    const modal = document.getElementById('friendQrModal');
    if(!modal) return;
    modal.style.display = 'none';
}

async function copyFriendInviteUrl(){
    const copy = getFriendQrCopy();
    const inviteUrl = getFriendInviteUrl();
    if(!inviteUrl || !inviteUrl.includes('friendId=')){
        showToast(copy.saveFirst, true);
        return;
    }
    const ok = await copyText(inviteUrl);
    showToast(ok ? copy.linkCopied : copy.linkCopyFailed, !ok);
}

function removeFriendParamFromUrl(){
    const url = new URL(window.location.href);
    let changed = false;
    if(url.searchParams.has('friendId')){
        url.searchParams.delete('friendId');
        changed = true;
    }
    if(url.searchParams.has('friend')){
        url.searchParams.delete('friend');
        changed = true;
    }
    if(!changed) return;
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function handlePendingFriendInviteFromUrl(){
    const url = new URL(window.location.href);
    const friendId = (url.searchParams.get('friendId') || '').trim();
    if(friendId){
        if(typeof handleIncomingFriendVisit === 'function'){
            const result = await handleIncomingFriendVisit(friendId);
            if(result?.ok || result?.reason === 'self') removeFriendParamFromUrl();
            return result;
        }
        return { ok:false, reason:'visit_handler_missing' };
    }
    const friendUserId = (url.searchParams.get('friend') || '').trim();
    if(!friendUserId){
        removeFriendParamFromUrl();
        return null;
    }
    const result = addWalMateFriend(friendUserId);
    removeFriendParamFromUrl();
    const copy = getFriendQrCopy();
    if(result?.ok){
        showToast(copy.addedToast);
        if(typeof setMsg === 'function') setMsg(copy.addedMsg);
    } else if(result?.reason === 'duplicate'){
        showToast(copy.duplicateToast, true);
        if(typeof setMsg === 'function') setMsg(copy.duplicateMsg, true);
    } else if(result?.reason === 'self'){
        showToast(copy.selfToast, true);
        if(typeof setMsg === 'function') setMsg(copy.selfMsg, true);
    } else {
        showToast(copy.invalidToast, true);
    }
    refreshFriendQrMeta();
    return result;
}

function getProfileEditorCopy(){
    return currentLang === 'ja'
        ? {
            aboutLabel: '自分ができること',
            aboutPlaceholder: '作れるもの、手伝えること、得意なことを短く書いてね…',
            linksLabel: 'リンク先',
            modalTitle: 'プロフィールを編集',
            editProfile: '✏️ プロフィールを編集',
            firstSetup: '初回だけここでまとめて入力できます。',
            xLabel: 'X URL',
            instagramLabel: 'Instagram URL',
            noteLabel: 'Note URL',
            cardTitle: 'カード名',
            cardMeta: '肩書き / ジャンル',
            saveLocal: '💾 この端末に保存',
            saveWalrus: '🌐 Walrusに保存',
            statusEmpty: 'まだプロフィールデッキは保存されていません。',
            savedLocal: 'この端末にプロフィールを保存したよ',
            savedWalrus: 'プロフィールをWalrusに保存したよ！',
            savedWalrusStatus: 'Walrus保存済み',
            savingWalrus: '🌐 保存中…',
            previewEmpty: 'ここに「何ができるか」とリンクが表示されます。'
        }
        : {
            aboutLabel: 'What you can do',
            aboutPlaceholder: 'Write what you build, help with, or do best…',
            linksLabel: 'Links',
            modalTitle: 'Edit profile',
            editProfile: '✏️ Edit profile',
            firstSetup: 'For the first setup, you can fill everything here.',
            xLabel: 'X URL',
            instagramLabel: 'Instagram URL',
            noteLabel: 'Note URL',
            cardTitle: 'Card title',
            cardMeta: 'Role / Category',
            saveLocal: '💾 Save on device',
            saveWalrus: '🌐 Save to Walrus',
            statusEmpty: 'No profile deck saved yet.',
            savedLocal: 'Saved your profile on this device',
            savedWalrus: 'Saved your profile to Walrus!',
            savedWalrusStatus: 'Saved on Walrus',
            savingWalrus: '🌐 Saving...',
            previewEmpty: 'Your abilities and links will appear here.'
        };
}

function normalizeProfileUrl(value){
    const raw = `${value || ''}`.trim();
    if(!raw) return '';
    if(/^https?:\/\//i.test(raw)) return raw;
    if(raw.startsWith('//')) return `https:${raw}`;
    return `https://${raw.replace(/^@/, '')}`;
}

function normalizeXProfileUrl(value){
    const raw = `${value || ''}`.trim();
    if(!raw) return '';
    if(/^https?:\/\/(www\.)?x\.com\//i.test(raw)) return raw;
    if(/^https?:\/\//i.test(raw)) return raw;
    if(raw.startsWith('//')) return `https:${raw}`;
    const username = raw
        .replace(/^@/, '')
        .replace(/^https?:\/\/(www\.)?x\.com\//i, '')
        .split(/[/?#]/)[0]
        .trim();
    return username ? `https://x.com/${username}` : '';
}

function getXProfileHandleLabel(url){
    const raw = `${url || ''}`.trim();
    if(!raw) return '𝕏 X';
    const match = raw.match(/x\.com\/([^/?#]+)/i);
    const username = (match?.[1] || raw.replace(/^@/, '').split(/[/?#]/)[0] || '').trim();
    return username ? `𝕏 @${username}` : '𝕏 X';
}

function getDefaultProfileDeck(){
    if(currentLang === 'ja'){
        return {
            about: '好きなものは Walrus Protocol、ちょっと妙なアイデア、そしてオンチェーンで遊ぶ余白。技術ネタもネタ投稿も歓迎です。',
            socials: {
                x: 'https://x.com/tajumaruxxx',
                instagram: '',
                note: 'https://note.com/tajumaru'
            },
            cards: [
                { id: 'pet-game', icon: '🎮', title: 'Walrus育成ゲーム', meta: 'Game / PWA / Walrus', speech: 'この育成ゲームそのものがポートフォリオの入口。育てる、保存する、交流する、日記を書くまでを1画面で遊べるようにしているよ。', fun: 5, tech: 5 },
                { id: 'note-lab', icon: '📝', title: 'Sui / Walrus Note', meta: 'Writing / Research', speech: 'NoteではSuiやWalrusで試したことを、あとから読み返せるログにしているよ。技術メモと沼トークのあいだくらいの温度感。', fun: 4, tech: 4 },
                { id: 'nft-collections', icon: '🖼', title: 'NFT Collections', meta: 'Art / Community', speech: 'NFTコレクションは遊び心の棚。Poopie Face、Tajumarte、SunSun、それぞれ違うノリで見てもらえるよ。', fun: 5, tech: 3 }
            ]
        };
    }
    return {
        about: 'Favorite things: Walrus Protocol, strange ideas, and the open space where on-chain experiments become playful. Tech talk and odd posts are welcome.',
        socials: {
            x: 'https://x.com/tajumaruxxx',
            instagram: '',
            note: 'https://note.com/tajumaru'
        },
        cards: [
            { id: 'pet-game', icon: '🎮', title: 'Walrus Pet Game', meta: 'Game / PWA / Walrus', speech: 'This pet game is the portfolio entrance: raising, saving, exchanging, and diary writing all live in one playful screen.', fun: 5, tech: 5 },
            { id: 'note-lab', icon: '📝', title: 'Sui / Walrus Notes', meta: 'Writing / Research', speech: 'On Note, experiments around Sui and Walrus stay readable as field notes: part technical memo, part swamp dispatch.', fun: 4, tech: 4 },
            { id: 'nft-collections', icon: '🖼', title: 'NFT Collections', meta: 'Art / Community', speech: 'The NFT collections are a playful display shelf. Each one carries a different mood and community energy.', fun: 5, tech: 3 }
        ]
    };
}

function getProfileDeckData(source = G?.profileDeck){
    const defaults = getDefaultProfileDeck();
    const hasCustom = !!(source && typeof source === 'object');
    const profile = hasCustom ? source : {};
    const socials = profile.socials && typeof profile.socials === 'object' ? profile.socials : {};
    const cards = Array.isArray(profile.cards) ? profile.cards : [];
    return {
        about: hasCustom
            ? (typeof profile.about === 'string' ? profile.about.trim() : '')
            : defaults.about,
        socials: {
            x: hasCustom ? normalizeXProfileUrl(socials.x) : defaults.socials.x,
            instagram: normalizeProfileUrl(socials.instagram),
            note: hasCustom ? normalizeProfileUrl(socials.note) : defaults.socials.note
        },
        cards: defaults.cards.map((item, index) => {
            const custom = cards[index] && typeof cards[index] === 'object' ? cards[index] : {};
            return {
                ...item,
                title: typeof custom.title === 'string' && custom.title.trim() ? custom.title.trim() : item.title,
                meta: typeof custom.meta === 'string' && custom.meta.trim() ? custom.meta.trim() : item.meta,
                speech: typeof custom.speech === 'string' && custom.speech.trim() ? custom.speech.trim() : item.speech
            };
        })
    };
}

function getPortfolioConfig(){
    return getProfileDeckData().cards;
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
    refreshWalrusMenu();
}

function setTheme(theme){
    currentTheme = theme === 'lagoon' || theme === 'ukiyo' ? theme : 'deep';
    if(currentTheme !== 'deep'){
        lastSurfaceTheme = currentTheme;
        try { localStorage.setItem(SURFACE_THEME_STORAGE_KEY, lastSurfaceTheme); } catch(e){}
    }
    try { localStorage.setItem(THEME_STORAGE_KEY, currentTheme); } catch(e){}
    applyTheme();
    refreshBgCssVarCache?.();
    restartBgCanvasLoop?.();
}

function toggleLanguage(event){
    event?.stopPropagation?.();
    setLanguage(currentLang === 'ja' ? 'en' : 'ja');
    closeWalrusMenu?.();
}

function toggleTheme(event){
    event?.stopPropagation?.();
    const nextTheme = currentTheme === 'deep'
        ? 'lagoon'
        : currentTheme === 'lagoon'
            ? 'ukiyo'
            : 'deep';
    setTheme(nextTheme);
    closeWalrusMenu?.();
}

function toggleDiveMode(event){
    event?.stopPropagation?.();
    if(currentTheme === 'deep'){
        setTheme(lastSurfaceTheme === 'ukiyo' ? 'ukiyo' : 'lagoon');
    } else {
        lastSurfaceTheme = currentTheme;
        try { localStorage.setItem(SURFACE_THEME_STORAGE_KEY, lastSurfaceTheme); } catch(e){}
        setTheme('deep');
    }
    closeWalrusMenu?.();
}

function isWalrusMenuOpen(){
    return document.getElementById('walrusMenuShell')?.classList.contains('open');
}

function ensureWalrusMenuLayer(){
    const shell = document.getElementById('walrusMenuShell');
    if(shell && shell.parentElement !== document.body){
        document.body.appendChild(shell);
    }
    return shell;
}

function positionWalrusMenu(){
    const shell = document.getElementById('walrusMenuShell');
    const stage = document.getElementById('petStage');
    if(!shell || !stage) return;
    const margin = 16;
    const gap = 14;
    const stageRect = stage.getBoundingClientRect();
    shell.style.visibility = 'hidden';
    shell.classList.add('open');
    const menuWidth = shell.offsetWidth || 280;
    const menuHeight = shell.offsetHeight || 220;
    const centeredLeft = stageRect.left + stageRect.width / 2 - menuWidth / 2;
    const left = Math.max(margin, Math.min(centeredLeft, window.innerWidth - menuWidth - margin));
    const topAbove = stageRect.top - menuHeight - gap;
    const canOpenAbove = topAbove >= margin;
    const top = canOpenAbove
        ? topAbove
        : Math.min(stageRect.bottom + gap, window.innerHeight - menuHeight - margin);
    shell.classList.toggle('below', !canOpenAbove);
    shell.style.left = `${Math.round(left)}px`;
    shell.style.top = `${Math.round(top)}px`;
    shell.style.visibility = '';
}

function openWalrusMenu(){
    const shell = ensureWalrusMenuLayer();
    const stage = document.getElementById('petStage');
    if(!shell || !stage) return;
    shell.classList.add('open');
    shell.setAttribute('aria-hidden', 'false');
    stage.setAttribute('aria-expanded', 'true');
    refreshWalrusMenu();
    positionWalrusMenu();
}

function closeWalrusMenu(){
    const shell = document.getElementById('walrusMenuShell');
    const stage = document.getElementById('petStage');
    if(!shell || !stage) return;
    shell.classList.remove('open');
    shell.classList.remove('below');
    shell.setAttribute('aria-hidden', 'true');
    stage.setAttribute('aria-expanded', 'false');
    shell.style.left = '';
    shell.style.top = '';
    shell.style.visibility = '';
}

function toggleWalrusMenu(){
    if(isWalrusMenuOpen()) closeWalrusMenu();
    else openWalrusMenu();
}

function refreshWalrusMenu(){
    const soundLabel = document.getElementById('walrusSoundLabel');
    const soundState = document.getElementById('walrusSoundState');
    const soundMeta = document.getElementById('walrusSoundMeta');
    const themeLabel = document.getElementById('walrusThemeLabel');
    const themeState = document.getElementById('walrusThemeState');
    const themeMeta = document.getElementById('walrusThemeMeta');
    const langLabel = document.getElementById('walrusLangLabel');
    const langState = document.getElementById('walrusLangState');
    const langMeta = document.getElementById('walrusLangMeta');
    const kicker = document.getElementById('walrusMenuKicker');
    const copy = document.getElementById('walrusMenuCopy');
    if(kicker) kicker.textContent = t('walrus_menu_kicker');
    if(copy) copy.textContent = t('walrus_menu_copy');
    if(soundLabel) soundLabel.textContent = t('walrus_menu_sound_label');
    if(soundState) soundState.textContent = t(isMuted ? 'walrus_menu_sound_off' : 'walrus_menu_sound_on');
    if(soundMeta) soundMeta.textContent = t(isMuted ? 'walrus_menu_sound_meta_off' : 'walrus_menu_sound_meta_on');
    if(themeLabel) themeLabel.textContent = t('walrus_menu_theme_label');
    if(themeState) themeState.textContent = t(currentTheme === 'deep' ? 'walrus_menu_theme_surface' : 'walrus_menu_theme_dive');
    if(themeMeta){
        const themeMetaKey = currentTheme === 'deep'
            ? 'walrus_menu_theme_meta_deep'
            : currentTheme === 'ukiyo'
                ? 'walrus_menu_theme_meta_ukiyo'
                : 'walrus_menu_theme_meta_surface';
        themeMeta.textContent = t(themeMetaKey);
    }
    if(langLabel) langLabel.textContent = t('walrus_menu_language_label');
    if(langState) langState.textContent = t(currentLang === 'ja' ? 'walrus_menu_language_state_ja' : 'walrus_menu_language_state_en');
    if(langMeta) langMeta.textContent = t(currentLang === 'ja' ? 'walrus_menu_language_meta_ja' : 'walrus_menu_language_meta_en');
}

function buildVersionedUrl(){
    const url = new URL(window.location.href);
    url.searchParams.set('v', APP_VERSION);
    url.searchParams.set('ts', Date.now().toString());
    return url.toString();
}

function versionedAssetUrl(path){
    const base = new URL(path, window.location.href);
    base.searchParams.set('v', APP_VERSION);
    return `${base.pathname}${base.search}`;
}

function registerServiceWorker(){
    if(!('serviceWorker' in navigator)) return;
    if(window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

    const register = () => {
        navigator.serviceWorker.register(versionedAssetUrl('./sw.js'), { updateViaCache: 'none' }).then(reg => {
            reg.update().catch(() => {});
        }).catch(err => {
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

function isThermalConstrainedDevice(){
    return isIosDevice() || (navigator.deviceMemory && navigator.deviceMemory <= 4);
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

async function clearRuntimeCaches({ unregisterServiceWorkers = false } = {}){
    try {
        if('caches' in window){
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        if(unregisterServiceWorkers && 'serviceWorker' in navigator){
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
        }
    } catch(e){
        console.warn('Runtime cache clear failed:', e);
    }
}

function ensureFreshVersion(){
    try{
        const savedVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);
        if(savedVersion !== APP_VERSION){
            localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
            clearRuntimeCaches({ unregisterServiceWorkers: true }).finally(() => {
                window.location.replace(buildVersionedUrl());
            });
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
    if(document.getElementById('btnFeedVerb')) document.getElementById('btnFeedVerb').textContent = t('feed');
    if(document.getElementById('btnPetVerb')) document.getElementById('btnPetVerb').textContent = t('pet');
    if(document.getElementById('btnPlayVerb')) document.getElementById('btnPlayVerb').textContent = t('play');
    setButtonHTML('btnMiniGame', `<span class="act-icon">🫧</span>${t('bubble_pop')}`);
    setButtonHTML('btnSave', `<span class="act-main"><span class="act-icon">🌊</span><span class="act-copy"><span class="act-title">${t('walrus_save')}</span><span class="act-sub">SINK</span></span></span><span class="act-hint">${t('walrus_save_sub')}</span>`);
    setButtonHTML('btnLoad', `<span class="act-main"><span class="act-icon">🫧</span><span class="act-copy"><span class="act-title">${t('walrus_load')}</span><span class="act-sub">CALL</span></span></span><span class="act-hint">${t('walrus_load_sub')}</span>`);
    if(document.getElementById('btnExchangeOpenLabel')) document.getElementById('btnExchangeOpenLabel').textContent = t('walrus_exchange');
    if(document.getElementById('btnDiaryLabel')) document.getElementById('btnDiaryLabel').textContent = t('walrus_diary');
    if(document.querySelector('#memoryActionsShell .memory-actions-title')) document.querySelector('#memoryActionsShell .memory-actions-title').textContent = t('memory_actions_title');
    if(document.querySelector('#memoryActionsShell .memory-actions-copy')) document.querySelector('#memoryActionsShell .memory-actions-copy').textContent = t('memory_actions_copy');
    const statNames = document.querySelectorAll('.stat-name');
    if(statNames[0]) statNames[0].innerHTML = `◇ ENERGY<br><span style="font-size:0.52rem;letter-spacing:0.08em;">${currentLang === 'ja' ? 'エネルギー' : 'Energy'}</span>`;
    if(statNames[1]) statNames[1].innerHTML = `✦ BOND<br><span style="font-size:0.52rem;letter-spacing:0.08em;">${currentLang === 'ja' ? '共鳴' : 'Bond'}</span>`;
    if(statNames[2]) statNames[2].innerHTML = `◎ MEMORY<br><span style="font-size:0.52rem;letter-spacing:0.08em;">${currentLang === 'ja' ? '記憶' : 'Memory'}</span>`;
    const petStage = document.getElementById('petStage');
    if(petStage) petStage.setAttribute('aria-label', currentLang === 'ja' ? 'Walrusメニューをひらく' : 'Open Walrus menu');
    refreshWalrusMenu();
    if(typeof updateActionCards === 'function') updateActionCards();
    updateFriendQrModalCopy();

    const sec1 = document.getElementById('sec1');
    if(sec1){
        sec1.classList.add('rich-card');
        const sec1Bodies = sec1.querySelectorAll('.ubody');
        setText(sec1.querySelector('.utag'), t('unlock2_tag'));
        setText(sec1.querySelector('.utitle'), t('unlock2_title'));
        setHtml(sec1Bodies[0], t('unlock2_body1'));
        setHtml(sec1Bodies[1], t('unlock2_body2'));
        renderProfileDeckSurface();
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
    if(document.getElementById('diaryFragmentNote')) document.getElementById('diaryFragmentNote').textContent = t('diary_fragment_note');
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
    applyWalkLanguage();
    updateUI();
}

function initAboutWalrusNarrator(){
    const avatar = document.getElementById('aboutWalrusAvatar');
    renderWalrusMarkup(avatar, G?.lv || 1, 'happy', 'happy', true);
}

function getIntroPreviewText(){
    const raw = (G?.userIntro || '').trim();
    if(!raw) return t('intro_preview_empty');
    return currentLang === 'ja'
        ? `ぼくの相棒はこんな人だよ。\n${raw}`
        : `Here is my buddy.\n${raw}`;
}

function renderIntroPreview(){
    const preview = document.getElementById('introPreviewCopy');
    if(preview) preview.textContent = getIntroPreviewText();
}

function syncUserIntroDraft(){
    const input = document.getElementById('introInput');
    const count = document.getElementById('introCount');
    const value = input ? input.value.slice(0, 420) : '';
    if(input && input.value !== value) input.value = value;
    if(count) count.textContent = `${value.length} / 420`;
    const preview = document.getElementById('introPreviewCopy');
    if(preview) preview.textContent = value.trim() ? (currentLang === 'ja' ? `ぼくの相棒はこんな人だよ。\n${value.trim()}` : `Here is my buddy.\n${value.trim()}`) : t('intro_preview_empty');
}

function renderUserIntroStatus(){
    const status = document.getElementById('introStatus');
    if(!status) return;
    status.textContent = getUserIntroStatusText();
}

function getUserIntroStatusText(){
    const hasIntro = !!(G?.userIntro || '').trim();
    if(!hasIntro){
        return currentLang === 'ja' ? 'まだ自己紹介は保存されていません。' : 'No intro saved yet.';
    }
    const savedAt = G.userIntroSavedAt
        ? new Date(G.userIntroSavedAt).toLocaleString(localeCode(), { dateStyle:'medium', timeStyle:'short' })
        : '';
    return G.userIntroBlobId
        ? `${t('intro_saved_walrus_status')} · ${shortBlobId(G.userIntroBlobId)}${savedAt ? ` · ${savedAt}` : ''}`
        : `${t('intro_saved_local')}${savedAt ? ` · ${savedAt}` : ''}`;
}

function hydrateUserIntroEditor(){
    const input = document.getElementById('introInput');
    if(input) input.value = G?.userIntro || '';
    syncUserIntroDraft();
    renderIntroPreview();
    renderUserIntroStatus();
}

function saveUserIntroDraft(){
    const input = document.getElementById('introInput');
    const value = (input?.value || '').trim().slice(0, 420);
    if(!value){
        showToast(t('intro_empty'), true);
        return;
    }
    G.userIntro = value;
    G.userIntroSavedAt = Date.now();
    saveG();
    hydrateUserIntroEditor();
    setMsg(t('intro_saved_local'));
    showToast(t('intro_saved_local'));
}

function collectProfileDeckDraft(){
    return {
        about: (document.getElementById('profileAboutInput')?.value || '').trim().slice(0, 280),
        socials: {
            x: (document.getElementById('profileLinkX')?.value || '').trim().slice(0, 220),
            instagram: (document.getElementById('profileLinkInstagram')?.value || '').trim().slice(0, 220),
            note: (document.getElementById('profileLinkNote')?.value || '').trim().slice(0, 220)
        },
        cards: [0, 1, 2].map(index => ({
            title: (document.getElementById(`profileCardTitle${index}`)?.value || '').trim().slice(0, 60),
            meta: (document.getElementById(`profileCardMeta${index}`)?.value || '').trim().slice(0, 60),
            speech: ''
        }))
    };
}

function renderProfileDeckStatus(){
    const status = document.getElementById('profileDeckStatus');
    if(!status) return;
    status.textContent = getProfileDeckStatusText();
}

function getProfileDeckStatusText(){
    const copy = getProfileEditorCopy();
    const hasDeck = !!(G?.profileDeck && (
        (G.profileDeck.about || '').trim()
        || (G.profileDeck.socials?.x || '').trim()
        || (G.profileDeck.socials?.instagram || '').trim()
        || (G.profileDeck.socials?.note || '').trim()
        || (G.profileDeck.cards || []).some(card => (card?.title || '').trim() || (card?.meta || '').trim() || (card?.speech || '').trim())
    ));
    if(!hasDeck){
        return copy.statusEmpty;
    }
    const savedAt = G.profileDeckSavedAt
        ? new Date(G.profileDeckSavedAt).toLocaleString(localeCode(), { dateStyle:'medium', timeStyle:'short' })
        : '';
    return G.profileDeckBlobId
        ? `${copy.savedWalrusStatus} · ${shortBlobId(G.profileDeckBlobId)}${savedAt ? ` · ${savedAt}` : ''}`
        : `${copy.savedLocal}${savedAt ? ` · ${savedAt}` : ''}`;
}

function hasProfileDeckSetup(){
    return !!(
        (G?.userIntro || '').trim()
        || (G?.profileDeck?.about || '').trim()
        || (G?.profileDeck?.socials?.x || '').trim()
        || (G?.profileDeck?.socials?.instagram || '').trim()
        || (G?.profileDeck?.socials?.note || '').trim()
        || (G?.profileDeck?.cards || []).some(card => (card?.title || '').trim() || (card?.meta || '').trim())
        || G?.userIntroSavedAt
        || G?.profileDeckSavedAt
    );
}

function renderSec1HeaderAction(){
    const sec1 = document.getElementById('sec1');
    if(!sec1) return;
    const tag = sec1.querySelector('.utag');
    const title = sec1.querySelector('.utitle');
    if(!title) return;
    let row = sec1.querySelector('.unlock-title-row');
    if(!row){
        row = document.createElement('div');
        row.className = 'unlock-title-row';
        if(tag && tag.nextSibling){
            sec1.insertBefore(row, tag.nextSibling);
        } else if(tag){
            sec1.appendChild(row);
        } else {
            sec1.insertBefore(row, sec1.firstChild);
        }
        row.appendChild(title);
    } else if(title.parentNode !== row){
        row.insertBefore(title, row.firstChild);
    }
    let actions = row.querySelector('.unlock-title-actions');
    if(!actions){
        actions = document.createElement('div');
        actions.className = 'unlock-title-actions';
        row.appendChild(actions);
    }
    const copy = getProfileEditorCopy();
    const friendCopy = getFriendQrCopy();
    const buttons = [
        `<button class="intro-btn alt intro-btn-compact" type="button" onclick="openFriendQrModal()">${friendCopy.openButton}</button>`
    ];
    if(hasProfileDeckSetup()){
        buttons.unshift(`<button class="intro-btn intro-btn-compact" type="button" onclick="openProfileDeckModal()">${copy.editProfile}</button>`);
    }
    actions.innerHTML = buttons.join('');
}

function openProfileDeckModal(){
    const modal = document.getElementById('profileDeckModal');
    if(!modal) return;
    modal.style.display = 'flex';
    hydrateProfileDeckEditor('profileDeckModalEditor');
}

function closeProfileDeckModal(){
    const modal = document.getElementById('profileDeckModal');
    if(!modal) return;
    modal.style.display = 'none';
}

function getWalrusLogItems(){
    const items = [];
    if((G?.userIntro || '').trim()){
        items.push({ kicker: currentLang === 'ja' ? 'INTRO SAVE' : 'INTRO SAVE', text: getUserIntroStatusText() });
    }
    if(
        (G?.profileDeck?.about || '').trim()
        || (G?.profileDeck?.socials?.x || '').trim()
        || (G?.profileDeck?.socials?.instagram || '').trim()
        || (G?.profileDeck?.socials?.note || '').trim()
        || (G?.profileDeck?.cards || []).some(card => (card?.title || '').trim() || (card?.meta || '').trim())
    ){
        items.push({ kicker: 'PROFILE SAVE', text: getProfileDeckStatusText() });
    }
    try{
        const soundBlobId = localStorage.getItem(SOUND_COLLECTION_BLOB_KEY) || '';
        if(soundBlobId){
            items.push({
                kicker: 'SOUND COLLECTION',
                text: `${currentLang === 'ja' ? 'Walrus保存済み' : 'Saved on Walrus'} · ${shortBlobId(soundBlobId)}`
            });
        }
    }catch(e){}
    const walmateLogs = getWalMateLogs?.() || [];
    walmateLogs.forEach(item => {
        const text = currentLang === 'ja' ? item.textJa : item.textEn;
        if(!text) return;
        items.push({
            kicker: currentLang === 'ja' ? 'DRIFT MEMORY' : 'DRIFT MEMORY',
            text: `${item.dateKey || ''} · ${text}`.trim()
        });
    });
    return items;
}

function toggleWalrusLogList(){
    const list = document.getElementById('walrusLogListInline');
    const btn = document.getElementById('toggleWalrusLogBtn');
    if(!list || !btn) return;
    list.classList.toggle('expanded');
    btn.textContent = list.classList.contains('expanded')
        ? (currentLang === 'ja' ? '現在に戻る' : 'Back to Present')
        : (currentLang === 'ja' ? '記憶を辿る' : 'Trace Memories');
}

function renderWalrusLogInline(){
    const wrap = document.getElementById('walrusLogInlineMount');
    if(!wrap) return;
    const items = getWalrusLogItems();
    if(!items.length){
        wrap.innerHTML = `<div class="walrus-log-container"><div class="walrus-log-header"><div class="walrus-log-title">${currentLang === 'ja' ? '記憶の潮跡' : 'Memory Wake'}</div><div class="walrus-log-sub">${currentLang === 'ja' ? 'ここに残るのは、Walrus が拾ってきた記憶たち。' : 'These are the memories your Walrus has gathered.'}</div></div><div class="walrus-log-empty">${currentLang === 'ja' ? 'まだ辿れる記憶はありません。' : 'There are no memories to trace yet.'}</div></div>`;
        return;
    }
    wrap.innerHTML = `
        <div class="walrus-log-container">
            <div class="walrus-log-header">
                <div class="walrus-log-title">${currentLang === 'ja' ? '記憶の潮跡' : 'Memory Wake'}</div>
                <div class="walrus-log-sub">${currentLang === 'ja' ? 'ここに残るのは、Walrus が拾ってきた記憶たち。' : 'These are the memories your Walrus has gathered.'}</div>
            </div>
            <div class="walrus-log-list-inline" id="walrusLogListInline">
                ${items.map(item => `<div class="walrus-log-item"><div class="walrus-log-kicker">${item.kicker}</div><div class="walrus-log-copy">${escapeHtml(item.text)}</div></div>`).join('')}
            </div>
            ${items.length > 5 ? `<button class="toggle-log" id="toggleWalrusLogBtn" type="button" onclick="toggleWalrusLogList()">${currentLang === 'ja' ? '記憶を辿る' : 'Trace Memories'}</button>` : ''}
        </div>`;
}

function renderProfileDeckSurface(){
    const mount = document.getElementById('profileDeckMount');
    if(!mount) return;
    const copy = getProfileEditorCopy();
    const isFirstSetup = !hasProfileDeckSetup();
    if(isFirstSetup){
        mount.innerHTML = `<div class="intro-card"><div class="section-caption">${copy.firstSetup}</div><div id="profileDeckInlineEditor"></div></div>`;
        hydrateProfileDeckEditor('profileDeckInlineEditor');
        renderSec1HeaderAction();
        return;
    }
    mount.innerHTML = ``;
    renderSec1HeaderAction();
    renderIntroPreview();
}

function renderProfilePresence(profile = getProfileDeckData()){
    const about = document.getElementById('profileAboutNote');
    const pills = document.getElementById('profileSocialPills');
    const copy = getProfileEditorCopy();
    if(about) about.textContent = profile.about || copy.previewEmpty;
    if(pills){
        const links = [
            profile.socials.x ? { label: getXProfileHandleLabel(profile.socials.x), href: profile.socials.x } : null,
            profile.socials.instagram ? { label: '📷 Instagram', href: profile.socials.instagram } : null,
            profile.socials.note ? { label: '📝 Note', href: profile.socials.note } : null
        ].filter(Boolean);
        pills.innerHTML = links.map(item => `<a class="social-pill" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`).join('');
    }
}

function syncProfileDeckDraft(){
    const profile = getProfileDeckData(collectProfileDeckDraft());
    const aboutInput = document.getElementById('profileAboutInput');
    const aboutCount = document.getElementById('profileAboutCount');
    if(aboutInput && aboutCount){
        if(aboutInput.value.length > 280) aboutInput.value = aboutInput.value.slice(0, 280);
        aboutCount.textContent = `${aboutInput.value.length} / 280`;
    }
    [0, 1, 2].forEach(index => {
        const title = document.getElementById(`profileCardTitle${index}`);
        const meta = document.getElementById(`profileCardMeta${index}`);
        if(title && title.value.length > 60) title.value = title.value.slice(0, 60);
        if(meta && meta.value.length > 60) meta.value = meta.value.slice(0, 60);
    });
    initPortfolioCards(profile);
    renderProfilePresence(profile);
}

function hydrateProfileDeckEditor(targetId = 'profileDeckInlineEditor'){
    const mount = document.getElementById(targetId);
    if(!mount) return;
    const profile = getProfileDeckData();
    const copy = getProfileEditorCopy();
    const showStatus = targetId === 'profileDeckInlineEditor';
    const modalTitle = document.getElementById('profileDeckModalTitle');
    if(modalTitle) modalTitle.textContent = copy.modalTitle;
    mount.innerHTML = `
        <div class="profile-editor-grid">
            <label class="intro-label" for="introInput">${currentLang === 'ja' ? 'あなたの自己紹介' : 'Introduce yourself'}</label>
            <textarea class="intro-textarea" id="introInput" maxlength="420" placeholder="${escapeHtml(currentLang === 'ja' ? 'Sui や Walrus で遊んでいること、作っているもの、好きなことを書いてね…' : 'Tell us what you build, what you like, or what you do around Sui / Walrus…')}" oninput="syncUserIntroDraft(); syncProfileDeckDraft()">${escapeHtml(G?.userIntro || '')}</textarea>
            <div class="intro-meta"><span id="introHelp">${currentLang === 'ja' ? 'Lv.2で解放。ここに書いた内容をWalrusに刻めます。' : 'Unlocked at Lv.2. You can etch this intro into Walrus.'}</span><span id="introCount">0 / 420</span></div>
            <label class="intro-label" for="profileAboutInput">${copy.aboutLabel}</label>
            <textarea class="intro-textarea profile-about-textarea" id="profileAboutInput" maxlength="280" placeholder="${escapeHtml(copy.aboutPlaceholder)}" oninput="syncProfileDeckDraft()">${escapeHtml(profile.about)}</textarea>
            <div class="intro-meta"><span>${copy.aboutLabel}</span><span id="profileAboutCount">0 / 280</span></div>
            <div class="profile-inline-grid">
                <label class="profile-field"><span class="intro-label">${copy.xLabel}</span><input class="intro-input" id="profileLinkX" type="url" value="${escapeHtml(profile.socials.x || '')}" oninput="syncProfileDeckDraft()" /></label>
                <label class="profile-field"><span class="intro-label">${copy.instagramLabel}</span><input class="intro-input" id="profileLinkInstagram" type="url" value="${escapeHtml(profile.socials.instagram || '')}" oninput="syncProfileDeckDraft()" /></label>
                <label class="profile-field"><span class="intro-label">${copy.noteLabel}</span><input class="intro-input" id="profileLinkNote" type="url" value="${escapeHtml(profile.socials.note || '')}" oninput="syncProfileDeckDraft()" /></label>
            </div>
            <div class="section-caption">${copy.linksLabel}</div>
            <div class="profile-card-editors">
                ${profile.cards.map((card, index) => `
                    <div class="profile-card-editor">
                        <div class="profile-card-editor-head"><span class="walrus-project-icon">${card.icon}</span><strong>${index + 1}</strong></div>
                        <label class="profile-field"><span class="intro-label">${copy.cardTitle}</span><input class="intro-input" id="profileCardTitle${index}" type="text" maxlength="60" value="${escapeHtml(card.title)}" oninput="syncProfileDeckDraft()" /></label>
                        <label class="profile-field"><span class="intro-label">${copy.cardMeta}</span><input class="intro-input" id="profileCardMeta${index}" type="text" maxlength="60" value="${escapeHtml(card.meta)}" oninput="syncProfileDeckDraft()" /></label>
                    </div>`).join('')}
            </div>
            <div class="intro-actions">
                <button class="intro-btn" id="profileDeckSaveBtn" type="button" onclick="saveProfileDeckDraft()">${copy.saveLocal}</button>
                <button class="intro-btn alt" id="profileDeckWalrusBtn" type="button" onclick="saveProfileDeckToWalrus()">${copy.saveWalrus}</button>
            </div>
            ${showStatus ? '<div class="intro-status" id="introStatus"></div><div class="intro-status" id="profileDeckStatus"></div>' : ''}
        </div>`;
    if(showStatus) hydrateUserIntroEditor();
    syncProfileDeckDraft();
    if(showStatus) renderProfileDeckStatus();
}

function saveProfileDeckDraft(){
    const copy = getProfileEditorCopy();
    const modalOpen = document.getElementById('profileDeckModal')?.style.display === 'flex';
    G.userIntro = (document.getElementById('introInput')?.value || '').trim().slice(0, 420);
    G.userIntroSavedAt = Date.now();
    G.profileDeck = collectProfileDeckDraft();
    G.profileDeckSavedAt = Date.now();
    saveG();
    renderProfileDeckSurface();
    if(modalOpen){
        closeProfileDeckModal();
    }
    setMsg(copy.savedLocal);
    showToast(copy.savedLocal);
}

function initPortfolioCards(profileOverride){
    const container = document.querySelector('#sec1 .walrus-projects');
    if(!container) return;
    const cards = Array.from(container.querySelectorAll('.walrus-project-card'));
    if(!cards.length) return;
    const profile = profileOverride && Array.isArray(profileOverride.cards) ? profileOverride : getProfileDeckData();
    const config = profile.cards;
    cards.forEach((card, index) => {
        const item = config[index] || config[0];
        card.dataset.projectId = item.id;
        card.dataset.speech = item.speech || '';
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
        const icon = card.querySelector('.walrus-project-icon');
        const title = card.querySelector('.walrus-project-title');
        const meta = card.querySelector('.walrus-project-meta');
        if(icon) icon.textContent = item.icon || '🫧';
        if(title) title.textContent = item.title || '';
        if(meta) meta.textContent = item.meta || '';
        card.querySelector('.walrus-rating-wrap')?.remove();
        card.querySelector('.portfolio-blob-controls')?.remove();
    });
    let discovery = container.previousElementSibling;
    if(!discovery || !discovery.classList.contains('walrus-project-discovery')){
        discovery = document.createElement('div');
        discovery.className = 'walrus-project-discovery';
        container.parentNode.insertBefore(discovery, container);
    }
    discovery.innerHTML = `<span class="walrus-discovery-pill">↕ ${t('portfolio_discovery_drag')}</span>`;
    applyPortfolioOrder(container);
    renderProfilePresence(profile);
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
    G.behavior = normalizeBehaviorState?.(G.behavior);
    if(!LEGEND_COLORS[G.custom.color]) G.custom.color = 'gold';
    if(!LEGEND_ACCESSORIES.includes(G.custom.accessory)) G.custom.accessory = 'none';
    if(!G.legendPath) G.legendPath = '';
    G.legendEvolution = !!G.legendEvolution;
}

function getLegendStatusText(){
    ensureLegendState();
    if(G.legendEvolution) return t('legend_lab_evolved');
    if(G.legendPath === 'custom') return t('legend_lab_custom');
    if(G.behavior?.originPath) return getOriginPathLabel(G.behavior.originPath);
    return t('legend_lab_idle');
}

function renderLegendPreview(){
    const originPath = G.behavior?.originPath || '';
    const previewCopy = originPath ? getOriginPathCopy(originPath) : t('legend_preview_copy');
    const previewColors = ['gold', 'aurora', 'coral'].map(key => {
        const opt = LEGEND_COLORS[key];
        return `<span class="legend-preview-swatch" style="background:${opt.dot}" title="${t('legend_color_' + key)}"></span>`;
    }).join('');
    return `
        <div class="legend-preview">
            <div class="legend-preview-kicker">${t('legend_preview_kicker')}</div>
            <div class="legend-preview-copy">${previewCopy}</div>
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
            <div class="legend-lab-note">${G.behavior?.originPath ? getOriginPathCopy(G.behavior.originPath) : t('legend_lab_note')}</div>
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
    if(!G.legendEvolution && G.legendPath !== 'custom'){
        const originPath = G.behavior?.originPath || ensureOriginPath?.();
        if(originPath === 'feral'){
            return { body:'#6C7B57', belly:'#A7B28B', accent:'#C7D96A', accessory:'scarf', evolved:false };
        }
        if(originPath === 'shadow'){
            return { body:'#4F4B86', belly:'#96A2D9', accent:'#7FD4FF', accessory:'halo', evolved:false };
        }
        if(originPath === 'clingy'){
            return { body:'#C96F8D', belly:'#FFD1DE', accent:'#FF8FBF', accessory:'pearl', evolved:false };
        }
    }
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

