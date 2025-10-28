import { execSync } from "child_process";
import fs from "fs";
import dns from "dns/promises";

const DOMAIN = process.argv[2];
const APP_PORT = 5003;
const EMAIL = process.env.BACKUP_EMAIL;
const VPS_IP = process.env.VPS_IP;
const NGINX_CONF = `/etc/nginx/conf.d/${DOMAIN}.conf`;

if (!DOMAIN) {
  console.error("❌ Usage: node auto-ssl.js <domain>");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDNS() {
  console.log(`🔍 Checking if ${DOMAIN} points to ${VPS_IP}...`);
  let attempts = 0;
  while (attempts < 30) {
    try {
      const records = await dns.lookup(DOMAIN);
      if (records.address === VPS_IP) {
        console.log(`✅ Domain ${DOMAIN} is correctly pointed to this VPS.`);
        return true;
      } else {
        console.log(
          `⚠️ ${DOMAIN} resolves to ${records.address}, waiting for propagation...`
        );
      }
    } catch (err) {
      console.log(`🌐 DNS not ready yet (${err.message})`);
    }
    attempts++;
    await sleep(10000); // wait 10s
  }
  console.error("❌ DNS check failed after 5 minutes. Aborting SSL issue.");
  process.exit(1);
}

(async () => {
  await waitForDNS();

  console.log(`🔧 Creating temporary HTTP config for ${DOMAIN}...`);
  const tempConfig = `
server {
    listen 80;
    server_name ${DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`;
  fs.writeFileSync(NGINX_CONF, tempConfig);
  execSync("sudo nginx -t && sudo systemctl reload nginx");
  console.log("✅ HTTP config loaded successfully.");

  // 🔐 Issue SSL
  console.log("🚀 Issuing SSL via Let's Encrypt...");
  try {
    execSync(
      `sudo certbot certonly --nginx -d ${DOMAIN} --agree-tos -m ${EMAIL} --non-interactive --redirect`
    );
  } catch (err) {
    console.error("❌ Failed to issue SSL:", err.message);
    process.exit(1);
  }

  // 🔁 Replace with HTTPS config
  const sslConfig = `
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`;
  fs.writeFileSync(NGINX_CONF, sslConfig);
  execSync("sudo nginx -t && sudo systemctl reload nginx");
  console.log(`🎉 SSL activated successfully for ${DOMAIN}`);
})();
