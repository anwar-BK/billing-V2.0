const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

console.log(JSON.stringify({
	username: settings.admin_username || '',
	passwordConfigured: Boolean(settings.admin_password),
	database: 'database/billing.db'
}, null, 2));
