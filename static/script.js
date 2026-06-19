// ─── State ────────────────────────────────────────────────────────────────────
let pendingFormData = null;

// ─── BU Toggle ────────────────────────────────────────────────────────────────
function toggleNewBU() {
    const select = document.getElementById('bu_selecionada');
    const group = document.getElementById('nova_bu_group');
    const isNew = select.value === '+ Cadastrar Nova BU';
    group.classList.toggle('hidden', !isNew);
    document.getElementById('nova_bu').required = isNew;
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function openTab(event, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById('modo').value = tabId;
}

// ─── Manual Table ─────────────────────────────────────────────────────────────
function addRow() {
    const tbody = document.querySelector('#manualTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" /></td>
        <td><input type="text" /></td>
        <td><input type="text" /></td>
        <td><input type="text" /></td>
        <td><input type="text" /></td>
        <td><button type="button" class="btn-danger" onclick="removeRow(this)">X</button></td>
    `;
    tbody.appendChild(tr);
}

function removeRow(btn) {
    const tbody = document.querySelector('#manualTable tbody');
    if (tbody.children.length > 1) btn.closest('tr').remove();
}

function getColumnHeaders() {
    return [...document.querySelectorAll('#manualTable thead th.editable-header')]
        .map((th, i) => th.innerText.trim() || `CONFIG_${i + 1}`);
}

function extractTableData() {
    const headers = getColumnHeaders();
    const data = [];
    document.querySelectorAll('#manualTable tbody tr').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const rowData = {};
        headers.forEach((h, i) => { rowData[h] = inputs[i].value.trim(); });
        if (Object.values(rowData).some(v => v !== '')) data.push(rowData);
    });
    return JSON.stringify(data);
}

// ─── CSV Parser (client-side, mirrors server logic) ───────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = lines[i].split(delimiter);
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = (vals[idx] || '').trim().replace(/^"|"$/g, '');
        });
        rows.push(obj);
    }
    return rows;
}

// ─── Drag-and-Drop ────────────────────────────────────────────────────────────
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('arquivo');

['dragenter', 'dragover'].forEach(evt => {
    dropArea.addEventListener(evt, e => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });
});

['dragleave', 'drop'].forEach(evt => {
    dropArea.addEventListener(evt, e => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
    });
});

dropArea.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
        showAlert('error', 'Apenas arquivos .csv são aceitos.');
        return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    document.querySelector('.file-msg').innerText = file.name;
});

fileInput.addEventListener('change', e => {
    const name = e.target.files[0]?.name || 'Arraste seu arquivo .csv aqui ou clique para selecionar';
    document.querySelector('.file-msg').innerText = name;
});

// ─── Preview Modal ────────────────────────────────────────────────────────────
function resolveBU() {
    const sel = document.getElementById('bu_selecionada');
    return sel.value === '+ Cadastrar Nova BU'
        ? document.getElementById('nova_bu').value
        : sel.value;
}

function showPreview(formData, rows, meta) {
    pendingFormData = formData;

    // Meta summary
    const bu_display = meta.usuario ? `${meta.bu} - ${meta.usuario}` : meta.bu;
    document.getElementById('modalMeta').innerHTML = `
        <div class="meta-item"><label>Nome do Assunto</label><span>${escHtml(meta.assunto)}</span></div>
        <div class="meta-item"><label>Área (BU)</label><span>${escHtml(bu_display)}</span></div>
        <div class="meta-item"><label>Key Info</label><span>${escHtml(meta.key_info)}</span></div>
        <div class="meta-item"><label>Usuário</label><span>${escHtml(meta.usuario)}</span></div>
        ${meta.comentario ? `<div class="meta-item"><label>Comentário</label><span>${escHtml(meta.comentario)}</span></div>` : ''}
    `;

    const preview = rows.slice(0, 10);
    document.getElementById('previewCount').innerText =
        `${rows.length} linha(s) encontrada(s). Exibindo as primeiras ${preview.length}.`;

    const headers = Object.keys(rows[0]);
    document.getElementById('previewHead').innerHTML =
        headers.map(h => `<th>${escHtml(h)}</th>`).join('');
    document.getElementById('previewBody').innerHTML =
        preview.map(row =>
            `<tr>${headers.map(h => `<td>${escHtml(row[h] ?? '')}</td>`).join('')}</tr>`
        ).join('');

    document.getElementById('previewModal').classList.remove('hidden');
}

function closePreview() {
    document.getElementById('previewModal').classList.add('hidden');
    pendingFormData = null;
    resetSubmitBtn();
}

async function confirmSubmit() {
    const btn = document.getElementById('confirmBtn');
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const response = await fetch('/upload', { method: 'POST', body: pendingFormData });
        const result = await response.json();
        document.getElementById('previewModal').classList.add('hidden');
        if (response.ok) {
            showAlert('success', result.message);
        } else {
            showAlert('error', `Erro: ${result.message}`);
        }
    } catch (err) {
        showAlert('error', `Erro de comunicação: ${err.message}`);
    } finally {
        btn.innerText = 'Confirmar e Enviar';
        btn.disabled = false;
        pendingFormData = null;
        resetSubmitBtn();
    }
}

// ─── Form Submission ──────────────────────────────────────────────────────────
document.getElementById('uploadForm').addEventListener('submit', async e => {
    e.preventDefault();

    const modo = document.getElementById('modo').value;
    const formData = new FormData(e.target);
    const meta = {
        assunto:    document.getElementById('assunto').value,
        comentario: document.getElementById('comentario').value,
        key_info:   document.getElementById('key_info').value,
        usuario:    document.getElementById('usuario').value,
        bu:         resolveBU(),
    };

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = 'Lendo dados...';
    submitBtn.disabled = true;

    if (modo === 'manual') {
        const jsonData = extractTableData();
        if (jsonData === '[]') {
            showAlert('error', 'A tabela está vazia. Preencha os dados antes de enviar.');
            resetSubmitBtn();
            return;
        }
        formData.set('dados_manuais', jsonData);
        formData.delete('arquivo');
        showPreview(formData, JSON.parse(jsonData), meta);

    } else {
        const file = fileInput.files[0];
        if (!file) {
            showAlert('error', 'Nenhum arquivo selecionado.');
            resetSubmitBtn();
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
            const rows = parseCSV(ev.target.result);
            if (rows.length === 0) {
                showAlert('error', 'O arquivo CSV está vazio ou não pôde ser lido.');
                resetSubmitBtn();
                return;
            }
            formData.delete('dados_manuais');
            showPreview(formData, rows, meta);
        };
        reader.readAsText(file, 'utf-8');
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resetSubmitBtn() {
    const btn = document.getElementById('submitBtn');
    btn.innerText = 'Processar e Enviar';
    btn.disabled = false;
}

function showAlert(type, message) {
    const box = document.getElementById('alert-box');
    box.className = `alert ${type}`;
    box.innerText = message;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
