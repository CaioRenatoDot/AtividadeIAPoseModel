const MODEL_PATH = "./my-pose-model/";
const CONFIDENCE_THRESHOLD = 0.85;
const REQUIRED_FRAMES = 6;

// DOM Elements
const inputName = document.getElementById("inputName");
const inputMat = document.getElementById("inputMat");
const btnAdd = document.getElementById("btnAdd");
const btnClear = document.getElementById("btnClear");
const btnExportCSV = document.getElementById("btnExportCSV");
const studentsBody = document.getElementById("studentsBody");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnSimulate = document.getElementById("btnSimulate");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const finalStatus = document.getElementById("finalStatus");

let students = [];
let selectedId = null;
let model, webcam, running = false, raf = null, consecutive = [];

// -------- Local Storage --------
function load() {
  const raw = localStorage.getItem("students_pose");
  students = raw ? JSON.parse(raw) : [];
}
function save() {
  localStorage.setItem("students_pose", JSON.stringify(students));
}

// -------- Table Rendering --------
function render() {
  studentsBody.innerHTML = "";
  students.forEach((s) => {
    const tr = document.createElement("tr");
    tr.dataset.id = s.id;

    const tdName = document.createElement("td");
    tdName.textContent = s.name;

    const tdMat = document.createElement("td");
    tdMat.textContent = s.mat;

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "status " + (s.status || "unknown");
    badge.textContent =
      s.status === "approved"
        ? "APROVADO"
        : s.status === "rejected"
        ? "REPROVADO"
        : "—";
    tdStatus.appendChild(badge);

    const tdActions = document.createElement("td");
    const btnSel = document.createElement("button");
    btnSel.textContent = "Selecionar";
    btnSel.onclick = () => select(s.id);
    const btnReset = document.createElement("button");
    btnReset.textContent = "Reset";
    btnReset.className = "ghost";
    btnReset.onclick = () => {
      s.status = null;
      save();
      render();
    };
    tdActions.appendChild(btnSel);
    tdActions.appendChild(btnReset);

    tr.append(tdName, tdMat, tdStatus, tdActions);
    studentsBody.appendChild(tr);
  });
}

// -------- Actions --------
btnAdd.onclick = () => {
  const name = inputName.value.trim();
  const mat = inputMat.value.trim();
  if (!name || !mat) return alert("Preencha nome e matrícula");
  students.push({ id: Date.now(), name, mat, status: null });
  save();
  render();
  inputName.value = "";
  inputMat.value = "";
};

btnClear.onclick = () => {
  if (!confirm("Deseja apagar todos os alunos?")) return;
  students = [];
  save();
  render();
};

btnExportCSV.onclick = () => {
  const rows = [
    ["id", "nome", "matricula", "status"],
    ...students.map((s) => [s.id, s.name, s.mat, s.status || "nenhum"]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "alunos.csv";
  a.click();
  URL.revokeObjectURL(url);
};

function select(id) {
  selectedId = id;
  finalStatus.textContent = "Aguardando...";
  finalStatus.className = "status unknown";
  render();
}

// -------- Teachable Machine --------
async function loadModel() {
  const modelURL = MODEL_PATH + "model.json";
  const metadataURL = MODEL_PATH + "metadata.json";
  model = await tmPose.load(modelURL, metadataURL);
  consecutive = new Array(model.getTotalClasses()).fill(0);
}

async function start() {
  if (!selectedId) return alert("Selecione um aluno primeiro!");
  btnStart.disabled = true;
  btnStop.disabled = false;

  try {
    await loadModel();
  } catch (e) {
    alert("Erro ao carregar modelo. Confira o caminho e abra o servidor local.");
    btnStart.disabled = false;
    btnStop.disabled = true;
    return;
  }

  const size = 320;
  webcam = new tmPose.Webcam(size, size, true);
  await webcam.setup();
  await webcam.play();
  running = true;
  loop();
}

function stop() {
  running = false;
  if (webcam) webcam.stop();
  if (raf) cancelAnimationFrame(raf);
  btnStart.disabled = false;
  btnStop.disabled = true;
}

async function loop() {
  if (!running) return;
  webcam.update();
  await predict();
  raf = requestAnimationFrame(loop);
}

async function predict() {
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
  const prediction = await model.predict(posenetOutput);
  const top = prediction.sort((a, b) => b.probability - a.probability)[0];
  const index = model.getClassLabels().indexOf(top.className);

  if (top.probability > CONFIDENCE_THRESHOLD)
    consecutive[index]++;
  else
    consecutive.fill(0);

  for (let i = 0; i < consecutive.length; i++) {
    if (consecutive[i] >= REQUIRED_FRAMES) {
      handleDetection(model.getClassLabels()[i]);
      stop();
      break;
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(webcam.canvas, 0, 0);
  if (pose)
    tmPose.drawKeypoints(pose.keypoints, 0.5, ctx),
      tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
}

function handleDetection(label) {
  const student = students.find((s) => s.id === selectedId);
  if (!student) return;
  const l = label.toLowerCase();

  if (l.includes("approve") || l.includes("up")) {
    student.status = "approved";
    finalStatus.textContent = "APROVADO";
    finalStatus.className = "status approved";
  } else if (l.includes("reject") || l.includes("down")) {
    student.status = "rejected";
    finalStatus.textContent = "REPROVADO";
    finalStatus.className = "status rejected";
  } else {
    finalStatus.textContent = "Gesto não reconhecido";
    finalStatus.className = "status unknown";
  }

  save();
  render();
}

btnSimulate.onclick = () => {
  if (!selectedId) return alert("Selecione um aluno!");
  const s = students.find((x) => x.id === selectedId);
  s.status = "approved";
  finalStatus.textContent = "APROVADO";
  finalStatus.className = "status approved";
  save();
  render();
};

const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');

toggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
});


btnStart.onclick = start;
btnStop.onclick = stop;

load();
render();
