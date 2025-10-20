import { loadJSON, tryFetchText, parseCSV, pick, toBool, startOfDay, addDays, iso } from './utils.js';
import { config, setInventory, setBookings, setBookedByDate } from './state.js';
import { renderCalendar } from './calendar.js';
import { renderFilters, updateRightPanels } from './ui.js';

function normalizeRooms(rows){
  return rows.map(r=>{
    const room = {
      block: (pick(r, ['Block','BLOCK'])||'').trim(),
      num:   String(pick(r, ['Room No','Room','RoomNo'])||'').trim(),
      floor: (pick(r, ['Floor','FLOOR'])||'').toString().trim(),
      min:   Math.max(1, parseInt(pick(r,['Min Person','Min'])||'1',10)),
      max:   Math.max(1, parseInt(pick(r,['Max Person','Max'])||'4',10)),
      ac:    toBool(pick(r,['Airconditioning','AC'])),
      wc:    toBool(pick(r,['Wheel Chair Access','Wheelchair','WC'])),
      pet:   toBool(pick(r,['Pets Permitted','Pet Friendly','Pets'])),
      groupPerm: toBool(pick(r,['Group Booking Permitted','GroupAllowed','Group']))
    };
    return (room.block && room.num) ? room : null;
  }).filter(Boolean);
}
function normalizeBookings(rows){
  return rows.map(r=>{
    const cin = new Date(String(pick(r,['CheckIn','Check In','From'])||'').trim());
    const cout= new Date(String(pick(r,['CheckOut','Check Out','To'])||'').trim());
    const ok = !isNaN(cin) && !isNaN(cout);
    const b = {
      id: (pick(r,['BookingID','ID'])||'').trim(),
      cin: ok ? startOfDay(cin) : null,
      cout: ok ? startOfDay(cout) : null,
      block: (pick(r,['Block'])||'').trim(),
      num: String(pick(r,['Room No','Room','RoomNo'])||'').trim(),
      status: (pick(r,['Status'])||'').trim().toLowerCase()
    };
    return (b.cin && b.cout && b.block && b.num) ? b : null;
  }).filter(Boolean);
}
function buildBookedByDate(bookings){
  const map = {};
  bookings.forEach(b=>{
    if (b.status === 'cancelled') return;
    const key = b.block + (b.num||'');
    for (let d = new Date(b.cin); d < b.cout; d = addDays(d,1)){
      const k = iso(d);
      if (!map[k]) map[k] = new Set();
      map[k].add(key);
    }
  });
  return map;
}

export async function boot(){
  // load config JSONs
  const [rules, restricted, lweek, tariff] = await Promise.all([
    loadJSON('data/config/rules.json'),
    loadJSON('data/config/restricted_periods.json'),
    loadJSON('data/config/long_weekends.json'),
    loadJSON('data/config/tariff.json')
  ]);
  config.rules = rules;
  config.restricted = restricted;
  config.longWeekends = lweek;
  config.tariff = tariff;

  // rooms from CSV
  const roomsCSV = await tryFetchText([
    'data/uploads/rooms.csv',
    'data/uploads/Room%20Classification%20List.csv',
    'data/uploads/Room Classification List.csv'
  ]);
  let inventory = [];
  if (roomsCSV){
    const rows = parseCSV(roomsCSV);
    inventory = normalizeRooms(rows);
  }
  if (!inventory.length){
    // safe tiny fallback
    inventory = [
      {block:'A', num:'1', floor:'0', min:1, max:2, ac:false, wc:false, pet:false, groupPerm:false},
      {block:'B', num:'2', floor:'0', min:1, max:3, ac:false, wc:false, pet:false, groupPerm:false},
      {block:'C', num:'3', floor:'1', min:2, max:4, ac:true,  wc:false, pet:true,  groupPerm:true},
    ];
  }
  setInventory(inventory);

  // optional bookings
  const bookingsCSV = await tryFetchText(['data/uploads/bookings.csv']);
  let bookings = [];
  if (bookingsCSV){
    bookings = normalizeBookings(parseCSV(bookingsCSV));
  }
  setBookings(bookings);
  setBookedByDate(buildBookedByDate(bookings));

  // render
  renderCalendar(document.getElementById('calendar'));
  renderFilters(document.getElementById('filters'));
  updateRightPanels();
}
