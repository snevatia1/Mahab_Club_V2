// Centralized app state
export const config = { rules:null, restricted:null, longWeekends:null, tariff:null };

export let checkIn = null;      // inclusive display
export let checkOut = null;

export const selection = {
  roomsSelected: new Map(),   // key -> occupants
  // DEFAULT OCCUPANCY = 2 (per request)
  filters: { wc:false, pet:false, ac:false, group:false, occ:2, blocksIncluded: new Set(), blockOpen: null },
  food: { veg:0, nonveg:0 }
};

export let inventory = [];      // normalized room list
export let bookings  = [];      // normalized bookings
export let bookedByDate = {};   // iso -> Set('BlockNum')

export function setDates(ci, co){ checkIn = ci; checkOut = co; }
export function setInventory(v){ inventory = v; }
export function setBookings(v){ bookings = v; }
export function setBookedByDate(v){ bookedByDate = v; }
