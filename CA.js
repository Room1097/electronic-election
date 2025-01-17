require("dotenv").config(); // Load environment variables
const express = require("express");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const archiver = require("archiver");

const app = express();

// Load environment variables
const PORT = process.env.PORT_CA || 3000; // Default to 3000
const IP = process.env.CA_HOSTNAME || "127.0.0.1";
const CA_PASS = process.env.CA_PASS || "mysecurepassword";

// Paths to the CA files folder
const CA_FILES_DIR = "./cafiles";
const CA_KEY_PATH = path.join(CA_FILES_DIR, "ca.key");
const CA_CERT_PATH = path.join(CA_FILES_DIR, "ca.crt");
const CSR_PATH = path.join(CA_FILES_DIR, "server.csr");
const SIGNED_CERT_PATH = path.join(CA_FILES_DIR, "server.crt");
const ZIP_PATH = path.join(CA_FILES_DIR, "certs.zip");

// Ensure the CA files folder exists
if (!fs.existsSync(CA_FILES_DIR)) {
  fs.mkdirSync(CA_FILES_DIR);
}

// Generate the CA private key and certificate if they don't exist
function generateCA() {
  if (!fs.existsSync(CA_KEY_PATH)) {
    execSync(
      `openssl genpkey -algorithm RSA -out ${CA_KEY_PATH} -aes256 -pass pass:${CA_PASS}`
    );
    console.log("CA private key generated.");
  }

  if (!fs.existsSync(CA_CERT_PATH)) {
    execSync(
      `openssl req -key ${CA_KEY_PATH} -new -x509 -out ${CA_CERT_PATH} -days 3650 -passin pass:${CA_PASS} -subj "/C=US/ST=State/L=City/O=MyOrg/OU=MyUnit/CN=MYCN"`
    );
    console.log("CA certificate generated.");
  }
}

// Generate the CA if it doesn't exist
generateCA();

// Route to sign a CSR and return the signed certificate along with CA cert
app.post("/sign-csr", express.json(), (req, res) => {
  const { csr } = req.body;
  if (!csr) return res.status(400).send("CSR is required.");

  fs.writeFileSync(CSR_PATH, csr);

  try {
    // Sign the CSR
    execSync(
      `openssl x509 -req -in ${CSR_PATH} -CA ${CA_CERT_PATH} -CAkey ${CA_KEY_PATH} -CAcreateserial -out ${SIGNED_CERT_PATH} -days 365 -passin pass:${CA_PASS}`
    );
    console.log("Certificate signed.");

    // Create a ZIP file containing the signed certificate and CA certificate
    const output = fs.createWriteStream(ZIP_PATH);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file(SIGNED_CERT_PATH, { name: "server.crt" });
    archive.file(CA_CERT_PATH, { name: "ca.crt" });

    archive.finalize();

    output.on("close", () => {
      res.type("application/zip").sendFile(path.resolve(ZIP_PATH));
    });

    output.on("error", (err) => {
      console.error("Error creating ZIP file:", err);
      res.status(500).send("Error creating ZIP file.");
    });
  } catch (error) {
    console.error("Error signing CSR:", error);
    res.status(500).send("Error signing CSR.");
  }
});

// Route to serve the CA certificate
app.get("/ca.crt", (req, res) => {
  res.type("crt").send(fs.readFileSync(CA_CERT_PATH));
});

// Start the CA server
app.listen(PORT, IP, () => {
  console.log(`CA server running at http://${IP}:${PORT}`);
});
