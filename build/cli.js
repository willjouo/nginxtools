"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
if (process.platform !== 'linux') {
    console.error('nginxtools: This script only works on Linux systems.');
    process.exit(1);
}
if (process.getuid() != 0) {
    console.error('nginxtools: Please run as root.');
    process.exit(1);
}
const commander_1 = require("commander");
const safe_1 = __importDefault(require("colors/safe"));
const op_1 = __importDefault(require("./op"));
const NT = new op_1.default();
async function testNginxConfig() {
    const result = await NT.testNginxConfig();
    if (!result.success) {
        console.log(safe_1.default.red('❌ Nginx config test failed:'));
        console.log(result.output);
    }
}
commander_1.program
    .command('enable <name>')
    .description('Enable a config name')
    .action(async (name) => {
    if (!(await NT.isAvailable(name))) {
        console.error(`${name} doest not exists.`);
    }
    else if (await NT.isEnabled(name)) {
        console.error(`${name} is already enabled.`);
    }
    else {
        await NT.enable(name);
        await testNginxConfig();
    }
});
commander_1.program
    .command('disable <name>')
    .description('Disable a config name')
    .action(async (name) => {
    if (!(await NT.isAvailable(name))) {
        console.error(`${name} does not exists.`);
    }
    else if (!(await NT.isEnabled(name))) {
        console.error(`${name} is already disabled.`);
    }
    else {
        await NT.disable(name);
        await testNginxConfig();
    }
});
commander_1.program
    .command('createproxy <domain> <port>')
    .description('Create a new proxy for a domain, redirecting it to a localhost port')
    .action(async (domain, port) => {
    if (await NT.isAvailable(domain)) {
        console.error(`${domain} already exists.`);
    }
    else {
        await NT.createProxy(domain, parseInt(port));
        await testNginxConfig();
    }
});
commander_1.program
    .command('remove <name>')
    .description('Remove a configuration file')
    .action(async (name) => {
    if (!(await NT.isAvailable(name))) {
        console.error(`${name} doest not exists.`);
    }
    else {
        NT.delete(name);
        await testNginxConfig();
    }
});
commander_1.program
    .command('ls')
    .description('List available configurations.')
    .action(async () => {
    const sites = await NT.listConfigs();
    sites.forEach((site) => {
        if (site.enabled) {
            console.log(safe_1.default.green(`🟢 ${site.name} (enabled)`));
        }
        else {
            console.log(safe_1.default.yellow(`🟡 ${site.name}`));
        }
    });
});
commander_1.program.parse();
