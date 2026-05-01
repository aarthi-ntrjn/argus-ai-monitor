import { getControlActions } from '../src/db/database.js';
const actions = getControlActions('f9296e54-874c-4cf0-9b2a-06b0e37d39cf');
const teams = actions.filter(a => a.source === 'Teams');
console.log('All actions:', actions.length, '  Teams actions:', teams.length);
teams.forEach(a => console.log(JSON.stringify(a)));
