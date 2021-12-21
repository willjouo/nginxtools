// Imports
import * as childProcess from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Hardcoded path to nginx
const nginxPath: string = '/etc/nginx';
const nginxPathAvailable: string = path.join(nginxPath, 'sites-available');
const nginxPathEnabled: string = path.join(nginxPath, 'sites-enabled');

/**
 * Output from a run child process
 */
export interface ProcessOutput {
    success: boolean;
    exitCode: number;
    output: string;
}

/**
 * Info for a nginx site
 */
export interface SiteInfo {
    name: string;
    enabled: boolean;
}

/**
 * Lists all files in a directory
 * @param dir 
 * @returns 
 */
function listFiles(dir: string): Promise<string[]>{
    return new Promise(resolve => {
        fs.readdir(dir, {withFileTypes: true}, (err: Error, files: fs.Dirent[])=>{
            if(err){
                throw new Error('Could not read nginx sites folder');
            }

            // Build list and return
            const res: string[] = [];
            files.forEach((f: fs.Dirent) => {
                if(f.isFile() || f.isSymbolicLink()){
                    res.push(f.name);
                }
            });
            resolve(res);
        });
    });
}

export default class nginxTools {
    /**
     * Tests the nginx configuration
     * @returns a promise with {success: boolean, output: string}
     */
    testNginxConfig(): Promise<ProcessOutput>{
        return new Promise(resolve => {
            const sub: childProcess.ChildProcessWithoutNullStreams = childProcess.spawn('nginx', ['-t']);
            const output: string[] = [];
            sub.stdout.on('data', (data: any)=>{
                output.push(`${data}`);
            });
            sub.stderr.on('data', (data: any)=>{
                output.push(`${data}`);
            });
            sub.on('close', (code: number)=>{
                resolve({
                    success: code === 0,
                    exitCode: code,
                    output: output.join('')
                });
            });
        });
    }

    /**
     * Lists all sites
     * @returns An array [{name: string, enabled: boolean}]
     */
    async listConfigs(): Promise<SiteInfo[]>{
        const avail: string[] = await listFiles(nginxPathAvailable);
        const enabled: string[] = await listFiles(nginxPathEnabled);
        const result: SiteInfo[] = [];
        avail.forEach((f: string) => {
            result.push({
                name: f,
                enabled: enabled.includes(f)
            });
        });
        return result;
    }

    async isAvailable(name): Promise<boolean>{
        return (await fs.promises.access(path.join(nginxPathAvailable, name))) === undefined;
    }

    async isEnabled(name): Promise<boolean>{
        return (await fs.promises.access(path.join(nginxPathEnabled, name))) === undefined;
    }

    async enable(name): Promise<void> {
        await fs.promises.symlink(path.join(nginxPathAvailable, name), path.join(nginxPathEnabled, name));
    }

    async disable(name): Promise<void>{
        await fs.promises.unlink(path.join(nginxPathEnabled, name));
    }

    async delete(name): Promise<void>{
        if(await this.isEnabled(name)){
            await this.disable(name);
        }
        fs.unlinkSync(path.join(nginxPathAvailable, name));
    }

    async createProxy(domain: string, targetPort: number): Promise<void>{
        const template: string = `server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/cert.key;
    access_log /var/log/nginx/${domain}_proxy.log;

    location / {
        # Proxy
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_redirect off;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}

server {
    listen 80;

    server_name ${domain};
    if ($host = ${domain}) {
        return 301 https://$host$request_uri;
    }

    return 404;
}`;
        fs.writeFileSync(path.join(nginxPathAvailable, domain), template);
        this.enable(domain);
    }
}