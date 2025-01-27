// setup.js
require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");
const unzipper = require("unzipper");

const SERVER_KEY_PATH = "./server.key";
const SERVER_CSR_PATH = "./server.csr";
const SERVER_CERT_PATH = "./serverfiles/server.crt";
const CA_CERT_PATH = "./serverfiles/ca.crt";

function generateServerKeyAndCSR() {
  try {
    console.log("Generating server private key...");
    execSync(
      `openssl genpkey -algorithm RSA -out ${SERVER_KEY_PATH} -aes256 -pass pass:mysecurepassword`
    );

    console.log("Generating server CSR...");
    execSync(
      `openssl req -new -key ${SERVER_KEY_PATH} -out ${SERVER_CSR_PATH} -passin pass:mysecurepassword -subj "/C=US/ST=State/L=City/O=MyOrg/OU=MyUnit/CN=localhost"`
    );

    console.log("Server key and CSR generated successfully.");
  } catch (error) {
    console.error("Error generating server key and CSR:", error);
  }
}

async function signCSR() {
  const csr = fs.readFileSync(SERVER_CSR_PATH, "utf8");

  try {
    const response = await axios.post(
      `http://${process.env.CA_HOSTNAME}:${process.env.PORT_CA}/sign-csr`,
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

async function createShare() {
  try {
    const response = await axios.get("http://127.0.0.1:4434/setup")
    console.log("Flask setup API response:", response.data);
  } catch (error) {
    console.error("Error calling Flask setup API:", error.message);
  }
}
async function setupServer(app, https) {
  generateServerKeyAndCSR();
  await signCSR();
  await createShare();

  const options = {
    key: fs.readFileSync(SERVER_KEY_PATH),
    cert: fs.readFileSync(SERVER_CERT_PATH),
    ca: fs.readFileSync(CA_CERT_PATH),
    passphrase: "mysecurepassword",
    rejectUnauthorized: true,
  };

  return https.createServer(options, app);
}

module.exports = { setupServer };
