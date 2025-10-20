import { el, iso, addDays, startOfDay } from './utils.js';
import { checkIn, checkOut, selection, inventory, bookedByDate, bookings, config } from './state.js';

/* ---------- safe helpers so we never crash ---------- */
const N = (x)=>Number.isFinite(x)?x:0;

/* ---------- header right-side meta ---------- */
function ensureTopMeta(){
  try{
    const hdr = document.querySelector('header'); if (!hdr) return;
    let meta = hdr.querySelector('.top-meta');
    if (!meta){ meta = el('div',{class:'top-meta'}); hdr.appendChild(meta); }
    const today = startOfDay(new Date());
    const open = Array.isArray(bookings)
      ? bookings.filter(b => b && b.cout && b.cout >= today && b.status !== 'cancelled').length
      : 0;
    const memberName = localStorage.getItem('memberName') || '';
    const memberNo   = localStorage.getItem('memberNo') || '';
    meta.innerHTML = `
      <span>Member: <b>${memberName || '—'}</b></span>
      <span>Membership #: <b>${memberNo || '—'}</b></span>
      <span>Open bookings: <b>${open}</b></span>
    `;
  }catch{ /* no-op */ }
}

/* ---------- availability + filters ---------- */
function isRoomAvailableInSelectedRange(room){
  if (!(checkIn && checkOut)) return true;
  const key = room.block + room.num;
  // nights: [checkIn, checkOut)
  for (let d = new Date(checkIn); d < checkOut; d = addDays(d,1)){
    const k = iso(d);
    if (bookedByDate[k] && bookedByDate[k].has(key)) return false;
  }
  return true;
}
function filterRoomsRaw(){
  const f = selection.filters || (selection.filters={occ:2,wc:false,pet:false,ac:false,group:false,blocksIncluded:new Set(),blockOpen:null});
  return inventory.filter(r=>{
    if (f.wc && !r.wc) return false;
    if (f.pet && !r.pet) return false;
    if (f.ac && !r.ac) return false;
    if (f.group && !r.groupPerm) return false;
    if (N(f.occ) < r.min || N(f.occ) > r.max) return false;
    if (!isRoomAvailableInSelectedRange(r)) return false;
    return true;
  });
}
function roomsByBlock(rooms){
  const map = {};
  rooms.forEach(r => (map[r.block] ||= []).push(r));
  return map;
}
function getRateForRoom(r){
  const rates = (config?.tariff?.rates) || {};
  const def = (config?.tariff?.default) ?? 0;
  return N(rates[r.block] ?? def);
}
function isWeekend(d){ const dow = d.getDay(); return dow===5 || dow===6; }
function isSpecial(d){
  const s = iso(d);
  if (config?.longWeekends?.dates?.includes?.(s)) return true;
  for (const p of (config?.restricted?.special_periods || [])){
    const a = new Date(p.start), b = new Date(p.end);
    const dd = startOfDay(d);
    if (dd >= startOfDay(a) && dd <= startOfDay(b)) return true;
  }
  return false;
}

/* ---------- Member area ---------- */
function renderMemberSection(container){
  container.innerHTML = '';

  const titleRow = el('div', {class:'section-title-row'},
    el('h3', {class:'panel-title', style:'margin:0'}, 'Member & Temp Members'),
    el('label', {style:'margin-left:12px;'},
      el('input', {type:'checkbox', id:'msgConfirmTop'}), ' Tick to confirm'
    )
  );
  container.appendChild(titleRow);

  const g = el('div', {class:'members-grid'});
  const addRow = (namePh) => {
    const name = el('input', {type:'text', placeholder: namePh});
    const age  = el('input', {type:'number', min:'0', placeholder:'Age', class:'age'});
    g.appendChild(name); g.appendChild(age);
  };
  [
    'Member name','Spouse name',
    'Child 1 name','Child 2 name',
    'Parent 1 name','Parent 2 name',
    'Temp member 1 name','Temp member 2 name'
  ].forEach(addRow);
  container.appendChild(g);

  const controls = el('div', {class:'members-controls'},
    el('label', {}, el('input', {type:'checkbox', id:'msgConfirmBottom'}), ' Tick to confirm'),
    el('button', {type:'button', id:'addTempBtn', class:'addtemp'}, '+ Add more Temp members')
  );
  container.appendChild(controls);

  const food = el('div', {class:'food-grid'},
    el('label', {}, 'Total Veg'),
    (()=>{
      const v = el('input', {type:'number', id:'vegTotal', min:'0', value:String(selection.food?.veg ?? 0)});
      v.addEventListener('input', ()=>{ selection.food = selection.food||{}; selection.food.veg = Math.max(0, parseInt(v.value||'0',10)); renderSummary(document.getElementById('summary')); });
      return v;
    })(),
    el('label', {}, 'Total Non-veg'),
    (()=>{
      const nv = el('input', {type:'number', id:'nonvegTotal', min:'0', value:String(selection.food?.nonveg ?? 0)});
      nv.addEventListener('input', ()=>{ selection.food = selection.food||{}; selection.food.nonveg = Math.max(0, parseInt(nv.value||'0',10)); renderSummary(document.getElementById('summary')); });
      return nv;
    })()
  );
  container.appendChild(food);

  controls.querySelector('#addTempBtn').addEventListener('click', ()=>{
    const name = el('input', {type:'text', placeholder:'Temp member name'});
    const age  = el('input', {type:'number', min:'0', placeholder:'Age', class:'age'});
    g.appendChild(name); g.appendChild(age);
  });
}

/* ---------- Booking window notice above calendar ---------- */
function ensureBookingWindowNotice(){
  const cal = document.getElementById('calendar'); if (!cal) return;
  if (cal.querySelector('.notice')) return;
  cal.prepend(
    el('div', {class:'notice'},
      'Booking for ',
      el('b',{},'members and groups up to 180 days'), ' • ',
      el('b',{},'members with Temp up to 90 days'), ' • ',
      el('b',{},'Temp members only up to 60 days'), ' in advance. ',
      'Choose dates from calendar below.'
    )
  );
}

/* ---------- UI renderers ---------- */
export function updateFiltersDynamic(){
  ensureTopMeta();
  ensureBookingWindowNotice();

  const ciRow = document.getElementById('cirow');
  if (ciRow){
    const ci = checkIn ? iso(checkIn) : '—';
    const co = checkOut ? iso(checkOut) : '—';
    ciRow.textContent = `Check-in: ${ci}   |   Check-out: ${co}`;
  }

  // live counters (do not override member-entered requirements)
  const roomsSelectedCount = document.getElementById('roomsSelectedCount');
  const occupantsSelectedCount = document.getElementById('occupantsSelectedCount');
  if (roomsSelectedCount || occupantsSelectedCount){
    const totalPeople = Array.from((selection.roomsSelected||new Map()).values()).reduce((a,b)=>a+b,0);
    if (roomsSelectedCount) roomsSelectedCount.textContent = `Selected: ${(selection.roomsSelected||new Map()).size}`;
    if (occupantsSelectedCount) occupantsSelectedCount.textContent = `Selected: ${totalPeople}`;
  }

  const wrap = document.getElementById('blocksWrap');
  const roomsBox = document.getElementById('blockRooms');
  if (!wrap || !roomsBox) return;

  const rooms = filterRoomsRaw();
  const byB = roomsByBlock(rooms);
  const allBlocks = Array.from(new Set(inventory.map(r=>r.block))).sort();

  const f = selection.filters;
  if (f.blocksIncluded.size === 0){
    allBlocks.forEach(b => f.blocksIncluded.add(b));
    f.blockOpen = allBlocks[0] || null;
  }

  wrap.innerHTML = '';
  allBlocks.forEach(blk=>{
    const count = (byB[blk]||[]).length;
    const active = f.blocksIncluded.has(blk);
    const pill = el('button', {class:'block-pill ' + (active?'active':''), type:'button'},
      `${blk}: ${count} room(s)`
    );
    pill.addEventListener('click', ()=>{
      if (active) f.blocksIncluded.delete(blk);
      else f.blocksIncluded.add(blk);
      f.blockOpen = blk;
      updateFiltersDynamic();
      updateRightPanels();
    });
    wrap.appendChild(pill);
  });

  roomsBox.innerHTML = '';
  const open = f.blockOpen || allBlocks[0];
  const list = (byB[open]||[]).slice().sort((a,b)=>a.num.localeCompare(b.num));

  roomsBox.appendChild(el('div',{class:'block-rooms-title'}, `Rooms available in ${open}:`));
  if (!list.length){
    roomsBox.appendChild(el('div',{},'None'));
  } else {
    const ul = el('div',{class:'room-list'});
    selection.roomsSelected = selection.roomsSelected || new Map();
    list.forEach(r=>{
      const key = r.block + r.num;
      const selected = selection.roomsSelected.has(key);

      const occSel = el('select',{class:'select small'},
        ...[0,...Array.from({length:r.max-r.min+1},(_,i)=>r.min+i)]
          .map(n => el('option',{value:String(n)},String(n)))
      );
      occSel.value = String(selected ? selection.roomsSelected.get(key) : 0);

      const btn = el('button',{
        class:'room-btn' + (selected?' selected':''), type:'button',
        onclick: ()=>{
          if (selection.roomsSelected.has(key)){
            selection.roomsSelected.delete(key);
            btn.classList.remove('selected');
            occSel.value = '0';
          }else{
            const v = Math.max(r.min, f.occ);
            selection.roomsSelected.set(key, v);
            btn.classList.add('selected');
            occSel.value = String(v);
          }
          updateFiltersDynamic();
          renderSummary(document.getElementById('summary'));
        }
      }, `${r.block}${r.num}`);

      occSel.addEventListener('change', e=>{
        const val = parseInt(e.target.value,10);
        if (val>0){
          selection.roomsSelected.set(key, val);
          btn.classList.add('selected');
        } else {
          selection.roomsSelected.delete(key);
          btn.classList.remove('selected');
        }
        updateFiltersDynamic();
        renderSummary(document.getElementById('summary'));
      });

      ul.appendChild(el('div',{class:'room-row'}, btn, occSel));
    });
    roomsBox.appendChild(ul);
  }

  // Member panel right under room list
  let memberSec = document.getElementById('memberSection');
  if (!memberSec){
    memberSec = el('div', {id:'memberSection', class:'member-panel'});
    roomsBox.parentElement.appendChild(memberSec);
  }
  renderMemberSection(memberSec);
}

export function renderFilters(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Filters'));

  const ciRow = el('div',{id:'cirow', class:'double-space strong'}); container.appendChild(ciRow);

  // Member-entered requirements + live “Selected”
  selection.requirements = selection.requirements || { rooms:0, occupants:0 };
  const roomsReqInput = el('input',{ type:'number', id:'roomsRequiredBox', min:'0',
    value:String(selection.requirements.rooms||0), class:'select' });
  roomsReqInput.addEventListener('input', ()=>{ selection.requirements.rooms = Math.max(0, parseInt(roomsReqInput.value||'0',10)); });
  const roomsSel = el('span',{id:'roomsSelectedCount', style:'opacity:.75'}, 'Selected: 0');

  const occReqInput = el('input',{ type:'number', id:'occupantsRequiredBox', min:'0',
    value:String(selection.requirements.occupants||0), class:'select' });
  occReqInput.addEventListener('input', ()=>{ selection.requirements.occupants = Math.max(0, parseInt(occReqInput.value||'0',10)); });
  const occSel = el('span',{id:'occupantsSelectedCount', style:'opacity:.75'}, 'Selected: 0');

  const totalsRow = el('div',{class:'filters-row double-space'},
    el('label',{},'Rooms required:'), roomsReqInput, roomsSel,
    el('label',{},'Occupants:'),     occReqInput,  occSel
  );
  container.appendChild(totalsRow);

  // Attribute checkboxes
  const mkChk = (label,id,setter)=> {
    const i = el('input',{type:'checkbox',id});
    i.addEventListener('change', e=>{ setter(e.target.checked); updateFiltersDynamic(); updateRightPanels(); });
    return el('label',{for:id,style:'margin-right:16px'}, label+' ', i);
  };
  const line1 = el('div',{class:'filters-row double-space'},
    mkChk('Wheelchair','f_wc', v=> (selection.filters.wc=v)),
    mkChk('Pet-friendly','f_pet', v=> (selection.filters.pet=v)),
    mkChk('AC','f_ac', v=> (selection.filters.ac=v)),
    mkChk('Group','f_grp', v=> (selection.filters.group=v))
  );

  const occ = el('select',{id:'occ',class:'select'},
    ...[1,2,3,4].map(n=>el('option',{value:String(n)},String(n)))
  );
  occ.value = String(selection.filters.occ ?? 2);
  occ.addEventListener('change', e=>{
    selection.filters.occ = Math.max(1,Math.min(4,parseInt(e.target.value,10)));
    updateFiltersDynamic(); updateRightPanels();
  });
  const line2 = el('div',{class:'filters-row double-space'}, el('span',{},'Occupancy:'), occ);

  container.appendChild(line1);
  container.appendChild(line2);

  container.appendChild(el('div',{id:'blocksWrap', class:'blocks-grid double-space'}));
  container.appendChild(el('div',{id:'blockRooms', class:'block-rooms'}));

  updateFiltersDynamic();
}

/* Keep #rooms section empty */
export function renderRooms(container){ container.innerHTML = ''; }

/* Summary with rule-based breakup + cancellation card */
export function renderSummary(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Summary'));

  const ci = checkIn ? iso(checkIn) : '—';
  const co = checkOut ? iso(checkOut) : '—';
  container.appendChild(el('div', {}, `Check-in: (${ci}) | Check-out: (${co})`));

  const roomKeys = Array.from((selection.roomsSelected||new Map()).keys());
  const totalPeople = Array.from((selection.roomsSelected||new Map()).values()).reduce((a,b)=>a+b,0);

  const reqRooms = selection.requirements?.rooms ?? 0;
  const reqPeople = selection.requirements?.occupants ?? 0;
  container.appendChild(el('div', {}, `Rooms required: (${reqRooms})  Occupants: (${reqPeople})`));
  container.appendChild(el('div', {}, `Selected → Rooms: (${roomKeys.length})  Occupants: (${totalPeople})`));
  container.appendChild(el('div', {}, `Veg (${selection.food?.veg ?? 0})  Non-veg (${selection.food?.nonveg ?? 0})`));

  // Dates list for nights
  let nights = 0, dates = [];
  if (checkIn && checkOut && checkOut > checkIn){
    for (let d = new Date(checkIn); d < checkOut; d = addDays(d,1)) dates.push(new Date(d));
    nights = dates.length;
  }

  // Price breakup from config.tariff (all optional/safe)
  const t = config?.tariff || {};
  const weekendPct = N(t.weekend_pct ?? 0);
  const specialPct = N(t.special_pct ?? 0);
  const gstPct     = N(t.gst_pct ?? 0);

  let perNightBaseSum = 0;
  let weekendN=0, specialN=0, normalN=0;
  const roomBreak = [];

  roomKeys.forEach(k=>{
    const room = inventory.find(r => (r.block + r.num) === k);
    if (!room) return;
    const base = getRateForRoom(room);

    let roomTotal = 0;
    dates.forEach(d=>{
      let r = base;
      if (isWeekend(d)){ r += base * (weekendPct/100); weekendN++; }
      else if (isSpecial(d)){ r += base * (specialPct/100); specialN++; }
      else { normalN++; }
      roomTotal += r;
    });

    perNightBaseSum += base;
    roomBreak.push({ label: `${room.block}${room.num}`, base, nights, total: roomTotal });
  });

  const subtotal = roomBreak.reduce((a,b)=>a + b.total, 0);
  const gst = subtotal * (gstPct/100);
  const grand = subtotal + gst;

  if (roomBreak.length){
    const list = el('div',{style:'margin:8px 0'});
    roomBreak.forEach(x=>{
      list.appendChild(el('div', {},
        `${x.label}: ₹${x.base.toFixed(0)} base x ${x.nights} night(s) → ₹${x.total.toFixed(0)}`
      ));
    });
    list.appendChild(el('div', {style:'margin-top:4px;opacity:.8'},
      `Nights: ${nights} (weekend: ${weekendN}, special: ${specialN}, normal: ${normalN})`
    ));
    container.appendChild(list);
  }

  container.appendChild(el('div', {}, `Room-nights: (${nights * roomKeys.length})  Amount/night (base sum): ₹(${perNightBaseSum})`));
  container.appendChild(el('div', {}, `Subtotal: ₹${subtotal.toFixed(0)}  |  GST ${gstPct}%: ₹${gst.toFixed(0)}  |  Total amount payable: ₹${grand.toFixed(0)}`));

  /* Cancellation card BEFORE confirm */
  container.appendChild(
    el('div', {class:'cancel-card'},
      el('h4',{},'Cancellation charges'),
      el('ul',{},
        el('li',{},'More than 7 clear days before arrival date: ', el('b',{},'10% of total booking amount')),
        el('li',{},'Between 2–7 clear days before arrival date: ', el('b',{},'20% of total booking amount')),
        el('li',{},'Less than 2 days or No-show: ', el('b',{},'100% of first 2 days\' booking amount')),
      ),
      el('div',{}, el('b',{},'Group booking:'),' ₹ 20,000 non-refundable advance')
    )
  );

  const rules = el('div', {style:'margin-top:8px'},
    el('a', {href:'./rules.pdf', target:'_blank'}, 'Read the Rules & Policies')
  );
  container.appendChild(rules);

  const confirmRow = el('label', {class:'confirm', style:'margin-top:8px'},
    el('input', {type:'checkbox', id:'confirmAll'}), ' Confirm above'
  );
  container.appendChild(confirmRow);
}

export function updateRightPanels(){
  try{
    renderRooms(document.getElementById('rooms'));
    renderSummary(document.getElementById('summary'));
    ensureTopMeta();
    ensureBookingWindowNotice();
  }catch(e){
    // Fail-safe so the page never blanks out
    console.error('UI update error', e);
  }
}

