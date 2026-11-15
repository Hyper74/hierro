// ─────────────────────────────────────────────────────────────
// Biblioteca precargada. Los nombres en español siguen la forma en
// que los escribe Hevy en castellano, para que la importación los
// empareje automáticamente. "en" es el nombre de Hevy en inglés.
//
// kind:  weight   → peso × repeticiones
//        reps     → solo repeticiones (peso corporal)
//        weighted → peso corporal + lastre opcional
//        time     → tiempo (con peso opcional)
// equipment: barra | mancuernas | maquina | discos | polea | corporal | kettlebell | otro
// ─────────────────────────────────────────────────────────────

export const LIBRARY_VERSION = 1;

export const MUSCLES = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Glúteos', 'Core', 'Otros'];

export const EQUIPMENT = {
  barra: 'Barra', mancuernas: 'Mancuernas', maquina: 'Máquina', discos: 'Máquina de discos',
  polea: 'Polea', corporal: 'Peso corporal', kettlebell: 'Pesa rusa', otro: 'Otro',
};

export const KINDS = {
  weight: 'Peso y repeticiones', reps: 'Solo repeticiones', weighted: 'Peso corporal + lastre', time: 'Tiempo',
};

// [nombre, nombre Hevy en inglés, músculo, material, tipo, descanso s]
const L = [
  // Pecho
  ['Press de Banca (Barra)', 'Bench Press (Barbell)', 'Pecho', 'barra', 'weight', 150],
  ['Press de Banca Inclinado (Barra)', 'Incline Bench Press (Barbell)', 'Pecho', 'barra', 'weight', 150],
  ['Press de Banca (Mancuerna)', 'Bench Press (Dumbbell)', 'Pecho', 'mancuernas', 'weight', 120],
  ['Press de Banca Inclinado (Mancuerna)', 'Incline Bench Press (Dumbbell)', 'Pecho', 'mancuernas', 'weight', 120],
  ['Press de Pecho (Máquina)', 'Chest Press (Machine)', 'Pecho', 'maquina', 'weight', 90],
  ['Press de Pecho Inclinado (Máquina)', 'Incline Chest Press (Machine)', 'Pecho', 'maquina', 'weight', 90],
  ['Press de Pecho Iso-Lateral (Máquina)', 'Iso-Lateral Chest Press (Machine)', 'Pecho', 'maquina', 'weight', 90],
  ['Press Declinado (Máquina)', 'Decline Chest Press (Machine)', 'Pecho', 'maquina', 'weight', 90],
  ['Aperturas (Máquina)', 'Chest Fly (Machine)', 'Pecho', 'maquina', 'weight', 75],
  ['Aperturas (Mancuerna)', 'Chest Fly (Dumbbell)', 'Pecho', 'mancuernas', 'weight', 75],
  ['Cruce de Poleas', 'Cable Fly Crossovers', 'Pecho', 'polea', 'weight', 75],
  ['Fondos', 'Chest Dip', 'Pecho', 'corporal', 'reps', 90],
  ['Flexiones', 'Push Up', 'Pecho', 'corporal', 'reps', 60],
  // Espalda
  ['Dominada', 'Pull Up', 'Espalda', 'corporal', 'reps', 120],
  ['Dominada (Con Peso Añadido)', 'Pull Up (Weighted)', 'Espalda', 'corporal', 'weighted', 120],
  ['Dominada Supina', 'Chin Up', 'Espalda', 'corporal', 'reps', 120],
  ['Jalón al Pecho (Cable)', 'Lat Pulldown (Cable)', 'Espalda', 'polea', 'weight', 90],
  ['Jalón al Pecho - Agarre Cerrado (Cable)', 'Lat Pulldown - Close Grip (Cable)', 'Espalda', 'polea', 'weight', 90],
  ['Jalón con Brazos Rectos (Cable)', 'Straight Arm Lat Pulldown (Cable)', 'Espalda', 'polea', 'weight', 75],
  ['Remo con Barra', 'Bent Over Row (Barbell)', 'Espalda', 'barra', 'weight', 120],
  ['Remo con Mancuerna', 'Dumbbell Row', 'Espalda', 'mancuernas', 'weight', 90],
  ['Remo Sentado (Cable)', 'Seated Cable Row - V Grip (Cable)', 'Espalda', 'polea', 'weight', 90],
  ['Remo Sentado (Máquina)', 'Seated Row (Machine)', 'Espalda', 'maquina', 'weight', 90],
  ['Remo Iso-Lateral', 'Iso-Lateral Row (Machine)', 'Espalda', 'maquina', 'weight', 90],
  ['Remo a Un Brazo (Cable)', 'Single Arm Cable Row', 'Espalda', 'polea', 'weight', 75],
  ['Peso Muerto (Barra)', 'Deadlift (Barbell)', 'Espalda', 'barra', 'weight', 180],
  ['Extensión de Espalda (Hiperextensión con peso)', 'Back Extension (Weighted Hyperextension)', 'Espalda', 'otro', 'weight', 90],
  // Hombros
  ['Press Militar (Barra)', 'Overhead Press (Barbell)', 'Hombros', 'barra', 'weight', 150],
  ['Press de Hombros (Mancuerna)', 'Shoulder Press (Dumbbell)', 'Hombros', 'mancuernas', 'weight', 120],
  ['Press de Hombros Sentado (Máquina)', 'Seated Shoulder Press (Machine)', 'Hombros', 'maquina', 'weight', 90],
  ['Press de Hombros (Máquina de Discos)', 'Shoulder Press (Plate Loaded)', 'Hombros', 'discos', 'weight', 90],
  ['Elevación Lateral (Mancuerna)', 'Lateral Raise (Dumbbell)', 'Hombros', 'mancuernas', 'weight', 60],
  ['Elevación Lateral (Cable)', 'Lateral Raise (Cable)', 'Hombros', 'polea', 'weight', 60],
  ['Elevación Lateral (Máquina)', 'Lateral Raise (Machine)', 'Hombros', 'maquina', 'weight', 60],
  ['Vuelos Posteriores (Máquina)', 'Rear Delt Reverse Fly (Machine)', 'Hombros', 'maquina', 'weight', 60],
  ['Vuelos Posteriores a Un Brazo (Cable)', 'Single Arm Rear Delt Fly (Cable)', 'Hombros', 'polea', 'weight', 60],
  ['Face Pull (Cable)', 'Face Pull', 'Hombros', 'polea', 'weight', 60],
  // Bíceps
  ['Curl de Bíceps (Barra)', 'Bicep Curl (Barbell)', 'Bíceps', 'barra', 'weight', 75],
  ['Curl de Bíceps (Mancuerna)', 'Bicep Curl (Dumbbell)', 'Bíceps', 'mancuernas', 'weight', 75],
  ['Curl de Bíceps (Cable)', 'Bicep Curl (Cable)', 'Bíceps', 'polea', 'weight', 60],
  ['Curl Martillo (Mancuerna)', 'Hammer Curl (Dumbbell)', 'Bíceps', 'mancuernas', 'weight', 75],
  ['Curl Martillo (Cable)', 'Hammer Curl (Cable)', 'Bíceps', 'polea', 'weight', 60],
  ['Curl Predicador (Máquina)', 'Preacher Curl (Machine)', 'Bíceps', 'maquina', 'weight', 75],
  ['Curl Predicador Unilateral', 'Single Arm Preacher Curl (Dumbbell)', 'Bíceps', 'mancuernas', 'weight', 60],
  // Tríceps
  ['Jalón de Tríceps en Polea', 'Triceps Pushdown', 'Tríceps', 'polea', 'weight', 60],
  ['Extensión de Tríceps a un Brazo (Cable)', 'Single Arm Triceps Pushdown (Cable)', 'Tríceps', 'polea', 'weight', 60],
  ['Extensión de Tríceps sobre la Cabeza (Cable)', 'Overhead Triceps Extension (Cable)', 'Tríceps', 'polea', 'weight', 60],
  ['Press Francés (Barra Z)', 'Skullcrusher (Barbell)', 'Tríceps', 'barra', 'weight', 90],
  // Piernas
  ['Sentadilla (Barra)', 'Squat (Barbell)', 'Piernas', 'barra', 'weight', 180],
  ['Sentadilla Hack (Máquina)', 'Hack Squat (Machine)', 'Piernas', 'maquina', 'weight', 120],
  ['Prensa de Piernas (Máquina)', 'Leg Press (Machine)', 'Piernas', 'discos', 'weight', 120],
  ['Sentadilla Búlgara (Mancuerna)', 'Bulgarian Split Squat', 'Piernas', 'mancuernas', 'weight', 90],
  ['Zancadas (Mancuerna)', 'Lunge (Dumbbell)', 'Piernas', 'mancuernas', 'weight', 90],
  ['Peso Muerto Rumano (Barra)', 'Romanian Deadlift (Barbell)', 'Piernas', 'barra', 'weight', 150],
  ['Peso Muerto Rumano a Una Pierna (Mancuerna)', 'Single Leg Romanian Deadlift (Dumbbell)', 'Piernas', 'mancuernas', 'weight', 75],
  ['Extensión de Piernas (Máquina)', 'Leg Extension (Machine)', 'Piernas', 'maquina', 'weight', 75],
  ['Extensiones a Una Pierna', 'Single Leg Extensions', 'Piernas', 'maquina', 'weight', 60],
  ['Curl de Pierna Sentado', 'Seated Leg Curl (Machine)', 'Piernas', 'maquina', 'weight', 75],
  ['Curl de Pierna Tumbado (Máquina)', 'Lying Leg Curl (Machine)', 'Piernas', 'maquina', 'weight', 75],
  ['Elevación de Gemelos de Pie (Máquina)', 'Standing Calf Raise (Machine)', 'Piernas', 'maquina', 'weight', 60],
  ['Elevación de Gemelos a Una Pierna', 'Single Leg Standing Calf Raise', 'Piernas', 'corporal', 'reps', 45],
  // Glúteos
  ['Hip Thrust (Barra)', 'Hip Thrust (Barbell)', 'Glúteos', 'barra', 'weight', 120],
  ['Aducción de Cadera (Máquina)', 'Hip Adduction (Machine)', 'Glúteos', 'maquina', 'weight', 60],
  ['Abducción de Cadera (Máquina)', 'Hip Abduction (Machine)', 'Glúteos', 'maquina', 'weight', 60],
  // Core
  ['Plancha', 'Plank', 'Core', 'corporal', 'time', 60],
  ['Levantamiento de Piernas en Barra', 'Hanging Leg Raise', 'Core', 'corporal', 'reps', 60],
  ['Levantamiento de Rodillas en Barra', 'Hanging Knee Raise', 'Core', 'corporal', 'reps', 60],
  ['Crunch en Polea', 'Cable Crunch', 'Core', 'polea', 'weight', 60],
  ['Rueda Abdominal', 'Ab Wheel', 'Core', 'corporal', 'reps', 60],
  ['Flexión Lateral (Mancuerna)', 'Side Bend (Dumbbell)', 'Core', 'mancuernas', 'weight', 45],
  ['Halo con pesa rusa', 'Kettlebell Halo', 'Core', 'kettlebell', 'weight', 45],
];

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const LIBRARY = L.map(([name, en, muscle, equipment, kind, rest]) => ({
  id: 'lib-' + slug(name),
  name, muscle, equipment, kind, rest,
  aliases: [en],
  perSide: equipment === 'discos',
  inc: null,
  custom: false,
}));
