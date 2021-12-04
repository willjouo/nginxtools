// Imports
const chalk = require('chalk');
const childProcess = require('child_process');
const path = require('path');
const {program} = require('commander');
const fs = require('fs');

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

const nginxPath = '/etc/nginx';
const nginxPathAvailable = path.join(nginxPath, 'sites-available');
const nginxPathEnabled = path.join(nginxPath, 'sites-enabled');

/**
 * Test nginx configuration
 * @returns true if confif is successful
 */
function testNginxConfig(){
	return new Promise(resolve => {
		console.log('nginxtools: Testing nginx configuration (nginx -t)...');
		const sub = childProcess.spawn('nginx', ['-t']);
		sub.stdout.on('data', (data)=>{
			process.stdout.write(`${data}`);
		});
		sub.stderr.on('data', (data)=>{
			process.stderr.write(`${data}`);
		});
		sub.on('close', (code)=>{
			if(code === 0){
				console.log('nginxtools: Don\'t forget to restart nginx.');
			}
			resolve(code === 0);
		});
	});
}

function listFiles(dir){
	fs.readdir(dir, {withFileTypes: true}, (err, files)=>{
		if(err){
			console.error(err);
			return [];
		}
		const res = [];
		files.forEach(f => {
			if(f.isFile() || f.isSymbolicLink()){
				res.push(f.name);
			}
		});
		return res;
	});
}

function listConfigs(){
	console.log('nginxtools: Listing configurations:');
	const avail = listFiles(nginxPathAvailable);
	const enabled = listFiles(nginxPathEnabled);
	avail.forEach(f => {
		if(enabled.includes(f)){
			console.log(chalk.blue(`• ${f} (enabled)`));
		}
		else {
			console.log(`• ${f}`);
		}
	});
}

function checkIsAvailable(name){
	return fs.existsSync(path.join(nginxPathAvailable, name));
}

function checkIsEnabled(name){
	return fs.existsSync(path.join(nginxPathEnabled, name));
}

function disable(name){
	if(!checkIsAvailable(name)){
		console.error(`nginxtools: ${name} does not exist.`);
	}
	else if(!checkIsEnabled(name)){
		console.error(`nginxtools: ${name} is already disabled.`);
	}
	else {
		fs.unlinkSync(path.join(nginxPathEnabled, name));
		console.log(`nginxtools: ${name} disabled.`);
	}
}

function enable(name){
	if(!checkIsAvailable(name)){
		console.error(`nginxtools: ${name} does not exist.`);
	}
	else if(checkIsEnabled(name)){
		console.error(`nginxtools: ${name} is already enabled.`);
	}
	else {
		fs.symlinkSync(path.join(nginxPathAvailable, name), path.join(nginxPathEnabled, name));
		console.log(`${name} enabled.`);
	}
}

function createProxy(domain, listeningPort, targetPort){
	if(checkIsAvailable(domain)){
		console.error(`nginxtools: ${domain} already has a config file.`);
		return;
	}

	const template = `server {
        listen ${listeningPort};
        server_name ${domain};
        access_log /var/log/nginx/${domain}_proxy.log;
        location / {
                proxy_pass http://127.0.0.1:${targetPort};
                proxy_redirect off;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
}`;
	fs.writeFileSync(path.join(nginxPathAvailable, domain), template);
	console.log(`nginxtools: created ${domain}:${listeningPort} => 127.0.0.1:${targetPort}.`);
	enable(domain);
}

function deleteProxy(name){
	if(checkIsEnabled(name)){
		disable(name);
	}
	if(!checkIsAvailable(name)){
		console.error(`nginxtools: ${name} does not exist.`);
		return;
	}
	fs.unlinkSync(path.join(nginxPathAvailable, name));
	console.log(`nginxtools: deleted ${name} configuration.`);
}

program
	.command('enable <name>')
	.description('Enable a config name')
	.action((name)=>{
		enable(name);
		testNginxConfig();
	});
program
	.command('disable <name>')
	.description('Disable a config name')
	.action((name)=>{
		disable(name);
		testNginxConfig();
	});
program
	.command('createproxy <domain> <port> [listeningPort]')
	.description('Create a new proxy for a domain, redirecting it to a localhost port')
	.action((domain, port, listeningPort)=>{
		listeningPort = listeningPort || 80;
		createProxy(domain, listeningPort, port);
		testNginxConfig();
	});
program
	.command('deleteproxy <name>')
	.description('Remove a proxy, deleting the configuration file')
	.action((name)=>{
		deleteProxy(name);
		testNginxConfig();
	});
program
	.command('ls')
	.description('List available configurations.')
	.action(()=>{
		listConfigs();
	});

program.parse();