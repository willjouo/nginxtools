// Check we are on linux
if(process.platform !== 'linux'){
	console.error('nginxtools: This script only works on Linux systems.');
	process.exit(1);
}

// Check that we are root
if(process.getuid() != 0){
	console.error('nginxtools: Please run as root.');
	process.exit(1);
}

// Imports
import {program} from 'commander';
import colors from 'colors/safe';
import nginxTools, { ProcessOutput, SiteInfo } from './op';

// Instance
const NT: nginxTools = new nginxTools();

/**
 * Tests nginx config and show results int console
 */
async function testNginxConfig(): Promise<void>{
	const result: ProcessOutput = await NT.testNginxConfig();
	if(!result.success){
		console.log(colors.red('❌ Nginx config test failed:'));
		console.log(result.output);
	}
}

program
	.command('enable <name>')
	.description('Enable a config name')
	.action(async (name: string)=>{
		if(!(await NT.isAvailable(name))){
			console.error(`${name} doest not exists.`);
		}
		else if(await NT.isEnabled(name)){
			console.error(`${name} is already enabled.`);
		}
		else {
			await NT.enable(name);
			await testNginxConfig();
		}
	});
program
	.command('disable <name>')
	.description('Disable a config name')
	.action(async (name: string)=>{
		if(!(await NT.isAvailable(name))){
			console.error(`${name} does not exists.`);
		}
		else if(!(await NT.isEnabled(name))){
			console.error(`${name} is already disabled.`);
		}
		else {
			await NT.disable(name);
			await testNginxConfig();
		}
	});
program
	.command('createproxy <domain> <port>')
	.description('Create a new proxy for a domain, redirecting it to a localhost port')
	.action(async (domain: string, port: string)=>{
		if(await NT.isAvailable(domain)){
			console.error(`${domain} already exists.`);
		}
		else {
			await NT.createProxy(domain, parseInt(port));
			await testNginxConfig();
		}
	});
program
	.command('remove <name>')
	.description('Remove a configuration file')
	.action(async (name: string)=>{
		if(!(await NT.isAvailable(name))){
			console.error(`${name} doest not exists.`);
		}
		else {
			NT.delete(name);
			await testNginxConfig();
		}
	});
program
	.command('ls')
	.description('List available configurations.')
	.action(async ()=>{
		const sites: SiteInfo[] = await NT.listConfigs();
		sites.forEach((site: SiteInfo) => {
			if(site.enabled){
				console.log(colors.green(`🟢 ${site.name} (enabled)`));
			}
			else {
				console.log(colors.yellow(`🟡 ${site.name}`));
			}
		});
	});

program.parse();