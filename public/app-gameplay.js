// Split from app.js: state and gameplay loops

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
    userIntro: '',
    userIntroBlobId: '',
    userIntroSavedAt: 0,
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
    state.userIntro = typeof state.userIntro === 'string' ? state.userIntro.slice(0, 420) : '';
    state.userIntroBlobId = typeof state.userIntroBlobId === 'string' ? state.userIntroBlobId : '';
    state.userIntroSavedAt = Number(state.userIntroSavedAt) || 0;
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
            : (G.lv===2
                ? (currentLang === 'ja' ? '✨ Lv.2解放！ きみの自己紹介を教えてね。' : '✨ Lv.2 unlocked! Tell your Walrus about yourself.')
                : (currentLang === 'ja' ? `✨ レベルアップ！ Lv.${G.lv} · ${getLvName(G.lv)} になったよ！` : `Level up! Lv.${G.lv} ${getLvName(G.lv)}`)));
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
        if(G.lv === 2){
            setTimeout(() => {
                showToast(currentLang === 'ja' ? 'Lv.2で自己紹介が書けるようになったよ' : 'Lv.2 unlocked your intro card');
                hydrateUserIntroEditor();
            }, 700);
        }
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
        setTimeout(triggerSakuraPetal, isThermalConstrainedDevice() ? 2600 : 1800);
    }
    const eventDelay = isThermalConstrainedDevice() ? 120000 + Math.random() * 60000 : 60000 + Math.random() * 45000;
    eventInterval = setInterval(() => {
        if (isSakuraEventActive() && !G.sakuraPink && Math.random() < 0.72) {
            triggerSakuraPetal();
            return;
        }
        if (Math.random() < 0.35) triggerGoldenFish();
    }, eventDelay);
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

