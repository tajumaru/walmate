// Split from app.js: state and gameplay loops

/* ===== STATE ===== */
const DECAY_PER_MIN = { hunger: 1.8, happy: 1.2 };
const COOLDOWNS = { feed: 8000, pet: 5000, play: 12000 };
const GAME_STORAGE_KEY = 'walrus_taju4';
const WALMATE_LAST_DAILY_EVENT_DATE_KEY = 'walmate_last_daily_event_date';
const WALMATE_LAST_DAILY_EVENT_ID_KEY = 'walmate_last_daily_event_id';
const WALMATE_MESSAGE_LOG_KEY = 'walmate_message_logs';
const WALMATE_STORY_STAGE_KEY = 'walmate_story_stage';
const SAKURA_PETALS_REQUIRED = 5;

function createDefaultDailyState(dateKey = '1970-01-01'){
    return {
        dateKey,
        lastLoginDate: '',
        streak: 0,
        shownDateKey: '',
        eventId: '',
        choiceId: '',
        limitedSoundId: '',
        limitedSoundCollected: false,
        weather: 'clear',
        weatherSource: 'seed',
        weatherSyncAt: 0,
        timeBand: 'day',
        weekday: 0,
        isFullMoon: false,
        anomalySlotId: '',
        anomalySlotConsumed: false
    };
}

function normalizeDailyState(daily){
    const base = createDefaultDailyState();
    const next = (daily && typeof daily === 'object') ? daily : {};
    base.dateKey = typeof next.dateKey === 'string' ? next.dateKey : base.dateKey;
    base.lastLoginDate = typeof next.lastLoginDate === 'string' ? next.lastLoginDate : '';
    base.streak = Math.max(0, Number(next.streak) || 0);
    base.shownDateKey = typeof next.shownDateKey === 'string' ? next.shownDateKey : '';
    base.eventId = typeof next.eventId === 'string' ? next.eventId : '';
    base.choiceId = typeof next.choiceId === 'string' ? next.choiceId : '';
    base.limitedSoundId = typeof next.limitedSoundId === 'string' ? next.limitedSoundId : '';
    base.limitedSoundCollected = !!next.limitedSoundCollected;
    base.weather = next.weather === 'rain' ? 'rain' : 'clear';
    base.weatherSource = next.weatherSource === 'gps' ? 'gps' : 'seed';
    base.weatherSyncAt = Number(next.weatherSyncAt) || 0;
    base.timeBand = ['dawn', 'day', 'night'].includes(next.timeBand) ? next.timeBand : 'day';
    base.weekday = Math.max(0, Math.min(6, Number(next.weekday) || 0));
    base.isFullMoon = !!next.isFullMoon;
    base.anomalySlotId = typeof next.anomalySlotId === 'string' ? next.anomalySlotId : '';
    base.anomalySlotConsumed = !!next.anomalySlotConsumed;
    return base;
}

function createDefaultIdleEventState(){
    return {
        id: '',
        dateKey: '',
        variant: '',
        weather: 'clear',
        timeBand: 'day',
        announced: false,
        triggeredAt: 0
    };
}

function normalizeIdleEventState(idleEvent){
    const base = createDefaultIdleEventState();
    const next = (idleEvent && typeof idleEvent === 'object') ? idleEvent : {};
    base.id = typeof next.id === 'string' ? next.id : '';
    base.dateKey = typeof next.dateKey === 'string' ? next.dateKey : '';
    base.variant = ['dawn', 'day', 'night', 'rain'].includes(next.variant) ? next.variant : '';
    base.weather = next.weather === 'rain' ? 'rain' : 'clear';
    base.timeBand = ['dawn', 'day', 'night'].includes(next.timeBand) ? next.timeBand : 'day';
    base.announced = !!next.announced;
    base.triggeredAt = Number(next.triggeredAt) || 0;
    return base;
}

function createDefaultBehaviorState(){
    return {
        feedCount: 0,
        petCount: 0,
        playCount: 0,
        tapCount: 0,
        walkSessions: 0,
        longAwayCount: 0,
        neglectMinutes: 0,
        missedLoginDays: 0,
        originPath: ''
    };
}

function createDefaultAnomalyState(){
    return {
        unlockedAt: 0,
        lastEscapeAt: 0,
        resonanceUntil: 0,
        hueShift: 0,
        mutationSeen: false,
        lastAudioSeed: '',
        lastActionAt: { offer: 0, sync: 0, drift: 0 },
        logBook: []
    };
}

function createDefaultWalrusDexState(){
    return {
        unlockedIds: [],
        lastDailyUnlockDate: '',
        lastUnlockedId: '',
        pendingDiscoveryId: '',
        discoveryHistory: [],
        entries: {}
    };
}

function createDefaultWalrusDexEntryLog(){
    return {
        unlocked: false,
        firstObservedAt: 0,
        lastPlayedAt: 0,
        playCount: 0,
        stateText: '',
        status: 'quiet'
    };
}

function normalizeBehaviorState(behavior){
    const base = createDefaultBehaviorState();
    const next = (behavior && typeof behavior === 'object') ? behavior : {};
    base.feedCount = Math.max(0, Number(next.feedCount) || 0);
    base.petCount = Math.max(0, Number(next.petCount) || 0);
    base.playCount = Math.max(0, Number(next.playCount) || 0);
    base.tapCount = Math.max(0, Number(next.tapCount) || 0);
    base.walkSessions = Math.max(0, Number(next.walkSessions) || 0);
    base.longAwayCount = Math.max(0, Number(next.longAwayCount) || 0);
    base.neglectMinutes = Math.max(0, Number(next.neglectMinutes) || 0);
    base.missedLoginDays = Math.max(0, Number(next.missedLoginDays) || 0);
    base.originPath = ['feral', 'shadow', 'clingy', 'balanced'].includes(next.originPath) ? next.originPath : '';
    return base;
}

function normalizeAnomalyState(anomaly){
    const base = createDefaultAnomalyState();
    const next = (anomaly && typeof anomaly === 'object') ? anomaly : {};
    base.unlockedAt = Math.max(0, Number(next.unlockedAt) || 0);
    base.lastEscapeAt = Math.max(0, Number(next.lastEscapeAt) || 0);
    base.resonanceUntil = Math.max(0, Number(next.resonanceUntil) || 0);
    base.hueShift = Math.max(-120, Math.min(120, Number(next.hueShift) || 0));
    base.mutationSeen = !!next.mutationSeen;
    base.lastAudioSeed = typeof next.lastAudioSeed === 'string' ? next.lastAudioSeed.slice(0, 64) : '';
    const lastActionAt = (next.lastActionAt && typeof next.lastActionAt === 'object') ? next.lastActionAt : {};
    base.lastActionAt = {
        offer: Math.max(0, Number(lastActionAt.offer) || 0),
        sync: Math.max(0, Number(lastActionAt.sync) || 0),
        drift: Math.max(0, Number(lastActionAt.drift) || 0)
    };
    base.logBook = Array.isArray(next.logBook)
        ? next.logBook
            .filter(entry => entry && typeof entry === 'object')
            .slice(0, 120)
            .map(entry => ({
                id: typeof entry.id === 'string' ? entry.id : `anomaly:${Date.now()}`,
                ts: Math.max(0, Number(entry.ts) || Date.now()),
                type: typeof entry.type === 'string' ? entry.type : 'anomaly',
                tier: typeof entry.tier === 'string' ? entry.tier : 'odd',
                textJa: typeof entry.textJa === 'string' ? entry.textJa : '',
                textEn: typeof entry.textEn === 'string' ? entry.textEn : '',
                dateKey: typeof entry.dateKey === 'string' ? entry.dateKey : getLocalDateKey()
            }))
        : [];
    return base;
}

function normalizeWalrusDexState(dex){
    const base = createDefaultWalrusDexState();
    const next = (dex && typeof dex === 'object') ? dex : {};
    const unlockedIds = Array.isArray(next.unlockedIds) ? next.unlockedIds : [];
    const discoveryHistory = Array.isArray(next.discoveryHistory) ? next.discoveryHistory : [];
    const rawEntries = (next.entries && typeof next.entries === 'object') ? next.entries : {};
    base.unlockedIds = Array.from(new Set(
        unlockedIds
            .filter(id => typeof id === 'string')
            .map(id => id.trim())
            .filter(Boolean)
    )).slice(0, 64);
    base.lastDailyUnlockDate = typeof next.lastDailyUnlockDate === 'string' ? next.lastDailyUnlockDate : '';
    base.lastUnlockedId = typeof next.lastUnlockedId === 'string' ? next.lastUnlockedId : '';
    base.pendingDiscoveryId = typeof next.pendingDiscoveryId === 'string' ? next.pendingDiscoveryId : '';
    base.discoveryHistory = discoveryHistory
        .filter(entry => entry && typeof entry === 'object')
        .slice(0, 30)
        .map(entry => ({
            id: typeof entry.id === 'string' ? entry.id : '',
            dateKey: typeof entry.dateKey === 'string' ? entry.dateKey : '',
            ts: Math.max(0, Number(entry.ts) || 0)
        }))
        .filter(entry => entry.id);
    base.entries = {};
    Object.keys(rawEntries).slice(0, 128).forEach((id) => {
        const entry = rawEntries[id];
        if(typeof id !== 'string' || !id.trim() || !entry || typeof entry !== 'object') return;
        const normalized = createDefaultWalrusDexEntryLog();
        normalized.unlocked = !!entry.unlocked;
        normalized.firstObservedAt = Math.max(0, Number(entry.firstObservedAt) || 0);
        normalized.lastPlayedAt = Math.max(0, Number(entry.lastPlayedAt) || 0);
        normalized.playCount = Math.max(0, Number(entry.playCount) || 0);
        normalized.stateText = typeof entry.stateText === 'string' ? entry.stateText.slice(0, 80) : '';
        normalized.status = typeof entry.status === 'string' ? entry.status.slice(0, 32) : 'quiet';
        base.entries[id.trim()] = normalized;
    });
    base.unlockedIds.forEach((id) => {
        if(!base.entries[id]) base.entries[id] = createDefaultWalrusDexEntryLog();
        base.entries[id].unlocked = true;
        if(!base.entries[id].firstObservedAt) base.entries[id].firstObservedAt = Date.now();
    });
    return base;
}

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
    profileDeck: null,
    profileDeckBlobId: '',
    profileDeckSavedAt: 0,
    custom: { color: 'gold', accessory: 'none' },
    soundDiet: createEmptySoundDiet('1970-01-01'),
    daily: createDefaultDailyState(),
    idleEvent: createDefaultIdleEventState(),
    behavior: createDefaultBehaviorState(),
    anomaly: createDefaultAnomalyState(),
    walrusDex: createDefaultWalrusDexState()
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
        soundDiet: normalizeSoundDiet(overrides.soundDiet || DEFAULT_GAME_STATE.soundDiet),
        daily: normalizeDailyState(overrides.daily || DEFAULT_GAME_STATE.daily),
        idleEvent: normalizeIdleEventState(overrides.idleEvent || DEFAULT_GAME_STATE.idleEvent),
        behavior: normalizeBehaviorState(overrides.behavior || DEFAULT_GAME_STATE.behavior),
        anomaly: normalizeAnomalyState(overrides.anomaly || DEFAULT_GAME_STATE.anomaly),
        walrusDex: normalizeWalrusDexState(overrides.walrusDex || DEFAULT_GAME_STATE.walrusDex)
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
    state.profileDeck = normalizeProfileDeckState(state.profileDeck);
    state.profileDeckBlobId = typeof state.profileDeckBlobId === 'string' ? state.profileDeckBlobId : '';
    state.profileDeckSavedAt = Number(state.profileDeckSavedAt) || 0;
    state.soundDiet = normalizeSoundDiet(state.soundDiet);
    state.daily = normalizeDailyState(state.daily);
    state.idleEvent = normalizeIdleEventState(state.idleEvent);
    state.behavior = normalizeBehaviorState(state.behavior);
    state.anomaly = normalizeAnomalyState(state.anomaly);
    state.walrusDex = normalizeWalrusDexState(state.walrusDex);
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
    G.behavior = normalizeBehaviorState(G.behavior);
    G.behavior.neglectMinutes += Math.max(0, Math.floor(mins));
    if(mins >= 180) G.behavior.longAwayCount += 1;
    return Math.floor(mins);
}

function ensureBehaviorState(){
    G.behavior = normalizeBehaviorState(G.behavior);
    return G.behavior;
}

function recordBehaviorAction(action, amount = 1){
    const behavior = ensureBehaviorState();
    if(typeof behavior[action] !== 'number') return behavior;
    behavior[action] += amount;
    return behavior;
}

function ensureAnomalyState(){
    G.anomaly = normalizeAnomalyState(G.anomaly);
    return G.anomaly;
}

function isAnomalyModeActive(){
    return Number(G?.lv) >= 4;
}

function isFriendResonanceActive(now = Date.now()){
    return isAnomalyModeActive() && ensureAnomalyState().resonanceUntil > now;
}

function unlockAnomalyMode(){
    const anomaly = ensureAnomalyState();
    if(!anomaly.unlockedAt) anomaly.unlockedAt = Date.now();
    return anomaly;
}

let anomalyEscapeTimer = null;

function scheduleAnomalyEscape(){
    if(!isAnomalyModeActive()){
        clearTimeout(anomalyEscapeTimer);
        anomalyEscapeTimer = null;
        return;
    }
    if(anomalyEscapeTimer) return;
    const delay = 9000 + Math.random() * 22000;
    anomalyEscapeTimer = window.setTimeout(() => {
        anomalyEscapeTimer = null;
        triggerAnomalyEscape();
    }, delay);
}

function triggerAnomalyEscape(){
    if(!isAnomalyModeActive()) return;
    const wrap = document.querySelector('.free-swim-wrap');
    if(!wrap || wrap.classList.contains('anomaly-escaping')){
        scheduleAnomalyEscape();
        return;
    }
    const anomaly = unlockAnomalyMode();
    const points = [
        ['78vw', '8vh'],
        ['72vw', '30vh'],
        ['6vw', '34vh'],
        ['60vw', '12vh']
    ];
    const [x, y] = points[Math.floor(Math.random() * points.length)];
    anomaly.lastEscapeAt = Date.now();
    wrap.style.setProperty('--anomaly-escape-x', x);
    wrap.style.setProperty('--anomaly-escape-y', y);
    wrap.classList.add('anomaly-escaping');
    window.setTimeout(() => {
        wrap.classList.remove('anomaly-escaping');
        wrap.style.removeProperty('--anomaly-escape-x');
        wrap.style.removeProperty('--anomaly-escape-y');
        scheduleAnomalyEscape();
    }, 2600);
}

function garbleAnomalyText(text){
    const src = String(text || '').trim();
    if(!src) return currentLang === 'ja' ? '...受信不能...' : '...signal lost...';
    const patterns = [
        value => value.replace(/[。.!！?？]/g, ' ... '),
        value => value.replace(/Walrus/gi, 'W4LRUS'),
        value => value.replace(/ログ/g, 'log//'),
        value => value.replace(/深海/g, '深//海'),
        value => value.replace(/\s+/g, ' / '),
        value => `${value} // ${currentLang === 'ja' ? 'ノイズ混入' : 'noise bleed'}`
    ];
    const next = patterns[Math.floor(Math.random() * patterns.length)](src);
    return next.slice(0, 160);
}

const ANOMALY_DAILY_SLOT_DEFS = Object.freeze({
    audio_bloom: {
        labelJa: '異常音',
        labelEn: 'Anomalous audio',
        hintJa: '今日は音の輪郭が少しだけ深く沈む',
        hintEn: 'Today the edge of sound sinks a little deeper'
    },
    strange_copy: {
        labelJa: '特殊ログ',
        labelEn: 'Special log',
        hintJa: '今日は短い反応でも違和感が混ざりやすい',
        hintEn: 'Today even small reactions may carry a trace of wrongness'
    },
    ui_shift: {
        labelJa: '微細な揺れ',
        labelEn: 'Micro shift',
        hintJa: '今日は画面の気配がわずかにずれる',
        hintEn: 'Today the screen mood slips slightly out of place'
    },
    rare_echo: {
        labelJa: 'レア残響',
        labelEn: 'Rare echo',
        hintJa: '今日は何かが一度だけ返ってくるかもしれない',
        hintEn: 'Today something may answer back exactly once'
    }
});

const ANOMALY_LOG_POOLS = Object.freeze({
    offer: {
        normal: {
            ja: ['静かに受理された。波紋だけが残った', '供物は沈んだ。返答は薄い', '手応えはないが、記録だけは残っている'],
            en: ['It was accepted quietly. Only the ripple remained', 'The offering sank. The reply stayed thin', 'No clear response, but the record remained']
        },
        odd: {
            ja: ['供物ログの末尾だけが読めない', '差し出したものより、受理音のほうが重かった', '返答はない。だが空白の形だけが残った'],
            en: ['Only the tail of the offering log is unreadable', 'The intake tone felt heavier than the item itself', 'No reply came back, only the shape of an absence']
        },
        anomaly: {
            ja: ['UNKNOWN OFFER // 供物の行き先が途中で反転した', '受理記録の時刻が先に進みすぎている', '誰も見ていない保管庫が一瞬だけ開いた'],
            en: ['UNKNOWN OFFER // the destination inverted halfway through', 'The intake timestamp advanced too far ahead', 'A storage vault that no one watches opened for a beat']
        },
        rare: {
            ja: ['RARE LOG // 供物ではなく、観測者が記録された', '供物の返答欄に、あなたの名前の欠片があった'],
            en: ['RARE LOG // the observer was recorded instead of the offering', 'A fragment of your name appeared in the response field']
        }
    },
    sync: {
        normal: {
            ja: ['周波数が重なった。まだ意味は読めない', '同期は浅く成功した。残響だけ長い', '短い共鳴が続いている'],
            en: ['Your frequencies overlapped. The meaning is still unclear', 'A shallow sync succeeded and left a longer echo', 'A short resonance is still continuing']
        },
        odd: {
            ja: ['共鳴の後ろで別の拍が鳴っていた', 'こちらの波形に、ひとつ余分な縁がある', '同期したはずの音が少し遅れて戻った'],
            en: ['Another pulse sounded behind the resonance', 'Your waveform gained one extra edge', 'The synced sound came back a little late']
        },
        anomaly: {
            ja: ['SYNC TRACE // 波形の外で誰かが歌っている', '共鳴率は上がったが、音源数が合わない', 'ノイズが信号のふりをして混ざった'],
            en: ['SYNC TRACE // something is singing outside the waveform', 'Resonance climbed, but the source count no longer fits', 'Noise joined in while pretending to be signal']
        },
        rare: {
            ja: ['RARE LOG // 共鳴先が友達Walrusではなかった', '波形の奥から、一度だけ別名で呼ばれた'],
            en: ['RARE LOG // the resonance target was not your friend Walrus', 'Something called you by another name from behind the waveform']
        }
    },
    drift: {
        normal: {
            ja: ['小さな漂流ログを持ち帰った', '浅い層で短い記録が拾われた', '泡の裏に短文が残っていた'],
            en: ['A small drift log came back', 'A short record was found in the shallow layer', 'A brief line remained behind the bubbles']
        },
        odd: {
            ja: ['帰還ログに余白が多すぎる', '拾った記録の主語だけが欠けている', '漂流は短かったが、影だけ長く残った'],
            en: ['There is too much blank space in the return log', 'Only the subject is missing from the recovered note', 'The drift was short, but the shadow lingered longer']
        },
        anomaly: {
            ja: ['DRIFT TRACE // 深海ログの座標が途中で濁った', '帰還したが、経路が一部だけ別の日付を指している', '海底の風向きが記録と逆だった'],
            en: ['DRIFT TRACE // the abyss coordinates blurred halfway through', 'It returned, but part of the route points to another date', 'The seabed current ran opposite to the record']
        },
        rare: {
            ja: ['RARE LOG // 帰還地点より先の記録が先に届いた', '深海の底で、まだ起きていない変異が記録されていた'],
            en: ['RARE LOG // a record from beyond the return point arrived first', 'A mutation that has not happened yet was logged at the abyss floor']
        }
    }
});

function getAnomalyDailySlotDef(slotId = G?.daily?.anomalySlotId){
    return ANOMALY_DAILY_SLOT_DEFS[slotId] || null;
}

function pickDailyAnomalySlot(context){
    const ids = Object.keys(ANOMALY_DAILY_SLOT_DEFS);
    const rng = createSeededRandom(`anomaly-slot:${context.dateKey}:${context.timeBand}:${context.weather}:${G.lv}`);
    return ids[Math.floor(rng() * ids.length)] || 'strange_copy';
}

function markDailyAnomalySlotConsumed(){
    ensureDailyState();
    if(!G.daily.anomalySlotId || G.daily.anomalySlotConsumed) return false;
    G.daily.anomalySlotConsumed = true;
    return true;
}

function getAnomalyDailyUiClass(){
    if(!isAnomalyModeActive()) return '';
    const slotId = G?.daily?.anomalySlotId || '';
    if(slotId === 'ui_shift') return 'daily-anomaly-ui';
    if(slotId === 'audio_bloom') return 'daily-anomaly-audio';
    return '';
}

function getDriftElapsedTier(now = Date.now()){
    const last = ensureAnomalyState().lastActionAt?.drift || 0;
    if(!last) return 'short';
    const elapsed = now - last;
    if(elapsed >= 3 * 60 * 60 * 1000) return 'long';
    if(elapsed >= 20 * 60 * 1000) return 'mid';
    return 'short';
}

function pickAnomalyTier(type, context = {}){
    const roll = Math.random();
    let tier = roll < 0.01 ? 'rare' : roll < 0.05 ? 'anomaly' : roll < 0.20 ? 'odd' : 'normal';
    if(type === 'drift'){
        const driftTier = context.driftElapsedTier || 'short';
        if(driftTier === 'mid' && tier === 'normal' && Math.random() < 0.64) tier = 'odd';
        if(driftTier === 'long'){
            if(tier === 'normal') tier = 'anomaly';
            else if(tier === 'odd' && Math.random() < 0.55) tier = 'anomaly';
            else if(tier === 'anomaly' && Math.random() < 0.16) tier = 'rare';
        }
    }
    if(G?.daily?.anomalySlotId === 'rare_echo' && !G?.daily?.anomalySlotConsumed && tier !== 'rare' && Math.random() < 0.22){
        tier = 'rare';
    }
    if(G?.daily?.anomalySlotId === 'strange_copy' && !G?.daily?.anomalySlotConsumed && tier === 'normal' && Math.random() < 0.6){
        tier = 'odd';
    }
    return tier;
}

function registerAnomalyLog(textJa, textEn, type = 'anomaly', tier = 'odd'){
    const anomaly = ensureAnomalyState();
    const entry = {
        id: `${type}:${tier}:${Date.now()}`,
        ts: Date.now(),
        type,
        tier,
        textJa,
        textEn,
        dateKey: getLocalDateKey()
    };
    anomaly.logBook.unshift(entry);
    if(anomaly.logBook.length > 120) anomaly.logBook.length = 120;
    return entry;
}

function getAnomalyLogBook(){
    return ensureAnomalyState().logBook.slice();
}

function recordMissedLoginDays(days = 0){
    if(days <= 0) return ensureBehaviorState();
    const behavior = ensureBehaviorState();
    behavior.missedLoginDays += days;
    return behavior;
}

function determineOriginPath(){
    const behavior = ensureBehaviorState();
    const careScore = behavior.feedCount + behavior.petCount + behavior.playCount + Math.floor(behavior.tapCount / 3);
    const walkSessions = behavior.walkSessions;
    if((behavior.neglectMinutes >= 360 || behavior.longAwayCount >= 2) && walkSessions <= 1){
        return 'feral';
    }
    if(behavior.missedLoginDays >= 4 && G.daily?.streak <= 1){
        return 'shadow';
    }
    if(careScore >= 40 && walkSessions <= 2){
        return 'clingy';
    }
    return 'balanced';
}

function ensureOriginPath(){
    const behavior = ensureBehaviorState();
    if(!behavior.originPath) behavior.originPath = determineOriginPath();
    return behavior.originPath;
}

const IDLE_RANDOM_EVENT_MIN_AWAY_MINS = 20;
const IDLE_RANDOM_EVENT_CHANCE = 0.01;

function clearIdleRandomEvent(){
    G.idleEvent = createDefaultIdleEventState();
    return G.idleEvent;
}

function getActiveIdleRandomEvent(){
    const idleEvent = normalizeIdleEventState(G.idleEvent);
    if(!idleEvent.id) return null;
    if(idleEvent.dateKey !== getLocalDateKey()){
        clearIdleRandomEvent();
        return null;
    }
    return idleEvent;
}

function rollIdleRandomEvent(awayMins = 0){
    const idleEvent = getActiveIdleRandomEvent();
    if(idleEvent) return idleEvent;
    if(awayMins < IDLE_RANDOM_EVENT_MIN_AWAY_MINS) return null;

    const daily = G.daily || createDefaultDailyState(getLocalDateKey());
    if(Math.random() >= IDLE_RANDOM_EVENT_CHANCE){
        clearIdleRandomEvent();
        return null;
    }

    const variant = daily.weather === 'rain'
        ? 'rain'
        : daily.timeBand === 'night'
            ? 'night'
            : daily.timeBand === 'dawn'
                ? 'dawn'
                : 'day';
    G.idleEvent = normalizeIdleEventState({
        id: 'mystery_walrus',
        dateKey: daily.dateKey || getLocalDateKey(),
        variant,
        weather: daily.weather,
        timeBand: daily.timeBand,
        announced: false,
        triggeredAt: Date.now()
    });
    G.happy = Math.min(100, G.happy + 6);
    return G.idleEvent;
}

function getLocalDateKey(date = new Date()){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey){
    if(typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function getDateKeyDiff(fromKey, toKey){
    const from = parseLocalDateKey(fromKey);
    const to = parseLocalDateKey(toKey);
    if(!from || !to) return 0;
    return Math.round((to.getTime() - from.getTime()) / 86400000);
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
    if(G.lv === 4) cls += ' legend-pet anomaly-pet';
    if(expression === 'full') cls += ' full';
    if(expression === 'ecstatic') cls += ' ecstatic';
    if(isFriendResonanceActive()) cls += ' resonance-pet';
    return cls;
}

// Update tama device visual state
function updateTamaDevice(){
    const dev = document.getElementById('tamaDevice');
    if(!dev) return;
    dev.classList.toggle('legend-device', G.lv >= 4);
    dev.classList.toggle('anomaly-mode', isAnomalyModeActive());
    dev.classList.toggle('friend-resonance', isFriendResonanceActive());
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

const ACTION_CARD_DEFS = Object.freeze([
    {
        key: 'offer',
        buttonId: 'btnFeed',
        titleId: 'btnFeedLabel',
        verbId: 'btnFeedVerb',
        hintId: 'btnFeedHint',
        lowThreshold: 42,
        urgentThreshold: 24,
        copy: {
            ja: {
                defaultTitle: 'OFFER',
                needyTitle: 'OFFER',
                verb: 'OFFER',
                defaultHint: '魚・貝・Blob をそっと差し出す',
                recommendedHint: '今日はおそなえが受け入れられやすい',
                success: '静かに受け取った'
            },
            en: {
                defaultTitle: 'OFFER',
                needyTitle: 'OFFER',
                verb: 'OFFER',
                defaultHint: 'Present fish, shells, or a strange Blob',
                recommendedHint: 'An offering should land well right now',
                success: 'It accepted the offering'
            }
        }
    },
    {
        key: 'sync',
        buttonId: 'btnPet',
        titleId: 'btnPetLabel',
        verbId: 'btnPetVerb',
        hintId: 'btnPetHint',
        lowThreshold: 45,
        urgentThreshold: 28,
        copy: {
            ja: {
                defaultTitle: 'SYNC',
                needyTitle: 'SYNC',
                verb: 'SYNC',
                defaultHint: '波形を合わせて共鳴を探る',
                recommendedHint: 'いまは同期すると信号が安定しそう',
                success: '周波数が重なった'
            },
            en: {
                defaultTitle: 'SYNC',
                needyTitle: 'SYNC',
                verb: 'SYNC',
                defaultHint: 'Align your signal and listen for resonance',
                recommendedHint: 'Syncing should stabilize the signal now',
                success: 'Your frequencies overlapped'
            }
        }
    },
    {
        key: 'drift',
        buttonId: 'btnPlay',
        titleId: 'btnPlayLabel',
        verbId: 'btnPlayVerb',
        hintId: 'btnPlayHint',
        lowThreshold: 40,
        urgentThreshold: 20,
        copy: {
            ja: {
                defaultTitle: 'DRIFT',
                needyTitle: 'DRIFT',
                verb: 'DRIFT',
                defaultHint: 'ふわりと漂って深海ログを拾う',
                recommendedHint: 'いまは漂流で記憶が集まりやすい',
                success: '漂流ログを持ち帰った'
            },
            en: {
                defaultTitle: 'DRIFT',
                needyTitle: 'DRIFT',
                verb: 'DRIFT',
                defaultHint: 'Let it glide and collect deep-sea logs',
                recommendedHint: 'Drifting should gather memory traces now',
                success: 'It returned with a drift log'
            }
        }
    }
]);

function getActionCardCopy(def){
    return currentLang === 'ja' ? def.copy.ja : def.copy.en;
}

function getWalrusTimeBand(){
    return G?.daily?.timeBand || 'day';
}

function pickRandom(list){
    return list[Math.floor(Math.random() * list.length)];
}

function renderActionTitle(key){
    const jp = key === 'offer' ? 'おそなえ' : key === 'sync' ? 'シンク' : '漂流';
    const en = key.toUpperCase();
    return `<span class="act-en">${en}</span><span class="act-jp">${jp}</span>`;
}

const ACTION_RITUAL_STATE = {
    lastType: '',
    streak: 0,
    history: []
};

function getActionRitualState(type){
    const history = Array.isArray(ACTION_RITUAL_STATE.history) ? ACTION_RITUAL_STATE.history : [];
    const lastType = ACTION_RITUAL_STATE.lastType || '';
    const streak = lastType === type ? Math.max(0, Number(ACTION_RITUAL_STATE.streak) || 0) : 0;
    return {
        lastType,
        streak,
        history: history.slice(0, 6)
    };
}

function commitActionRitualState(type){
    const nextStreak = ACTION_RITUAL_STATE.lastType === type
        ? (Math.max(0, Number(ACTION_RITUAL_STATE.streak) || 0) + 1)
        : 1;
    ACTION_RITUAL_STATE.lastType = type;
    ACTION_RITUAL_STATE.streak = nextStreak;
    ACTION_RITUAL_STATE.history.unshift({ type, ts: Date.now() });
    if(ACTION_RITUAL_STATE.history.length > 8) ACTION_RITUAL_STATE.history.length = 8;
    return nextStreak;
}

function getActionRepeatPenalty(streak = 0){
    if(streak <= 1) return 0;
    return Math.min(0.38, (streak - 1) * 0.08);
}

function getActionRitualContext(type, now = Date.now()){
    ensureDailyState();
    const ritual = getActionRitualState(type);
    const soundInsight = typeof getSoundDietInsight === 'function' ? getSoundDietInsight() : null;
    const soundTotal = Math.max(0, Number(soundInsight?.diet?.total) || 0);
    const soundStarved = typeof isSoundStarved === 'function' ? !!isSoundStarved(now) : false;
    return {
        type,
        now,
        lastType: ritual.lastType,
        repeatCount: ritual.streak,
        repeatPenalty: getActionRepeatPenalty(ritual.streak),
        timeBand: getWalrusTimeBand(),
        weather: G?.daily?.weather || 'clear',
        anomalySlotId: G?.daily?.anomalySlotId || '',
        anomalyActive: isAnomalyModeActive(),
        soundStarved,
        soundTotal,
        favoriteSound: soundInsight?.favoriteLabel || '',
        friendResonance: isFriendResonanceActive(now),
        hunger: Math.max(0, Number(G.hunger) || 0),
        happy: Math.max(0, Number(G.happy) || 0)
    };
}

function appendActionLine(text, addition){
    const base = String(text || '').trim();
    const suffix = String(addition || '').trim();
    if(!suffix) return base;
    return base ? `${base}。${suffix}` : suffix;
}

function getActionRejectionOutcome(type, context, baseOutcome){
    const copy = {
        offer: {
            ja: '供物は沈んだが、今日は深く受理されなかった',
            en: 'The offering sank, but today it was not fully accepted'
        },
        sync: {
            ja: '同期を試したが、拍だけが少し離れた',
            en: 'You tried to sync, but the beat slipped away'
        },
        drift: {
            ja: '漂流に出たが、すぐ浅い層へ押し戻された',
            en: 'It drifted out, then was pushed back to the shallow layer'
        }
    }[type];
    return {
        ...baseOutcome,
        textJa: copy?.ja || baseOutcome.textJa,
        textEn: copy?.en || baseOutcome.textEn,
        rejected: true,
        special: true,
        logTier: 'odd',
        delta: type === 'offer'
            ? { hunger: 4, happy: 0, exp: 2 }
            : type === 'sync'
                ? { hunger: 0, happy: 3, exp: 3 }
                : { hunger: -1, happy: 1, exp: 6 },
        reactionNoteJa: context.repeatCount >= 3 ? '同じ信号が続きすぎている。' : '今日は少し気分がずれている。',
        reactionNoteEn: context.repeatCount >= 3 ? 'The same signal has repeated too many times.' : 'Its mood is drifting slightly out of phase.'
    };
}

function buildRitualActionOutcome(type, baseOutcome, context){
    const outcome = {
        ...baseOutcome,
        delta: type === 'offer'
            ? { hunger: 12, happy: 3, exp: 7 }
            : type === 'sync'
                ? { hunger: 0, happy: 12, exp: 9 }
                : { hunger: -3, happy: 4, exp: 15 },
        logTier: baseOutcome.secret ? 'rare' : baseOutcome.special ? 'odd' : 'normal',
        supplyLog: false,
        responseSuppressed: false,
        uiShift: false,
        ritualFx: type,
        anomalyPulse: false
    };

    if(outcome.special){
        if(type === 'offer') outcome.delta.exp += 4;
        if(type === 'sync') outcome.delta.happy += 3;
        if(type === 'drift') outcome.delta.exp += 5;
    }
    if(outcome.secret){
        outcome.delta.exp += type === 'drift' ? 12 : 9;
        if(type !== 'drift') outcome.delta.happy += 4;
    }

    if(context.repeatPenalty > 0){
        const scale = Math.max(0.58, 1 - context.repeatPenalty);
        outcome.delta.hunger = Math.round(outcome.delta.hunger * scale);
        outcome.delta.happy = Math.round(outcome.delta.happy * scale);
        outcome.delta.exp = Math.round(outcome.delta.exp * scale);
    }

    if(type === 'offer'){
        if(context.hunger >= 88){
            outcome.delta.hunger = Math.max(3, Math.round(outcome.delta.hunger * 0.35));
            outcome.delta.happy = Math.max(0, Math.round(outcome.delta.happy * 0.5));
            outcome.textJa = appendActionLine(outcome.textJa, 'もう満ちていて、供物はゆっくり沈んだ');
            outcome.textEn = `${outcome.textEn}. It is already full, so the offering sank slowly`;
        } else if(context.hunger <= 26){
            outcome.delta.hunger += 5;
            outcome.delta.exp += 2;
        }
        if(Math.random() < 0.11){
            outcome.supplyLog = true;
            outcome.special = true;
            outcome.logTier = 'odd';
            outcome.textJa = appendActionLine(outcome.textJa, '供物ログが一行だけ残った');
            outcome.textEn = `${outcome.textEn}. A one-line offering log remained`;
        }
        if(context.anomalyActive && Math.random() < 0.14){
            outcome.responseSuppressed = true;
            outcome.textJa = '供物は沈んだ。返事はなかった。';
            outcome.textEn = 'The offering sank. No answer came back.';
            outcome.logTier = 'anomaly';
        }
    } else if(type === 'sync'){
        if(context.timeBand === 'dawn'){
            outcome.delta.happy += 3;
            outcome.textJa = appendActionLine(outcome.textJa, '夜明けの拍がやわらかく重なった');
            outcome.textEn = `${outcome.textEn}. Dawn let the rhythm overlap more softly`;
        } else if(context.timeBand === 'night'){
            outcome.delta.exp += 3;
            outcome.textJa = appendActionLine(outcome.textJa, '夜の層で、同期が少し深く沈んだ');
            outcome.textEn = `${outcome.textEn}. The night layer pulled the sync a little deeper`;
        }
        if(context.soundTotal <= 1){
            outcome.delta.happy = Math.max(4, outcome.delta.happy - 3);
            outcome.textJa = appendActionLine(outcome.textJa, 'まだ音の記憶が薄く、共鳴は浅い');
            outcome.textEn = `${outcome.textEn}. The sound memory is still thin, so the resonance stayed shallow`;
        }
        if(context.soundStarved){
            outcome.delta.happy = Math.max(2, Math.round(outcome.delta.happy * 0.45));
            outcome.textJa = '同期音が一拍だけ遅れた。';
            outcome.textEn = 'The sync tone lagged behind by one beat.';
            outcome.logTier = context.anomalyActive ? 'anomaly' : 'odd';
            registerAnomalyLog(
                '同期音が一拍だけ遅れた。',
                'The sync tone lagged behind by one beat.',
                'sync',
                context.anomalyActive ? 'anomaly' : 'odd'
            );
        }
        if(context.friendResonance){
            outcome.delta.happy += 5;
            outcome.delta.exp += 4;
            outcome.special = true;
            outcome.textJa = appendActionLine(outcome.textJa, 'Friend Resonance が短く走った');
            outcome.textEn = `${outcome.textEn}. A brief Friend Resonance passed through`;
        }
    } else {
        if(context.weather === 'rain'){
            outcome.delta.exp += 4;
            outcome.special = true;
            outcome.textJa = appendActionLine(outcome.textJa, '雨の層で深海ログが濡れていた');
            outcome.textEn = `${outcome.textEn}. The abyss log came back wet from the rain layer`;
        }
        if(context.timeBand === 'night'){
            outcome.delta.exp += 4;
            outcome.textJa = appendActionLine(outcome.textJa, '夜の漂流座標が少し深かった');
            outcome.textEn = `${outcome.textEn}. The night drift coordinates ran a little deeper`;
        } else if(context.timeBand === 'dawn'){
            outcome.delta.happy += 2;
        }
        if(context.anomalySlotId === 'rare_echo'){
            outcome.secret = outcome.secret || Math.random() < 0.18;
            outcome.delta.exp += 3;
            outcome.textJa = appendActionLine(outcome.textJa, '漂流座標に知らない印が混ざった');
            outcome.textEn = `${outcome.textEn}. An unknown mark mixed into the drift coordinates`;
        } else if(context.anomalySlotId === 'ui_shift'){
            outcome.uiShift = Math.random() < (context.anomalyActive ? 0.18 : 0.08);
        } else if(context.anomalySlotId === 'audio_bloom'){
            outcome.special = true;
            outcome.textJa = appendActionLine(outcome.textJa, '深海の底で鈍い残響がふくらんだ');
            outcome.textEn = `${outcome.textEn}. A dull bloom of echo opened at the abyss floor`;
        }
        if(context.anomalyActive && Math.random() < 0.12){
            outcome.logTier = 'anomaly';
            outcome.delta.exp += 6;
            outcome.deepSeaLog = true;
            outcome.textJa = pickRandom([
                '深海ログが先に届いた。',
                '漂流座標に知らない印が混ざった。',
                '帰還点の数字が少しずれていた。'
            ]);
            outcome.textEn = pickRandom([
                'A deep-sea log arrived first.',
                'An unfamiliar mark mixed into the drift coordinates.',
                'The return-point numbers were slightly misaligned.'
            ]);
            outcome.uiShift = outcome.uiShift || Math.random() < 0.5;
            outcome.anomalyPulse = true;
        }
    }

    if(context.repeatCount >= 2){
        const repeatLineJa = type === 'offer'
            ? '同じ供物が続いて、波が少し鈍った'
            : type === 'sync'
                ? '同じ拍が続いて、共鳴が少し眠った'
                : '同じ流れを追いすぎて、座標が平坦になった';
        const repeatLineEn = type === 'offer'
            ? 'The repeated offering made the tide a little dull'
            : type === 'sync'
                ? 'The repeated beat made the resonance drowsy'
                : 'Following the same current flattened the coordinates';
        outcome.textJa = appendActionLine(outcome.textJa, repeatLineJa);
        outcome.textEn = `${outcome.textEn}. ${repeatLineEn}`;
    }

    const rejectChance = context.repeatCount >= 2
        ? Math.min(0.2, 0.04 + (context.repeatCount - 1) * 0.05 + (context.anomalyActive ? 0.03 : 0))
        : 0;
    if(rejectChance > 0 && Math.random() < rejectChance){
        return getActionRejectionOutcome(type, context, outcome);
    }
    return outcome;
}

function getActionOutcome(type){
    if(isAnomalyModeActive()){
        ensureDailyState();
        const driftElapsedTier = type === 'drift' ? getDriftElapsedTier() : 'short';
        const tier = pickAnomalyTier(type, { driftElapsedTier });
        const pool = ANOMALY_LOG_POOLS[type]?.[tier] || ANOMALY_LOG_POOLS[type]?.normal;
        let textJa = garbleAnomalyText(pickRandom(pool?.ja || ['...']));
        let textEn = garbleAnomalyText(pickRandom(pool?.en || ['...']));
        if(type === 'drift'){
            if(driftElapsedTier === 'short'){
                textJa = `${textJa} // 小さな漂流片`;
                textEn = `${textEn} // small drift fragment`;
            } else if(driftElapsedTier === 'mid'){
                textJa = `${textJa} // 中層ログ`;
                textEn = `${textEn} // mid-layer log`;
            } else {
                textJa = `${textJa} // 変異予兆`;
                textEn = `${textEn} // mutation omen`;
            }
        }
        const consumedDaily = !G.daily.anomalySlotConsumed && markDailyAnomalySlotConsumed();
        if(consumedDaily && G.daily.anomalySlotId === 'strange_copy'){
            textJa = garbleAnomalyText(textJa);
            textEn = garbleAnomalyText(textEn);
        }
        if(consumedDaily && G.daily.anomalySlotId === 'rare_echo'){
            textJa = `${textJa} // 一度だけ返答あり`;
            textEn = `${textEn} // one-time answer returned`;
        }
        return {
            textJa,
            textEn,
            secret: tier === 'rare',
            special: tier === 'odd' || tier === 'anomaly',
            anomalyTier: tier,
            driftElapsedTier,
            consumedDaily
        };
    }
    const timeBand = getWalrusTimeBand();
    const bandIndex = timeBand === 'night' ? 2 : timeBand === 'dawn' ? 1 : 0;
    const roll = Math.random();
    const secret = roll < 0.03;
    const special = !secret && roll < 0.08;
    const pool = {
        offer: {
            commonJa: ['謎の貝を受け取った', 'SUIの光をまとった', '今日は食べる気分じゃない', 'Blobの匂いを気に入った'],
            commonEn: ['It accepted a strange shell', 'It wrapped itself in SUI light', 'Not in the mood to consume today', 'It liked the scent of the Blob'],
            specialJa: ['深海祭壇が一瞬だけ開いた', 'おそなえが青い波紋に変わった', '見えない保管庫へ運ばれていった'],
            specialEn: ['A deep-sea altar flickered open', 'The offering became a blue ripple', 'Something carried it into a hidden vault'],
            timeJa: ['昼の泡がやさしく反応した', '夜明けの潮が少しだけ震えた', '夜の層に静かな返答があった'],
            timeEn: ['Day bubbles answered softly', 'The dawn tide gave a small tremor', 'The night layer answered in silence']
        },
        sync: {
            commonJa: ['周波数が合ってきた', 'Walrusがこちらを見ている', '一瞬だけ秘密が見えた', '同期率が少し上がった'],
            commonEn: ['Your frequencies are aligning', 'The Walrus is looking back at you', 'A secret flashed for a moment', 'Sync rate increased slightly'],
            specialJa: ['輪郭が二重になって、すぐ戻った', '秘密基地のノイズが急に静かになった', '心拍みたいな波形が見えた'],
            specialEn: ['Its silhouette doubled, then returned', 'The base noise suddenly went quiet', 'A heartbeat-like waveform appeared'],
            timeJa: ['昼の信号は安定している', '夜明けのノイズが少し甘い', '夜の同期は深く沈む感じがする'],
            timeEn: ['Daytime signals feel stable', 'Dawn noise feels unusually warm', 'Night sync sinks deeper than usual']
        },
        drift: {
            commonJa: ['泡のゲートを見つけた', '遠くで光るBlobを見つけた', '何も起きなかった。でも少し楽しそう', '深海ログを拾った'],
            commonEn: ['It found a bubble gate', 'It spotted a glowing Blob far away', 'Nothing happened, but it looked pleased', 'It brought back a deep-sea log'],
            specialJa: ['漂流ルートが一瞬だけ星図になった', '深海の風が逆向きに流れた', '見覚えのない標識を通り過ぎた'],
            specialEn: ['Its drift path turned into a star map', 'The deep-sea current reversed for a beat', 'It passed an unknown marker'],
            timeJa: ['昼の層をふわりと横切った', '夜明けの青に溶けるように漂った', '夜の水面下で静かに遠回りした'],
            timeEn: ['It glided across the daytime layer', 'It drifted into the blue of dawn', 'It took a silent night detour below the surface']
        }
    }[type];
    const textJa = secret
        ? `SECRET FOUND · ${type === 'offer' ? '供物ログが解読された' : type === 'sync' ? '隠し周波数を検出した' : '漂流座標に秘匿印があった'}`
        : special
            ? pickRandom(pool.specialJa)
            : `${pickRandom(pool.commonJa)}。${pool.timeJa[bandIndex]}`;
    const textEn = secret
        ? `SECRET FOUND · ${type === 'offer' ? 'offering log decoded' : type === 'sync' ? 'hidden frequency detected' : 'drift coordinates carried a hidden mark'}`
        : special
            ? pickRandom(pool.specialEn)
            : `${pickRandom(pool.commonEn)}. ${pool.timeEn[bandIndex]}`;
    return { textJa, textEn, secret, special };
}

function applyActionDelta(type, outcome){
    if(outcome?.delta){
        G.hunger = clampNumber(G.hunger + (Number(outcome.delta.hunger) || 0), 0, 100, G.hunger);
        G.happy = clampNumber(G.happy + (Number(outcome.delta.happy) || 0), 0, 100, G.happy);
        G.exp = Math.max(0, G.exp + (Number(outcome.delta.exp) || 0));
        return;
    }
    if(type === 'offer'){
        G.hunger = Math.min(100, G.hunger + 10 + Math.floor(Math.random() * 9));
        G.happy = Math.min(100, G.happy + 1 + Math.floor(Math.random() * 5));
        G.exp += 8 + Math.floor(Math.random() * 7);
        if(outcome.special) G.exp += 8;
        if(outcome.secret){
            G.hunger = Math.min(100, G.hunger + 6);
            G.happy = Math.min(100, G.happy + 6);
            G.exp += 12;
        }
        return;
    }
    if(type === 'sync'){
        G.happy = Math.min(100, G.happy + 8 + Math.floor(Math.random() * 10));
        G.exp += 10 + Math.floor(Math.random() * 8);
        if(outcome.special) G.hunger = Math.min(100, G.hunger + 2);
        if(outcome.secret){
            G.happy = Math.min(100, G.happy + 8);
            G.exp += 14;
        }
        return;
    }
    G.happy = Math.min(100, G.happy + 6 + Math.floor(Math.random() * 7));
    G.hunger = Math.max(0, G.hunger - (2 + Math.floor(Math.random() * 5)));
    G.exp += 14 + Math.floor(Math.random() * 10);
    if(outcome.special) G.happy = Math.min(100, G.happy + 3);
    if(outcome.secret){
        G.happy = Math.min(100, G.happy + 6);
        G.exp += 16;
    }
}

function getRecommendedAction(){
    const expInLv = G.exp - (G.lv - 1) * 100;
    const ritual = getActionRitualState();
    const timeBand = getWalrusTimeBand();
    const soundStarved = typeof isSoundStarved === 'function' ? !!isSoundStarved() : false;
    const anomalyActive = isAnomalyModeActive();
    const candidates = [
        {
            key: 'offer',
            score: (G.hunger < 42 ? 120 + (42 - G.hunger) : 20)
                + (timeBand === 'night' ? 6 : 0)
                + (ritual.lastType === 'offer' ? -22 - ritual.streak * 4 : 8),
            urgency: G.hunger < 24 ? 'urgent' : 'normal'
        },
        {
            key: 'sync',
            score: (G.happy < 45 ? 110 + (45 - G.happy) : 24)
                + (timeBand === 'dawn' ? 10 : 0)
                + (soundStarved ? -16 : 12)
                + (ritual.lastType === 'sync' ? -18 - ritual.streak * 4 : 6)
                + (isFriendResonanceActive() ? 16 : 0),
            urgency: G.happy < 28 ? 'urgent' : 'normal'
        },
        {
            key: 'drift',
            score: ((G.hunger >= 42 && G.happy >= 45 ? 90 : 28) + Math.max(0, 42 - expInLv) * 0.6)
                + ((G?.daily?.weather === 'rain' || timeBand === 'night') ? 12 : 0)
                + ((G?.daily?.anomalySlotId === 'rare_echo' || G?.daily?.anomalySlotId === 'ui_shift') ? 10 : 0)
                + (ritual.lastType === 'drift' ? -20 - ritual.streak * 5 : 8)
                - (anomalyActive && G.hunger < 34 ? 18 : 0),
            urgency: expInLv < 20 && G.hunger >= 42 ? 'urgent' : 'normal'
        }
    ];
    const available = candidates.filter(candidate => {
        const def = ACTION_CARD_DEFS.find(item => item.key === candidate.key);
        const btn = def ? document.getElementById(def.buttonId) : null;
        return !btn || !btn.disabled;
    });
    const pool = available.length ? available : candidates;
    pool.sort((a, b) => b.score - a.score);
    return pool[0];
}

function updateActionCards(){
    const recommendation = getRecommendedAction();
    const anomalyActive = isAnomalyModeActive();
    const guidance = document.getElementById('actionGuidance');
    const guidanceKicker = document.getElementById('actionGuidanceKicker');
    const guidanceText = document.getElementById('actionGuidanceText');
    const guidanceSub = document.getElementById('actionGuidanceSub');
    if(guidance){
        guidance.dataset.recommend = recommendation.key;
        if(guidanceKicker) guidanceKicker.textContent = anomalyActive ? 'ANOMALY SIGNAL' : 'WALRUS SIGNAL';
        if(guidanceText){
            guidanceText.textContent = anomalyActive
                ? (recommendation.key === 'offer'
                    ? (currentLang === 'ja' ? '応答が薄い。供物は受理されても返答が消える。' : 'Responses are thinning. Offerings may be accepted without a reply.')
                    : recommendation.key === 'sync'
                        ? (currentLang === 'ja' ? '共鳴が深すぎる。波形の外で別の音が混ざる。' : 'Resonance is running too deep. Another sound leaks in around the waveform.')
                        : (currentLang === 'ja' ? '漂流ルートが乱れている。帰還ログの破損に注意。' : 'The drift route is unstable. Expect return logs to arrive corrupted.'))
                : (recommendation.key === 'offer' ? (currentLang === 'ja' ? 'いまは供物の気配に反応しやすい。' : 'It is unusually receptive to offerings right now.') :
                    recommendation.key === 'sync' ? (currentLang === 'ja' ? 'いまは同期すると深く共鳴しそう。' : 'A sync attempt should resonate deeply right now.') :
                    (currentLang === 'ja' ? 'いまは漂流で何か拾ってきそう。' : 'A short drift could uncover something right now.'));
        }
        if(guidanceSub){
            guidanceSub.textContent = anomalyActive
                ? (currentLang === 'ja'
                    ? 'Lv.4では行動名は変わらないが、反応ログだけが少しずつ壊れていく。'
                    : 'At Lv.4 the action names stay the same, but the reaction logs begin to decay.')
                : (recommendation.key === 'offer' ? (currentLang === 'ja' ? 'ENERGY が低いときは、おそなえから入ると安定しやすい。' : 'Low ENERGY responds well to a quiet offering first.') :
                    recommendation.key === 'sync' ? (currentLang === 'ja' ? 'BOND を整えると、反応ログがやわらかくなる。' : 'A little BOND makes later reactions softer.') :
                    (currentLang === 'ja' ? 'MEMORY を集めたいなら、軽い漂流がちょうどいい。' : 'If you want MEMORY, a light drift is a good bet.'));
        }
    }
    ACTION_CARD_DEFS.forEach(def => {
        const copy = getActionCardCopy(def);
        const titleEl = document.getElementById(def.titleId);
        const verbEl = document.getElementById(def.verbId);
        const hintEl = document.getElementById(def.hintId);
        const btn = document.getElementById(def.buttonId);
        if(!btn) return;
        const ritual = getActionRitualContext(def.key);

        const isFeedNeed = def.key === 'offer' && G.hunger < def.lowThreshold;
        const isPetNeed = def.key === 'sync' && G.happy < def.lowThreshold;
        const isPlayNeed = def.key === 'drift' && G.hunger >= 42 && G.happy >= 45;
        const title =
            def.key === 'offer' ? (isFeedNeed ? copy.needyTitle : copy.defaultTitle) :
            def.key === 'sync' ? (isPetNeed ? copy.needyTitle : copy.defaultTitle) :
            (isPlayNeed ? copy.needyTitle : copy.defaultTitle);
        if(titleEl) titleEl.innerHTML = renderActionTitle(def.key);
        if(verbEl) verbEl.textContent = copy.verb;
        if(hintEl){
            if(ritual.repeatCount >= 2){
                hintEl.textContent =
                    def.key === 'offer' ? (currentLang === 'ja' ? '同じおそなえが続くと、受理は少しずつ鈍る' : 'Repeated offerings become less effective') :
                    def.key === 'sync' ? (currentLang === 'ja' ? '同じ同期を続けると、拍が少し離れやすい' : 'Repeating sync can push the beat slightly out of phase') :
                    (currentLang === 'ja' ? '同じ漂流を連ねると、座標は少し平坦になる' : 'Repeated drifting can flatten the coordinates');
            } else if(anomalyActive){
                hintEl.textContent =
                    def.key === 'offer' ? (currentLang === 'ja' ? '反応が返らないまま、供物ログだけ残ることがある' : 'The response may vanish while only the offer log remains') :
                    def.key === 'sync' ? (currentLang === 'ja' ? '共鳴とノイズが混線し、音の輪郭が二重になる' : 'Resonance and noise may cross until the sound doubles') :
                    (currentLang === 'ja' ? '帰還ログや深海ログが壊れた形で届くことがある' : 'Return and abyss logs may come back partially corrupted');
            } else {
                hintEl.textContent = recommendation.key === def.key ? copy.recommendedHint : copy.defaultHint;
            }
        }

        const isRecommended = recommendation.key === def.key;
        btn.classList.toggle('is-recommended', isRecommended);
        btn.classList.toggle('is-muted', !isRecommended);
        btn.classList.toggle('is-urgent', isRecommended && recommendation.urgency === 'urgent');
        btn.classList.toggle('is-fatigued', ritual.repeatCount >= 2);
        btn.dataset.recommendation = isRecommended ? 'true' : 'false';
    });
}

function updateUI(){
    const mood = getMood();
    const expression = getExpressionState(mood);
    const xInLv = G.exp - (G.lv-1)*100;
    const anomalyActive = isAnomalyModeActive();

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
    if(G.lv === 4) alerts.innerHTML += `<span class="alert-tag alert-legend">✦ ANOMALY DRIFT</span>`;
    if((G.soundDiet?.total || 0) > 0){
        const insight = getSoundDietInsight();
        alerts.innerHTML += `<span class="alert-tag alert-happy">🎵 ${insight.favoriteLabel}</span>`;
    }
    const dailyAnomaly = getAnomalyDailySlotDef?.();
    if(anomalyActive && dailyAnomaly){
        alerts.innerHTML += `<span class="alert-tag alert-mystery">${currentLang === 'ja' ? dailyAnomaly.labelJa : dailyAnomaly.labelEn}</span>`;
    }
    if(isSoundStarved()){
        alerts.innerHTML += `<span class="alert-tag alert-silence">${currentLang === 'ja' ? '🔇 静かすぎる…' : '🔇 Too quiet...'}</span>`;
    }
    const idleMeta = getIdleRandomEventMeta?.();
    if(idleMeta){
        alerts.innerHTML += `<span class="alert-tag alert-mystery">${currentLang === 'ja' ? idleMeta.statusJa : idleMeta.statusEn}</span>`;
    }

    const stage = document.getElementById('petStage');
    const mainScreen = document.getElementById('mainScreen');
    renderWalrusMarkup(stage, G.lv, mood, expression);
    const aboutAvatar = document.getElementById('aboutWalrusAvatar');
    renderWalrusMarkup(aboutAvatar, G.lv, 'happy', 'happy');
    if(!stage.classList.contains('bounce') && !stage.classList.contains('shake') && !stage.classList.contains('legend-reveal') && !stage.classList.contains('action-feed') && !stage.classList.contains('action-pet') && !stage.classList.contains('action-play') && !stage.classList.contains('action-offer') && !stage.classList.contains('action-sync') && !stage.classList.contains('action-drift')){
        stage.className = getPetClasses();
    }
    applyIdleRandomEventVisuals?.();
    syncSoundReactiveStage();
    renderSoundDietCard();
    renderDailyBoard();
    syncStoryProgress?.(false);

    document.getElementById('zzzWrap').style.display = mood==='sleepy' ? 'block':'none';
    const showRing = G.lv >= 4;
    document.getElementById('legendRing').style.display      = showRing ? 'block':'none';
    document.getElementById('legendRingOuter').style.display = showRing ? 'block':'none';
    if(mainScreen) mainScreen.classList.toggle('anomaly-mode', anomalyActive);
    if(mainScreen) mainScreen.style.setProperty('--anomaly-hue-shift', `${ensureAnomalyState().hueShift}deg`);
    if(mainScreen) mainScreen.classList.toggle('daily-anomaly-ui', getAnomalyDailyUiClass() === 'daily-anomaly-ui');
    if(mainScreen) mainScreen.classList.toggle('daily-anomaly-audio', getAnomalyDailyUiClass() === 'daily-anomaly-audio');
    if(stage) stage.classList.toggle('resonance-pet', isFriendResonanceActive());
    if(anomalyActive) scheduleAnomalyEscape();
    const anomalySoundBtn = document.getElementById('anomalySoundBtn');
    if(anomalySoundBtn) anomalySoundBtn.style.display = anomalyActive ? '' : 'none';

    if(G.lv>=2) document.getElementById('sec1').classList.add('show');
    if(G.lv>=3) document.getElementById('sec2').classList.add('show');
    if(G.lv>=4) document.getElementById('sec3').classList.add('show');
    if(G.lv >= 3) renderDeepSeaLogSystem?.();
    renderAnomalyHub?.();

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
    updateActionCards();
    refreshMyShareCode();
    renderWalrusStorageStatus();
    updateWalkHero();
    renderWalrusDexButton?.();
    renderWalrusDexGrid?.();
    const bubble = document.getElementById('msgBubble');
    bubble.classList.toggle('mood-happy', expression === 'happy' || expression === 'ecstatic');
    bubble.classList.toggle('mood-sleepy', expression === 'sleepy');
    bubble.classList.toggle('mood-full', expression === 'full' || expression === 'ecstatic');
    bubble.classList.toggle('anomaly-bubble', anomalyActive);
    bubble.classList.toggle('friend-resonance', isFriendResonanceActive());
    applyIdleRandomEventVisuals?.();
    maybeShowPendingWalrusDexDiscovery?.();
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
        if(isAnomalyModeActive()) el.classList.add('anomaly-bubble');
        if(isFriendResonanceActive()) el.classList.add('friend-resonance');
        applyIdleRandomEventVisuals?.();
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
    if(mood==='happy')  return ['最高にしあわせ！✨','クーーー！！💚','大好き！シンクして！'];
    return ['クー！','ぷくぷく〜','ウォルラス！','信号を合わせて〜','クゥ〜','波が好きだよ🌊','気持ちいい〜'];
}
*/
/*
function getMoodMsg(){
    const mood=getMood();
    if(mood==='sleepy') return ['おなか空いたよ〜 🐟','眠くなってきた…','ふらふらするよ…'];
    if(mood==='sad')    return ['もっと遊んでよ…','ちょっとさみしいな','元気が出ないよ…'];
    if(mood==='happy')  return ['最高にしあわせ！ ✨','クーーー！！','だいすき！ シンクして！'];
    return ['クー！','ぷかぷか〜','ウォルラス！','信号を合わせて〜','クゥ〜','波が気持ちいい〜','漂流しようよ！'];
}
*/
function getMoodMsgSafe(){
    const mood=getMood();
    if(currentLang === 'ja'){
        if(mood==='sleepy') return ['おそなえがほしい…','眠くなってきた…','ふらふらするよ…'];
        if(mood==='sad')    return ['もう少しシンクしたい…','ちょっとさみしいな','元気が出ないよ…'];
        if(mood==='happy')  return ['最高にしあわせ！ ✨','クーーー！！','この拍、好きかも'];
        return ['クー！','ぷかぷか〜','ウォルラス！','波が気持ちいい〜','クゥ〜','今日はどこへ漂う？','信号を合わせよう'];
    }
    if(mood==='sleepy') return ['need an offering...','so sleepy...','running low...'];
    if(mood==='sad')    return ['sync with me...','feeling lonely','the signal feels thin'];
    if(mood==='happy')  return ['so happy!','KUUUU!!','love you!'];
    return ['kuu!','splash splash','walrus!','sync signal?','kuu~','ocean vibes','let us drift!'];
}
const getMoodMsg = getMoodMsgSafe;

function getStoredDailyEventDate(){
    try { return localStorage.getItem(WALMATE_LAST_DAILY_EVENT_DATE_KEY) || ''; } catch(e){ return ''; }
}

function setStoredDailyEventSnapshot(dateKey, eventId){
    try {
        localStorage.setItem(WALMATE_LAST_DAILY_EVENT_DATE_KEY, dateKey || '');
        localStorage.setItem(WALMATE_LAST_DAILY_EVENT_ID_KEY, eventId || '');
    } catch(e){}
}

function getWalMateLogs(){
    try {
        const raw = localStorage.getItem(WALMATE_MESSAGE_LOG_KEY);
        const logs = raw ? JSON.parse(raw) : [];
        return Array.isArray(logs) ? logs.slice(0, 5) : [];
    } catch(e){
        return [];
    }
}

function saveWalMateLogs(logs){
    try { localStorage.setItem(WALMATE_MESSAGE_LOG_KEY, JSON.stringify((Array.isArray(logs) ? logs : []).slice(0, 5))); } catch(e){}
}

function addWalMateLog(textJa, textEn, type = 'story', meta = {}){
    const logs = getWalMateLogs();
    const text = currentLang === 'ja' ? textJa : textEn;
    if(text && logs[0]?.text === text && logs[0]?.dateKey === getLocalDateKey()) return;
    logs.unshift({
        id: meta.id || `${type}:${Date.now()}`,
        type,
        textJa,
        textEn,
        text,
        ts: Date.now(),
        dateKey: meta.dateKey || getLocalDateKey()
    });
    saveWalMateLogs(logs);
    renderWalMateLogs?.();
}

function getStoredStoryStage(){
    try { return Math.max(0, Number(localStorage.getItem(WALMATE_STORY_STAGE_KEY)) || 0); } catch(e){ return 0; }
}

function setStoredStoryStage(stage){
    try { localStorage.setItem(WALMATE_STORY_STAGE_KEY, String(Math.max(0, Number(stage) || 0))); } catch(e){}
}

function animPet(cls){
    const el = document.getElementById('petStage');
    el.style.animation='none'; void el.offsetWidth;
    el.className = 'pet-stage ' + cls + (G.lv===4 ? ' legend-pet anomaly-pet' : '');
    if(isFriendResonanceActive()) el.classList.add('resonance-pet');
    const actionDurations = { 'action-feed': 960, 'action-pet': 1020, 'action-play': 1100, 'action-offer': 960, 'action-sync': 1020, 'action-drift': 1100 };
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
        offer: { color: '#f5d080', glow: 'rgba(245,208,128,0.42)', label: 'OFFER', dots: ['🐚','◇','✦'], ring: 150 },
        sync:  { color: '#bca7ff', glow: 'rgba(188,167,255,0.42)', label: 'SYNC', dots: ['✦','◎','∿'], ring: 138 },
        drift: { color: '#00c8f0', glow: 'rgba(0,200,240,0.45)', label: 'DRIFT', dots: ['🫧','≋','➜'], ring: 166 }
    }[type];
    if(!cfg) return;
    createActionFx('ring', c.x, c.y + 4, cfg, { '--size': `${cfg.ring}px` });
    createActionFx('chip', c.x, c.y - 96, cfg);
    if(type === 'sync') {
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

function spawnActionCourier(type, emoji, endX, endY){
    const btn = document.getElementById(type === 'offer' ? 'btnFeed' : type === 'sync' ? 'btnPet' : 'btnPlay');
    if(!btn) return;
    const rect = btn.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const el = document.createElement('div');
    el.className = `action-courier ${type}`;
    el.textContent = emoji;
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.setProperty('--dx', `${endX - startX}px`);
    el.style.setProperty('--dy', `${endY - startY}px`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

function spawnWalrusReactionBursts(type){
    const center = getStageCenter();
    const palette = type === 'offer'
        ? [{ text: '◇', cls: 'sparkle' }, { text: '🐚', cls: 'sparkle' }, { text: '✦', cls: 'sparkle' }]
        : type === 'sync'
            ? [{ text: '◎', cls: 'sync' }, { text: '∿', cls: 'sync' }, { text: '✦', cls: 'sparkle' }]
            : [{ text: '🫧', cls: 'ball' }, { text: '➜', cls: 'ball' }, { text: '≋', cls: 'ball' }];
    palette.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = `walrus-react-burst ${item.cls}`;
        el.textContent = item.text;
        el.style.left = `${center.x + (index - 1) * 18}px`;
        el.style.top = `${center.y - 14 + (Math.random() * 10 - 5)}px`;
        el.style.setProperty('--dx', `${(index - 1) * 22}px`);
        el.style.setProperty('--dy', `${-34 - Math.random() * 20}px`);
        el.style.setProperty('--dur', `${0.58 + Math.random() * 0.24}s`);
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
    });
}

function triggerWalrusActionResponse(type){
    const center = getStageCenter();
    const mouthX = center.x + 4;
    const mouthY = center.y + 22;
    if(type === 'offer'){
        spawnActionCourier('offer', '🐚', mouthX, mouthY);
        setTimeout(() => spawnWalrusReactionBursts('offer'), 180);
        return;
    }
    if(type === 'sync'){
        spawnActionCourier('sync', '✦', mouthX, mouthY - 10);
        setTimeout(() => spawnWalrusReactionBursts('sync'), 60);
        return;
    }
    spawnActionCourier('drift', '🫧', center.x + 8, center.y + 8);
    setTimeout(() => spawnWalrusReactionBursts('drift'), 180);
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

function getRitualFxLayer(){
    return document.getElementById('ritualFxLayer') || document.body;
}

function createRitualFxNode(className, styleMap = {}, text = '', ttl = 1200){
    const layer = getRitualFxLayer();
    const el = document.createElement('div');
    el.className = className;
    if(text) el.textContent = text;
    Object.entries(styleMap).forEach(([key, value]) => el.style.setProperty(key, value));
    layer.appendChild(el);
    window.setTimeout(() => el.remove(), ttl);
    return el;
}

function triggerAnomalyHueGlitch(duration = 400){
    const main = document.getElementById('mainScreen');
    if(!main) return;
    main.classList.remove('ritual-anomaly-glitch');
    void main.offsetWidth;
    main.classList.add('ritual-anomaly-glitch');
    window.setTimeout(() => main.classList.remove('ritual-anomaly-glitch'), duration);
}

function triggerRitualScreenFx(type, outcome = {}){
    const stage = document.getElementById('petStage');
    const center = getStageCenter();
    const rect = stage?.getBoundingClientRect();
    if(type === 'offer'){
        for(let i = 0; i < 10; i += 1){
            createRitualFxNode('ritual-fx ritual-offer-grain', {
                '--x': `${center.x + (Math.random() - 0.5) * 44}px`,
                '--y': `${center.y - 16 + Math.random() * 24}px`,
                '--dx': `${(Math.random() - 0.5) * 18}px`,
                '--dy': `${40 + Math.random() * 46}px`,
                '--delay': `${i * 0.03}s`
            }, '', 980);
        }
    } else if(type === 'sync'){
        for(let i = 0; i < 2; i += 1){
            createRitualFxNode('ritual-fx ritual-sync-ring', {
                '--x': `${center.x}px`,
                '--y': `${center.y}px`,
                '--size': `${110 + i * 42}px`,
                '--delay': `${i * 0.08}s`
            }, '', 900);
        }
    } else if(rect){
        for(let i = 0; i < 8; i += 1){
            createRitualFxNode('ritual-fx ritual-drift-bubble', {
                '--x': `${rect.left - 10 + Math.random() * (rect.width + 20)}px`,
                '--y': `${rect.top + 26 + Math.random() * Math.max(24, rect.height - 32)}px`,
                '--dx': `${120 + Math.random() * 120}px`,
                '--dy': `${-12 + Math.random() * 24}px`,
                '--size': `${7 + Math.random() * 12}px`,
                '--delay': `${i * 0.04}s`
            }, '', 1100);
        }
    }
    if(outcome.uiShift || outcome.anomalyPulse){
        triggerAnomalyHueGlitch(400);
    }
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

function createHatchBaby(){
    return makeWalrus(1, 'happy', 'baby');
}

function getStageCenter(){
    const r=document.getElementById('petStage').getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};
}

function isMiniGameOpen(){
    const miniScreen = document.getElementById('miniGameScreen');
    return !!(miniScreen && !miniScreen.classList.contains('hidden'));
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
            if(typeof updateActionCards === 'function') updateActionCards();
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
            ? (currentLang === 'ja'
                ? 'Walrusの浮遊が安定しなくなった。これは成長ではなく、変質かもしれない。'
                : 'The Walrus can no longer keep a stable drift. This may not be growth, but a mutation.')
            : (G.lv===2
                ? (currentLang === 'ja' ? '✨ Lv.2解放！ 自己紹介とプロフィールカードを教えてね。' : '✨ Lv.2 unlocked! Set your intro and profile cards.')
                : (currentLang === 'ja' ? `✨ レベルアップ！ Lv.${G.lv} · ${getLvName(G.lv)} になったよ！` : `Level up! Lv.${G.lv} ${getLvName(G.lv)}`)));
        if(G.lv===4){
            unlockAnomalyMode();
            socialPopupPending = false;
            animPet('legend-reveal');
            const c = getStageCenter();
            spawnParticles(['✦','//','🫧','≋','✦'], c.x, c.y);
            addWalMateLog(
                'Walrusの浮遊が安定しなくなった。これは成長ではなく、変質かもしれない。',
                'The Walrus drift became unstable. This may be a mutation, not simple growth.',
                'story',
                { id: 'story:anomaly-drift-unlock' }
            );
            setTimeout(() => {
                setMsg(currentLang === 'ja'
                    ? '異常浮遊 / Anomaly Drift が解放された。ホーム画面の反応ログが少しずつ壊れはじめる。'
                    : 'Anomaly Drift unlocked. Home-screen reaction logs will begin to decay.');
            }, 880);
        } else {
            animPet('bounce');
        }
        const c=getStageCenter();
        spawnParticles(['✨','⭐','💎','✨','🫧'],c.x,c.y);
        scrollToUnlockedSection(G.lv);
        if(G.lv === 2){
            setTimeout(() => {
                showToast(currentLang === 'ja' ? 'Lv.2で自己紹介とプロフィール編集が開いたよ' : 'Lv.2 unlocked intro and profile editing');
                hydrateUserIntroEditor();
                hydrateProfileDeckEditor();
            }, 700);
        }
        syncStoryProgress?.(true);
        return true;
    }
    return false;
}

function normalizeProfileDeckState(profileDeck){
    const source = profileDeck && typeof profileDeck === 'object' ? profileDeck : {};
    const cards = Array.isArray(source.cards) ? source.cards.slice(0, 3) : [];
    return {
        about: typeof source.about === 'string' ? source.about.slice(0, 280) : '',
        socials: {
            x: typeof source?.socials?.x === 'string' ? source.socials.x.slice(0, 220) : '',
            instagram: typeof source?.socials?.instagram === 'string' ? source.socials.instagram.slice(0, 220) : '',
            note: typeof source?.socials?.note === 'string' ? source.socials.note.slice(0, 220) : ''
        },
        cards: [0, 1, 2].map(index => {
            const card = cards[index] && typeof cards[index] === 'object' ? cards[index] : {};
            return {
                title: typeof card.title === 'string' ? card.title.slice(0, 60) : '',
                meta: typeof card.meta === 'string' ? card.meta.slice(0, 60) : '',
                speech: typeof card.speech === 'string' ? card.speech.slice(0, 220) : ''
            };
        })
    };
}

/* ===== ACTIONS ===== */
function performWalrusAction(type){
    const map = {
        offer: { count: 'feedCount', button: '#btnFeed', sfx: sfxFeed, hapticMs: 15, cls: 'action-offer', particles: ['◇','✦','🐚','✦'], cooldown: COOLDOWNS.feed, cd: ['btnFeed','cdFeed','lblFeed'] },
        sync: { count: 'petCount', button: '#btnPet', sfx: sfxPet, hapticMs: 12, cls: 'action-sync', particles: ['∿','✦','◎'], cooldown: COOLDOWNS.pet, cd: ['btnPet','cdPet','lblPet'] },
        drift: { count: 'playCount', button: '#btnPlay', sfx: sfxPlay, hapticMs: 20, cls: 'action-drift', particles: ['🫧','≋','➜','✦'], cooldown: COOLDOWNS.play, cd: ['btnPlay','cdPlay','lblPlay'] }
    }[type];
    if(!map) return;
    dismissNewbornGuide();
    const context = getActionRitualContext(type);
    recordBehaviorAction(map.count);
    pulseActionButtons(map.button, type === 'offer' ? '.tama-btn-a' : type === 'sync' ? '.tama-btn-b' : '.tama-btn-c');
    map.sfx(); haptic(map.hapticMs);
    triggerWalrusActionResponse(type);
    const outcome = buildRitualActionOutcome(type, getActionOutcome(type), context);
    const anomaly = isAnomalyModeActive() ? ensureAnomalyState() : null;
    applyActionDelta(type, outcome);
    commitActionRitualState(type);
    if(anomaly){
        anomaly.lastActionAt[type] = Date.now();
    }
    setMsg(currentLang === 'ja' ? outcome.textJa : outcome.textEn, !!outcome.secret);
    if(outcome.secret){
        showToast?.('SECRET FOUND');
        addWalMateLog(outcome.textJa, outcome.textEn, 'secret', { id: `secret:${type}:${Date.now()}` });
    } else if(outcome.special){
        addWalMateLog(outcome.textJa, outcome.textEn, 'ritual', { id: `ritual:${type}:${Date.now()}` });
    }
    registerAnomalyLog(
        outcome.textJa,
        outcome.textEn,
        type,
        outcome.anomalyTier || outcome.logTier || (outcome.secret ? 'rare' : outcome.special ? 'odd' : 'normal')
    );
    if(anomaly && outcome.anomalyTier){
        if(type === 'drift' && outcome.driftElapsedTier === 'long'){
            anomaly.hueShift = -24 + Math.round(Math.random() * 48);
            if(Math.random() < 0.58) triggerAnomalySound?.();
        }
        if(type === 'sync' && outcome.consumedDaily && G.daily.anomalySlotId === 'audio_bloom'){
            triggerAnomalySound?.();
        }
    }
    triggerRitualScreenFx?.(type, outcome);
    animPet(map.cls);
    const c=getStageCenter(); spawnParticles(map.particles,c.x,c.y);
    spawnActionFx(type);
    startCD(...map.cd, map.cooldown);
    checkLevelUp(); updateUI();
}
function offerToWalrus(){ performWalrusAction('offer'); }
function syncWithWalrus(){ performWalrusAction('sync'); }
function driftWalrus(){ performWalrusAction('drift'); }
function doFeed(){ offerToWalrus(); }
function doPet(){ syncWithWalrus(); }
function doPlay(){ driftWalrus(); }
function tapPet(){
    haptic(10);
    recordBehaviorAction('tapCount');
    toggleWalrusMenu?.();
    if(isWalrusMenuOpen?.()){
        setMsg(currentLang === 'ja' ? '🫧 Walrusが、海の気配をそっとひらいた。' : '🫧 Your Walrus quietly opened the sea around you.');
        animPet('bounce');
    }
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
                DEEPSEA_LOG_STORAGE_KEY,
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
    if (isMiniGameOpen()) return;
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
    if (isMiniGameOpen()) return;
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
    const miniScreen = document.getElementById('miniGameScreen');
    if(!miniScreen){
        setMsg(currentLang === 'ja' ? '🫧 バブルポップはこのバージョンでは終了しました' : '🫧 Bubble Pop has been retired in this build', true);
        return;
    }
    document.getElementById('mainScreen').classList.add('hidden');
    miniScreen.classList.remove('hidden');
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

