import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const $ = id => document.getElementById(id);
const viewport = $('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8e9e3');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(6, 5.2, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.appendChild(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 1, 0);
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.minDistance = 3;
orbit.maxDistance = 18;

scene.add(new THREE.HemisphereLight(0xffffff, 0x898b7e, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(4, 8, 5);
sun.castShadow = true;
scene.add(sun);

const floorMat = new THREE.MeshStandardMaterial({ color: '#d9d9d0', roughness: 0.9 });
const wallMat = new THREE.MeshStandardMaterial({ color: '#f7f5ee', roughness: 0.95, side: THREE.DoubleSide });
const cabinetMat = new THREE.MeshStandardMaterial({ color: '#d8d0c1', roughness: 0.65 });
const topMat = new THREE.MeshStandardMaterial({ color: '#8b897f', roughness: 0.45 });
const detailMat = new THREE.MeshStandardMaterial({ color: '#77776d', metalness: 0.55, roughness: 0.35 });

let room = { width: 4, length: 4, height: 2.7 };
let units = [];
let selected = null;
let nextId = 1;
let facadeColor = '#d8d0c1';
let dragging = false;
let moved = false;
let lastPointer = null;
let pointerDown = null;

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.015;
floor.receiveShadow = true;
scene.add(floor);

const roomGroup = new THREE.Group();
scene.add(roomGroup);
const unitGroup = new THREE.Group();
scene.add(unitGroup);

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.traverse?.(obj => {
      if (obj.geometry) obj.geometry.dispose();
    });
  }
}

function addBox(parent, size, position, material, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.part = name;
  parent.add(mesh);
  return mesh;
}

function drawRoom() {
  clearGroup(roomGroup);
  const { width: w, length: l, height: h } = room;
  addBox(roomGroup, [w, 0.08, l], [0, 0, 0], floorMat, 'floor');

  // Back wall and two side walls
  addBox(roomGroup, [w, h, 0.08], [0, h / 2, -l / 2], wallMat, 'wall');
  addBox(roomGroup, [0.08, h, l], [-w / 2, h / 2, 0], wallMat, 'wall');
  addBox(roomGroup, [0.08, h, l], [w / 2, h / 2, 0], wallMat, 'wall');

  // Subtle floor grid
  const grid = new THREE.GridHelper(Math.max(w, l), Math.round(Math.max(w, l) * 2), 0xb7b8ad, 0xd0d1c8);
  grid.position.y = 0.045;
  roomGroup.add(grid);

  orbit.target.set(0, h * 0.38, 0);
  orbit.update();
}


function dimensions(type) {
  const defs = {
    base:   { w:.6, h:.86, d:.58, price:2900, name:'Нижний шкаф' },
    drawer: { w:.6, h:.86, d:.58, price:3600, name:'Шкаф с ящиками' },
    tall:   { w:.6, h:Math.min(2.2, room.height-.2), d:.58, price:4200, name:'Высокий шкаф' },
    wall:   { w:.6, h:.72, d:.35, price:2400, name:'Навесной шкаф' },
    fridge: { w:.72, h:1.85, d:.7, price:9500, name:'Холодильник' },
    sink:   { w:.6, h:.86, d:.58, price:1800, name:'Мойка' },
    faucet: { w:.16, h:.35, d:.16, price:650, name:'Кран' },
    stove:  { w:.6, h:.08, d:.52, price:2200, name:'Варочная панель' },
    oven:   { w:.6, h:.6, d:.55, price:3200, name:'Духовка' },
    window: { w:1.2, h:1.0, d:.09, price:0, name:'Окно' },
    door:   { w:.9, h:2.05, d:.1, price:0, name:'Дверь' },
    table:  { w:1.2, h:.76, d:.75, price:2500, name:'Обеденный стол' },
    chair:  { w:.42, h:.9, d:.42, price:700, name:'Стул' }
  };
  return defs[type] || defs.base;
}



function buildUnit(data) {
  const dim = dimensions(data.type);
  const group = new THREE.Group();
  group.userData.unitId = data.id;
  group.userData.type = data.type;

  const facade = new THREE.MeshStandardMaterial({
    color: data.color || facadeColor,
    roughness: .58
  });
  const dark = new THREE.MeshStandardMaterial({ color:'#454943', roughness:.45 });
  const metal = new THREE.MeshStandardMaterial({ color:'#aeb1aa', metalness:.7, roughness:.25 });
  const glass = new THREE.MeshStandardMaterial({
    color:'#a9d5e7', metalness:.15, roughness:.18,
    transparent:true, opacity:.72
  });
  const wood = new THREE.MeshStandardMaterial({ color:'#b29a7b', roughness:.7 });
  const black = new THREE.MeshStandardMaterial({ color:'#222522', roughness:.3 });

  const box = (size, pos, mat, part='') =>
    addBox(group, size, pos, mat, part);

  const cyl = (radius, height, pos, mat, sides=20) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, sides), mat
    );
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.userData.part = '';
    mesh.userData.unitId = data.id;
    group.add(mesh);
    return mesh;
  };

  const t = data.type;
  const isWall = t === 'wall';
  let defaultY = dim.h/2 + .05;

  if (t === 'window') defaultY = Math.min(room.height*.62, room.height-.65);
  if (t === 'door') defaultY = dim.h/2 + .05;
  if (t === 'faucet') defaultY = .98;
  if (t === 'stove') defaultY = .95;
  if (t === 'oven') defaultY = .52;
  if (t === 'wall') defaultY = Math.min(room.height-dim.h/2-.2, 1.85);
  if (t === 'chair') defaultY = .45;

  if (['base','drawer','tall','wall'].includes(t)) {
    const bodyH = dim.h - .035;
    box([dim.w-.035, bodyH, dim.d-.025], [0,0,0], wood, 'body');
    box([dim.w-.07, dim.h-.08, .035], [0,0,dim.d/2+.02], facade, 'facade');

    if (t === 'drawer') {
      for (let i=0; i<3; i++) {
        const yy = -dim.h/2 + dim.h*(i+.5)/3;
        box([dim.w*.52,.025,.025], [0,yy,dim.d/2+.045], metal);
      }
    } else {
      box([.16,.025,.025], [0,0,dim.d/2+.045], metal);
    }
    if (!isWall) {
      box([dim.w+.025,.045,dim.d+.035], [0,dim.h/2+.025,0], topMat, 'countertop');
      box([dim.w-.07,.04,dim.d-.07], [0,-dim.h/2+.025,0], wood);
    }
  }

  if (t === 'fridge') {
    box([dim.w,dim.h,dim.d], [0,0,0], facade, 'facade');
    box([dim.w-.035,dim.h*.57,.025], [0,dim.h*.21,dim.d/2+.014], metal);
    box([dim.w-.035,.018,.025], [0,-dim.h*.08,dim.d/2+.016], dark);
    box([.025,dim.h*.35,.035], [dim.w*.32,dim.h*.23,dim.d/2+.025], metal);
    box([.025,dim.h*.28,.035], [dim.w*.32,-dim.h*.28,dim.d/2+.025], metal);
  }

  if (t === 'sink') {
    box([dim.w, .07, dim.d], [0,0,0], topMat);
    box([dim.w*.66,.035,dim.d*.56], [0,.045,0], dark);
    box([dim.w*.58,.025,dim.d*.48], [0,.065,0], metal);
    box([.035,.02,.035], [0,.085,0], dark);
  }

  if (t === 'faucet') {
    cyl(.035,.22,[0,-.08,0],metal);
    cyl(.025,.18,[0,.035,-.025],metal);
    cyl(.022,.15,[0,.105,.045],metal);
    cyl(.018,.07,[0,.17,.075],metal);
  }

  if (t === 'stove') {
    box([dim.w,.065,dim.d],[0,0,0],black,'facade');
    for (const x of [-.17,.17]) {
      for (const z of [-.13,.13]) {
        cyl(.085,.018,[x,.042,z],metal);
        cyl(.057,.02,[x,.054,z],black);
      }
    }
  }

  if (t === 'oven') {
    box([dim.w,dim.h,dim.d],[0,0,0],facade,'facade');
    box([dim.w*.76,dim.h*.53,.025],[0,-.04,dim.d/2+.018],black);
    box([dim.w*.65,.025,.025],[0,dim.h*.34,dim.d/2+.04],metal);
    for (let i=0;i<3;i++) cyl(.025,.025,[-.16+i*.16,dim.h*.39,dim.d/2+.04],metal);
  }

  if (t === 'window') {
    box([dim.w,dim.h,.06],[0,0,0],wood);
    box([dim.w-.12,dim.h-.12,.025],[0,0,.04],glass,'facade');
    box([.035,dim.h-.08,.025],[0,0,.06],wood);
    box([dim.w-.08,.035,.025],[0,0,.06],wood);
    box([.025,dim.h-.08,.025],[0,0,.075],metal);
  }

  if (t === 'door') {
    box([dim.w,dim.h,.07],[0,0,0],wood,'facade');
    box([dim.w*.65,dim.h*.65,.018],[0,.05,.045],facade);
    cyl(.025,.025,[dim.w*.32,-.05,.07],metal);
  }

  if (t === 'table') {
    box([dim.w,.07,dim.d],[0,dim.h/2,0],wood,'facade');
    for (const x of [-dim.w*.42,dim.w*.42]) {
      for (const z of [-dim.d*.36,dim.d*.36]) {
        box([.055,dim.h-.06,.055],[x,-.025,z],dark);
      }
    }
  }

  if (t === 'chair') {
    box([dim.w,.06,dim.d*.9],[0,0,0],wood,'facade');
    for (const x of [-dim.w*.38,dim.w*.38]) {
      for (const z of [-dim.d*.38,dim.d*.38]) {
        box([.035,.43,.035],[x,-.22,z],wood);
      }
    }
    box([dim.w,.43,.045],[0,.24,-dim.d*.4],wood);
    box([dim.w,.06,dim.d*.88],[0,.47,-dim.d*.4],facade);
  }

  let x = Number.isFinite(data.x) ? data.x : 0;
  let z = Number.isFinite(data.z) ? data.z : 0;

  group.position.set(x, defaultY, z);
  group.rotation.y = data.rotation || 0;
  group.userData.price = dim.price;
  group.userData.name = dim.name;
  group.userData.dim = dim;
  group.userData.saved = { ...data };
  group.traverse(obj => {
    if (obj.isMesh) obj.userData.unitId = data.id;
  });
  unitGroup.add(group);
  return group;
}



function addUnit(type) {
  const dim = dimensions(type);
  const id = nextId++;
  let x = 0;
  let z = 0;

  const wallTypes = ['base','drawer','wall','sink','stove','oven','fridge'];
  const wallItems = units.filter(u => wallTypes.includes(u.userData.type));

  if (wallTypes.includes(type)) {
    // Ставим кухонные модули последовательно вдоль задней стены.
    const usedWidth = wallItems.reduce(
      (sum, u) => sum + u.userData.dim.w + 0.04, 0
    );
    x = -room.width / 2 + 0.08 + usedWidth + dim.w / 2;
    z = -room.length / 2 + dim.d / 2 + 0.08;

    // Если не помещается, начинаем следующий ряд.
    if (x + dim.w / 2 > room.width / 2 - 0.05) {
      const row = Math.floor(wallItems.length / 3) + 1;
      x = -room.width / 2 + dim.w / 2 + 0.08;
      z = -room.length / 2 + dim.d / 2 + 0.08 + row * (dim.d + 0.12);
    }
  } else if (type === 'window' || type === 'door') {
    x = type === 'window' ? 0 : room.width / 2 - dim.w / 2 - 0.05;
    z = -room.length / 2 + dim.d / 2 + 0.05;
  } else {
    // Стол, стулья, кран и другие отдельные предметы — разные позиции.
    const index = units.length;
    const cols = 3;
    const spacingX = Math.max(dim.w + 0.25, 0.8);
    const spacingZ = Math.max(dim.d + 0.25, 0.8);
    x = -room.width / 2 + 0.6 + (index % cols) * spacingX;
    z = -room.length / 2 + 1.0 + Math.floor(index / cols) * spacingZ;
  }

  x = THREE.MathUtils.clamp(
    x, -room.width / 2 + dim.w / 2, room.width / 2 - dim.w / 2
  );
  z = THREE.MathUtils.clamp(
    z, -room.length / 2 + dim.d / 2, room.length / 2 - dim.d / 2
  );

  const data = { id, type, x, z, rotation: 0, color: facadeColor };
  const unit = buildUnit(data);
  units.push(unit);
  selectUnit(unit);
  updateEstimate();
  status('Добавлен предмет: ' + unit.userData.name + '.');
}
function selectUnit(unit) {
  if (selected) selected.traverse(o => {
    if (o.isMesh && o.material?.emissive) o.material.emissive.set('#000000');
  });
  selected = unit;
  if (selected) {
    selected.traverse(o => {
      if (o.isMesh && o.material?.emissive) o.material.emissive.set('#222218');
    });
    $('selectionInfo').textContent = selected.userData.name + ' · ширина 60 см';
  } else {
    $('selectionInfo').textContent = 'Выберите модуль в 3D, чтобы изменить его.';
  }
  if (typeof refreshObjectControls === 'function') refreshObjectControls();
}


let moveMode = false;

function refreshObjectControls() {
  const panel = document.getElementById('objectControls');
  if (!panel) return;
  panel.style.display = selected ? 'block' : 'none';
  const title = document.getElementById('objectControlsTitle');
  if (title) title.textContent = selected
    ? 'Выбран предмет: ' + (selected.userData.name || 'Модуль')
    : 'Сначала выберите предмет';
  const move = document.getElementById('moveSelected');
  if (move) {
    move.textContent = moveMode ? 'Готово: перемещение' : '↔ Переместить';
    move.style.background = moveMode ? '#3b7555' : '#333';
  }
}

(function createObjectControls() {
  let panel = document.getElementById('objectControls');
  const info = document.getElementById('selectionInfo');

  if (!panel) {
    if (!info) {
      console.error('Не найден selectionInfo');
      return;
    }
    panel = document.createElement('div');
    panel.id = 'objectControls';
    panel.style.cssText =
      'display:none;margin:12px 0;padding:12px;border:1px solid #777;border-radius:12px;background:#202020;color:white;';
    panel.innerHTML = `
      <div id="objectControlsTitle" style="font-weight:600;margin-bottom:10px">Выберите предмет</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button id="moveSelected" type="button">↔ Переместить</button>
        <button id="rotateSelected" type="button">⟳ Повернуть</button>
        <button id="deleteSelected" type="button">✕ Удалить</button>
      </div>
      <div style="font-size:12px;margin-top:8px;color:#ccc">
        Включите перемещение, затем перетащите предмет пальцем.
      </div>`;
    info.insertAdjacentElement('afterend', panel);
  }

  // Если обработчики уже подключены, не подключаем их повторно.
  if (panel.dataset.controlsBound === 'yes') return;
  panel.dataset.controlsBound = 'yes';

  const moveButton = document.getElementById('moveSelected');
  const rotateButton = document.getElementById('rotateSelected');
  const deleteButton = document.getElementById('deleteSelected');

  if (moveButton) moveButton.addEventListener('click', () => {
    if (!selected) {
      status('Сначала нажмите на предмет в 3D.');
      return;
    }
    moveMode = !moveMode;
    refreshObjectControls();
    status(moveMode
      ? 'Перемещение включено: перетащите выбранный предмет.'
      : 'Перемещение выключено.');
  });

  if (rotateButton) rotateButton.addEventListener('click', () => {
    if (!selected) {
      status('Сначала выберите предмет.');
      return;
    }
    selected.rotation.y += Math.PI / 2;
    if (selected.userData.saved) {
      selected.userData.saved.rotation = selected.rotation.y;
    }
    status('Предмет повёрнут на 90°.');
  });

  if (deleteButton) deleteButton.addEventListener('click', () => {
    if (!selected) {
      status('Сначала выберите предмет.');
      return;
    }
    unitGroup.remove(selected);
    units = units.filter(u => u !== selected);
    selected = null;
    moveMode = false;
    selectUnit(null);
    updateEstimate();
    status('Предмет удалён.');
  });
})();

function updateEstimate() {
  const price = units.reduce((sum, u) => sum + u.userData.price, 0);
  const length = units.filter(u => ['base','drawer','sink','stove','oven'].includes(u.userData.type)).reduce((sum, u) => sum + u.userData.dim.w, 0);
  $('totalPrice').textContent = price.toLocaleString('ru-RU') + ' MDL';
  $('moduleCount').textContent = units.length;
  $('runLength').textContent = length.toFixed(1) + ' м';
}

function status(message) {
  $('status').textContent = message;
}

function applyRoom() {
  const w = Number($('roomWidth').value);
  const l = Number($('roomLength').value);
  const h = Number($('roomHeight').value);
  if (![w, l, h].every(Number.isFinite) || w < 2 || w > 10 || l < 2 || l > 10 || h < 2 || h > 4) {
    status('Введите ширину и длину от 2 до 10 м, высоту от 2 до 4 м.');
    return;
  }
  room = { width: w, length: l, height: h };
  drawRoom();
  status('Размеры комнаты обновлены. Проверьте расположение модулей.');
}

function projectData() {
  return {
    version: 1,
    room,
    facadeColor,
    units: units.map(u => ({
      id: u.userData.unitId,
      type: u.userData.type,
      x: u.position.x,
      z: u.position.z,
      rotation: u.rotation.y,
      color: u.userData.saved.color || facadeColor
    }))
  };
}

function loadData(data) {
  if (!data || !data.room || !Array.isArray(data.units)) throw new Error('Неверный формат проекта');
  const r = data.room;
  if (![r.width, r.length, r.height].every(Number.isFinite) ||
      r.width < 2 || r.width > 10 || r.length < 2 || r.length > 10 || r.height < 2 || r.height > 4 ||
      data.units.length > 100) throw new Error('Некорректные параметры проекта');
  room = { width: r.width, length: r.length, height: r.height };
  $('roomWidth').value = room.width;
  $('roomLength').value = room.length;
  $('roomHeight').value = room.height;
  facadeColor = data.facadeColor || '#d8d0c1';
  document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('active', b.dataset.color === facadeColor));
  clearGroup(unitGroup);
  units = [];
  selected = null;
  nextId = 1;
  drawRoom();
  for (const item of data.units) {
    if (!['base','drawer','tall','wall','fridge','sink','faucet','stove','oven','window','door','table','chair'].includes(item.type)) continue;
    const safe = {
      id: Number.isFinite(item.id) ? item.id : nextId,
      type: item.type,
      x: THREE.MathUtils.clamp(Number(item.x) || 0, -room.width / 2 + 0.35, room.width / 2 - 0.35),
      z: THREE.MathUtils.clamp(Number(item.z) || 0, -room.length / 2 + 0.3, room.length / 2 - 0.3),
      rotation: Number(item.rotation) || 0,
      color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : facadeColor
    };
    nextId = Math.max(nextId, safe.id + 1);
    units.push(buildUnit(safe));
  }
  updateEstimate();
  status('Проект загружен.');
}

$('updateRoom').addEventListener('click', applyRoom);
document.querySelectorAll('[data-module]').forEach(b => b.addEventListener('click', () => addUnit(b.dataset.module)));

document.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
  facadeColor = b.dataset.color;
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s === b));
  for (const unit of units) {
    unit.traverse(o => {
      if (o.isMesh && o.userData.part === 'facade') {
        o.material.color.set(facadeColor);
      }
    });
    unit.userData.saved.color = facadeColor;
  }
  status('Цвет фасадов изменён.');
}));

$('rotateModule').addEventListener('click', () => {
  if (!selected) return status('Сначала выберите модуль.');
  selected.rotation.y += Math.PI / 2;
  selected.userData.saved.rotation = selected.rotation.y;
});
$('deleteModule').addEventListener('click', () => {
  if (!selected) return status('Сначала выберите модуль.');
  unitGroup.remove(selected);
  units = units.filter(u => u !== selected);
  selected = null;
  selectUnit(null);
  updateEstimate();
  status('Модуль удалён.');
});

$('saveProject').addEventListener('click', () => {
  try {
    localStorage.setItem('forma-kitchen-project', JSON.stringify(projectData()));
    status('Проект сохранён в памяти этого браузера.');
  } catch (e) { status('Не удалось сохранить проект в браузере.'); }
});
$('loadProject').addEventListener('click', () => {
  try {
    const saved = localStorage.getItem('forma-kitchen-project');
    if (!saved) return status('Сохранённых проектов пока нет.');
    loadData(JSON.parse(saved));
  } catch (e) { status('Не удалось загрузить проект.'); }
});

$('exportProject').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(projectData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'forma-kitchen-project.json'; a.click();
  URL.revokeObjectURL(url);
  status('Файл проекта подготовлен.');
});
$('importProject').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  
  if (!file) return;

  try {
    const text = await file.text();
    loadData(JSON.parse(text));
  } catch (e) {
    status('Не удалось импортировать проект. Проверьте файл.');
  }

  e.target.value = '';
});

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  0
);

let dragOffset = new THREE.Vector3();

renderer.domElement.addEventListener('pointerdown', event => {
  if (!moveMode || !selected) return;

  dragging = true;
  moved = false;
  orbit.enabled = false;

  dragPlane.constant = selected.position.y;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(dragPlane, point)) {
    dragOffset.set(
      selected.position.x - point.x,
      0,
      selected.position.z - point.z
    );
  }

  lastPointer = { x: event.clientX, y: event.clientY };
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', event => {
  if (!dragging || !selected) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, point)) return;

  moved = true;

  const dim = selected.userData.dim;
  selected.position.x = THREE.MathUtils.clamp(
    point.x + dragOffset.x,
    -room.width / 2 + dim.w / 2,
    room.width / 2 - dim.w / 2
  );
  selected.position.z = THREE.MathUtils.clamp(
    point.z + dragOffset.z,
    -room.length / 2 + dim.d / 2,
    room.length / 2 - dim.d / 2
  );
});

function stopDragging() {
  if (!dragging) return;

  dragging = false;
  orbit.enabled = true;

  if (selected?.userData.saved) {
    selected.userData.saved.x = selected.position.x;
    selected.userData.saved.z = selected.position.z;
  }
}

renderer.domElement.addEventListener('pointerup', stopDragging);
renderer.domElement.addEventListener('pointercancel', stopDragging);

renderer.domElement.addEventListener('click', event => {
  if (moveMode || moved) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(unitGroup.children, true);
  const hit = hits.find(item => item.object.userData.unitId !== undefined);

  if (hit) {
    const id = hit.object.userData.unitId;
    selectUnit(units.find(unit => unit.userData.unitId === id) || null);
  }
});

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  renderer.render(scene, camera);
}

drawRoom();
resize();
updateEstimate();
animate();

window.addEventListener('resize', resize);

