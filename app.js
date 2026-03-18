/* ============================================================
   Vic's Takeoff — app.js
   Pure vanilla JS, no dependencies. GitHub Pages compatible.
   ============================================================ */

'use strict';

// ─── State ───────────────────────────────────────────────────
let appData = { rooms: [], categories: [], worktypes: [], materials: [] };
let userAdditions = { rooms: [], categories: [], worktypes: [], materials: [] };
let rows = [];        // Array of row state objects
let rowIdCounter = 0;
const hiddenColumns = new Set();

// Columns that can be toggled (not 'actions')
const COLUMNS = [
  { key: 'room',        label: 'Room' },
  { key: 'category',    label: 'Category' },
  { key: 'worktype',    label: 'Work Type' },
  { key: 'material',    label: 'Material' },
  { key: 'description', label: 'Description' },
  { key: 'unit_price',  label: 'Unit Price' },
  { key: 'quantity',    label: 'Qty' },
  { key: 'total_price', label: 'Total Price' },
];

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  buildColumnPanel();
  setupTotals();
  setupExport();
  document.getElementById('add-row-btn').addEventListener('click', addRow);
  document.getElementById('settings-btn').addEventListener('click', toggleSettingsPanel);

  // Select-all on focus for every number input in the table
  document.getElementById('line-items-body').addEventListener('focusin', e => {
    if (e.target.matches('input[type="number"]')) e.target.select();
  });
  addRow(); // start with one empty row
});

async function loadData() {
  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error('fetch failed');
    appData = await res.json();
  } catch (e) {
    console.warn('Could not load data.json, starting with empty lists.', e);
  }
}

// ─── Column Visibility ────────────────────────────────────────
function buildColumnPanel() {
  const panel = document.getElementById('column-panel');
  panel.innerHTML = '';
  COLUMNS.forEach(col => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => toggleColumn(col.key, cb.checked));
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' ' + col.label));
    panel.appendChild(lbl);
  });
}

function toggleSettingsPanel() {
  document.getElementById('settings-panel').classList.toggle('hidden');
}

function toggleColumn(key, visible) {
  if (visible) hiddenColumns.delete(key);
  else hiddenColumns.add(key);

  // Toggle header
  const th = document.querySelector(`thead th[data-col="${key}"]`);
  if (th) th.classList.toggle('col-hidden', !visible);

  // Toggle every td in that column
  document.querySelectorAll(`tbody td[data-col="${key}"]`).forEach(td => {
    td.classList.toggle('col-hidden', !visible);
  });
}

// ─── Smart Autocomplete Input ─────────────────────────────────
let _activeSmartInput = null; // only one dropdown open at a time

class SmartInput {
  constructor(container, dataKey, placeholder, onSelect) {
    this.dataKey = dataKey;
    this.onSelect = onSelect || (() => {});
    this.activeIndex = -1;

    // Inner wrapper keeps flex layout off the td itself (preserves table-cell display)
    const wrap = document.createElement('div');
    wrap.className = 'smart-input-wrap';
    container.appendChild(wrap);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = placeholder || '';

    // Dropdown portaled to body so it always renders on top of table/overflow
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'smart-dropdown hidden';
    document.body.appendChild(this.dropdown);

    // Toggle button — shows full list on click
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.type = 'button';
    this.toggleBtn.className = 'smart-toggle-btn';
    this.toggleBtn.textContent = '▾';
    this.toggleBtn.title = 'Show all options';
    this.toggleBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!this.dropdown.classList.contains('hidden')) {
        this._closeDropdown();
      } else {
        this._showAllOptions();
      }
    });

    wrap.appendChild(this.input);
    wrap.appendChild(this.toggleBtn);

    this.input.addEventListener('input', () => this._onInput());
    this.input.addEventListener('keydown', e => this._onKeydown(e));
    this.input.addEventListener('focus', () => {
      if (this.input.value.length >= 1 && this.dropdown.classList.contains('hidden')) this._showDropdown();
    });
    this.input.addEventListener('blur', () => {
      setTimeout(() => {
        this._maybeAddToDatabase();
        this._closeDropdown();
      }, 180);
    });

    // Reposition on scroll/resize; close if input scrolls out of view
    this._scrollHandler = () => {
      if (!this.dropdown.classList.contains('hidden')) {
        this._positionDropdown();
      }
    };
    window.addEventListener('scroll', this._scrollHandler, true);
    window.addEventListener('resize', this._scrollHandler);
  }

  _getAllItems() {
    const key = this.dataKey;
    const source = appData[key] || [];
    const extra = userAdditions[key] || [];
    const all = [
      ...source,
      ...extra.filter(e => !source.some(s =>
        (typeof s === 'string' ? s : s.name).toLowerCase() ===
        (typeof e === 'string' ? e : e.name).toLowerCase()
      ))
    ];
    return all.map(item => typeof item === 'string' ? item : item.name)
              .sort((a, b) => a.localeCompare(b));
  }

  _getOptions() {
    const query = this.input.value.toLowerCase();
    return this._getAllItems().filter(name => name.toLowerCase().includes(query));
  }

  _getPriceForMaterial(name) {
    if (this.dataKey !== 'materials') return null;
    const all = [...(appData.materials || []), ...(userAdditions.materials || [])];
    const found = all.find(m => m.name.toLowerCase() === name.toLowerCase());
    return found ? found.price : null;
  }

  _positionDropdown() {
    const rect = this.input.getBoundingClientRect();
    const toggleW = this.toggleBtn ? this.toggleBtn.offsetWidth : 0;
    this.dropdown.style.top  = (rect.bottom + 2) + 'px';
    this.dropdown.style.left = rect.left + 'px';
    this.dropdown.style.width = Math.max(rect.width + toggleW, 200) + 'px';
  }

  _buildDropdownItems(opts) {
    this.dropdown.innerHTML = '';
    opts.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = opt;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        this._selectOption(opt);
      });
      this.dropdown.appendChild(item);
    });
    this.activeIndex = -1;
  }

  _showDropdown() {
    const opts = this._getOptions();
    if (opts.length === 0) { this._closeDropdown(); return; }
    if (_activeSmartInput && _activeSmartInput !== this) _activeSmartInput._closeDropdown();
    _activeSmartInput = this;
    this._buildDropdownItems(opts);
    this._positionDropdown();
    this.dropdown.classList.remove('hidden');
  }

  _showAllOptions() {
    const opts = this._getAllItems();
    if (opts.length === 0) return;
    if (_activeSmartInput && _activeSmartInput !== this) _activeSmartInput._closeDropdown();
    _activeSmartInput = this;
    this._buildDropdownItems(opts);
    this._positionDropdown();
    this.dropdown.classList.remove('hidden');
    this.input.focus();
  }

  _closeDropdown() {
    this.dropdown.classList.add('hidden');
    this.activeIndex = -1;
    if (_activeSmartInput === this) _activeSmartInput = null;
  }

  _onInput() {
    const val = this.input.value;
    if (val.length >= 1) this._showDropdown();
    else this._closeDropdown();
    this.onSelect(null);
  }

  _onKeydown(e) {
    const items = this.dropdown.querySelectorAll('.dropdown-item');
    if (this.dropdown.classList.contains('hidden')) {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && this.input.value.length >= 1) {
        this._showDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
      this._highlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, -1);
      this._highlight(items);
    } else if (e.key === 'Enter') {
      if (this.activeIndex >= 0 && items[this.activeIndex]) {
        e.preventDefault();
        this._selectOption(items[this.activeIndex].textContent);
      }
    } else if (e.key === 'Escape') {
      this._closeDropdown();
    } else if (e.key === 'Tab') {
      if (this.activeIndex >= 0 && items[this.activeIndex]) {
        this._selectOption(items[this.activeIndex].textContent);
      } else if (items.length > 0) {
        this._selectOption(items[0].textContent);
      }
    }
  }

  _highlight(items) {
    items.forEach((item, i) => item.classList.toggle('active', i === this.activeIndex));
    if (this.activeIndex >= 0 && items[this.activeIndex]) {
      items[this.activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  _selectOption(value) {
    this.input.value = value;
    this._closeDropdown();
    const price = this._getPriceForMaterial(value);
    this.onSelect(value, price);
  }

  _maybeAddToDatabase() {
    const val = this.input.value.trim();
    if (!val) return;
    const key = this.dataKey;
    const existing = [
      ...(appData[key] || []),
      ...(userAdditions[key] || [])
    ].map(item => typeof item === 'string' ? item.toLowerCase() : item.name.toLowerCase());

    if (!existing.includes(val.toLowerCase())) {
      const newEntry = key === 'materials' ? { name: val, price: 0 } : val;
      userAdditions[key] = userAdditions[key] || [];
      userAdditions[key].push(newEntry);
    }
  }

  getValue() { return this.input.value.trim(); }
  setValue(val) { this.input.value = val; }
  focus() { this.input.focus(); }

  destroy() {
    window.removeEventListener('scroll', this._scrollHandler, true);
    window.removeEventListener('resize', this._scrollHandler);
    if (this.dropdown.parentNode) this.dropdown.parentNode.removeChild(this.dropdown);
  }
}

// ─── Row Management ───────────────────────────────────────────
function addRow() {
  const id = ++rowIdCounter;
  const rowState = {
    id,
    room: '', category: '', worktype: '',
    quantity: 1, material: '', unit_price: 0,
    total_price: 0, description: '',
    descriptionManuallyEdited: false,
    hidden: false,
    _smartInputs: []  // for cleanup on delete
  };
  rows.push(rowState);
  renderRow(rowState);
  recalcTotals();
}

function isLastRow(state) {
  return rows.length > 0 && rows[rows.length - 1].id === state.id;
}

function autoAddRowIfLast(state) {
  if (isLastRow(state)) addRow();
}

function renderRow(state) {
  const tbody = document.getElementById('line-items-body');
  const tr = document.createElement('tr');
  tr.dataset.rowId = state.id;

  // Helper: create a td with data-col attribute
  function td(key) {
    const cell = document.createElement('td');
    cell.dataset.col = key;
    if (hiddenColumns.has(key)) cell.classList.add('col-hidden');
    tr.appendChild(cell);
    return cell;
  }

  // Description input declared early — referenced in room/worktype/material callbacks
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'description-input';
  descInput.placeholder = 'Auto-generated or type here';
  descInput.addEventListener('input', () => {
    state.description = descInput.value;
    state.descriptionManuallyEdited = descInput.value !== '';
  });

  // Unit Price input declared early — referenced in material callback
  const unitInp = document.createElement('input');
  unitInp.type = 'number';
  unitInp.value = state.unit_price.toFixed(2);
  unitInp.min = '0';
  unitInp.step = '0.01';
  unitInp.addEventListener('input', () => {
    state.unit_price = parseFloat(unitInp.value) || 0;
    state.total_price = state.quantity * state.unit_price;
    updateTotalCell(tr, state.total_price);
    recalcTotals();
  });

  // Room
  const roomCell = td('room');
  const roomInput = new SmartInput(roomCell, 'rooms', 'Room', (val) => {
    state.room = val || roomInput.getValue();
    autoDescription(state, descInput);
  });
  state._smartInputs.push(roomInput);

  // Category
  const catCell = td('category');
  const catInput = new SmartInput(catCell, 'categories', 'Category', (val) => {
    state.category = val || catInput.getValue();
  });
  state._smartInputs.push(catInput);

  // Worktype
  const wtCell = td('worktype');
  const wtInput = new SmartInput(wtCell, 'worktypes', 'Work Type', (val) => {
    state.worktype = val || wtInput.getValue();
    autoDescription(state, descInput);
  });
  state._smartInputs.push(wtInput);

  // Material
  const matCell = td('material');
  const matInput = new SmartInput(matCell, 'materials', 'Material', (val, price) => {
    state.material = val || matInput.getValue();
    if (price !== null && price !== undefined) {
      state.unit_price = price;
      unitInp.value = price.toFixed(2);
    }
    state.total_price = state.quantity * state.unit_price;
    updateTotalCell(tr, state.total_price);
    autoDescription(state, descInput);
    recalcTotals();
  });
  state._smartInputs.push(matInput);

  // Description
  const descCell = td('description');
  descCell.appendChild(descInput);

  // Unit Price
  const upCell = td('unit_price');
  upCell.appendChild(unitInp);

  // Quantity
  const qtyCell = td('quantity');
  const qtyInp = document.createElement('input');
  qtyInp.type = 'number';
  qtyInp.value = state.quantity;
  qtyInp.min = '0';
  qtyInp.step = '1';
  qtyInp.addEventListener('input', () => {
    state.quantity = parseFloat(qtyInp.value) || 0;
    state.total_price = state.quantity * state.unit_price;
    updateTotalCell(tr, state.total_price);
    autoDescription(state, descInput);
    recalcTotals();
  });
  qtyCell.appendChild(qtyInp);

  // Total Price (readonly)
  const tpCell = td('total_price');
  tpCell.className = 'total-price-cell';
  tpCell.textContent = '$0.00';

  // Auto-add a new row when focus leaves the last row and 2+ fields are filled
  tr.addEventListener('focusout', () => {
    setTimeout(() => {
      if (tr.contains(document.activeElement)) return;
      if (!isLastRow(state)) return;
      const filled = [state.room, state.category, state.worktype, state.material, state.description]
        .filter(v => v && v.trim() !== '').length
        + (state.unit_price > 0 ? 1 : 0);
      if (filled >= 2) addRow();
    }, 0);
  });

  // Actions
  const actCell = document.createElement('td');
  actCell.className = 'actions-cell';
  actCell.dataset.col = 'actions';

  const actWrap = document.createElement('div');
  actWrap.className = 'actions-wrap';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger';
  delBtn.textContent = '✕';
  delBtn.title = 'Delete row';
  delBtn.addEventListener('click', () => deleteRow(state.id, tr));

  const hideBtn = document.createElement('button');
  hideBtn.className = 'btn btn-icon';
  hideBtn.textContent = '👁';
  hideBtn.title = 'Toggle row visibility (hidden rows excluded from totals)';
  hideBtn.addEventListener('click', () => {
    state.hidden = !state.hidden;
    tr.classList.toggle('row-hidden', state.hidden);
    hideBtn.textContent = state.hidden ? '🚫' : '👁';
    recalcTotals();
  });

  actWrap.appendChild(delBtn);
  actWrap.appendChild(hideBtn);
  actCell.appendChild(actWrap);
  tr.appendChild(actCell);

  tbody.appendChild(tr);
}

function updateTotalCell(tr, value) {
  const cell = tr.querySelector('td[data-col="total_price"]');
  if (cell) cell.textContent = '$' + value.toFixed(2);
}

function autoDescription(state, descInput) {
  if (state.descriptionManuallyEdited) return;
  const parts = [];
  if (state.worktype) parts.push(state.worktype);
  if (state.quantity && state.quantity !== 1) parts.push(state.quantity);
  if (state.material) parts.push(state.material);
  const auto = parts.join(' ');
  descInput.value = auto;
  state.description = auto;
}

function deleteRow(id, tr) {
  const row = rows.find(r => r.id === id);
  if (row) row._smartInputs.forEach(si => si.destroy());
  rows = rows.filter(r => r.id !== id);
  tr.remove();
  recalcTotals();
}

// ─── Totals ───────────────────────────────────────────────────
let baseTotalValue = 0;

function setupTotals() {
  const pct = document.getElementById('percent-total');
  const final = document.getElementById('final-total');

  pct.addEventListener('input', () => {
    const p = parseFloat(pct.value) || 0;
    const newFinal = baseTotalValue * (p / 100);
    final.value = newFinal.toFixed(2);
  });

  final.addEventListener('input', () => {
    const f = parseFloat(final.value) || 0;
    const p = baseTotalValue !== 0 ? (f / baseTotalValue) * 100 : 0;
    pct.value = p.toFixed(2);
  });
}

function recalcTotals() {
  baseTotalValue = rows
    .filter(r => !r.hidden)
    .reduce((sum, r) => sum + r.total_price, 0);

  document.getElementById('base-total').textContent = '$' + baseTotalValue.toFixed(2);

  const pct = parseFloat(document.getElementById('percent-total').value) || 100;
  document.getElementById('final-total').value = (baseTotalValue * pct / 100).toFixed(2);
}

// ─── Export ───────────────────────────────────────────────────
function setupExport() {
  document.getElementById('download-btn').addEventListener('click', () => {
    const yaml = buildTakeoffYaml();
    downloadText(yaml, 'takeoff.yaml', 'text/yaml');
    showBanner('takeoff.yaml downloaded!', 'success');
  });

  document.getElementById('email-btn').addEventListener('click', () => {
    // First download the file
    const yaml = buildTakeoffYaml();
    downloadText(yaml, 'takeoff.yaml', 'text/yaml');

    // Then open mailto
    const workAddress = document.getElementById('work-address').value.trim() || '(address not provided)';
    const subject = encodeURIComponent("Vic's Takeoff – Material Takeoff, Scope of Work & Estimate");
    const body = encodeURIComponent(
      `Hello,\n\nPlease find attached the material takeoff, scope of work, and estimate for ${workAddress}.\n\nThank you`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;

    showBanner('takeoff.yaml downloaded — please attach it to the email that opened.', 'warning');
  });

  document.getElementById('save-db-btn').addEventListener('click', () => {
    const merged = mergeDatabase();
    downloadText(JSON.stringify(merged, null, 2), 'data.json', 'application/json');
    showBanner('Updated data.json downloaded! Replace the project file to save new entries.', 'success');
  });
}

function getJobDetails() {
  return {
    customer_name:    document.getElementById('customer-name').value.trim(),
    work_address:     document.getElementById('work-address').value.trim(),
    business_name:    document.getElementById('business-name').value.trim(),
    business_address: document.getElementById('business-address').value.trim(),
    customer_email:   document.getElementById('customer-email').value.trim(),
    customer_phone:   document.getElementById('customer-phone').value.trim(),
    contractor_email: document.getElementById('contractor-email').value.trim(),
    contractor_phone: document.getElementById('contractor-phone').value.trim(),
  };
}

function buildTakeoffYaml() {
  const job = getJobDetails();
  const lineItems = rows.map(r => ({
    room:        r.room,
    category:    r.category,
    work_type:   r.worktype,
    quantity:    r.quantity,
    material:    r.material,
    unit_price:  r.unit_price,
    total_price: r.total_price,
    description: r.description,
    hidden:      r.hidden,
  }));

  const baseTotalFinal = baseTotalValue;
  const pct = parseFloat(document.getElementById('percent-total').value) || 100;
  const finalTotal = parseFloat(document.getElementById('final-total').value) || 0;

  const payload = {
    job_details: job,
    line_items: lineItems,
    totals: {
      base_item_total:    baseTotalFinal,
      adjustment_percent: pct,
      final_total:        finalTotal,
    }
  };

  return toYaml(payload);
}

function mergeDatabase() {
  const merged = {};
  Object.keys(appData).forEach(key => {
    const base = appData[key] || [];
    const extra = (userAdditions[key] || []).filter(e => {
      const eName = typeof e === 'string' ? e.toLowerCase() : e.name.toLowerCase();
      return !base.some(b => (typeof b === 'string' ? b : b.name).toLowerCase() === eName);
    });
    merged[key] = [...base, ...extra];
  });
  return merged;
}

// ─── YAML Serializer ──────────────────────────────────────────
function toYaml(obj, indent) {
  indent = indent || 0;
  const pad = '  '.repeat(indent);
  let out = '';

  if (Array.isArray(obj)) {
    if (obj.length === 0) return pad + '[]\n';
    obj.forEach(item => {
      if (item !== null && typeof item === 'object') {
        out += pad + '-\n' + toYaml(item, indent + 1);
      } else {
        out += pad + '- ' + yamlScalar(item) + '\n';
      }
    });
  } else if (obj !== null && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        if (val.length === 0) {
          out += pad + key + ': []\n';
        } else {
          out += pad + key + ':\n' + toYaml(val, indent + 1);
        }
      } else if (val !== null && typeof val === 'object') {
        out += pad + key + ':\n' + toYaml(val, indent + 1);
      } else {
        out += pad + key + ': ' + yamlScalar(val) + '\n';
      }
    });
  }

  return out;
}

function yamlScalar(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  const s = String(val);
  // Quote strings that could be misread by YAML parsers
  const needsQuotes = s === '' ||
    /[:#{}\[\],&*?|<>=!%@`]/.test(s) ||
    /^[\s]|[\s]$/.test(s) ||
    /^(true|false|null|yes|no|on|off)$/i.test(s) ||
    /^\d/.test(s);
  if (needsQuotes) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return s;
}

// ─── Utilities ────────────────────────────────────────────────
function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function showBanner(message, type) {
  const existing = document.querySelector('.banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'banner' + (type ? ' ' + type : '');
  banner.textContent = message;
  document.body.appendChild(banner);

  setTimeout(() => {
    banner.style.transition = 'opacity 0.4s';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 400);
  }, 4000);
}
