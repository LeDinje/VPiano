// Piano virtuel : clavier AZERTY -> notes, sons chargés depuis le dossier sounds/.

// Touches physiques (event.code) -> note, avec le libellé AZERTY affiché sur la touche.
// Rangée du bas (W X C V B N ,) + rangée du milieu pour les noires : octave 3.
// Rangée du haut (A Z E R T Y U I O P ^ $) + rangée des chiffres pour les noires : octaves 4-5.
const KEYMAP = [
  { code: 'KeyZ', label: 'W', note: 'C3' },
  { code: 'KeyS', label: 'S', note: 'C#3' },
  { code: 'KeyX', label: 'X', note: 'D3' },
  { code: 'KeyD', label: 'D', note: 'D#3' },
  { code: 'KeyC', label: 'C', note: 'E3' },
  { code: 'KeyV', label: 'V', note: 'F3' },
  { code: 'KeyG', label: 'G', note: 'F#3' },
  { code: 'KeyB', label: 'B', note: 'G3' },
  { code: 'KeyH', label: 'H', note: 'G#3' },
  { code: 'KeyN', label: 'N', note: 'A3' },
  { code: 'KeyJ', label: 'J', note: 'A#3' },
  { code: 'KeyM', label: ',', note: 'B3' },

  { code: 'KeyQ', label: 'A', note: 'C4' },
  { code: 'Digit2', label: 'é', note: 'C#4' },
  { code: 'KeyW', label: 'Z', note: 'D4' },
  { code: 'Digit3', label: '"', note: 'D#4' },
  { code: 'KeyE', label: 'E', note: 'E4' },
  { code: 'KeyR', label: 'R', note: 'F4' },
  { code: 'Digit5', label: '(', note: 'F#4' },
  { code: 'KeyT', label: 'T', note: 'G4' },
  { code: 'Digit6', label: '-', note: 'G#4' },
  { code: 'KeyY', label: 'Y', note: 'A4' },
  { code: 'Digit7', label: 'è', note: 'A#4' },
  { code: 'KeyU', label: 'U', note: 'B4' },
  { code: 'KeyI', label: 'I', note: 'C5' },
  { code: 'Digit9', label: 'ç', note: 'C#5' },
  { code: 'KeyO', label: 'O', note: 'D5' },
  { code: 'Digit0', label: 'à', note: 'D#5' },
  { code: 'KeyP', label: 'P', note: 'E5' },
  { code: 'BracketLeft', label: '^', note: 'F5' },
  { code: 'Equal', label: '=', note: 'F#5' },
  { code: 'BracketRight', label: '$', note: 'G5' },
];

// Format et emplacement des fichiers son : sounds/C4.mp3, sounds/Cs4.mp3 (dièse = "s")...
const SOUND_DIR = 'sounds/';
const SOUND_EXT = '.mp3';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToMidi(note) {
  const [, name, octave] = note.match(/^([A-G]#?)(-?\d)$/);
  return NOTE_NAMES.indexOf(name) + (Number(octave) + 1) * 12;
}

function midiToNote(midi) {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

function noteToFile(note) {
  return SOUND_DIR + note.replace('#', 's') + SOUND_EXT;
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

const samples = new Map(); // midi -> AudioBuffer
const activeVoices = new Map(); // code -> { gain, source }
let octaveShift = 0;
let sustain = false;

// Charge un échantillon par note de la plage étendue (±2 octaves pour le décalage d'octave).
async function loadSamples() {
  const midis = KEYMAP.map(k => noteToMidi(k.note));
  const min = Math.min(...midis) - 24;
  const max = Math.max(...midis) + 24;
  const jobs = [];
  for (let m = min; m <= max; m++) {
    const url = noteToFile(midiToNote(m));
    jobs.push(
      fetch(url)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(audio => samples.set(m, audio))
        .catch(() => {})
    );
  }
  await Promise.all(jobs);
  const status = document.getElementById('status');
  status.textContent = samples.size
    ? `${samples.size} sons chargés`
    : 'Aucun son trouvé dans sounds/ : synthétiseur utilisé';
}

// Échantillon le plus proche + vitesse de lecture pour transposer les notes manquantes.
function findSample(midi) {
  let best = null;
  for (const m of samples.keys()) {
    if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  }
  if (best === null) return null;
  return { buffer: samples.get(best), rate: Math.pow(2, (midi - best) / 12) };
}

function startVoice(midi) {
  const gain = audioCtx.createGain();
  gain.connect(masterGain);
  const sample = findSample(midi);
  let source;
  if (sample) {
    source = audioCtx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = sample.rate;
    gain.gain.value = 1;
  } else {
    source = audioCtx.createOscillator();
    source.type = 'triangle';
    source.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.15, t + 1);
  }
  source.connect(gain);
  source.start();
  return { gain, source };
}

function stopVoice(voice) {
  const t = audioCtx.currentTime;
  voice.gain.gain.cancelScheduledValues(t);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
  voice.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  voice.source.stop(t + 0.35);
}

function press(code) {
  if (activeVoices.has(code)) return;
  const key = KEYMAP.find(k => k.code === code);
  if (!key) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const midi = noteToMidi(key.note) + octaveShift * 12;
  activeVoices.set(code, startVoice(midi));
  document.querySelector(`[data-code="${code}"]`).classList.add('active');
  onKeyPressed(code);
}

function release(code) {
  const voice = activeVoices.get(code);
  if (!voice) return;
  activeVoices.delete(code);
  document.querySelector(`[data-code="${code}"]`).classList.remove('active');
  if (!sustain) stopVoice(voice);
  else sustainedVoices.push(voice);
}

const sustainedVoices = [];

function setSustain(on) {
  sustain = on;
  document.getElementById('sustain').checked = on;
  if (!on) sustainedVoices.splice(0).forEach(stopVoice);
}

function buildPiano() {
  const piano = document.getElementById('piano');
  for (const key of KEYMAP) {
    const el = document.createElement('div');
    el.className = 'key ' + (key.note.includes('#') ? 'black' : 'white');
    el.dataset.code = key.code;
    el.innerHTML = `<span class="label">${key.label}</span><span class="note">${key.note}</span>`;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); press(key.code); });
    el.addEventListener('pointerup', () => release(key.code));
    el.addEventListener('pointercancel', () => release(key.code));
    piano.appendChild(el);
  }
}

function updateNoteLabels() {
  for (const key of KEYMAP) {
    const note = midiToNote(noteToMidi(key.note) + octaveShift * 12);
    document.querySelector(`[data-code="${key.code}"] .note`).textContent = note;
  }
  document.getElementById('octave-value').textContent = octaveShift > 0 ? `+${octaveShift}` : octaveShift;
}

function changeOctave(delta) {
  octaveShift = Math.max(-2, Math.min(2, octaveShift + delta));
  updateNoteLabels();
}

// Pas de notes pendant qu'on tape dans un champ (éditeur de chart, tempo...).
function isTyping(e) {
  return e.target.matches('textarea, input[type="text"], input[type="number"], select');
}

document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
  if (e.code === 'Space') { e.preventDefault(); setSustain(true); return; }
  if (e.code === 'ArrowLeft') { changeOctave(-1); return; }
  if (e.code === 'ArrowRight') { changeOctave(1); return; }
  if (KEYMAP.some(k => k.code === e.code)) { e.preventDefault(); press(e.code); }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space') { setSustain(false); return; }
  release(e.code);
});

window.addEventListener('blur', () => [...activeVoices.keys()].forEach(release));

document.getElementById('volume').addEventListener('input', e => {
  masterGain.gain.value = Number(e.target.value);
});
document.getElementById('sustain').addEventListener('change', e => setSustain(e.target.checked));
document.getElementById('octave-down').addEventListener('click', () => changeOctave(-1));
document.getElementById('octave-up').addEventListener('click', () => changeOctave(1));

// ---------- Charts ----------
// Format : touches séparées par des espaces, "[XC]" = touches simultanées,
// "." = pause, retour à la ligne = nouvelle ligne. "ZXC" sans crochets = Z puis X puis C.

// Rappel des touches : W=Do3 X=Ré3 C=Mi3 V=Fa3 B=Sol3 N=La3 ,=Si3
// A=Do4 Z=Ré4 E=Mi4 R=Fa4 T=Sol4 Y=La4 U=Si4 I=Do5 O=Ré5 P=Mi5 ^=Fa5 $=Sol5
// Noires : S D G H J (octave 3), é " ( - è (octave 4), ç à = (octave 5).
// Les morceaux trop aigus sont transposés pour tenir sur le clavier.
const EXAMPLE_CHARTS = [
  { group: 'Classique & comptines', name: 'Au clair de la lune', tempo: 120,
    chart: 'A A A Z E . Z .\nA E Z Z A' },
  { group: 'Classique & comptines', name: 'Ah ! vous dirai-je, maman', tempo: 130,
    chart: 'A A T T Y Y T .\nR R E E Z Z A .\nT T R R E E Z .\nT T R R E E Z .\nA A T T Y Y T .\nR R E E Z Z A' },
  { group: 'Classique & comptines', name: 'Frère Jacques', tempo: 140,
    chart: 'A Z E A A Z E A\nE R T . E R T .\nT Y T R E A T Y T R E A\nA B A . A B A' },
  { group: 'Classique & comptines', name: 'Joyeux anniversaire', tempo: 130,
    chart: 'T T Y T I U .\nT T Y T O I .\nT T $ P I U Y .\n^ ^ P I O I' },
  { group: 'Classique & comptines', name: 'Jingle Bells', tempo: 180,
    chart: 'E E E . E E E .\nE T A Z E . . .\nR R R R R E E E\nE Z Z E Z . T .' },
  { group: 'Classique & comptines', name: 'Ode à la joie (Beethoven)', tempo: 130,
    chart: 'E E R T T R E Z\nA A Z E E . Z Z .\nE E R T T R E Z\nA A Z E Z . A A' },
  { group: 'Classique & comptines', name: 'Lettre à Élise (Beethoven)', tempo: 150,
    chart: 'P à P à P U O I [NY] .\nA E Y [,U] .\nE - U [AI] .\nE P à P à P U O I [NY] .\nA E Y [,U] .\nE I U [NY]' },
  { group: 'Classique & comptines', name: 'Canon en ré (Pachelbel)', tempo: 70,
    chart: '[X=] [NP] [,O] [Gç]\n[BU] [XY] [BU] [Nç]' },

  { group: 'Films & séries', name: 'Pirates des Caraïbes', tempo: 180,
    chart: 'N A Z Z . Z E R R .\nR T E E . Z A A Z .\nN A Z Z . Z E R R .\nR T E E . Z A Z' },
  { group: 'Films & séries', name: 'Game of Thrones', tempo: 170,
    chart: 'T A " R T A " R\nT A E R T A E R\nT . A . " R T . A . " R Z' },
  { group: 'Films & séries', name: 'Harry Potter (Hedwige)', tempo: 140,
    chart: ', E T ( E . U Y . .\n( . . E T ( " . R ,' },
  { group: 'Films & séries', name: 'Star Wars', tempo: 130,
    chart: 'B B B A . T .\nR E Z I . T .\nR E Z I . T .\nR E R Z' },
  { group: 'Films & séries', name: 'La Panthère rose', tempo: 150,
    chart: '" E . ( T .\n" E ( T I U E T U è .\nY T E Z E' },
  { group: 'Films & séries', name: 'Seven Nation Army (riff)', tempo: 140,
    chart: 'E . E T E Z A , .\nE . E T E Z A Z A ,' },

  { group: 'Jeux vidéo', name: 'Tetris', tempo: 170,
    chart: 'E , A Z A , N N A E Z A , . A Z E A N N .\nZ R Y T R E . A E Z A , . , A Z E A N N' },
  { group: 'Jeux vidéo', name: 'Super Mario Bros', tempo: 200,
    chart: 'E E . E . A E . T . . . B . . .\nA . B . C . N , J N .\nB E T Y R T . E A Z ,' },
  { group: 'Jeux vidéo', name: 'Zelda – Berceuse de Zelda', tempo: 90,
    chart: ', Z N . B N , Z N .\n, Z Y T Z . A , N' },
  { group: 'Jeux vidéo', name: 'Zelda – Chant des tempêtes', tempo: 170,
    chart: 'Z R O . Z R O .\nP ^ P ^ P I Y .\nY Z R T Y .\nY Z R T E' },
  { group: 'Jeux vidéo', name: 'Final Fantasy – Prélude', tempo: 200,
    chart: 'A Z E T I O P $ P O I T E Z\nN , A E Y U I P I U Y E A ,' },
  { group: 'Jeux vidéo', name: 'Undertale – Megalovania', tempo: 220,
    chart: 'Z Z O . Y . - . T . R . Z R T\nA A O . Y . - . T . R . Z R T\n, , O . Y . - . T . R . Z R T\nJ J O . Y . - . T . R . Z R T' },
  { group: 'Jeux vidéo', name: 'Wii – Chaîne Mii', tempo: 170,
    chart: '( Y ç . Y . ( Z Z Z . .\né Z ( Y ç . Y . ( P à O' },

  { group: 'Exemples', name: 'Accords (exemple)', tempo: 120,
    chart: '[WA] E T [WA] E T\n[VR] Y I [VR] Y I\n[BT] U O [BT] U O\n[WAI]' },
];

const labelToKey = new Map(KEYMAP.map(k => [k.label.toUpperCase(), k]));

// Renvoie des lignes d'étapes ; une étape = liste de touches (vide = pause).
function parseChart(text) {
  return text.split('\n').map(line => {
    const steps = [];
    const tokens = line.match(/\[[^\]]*\]|\S/g) || [];
    for (const token of tokens) {
      if (token === '.') steps.push({ keys: [], raw: ['.'] });
      else if (token.startsWith('[')) {
        const raw = [...token.slice(1, -1)].filter(c => c.trim());
        steps.push({ keys: raw.map(c => labelToKey.get(c.toUpperCase())).filter(Boolean), raw });
      } else {
        const key = labelToKey.get(token.toUpperCase());
        steps.push({ keys: key ? [key] : [], raw: [token] });
      }
    }
    return steps;
  }).filter(steps => steps.length);
}

const chartInput = document.getElementById('chart-input');
const chartView = document.getElementById('chart-view');
let chartSteps = []; // toutes les étapes à plat, avec leur élément DOM
let chartIndex = -1;
let mode = null; // 'play' | 'practice' | null
let playTimer = null;
let pressedForStep = new Set();

function renderChart() {
  stopChart();
  chartView.innerHTML = '';
  chartSteps = [];
  for (const line of parseChart(chartInput.value)) {
    const lineEl = document.createElement('div');
    lineEl.className = 'chart-line';
    for (const step of line) {
      const stepEl = document.createElement('div');
      stepEl.className = 'chart-step';
      // Note la plus aiguë en haut, comme sur une partition.
      const pitch = c => { const k = labelToKey.get(c.toUpperCase()); return k ? noteToMidi(k.note) : -1; };
      const raw = [...step.raw].sort((a, b) => pitch(b) - pitch(a));
      for (const c of raw) {
        const key = labelToKey.get(c.toUpperCase());
        const span = document.createElement('span');
        span.textContent = key ? key.label : c;
        span.className = c === '.' ? 'pause' : !key ? 'unknown' : key.note.includes('#') ? 'black' : '';
        stepEl.appendChild(span);
      }
      lineEl.appendChild(stepEl);
      chartSteps.push({ ...step, el: stepEl });
    }
    chartView.appendChild(lineEl);
  }
}

function clearTargets() {
  document.querySelectorAll('.key.target').forEach(el => el.classList.remove('target'));
}

function goToStep(i) {
  chartSteps.forEach((s, j) => {
    s.el.classList.toggle('current', j === i);
    s.el.classList.toggle('done', j < i);
  });
  clearTargets();
  chartIndex = i;
  pressedForStep = new Set();
  const step = chartSteps[i];
  if (!step) return;
  step.keys.forEach(k => document.querySelector(`[data-code="${k.code}"]`).classList.add('target'));
  step.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function stopChart() {
  clearTimeout(playTimer);
  mode = null;
  chartIndex = -1;
  clearTargets();
  chartSteps.forEach(s => s.el.classList.remove('current', 'done'));
}

function playChart() {
  renderChart();
  if (!chartSteps.length) return;
  mode = 'play';
  const beat = () => 60000 / Number(document.getElementById('tempo').value || 120);
  const next = i => {
    if (mode !== 'play') return;
    if (i >= chartSteps.length) { stopChart(); return; }
    goToStep(i);
    const codes = chartSteps[i].keys.map(k => k.code);
    codes.forEach(press);
    const duration = beat();
    setTimeout(() => codes.forEach(release), duration * 0.9);
    playTimer = setTimeout(() => next(i + 1), duration);
  };
  next(0);
}

function skipPauses(i) {
  while (chartSteps[i] && !chartSteps[i].keys.length) i++;
  return i;
}

function practiceChart() {
  renderChart();
  if (!chartSteps.length) return;
  mode = 'practice';
  goToStep(skipPauses(0));
}

// En mode entraînement, on passe à l'étape suivante quand toutes ses touches ont été jouées.
function onKeyPressed(code) {
  if (mode !== 'practice') return;
  const step = chartSteps[chartIndex];
  if (!step || !step.keys.some(k => k.code === code)) return;
  pressedForStep.add(code);
  if (step.keys.every(k => pressedForStep.has(k.code))) {
    const nextIndex = skipPauses(chartIndex + 1);
    if (nextIndex >= chartSteps.length) {
      goToStep(chartSteps.length);
      mode = null;
      document.getElementById('status').textContent = 'Bravo, chart terminé !';
    } else {
      goToStep(nextIndex);
    }
  }
}

function initCharts() {
  const select = document.getElementById('chart-select');
  const groups = new Map();
  EXAMPLE_CHARTS.forEach((c, i) => {
    if (!groups.has(c.group)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = c.group;
      select.appendChild(optgroup);
      groups.set(c.group, optgroup);
    }
    groups.get(c.group).appendChild(new Option(c.name, i));
  });
  const loadExample = () => {
    const c = EXAMPLE_CHARTS[select.value];
    chartInput.value = c.chart;
    document.getElementById('tempo').value = c.tempo;
    renderChart();
  };
  select.addEventListener('change', loadExample);
  loadExample();
  chartInput.addEventListener('input', renderChart);
  document.getElementById('chart-play').addEventListener('click', e => { e.currentTarget.blur(); playChart(); });
  document.getElementById('chart-practice').addEventListener('click', e => { e.currentTarget.blur(); practiceChart(); });
  document.getElementById('chart-stop').addEventListener('click', stopChart);
  renderChart();
}

masterGain.gain.value = 0.8;
buildPiano();
initCharts();
loadSamples();
