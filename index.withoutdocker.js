import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import dns from "dns/promises";

const app = express();
const PORT = 5003; // host API port

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`Hello World! From Client`);
});

app.post("/ssl/:domain", (req, res) => {
  const DOMAIN = req.params.domain;

  // const DOMAIN = process.argv[2];
  const APP_PORT = 5003;
  const EMAIL = "nirimonpc@gmail.com";
  const VPS_IP = "52.74.69.186";
  const NGINX_CONF_DIR = "/etc/nginx/conf.d";
  const NGINX_CONF = `${NGINX_CONF_DIR}/${DOMAIN}.conf`;

  // Absolute paths
  const NGINX_BIN = "/usr/sbin/nginx";
  const SYSTEMCTL_BIN = "/bin/systemctl";
  const CERTBOT_BIN = "/usr/bin/certbot";

  if (!DOMAIN) {
    console.error("❌ Usage: node auto-ssl.js <domain>");
    process.exit(1);
  }

  // sleep helper
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitForDNS() {
    console.log(`🔍 Checking if ${DOMAIN} points to ${VPS_IP}...`);
    let attempts = 0;
    while (attempts < 2) {
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
      await sleep(10000);
    }
    console.error("❌ DNS check failed after 5 minutes. Aborting SSL issue.");
    process.exit(1);
  }

  function run(command, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: "inherit" });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
      child.on("error", (err) => {
        reject(err);
      });
    });
  }

  (async () => {
    // ensure directory exists
    if (!fs.existsSync(NGINX_CONF_DIR)) {
      fs.mkdirSync(NGINX_CONF_DIR, { recursive: true });
    }

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

    await run(NGINX_BIN, ["-t"]);
    await run(SYSTEMCTL_BIN, ["reload", "nginx"]);
    console.log("✅ HTTP config loaded successfully.");

    // 🔐 Issue SSL
    console.log("🚀 Issuing SSL via Let's Encrypt...");
    await run(CERTBOT_BIN, [
      "certonly",
      "--nginx",
      "-d",
      DOMAIN,
      "--agree-tos",
      "-m",
      EMAIL,
      "--non-interactive",
      "--redirect",
    ]);

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
    await run(NGINX_BIN, ["-t"]);
    await run(SYSTEMCTL_BIN, ["reload", "nginx"]);
    console.log(`🎉 SSL activated successfully for ${DOMAIN}`);
  })();
});

app.listen(PORT, () => {
  console.log(`🔹 Host SSL API running on port ${PORT}`);
});
