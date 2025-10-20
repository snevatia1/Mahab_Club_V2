import { el, badge, iso, startOfDay } from './utils.js';
import { config, checkIn, checkOut, setDates, inventory, bookedByDate } from './state.js';
import { updateFiltersDynamic, updateRightPanels } from './ui.js';

function roomsAvailableOn(dateISO){
  const booked = bookedByDate[dateISO] ? bookedByDate[dateISO].size : 0;
  return Math.max(0, inventory.length - booked);
}

function buildSpecialSets(restricted, longWeekends){
  const special = new Set(), closed = new Set();
  (restricted?.special_periods || []).forEach(p=>{
    const s = new Date(p.start), e = new Date(p.end);
    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) special.add(iso(d));
  });
  (restricted?.closed_periods || []).forEach(p=>{
    const s = new Date(p.start), e = new Date(p.end);
    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) closed.add(iso(d));
  });
  (longWeekends?.dates || []).forEach(d => special.add(d));
  return {special, closed};
}

export function renderCalendar(container){
  const {special, closed} = buildSpecialSets(config.restricted, config.longWeekends);
  const today = startOfDay(new Date());
  const end   = new Date(today.getFullYear(), today.getMonth()+8, 0);

  container.innerHTML = '';

  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor <= end){
    const ms = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const me = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0);

    const m = el('div', {class:'month'});
    m.appendChild(el('div', {class:'month-title'}, ms.toLocaleString(undefined, {month:'long', year:'numeric'})));
    m.appendChild(el('div', {class:'mline'}));

    const grid = el('div', {class:'month-grid-12'});

    for(let d=new Date(ms); d<=me; d.setDate(d.getDate()+1)){
      const dPick = startOfDay(d);
      const s = iso(dPick);

      const classes = ['date'];
      const dow = dPick.getDay();
      if (dow===5 || dow===6) classes.push('fri-sat');
      if (special.has(s)) classes.push('special');
      if (closed.has(s))  classes.push('closed');

      if (checkIn && !checkOut && iso(checkIn)===s) classes.push('selected');
      if (checkIn && checkOut && dPick>=checkIn && dPick<=checkOut) classes.push('in-range');

      const cell = el('div', {class:classes.join(' ')},
        el('div', {class:'dnum'}, String(dPick.getDate())),
        el('div', {class:'dow'},  ['Su','Mo','Tu','We','Th','Fr','Sa'][dow]),
        el('div', {class:'avail'}, String(roomsAvailableOn(s)))
      );

      cell.addEventListener('click', ()=>{
        if (!checkIn || (checkIn && checkOut)) {
          setDates(dPick, null);
        } else {
          if (dPick <= checkIn) {
            setDates(dPick, null);
          } else {
            setDates(checkIn, dPick);
          }
        }
        renderCalendar(container);
        updateFiltersDynamic();
        updateRightPanels();
      });

      grid.appendChild(cell);
    }

    m.appendChild(grid);
    m.appendChild(el('div', {class:'mline'}));
    m.appendChild(el('div', {class:'mline'}));
    container.appendChild(m);

    cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
  }

  container.appendChild(el('div', {class:'legend'},
    badge('Fri/Sat night'), badge('Special/Holiday'), badge('Closed'), badge('Selected/Range')
  ));
}
