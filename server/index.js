require("dotenv").config(); // Load environment variables
const https = require("https");
const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");
const unzipper = require("unzipper");

// Environment variables
const PORT_SERVER = process.env.PORT_SERVER || 4433;
const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || "localhost";
const CA_SERVER_URL =
  `http://${process.env.CA_HOSTNAME}:${process.env.PORT_CA}` ||
  "http://localhost:3000";
const PYTHON_SERVER_URL = "http://127.0.0.1:5000/encrypt";

// Paths to server key, CSR, and certificates
const SERVER_KEY_PATH = "./server.key";
const SERVER_CSR_PATH = "./server.csr";
const SERVER_CERT_PATH = "./serverfiles/server.crt";
const CA_CERT_PATH = "./serverfiles/ca.crt";

function generateServerKeyAndCSR() {
  execSync(
    `openssl genpkey -algorithm RSA -out ${SERVER_KEY_PATH} -aes256 -pass pass:mysecurepassword`
  );
  execSync(
    `openssl req -new -key ${SERVER_KEY_PATH} -out ${SERVER_CSR_PATH} -passin pass:mysecurepassword -subj "/C=US/ST=State/L=City/O=MyOrg/OU=MyUnit/CN=${SERVER_HOSTNAME}"`
  );
  console.log("Server key and CSR generated.");
}

async function signCSR() {
  const csr = fs.readFileSync(SERVER_CSR_PATH, "utf8");

  try {
    const response = await axios.post(
      `${CA_SERVER_URL}/sign-csr`,
      { csr },
      {
        responseType: "stream",
      }
    );

    const zipPath = "./certs.zip";
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await extractCertsFromZip(zipPath);
    console.log("Certificates retrieved.");
  } catch (error) {
    console.error("Error signing CSR:", error.message);
    process.exit(1);
  }
}

async function extractCertsFromZip(zipPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: "./serverfiles" }))
      .on("close", resolve)
      .on("error", reject);
  });
}

async function startServer() {
  generateServerKeyAndCSR();
  await signCSR();

  const options = {
    key: fs.readFileSync(SERVER_KEY_PATH),
    cert: fs.readFileSync(SERVER_CERT_PATH),
    ca: fs.readFileSync(CA_CERT_PATH),
    passphrase: "mysecurepassword",
    rejectUnauthorized: true,
  };

  const server = https.createServer(options, async (req, res) => {
    if (req.method === "POST" && req.url === "/encrypt") {
      let body = "";
      req.on("data", chunk => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const { vi } = JSON.parse(body);

          if (!vi) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "vi is required" }));
            return;
          }

          // Forward vi to the Python server
          const response = await axios.post(PYTHON_SERVER_URL, { vi });
          const { c1, c2 } = response.data;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Encryption successful", c1, c2 }));
        } catch (error) {
          console.error("Error processing encryption request:", error.message);
          if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Response status:", error.response.status);
          }
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  server.listen(PORT_SERVER, SERVER_HOSTNAME, () => {
    console.log(
      `HTTPS server running at https://${SERVER_HOSTNAME}:${PORT_SERVER}`
    );
  });
}

startServer();
