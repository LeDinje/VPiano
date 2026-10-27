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

const EXAMPLE_CHARTS = {
  'Au clair de la lune': 'A A A Z E . Z .\nA E Z Z A',
  'Ode à la joie': 'E E R T T R E Z\nA A Z E E . Z Z .\nE E R T T R E Z\nA A Z E Z . A A',
  'Accords (exemple)': '[WA] E T [WA] E T\n[VR] Y I [VR] Y I\n[BT] U O [BT] U O\n[WAI]',
};

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
  for (const name of Object.keys(EXAMPLE_CHARTS)) select.add(new Option(name, name));
  select.addEventListener('change', () => { chartInput.value = EXAMPLE_CHARTS[select.value]; renderChart(); });
  chartInput.value = EXAMPLE_CHARTS[select.value];
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
