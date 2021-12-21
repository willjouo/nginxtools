"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const childProcess = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const nginxPath = '/etc/nginx';
const nginxPathAvailable = path.join(nginxPath, 'sites-available');
const nginxPathEnabled = path.join(nginxPath, 'sites-enabled');
function listFiles(dir) {
    return new Promise(resolve => {
        fs.readdir(dir, { withFileTypes: true }, (err, files) => {
            if (err) {
                throw new Error('Could not read nginx sites folder');
            }
            const res = [];
            files.forEach((f) => {
                if (f.isFile() || f.isSymbolicLink()) {
                    res.push(f.name);
                }
            });
            resolve(res);
        });
    });
}
class nginxTools {
    testNginxConfig() {
        return new Promise(resolve => {
            const sub = childProcess.spawn('nginx', ['-t']);
            const output = [];
            sub.stdout.on('data', (data) => {
                output.push(`${data}`);
            });
            sub.stderr.on('data', (data) => {
                output.push(`${data}`);
            });
            sub.on('close', (code) => {
                resolve({
                    success: code === 0,
                    exitCode: code,
                    output: output.join('')
                });
            });
        });
    }
    async listConfigs() {
        const avail = await listFiles(nginxPathAvailable);
        const enabled = await listFiles(nginxPathEnabled);
        const result = [];
        avail.forEach((f) => {
            result.push({
                name: f,
                enabled: enabled.includes(f)
            });
        });
        return result;
    }
    async isAvailable(name) {
        return (await fs.promises.access(path.join(nginxPathAvailable, name))) === undefined;
    }
    async isEnabled(name) {
        return (await fs.promises.access(path.join(nginxPathEnabled, name))) === undefined;
    }
    async enable(name) {
        await fs.promises.symlink(path.join(nginxPathAvailable, name), path.join(nginxPathEnabled, name));
    }
    async disable(name) {
        await fs.promises.unlink(path.join(nginxPathEnabled, name));
    }
    async delete(name) {
        if (await this.isEnabled(name)) {
            await this.disable(name);
        }
        fs.unlinkSync(path.join(nginxPathAvailable, name));
    }
    async createProxy(domain, targetPort) {
        const template = `server {
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
exports.default = nginxTools;
