require("dotenv").config(); // Load environment variables
const https = require("https");
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const unzipper = require("unzipper");
const { execSync } = require("child_process");
const { setupElection, encryptVote, decryptVote } = require("./utils/crypto");
const DATA_DIR = path.join(__dirname, "data");
const ELECTION_CONFIG_PATH = path.join(DATA_DIR, "election.json");

// Load environment variables
const PORT_SERVER = process.env.PORT_SERVER || 4433;
const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || "localhost";
const CA_SERVER_URL =
  `http://${process.env.CA_HOSTNAME}:${process.env.PORT_CA}` ||
  "http://localhost:3000";

// Paths to server key, CSR, and certificate
const SERVER_KEY_PATH = "./keys/server.key";
const SERVER_CSR_PATH = "./keys/server.csr";
const SERVER_CERT_PATH = "./keys/server.crt";
const CA_CERT_PATH = "./keys/ca.crt";

// Path to the file where votes will be stored
const VOTES_FILE_PATH = "./data/votes.txt";

// Ensure the votes directory exists
if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data");
}

function loadElectionConfig() {
  if (fs.existsSync(ELECTION_CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(ELECTION_CONFIG_PATH, "utf8"));
  }
  return null;
}

function saveElectionConfig(config) {
  fs.writeFileSync(ELECTION_CONFIG_PATH, JSON.stringify(config, null, 2));
}

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

    const zipPath = "./keys/certs.zip";
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await extractCertsFromZip(zipPath);
    console.log("Certificates retrieved.");
  } catch (error) {
    console.error("Error signing CSR:", error);
    process.exit(1);
  }
}

async function extractCertsFromZip(zipPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: "./keys" }))
      .on("close", resolve)
      .on("error", reject);
  });
}

function generateElectionParams() {
  const p = 23; // Replace with a large prime number
  const g = 5; // Replace with a generator for the group
  const secretKey = Math.floor(Math.random() * (p - 2)) + 1; // Random private key
  const n = 10; // Optional: Define as the number of expected voters or similar purpose
  return { p, g, secretKey, n };
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

  // Initialize election configuration
  let electionConfig = loadElectionConfig();
  if (!electionConfig) {
    const electionParams = generateElectionParams();
    electionConfig = { ...electionParams, publicKey: electionParams.g ** electionParams.secretKey % electionParams.p };
    saveElectionConfig(electionConfig);
    console.log("Election setup complete:", electionConfig);
  } else {
    console.log("Loaded existing election configuration:", electionConfig);
  }

  const app = express();

  // Set up EJS as the view engine
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  // Serve static files
  app.use(express.static(path.join(__dirname, "public")));

  // Middleware for parsing POST data
  app.use(express.urlencoded({ extended: true }));

  // Route for the voting page
  app.get("/", (req, res) => {
    res.render("index", { message: null });
  });

  // Route for handling vote submissions
  app.post("/vote", (req, res) => {
    const { candidate } = req.body;

    if (!candidate) {
      return res.render("index", { message: "Please select a candidate." });
    }

    try {
      // Map candidate names to numeric values
      const candidateValue = candidate === "Bob" ? 1 : candidate === "Alice" ? 2 : null;

      if (candidateValue === null) {
        return res.render("index", { message: "Invalid candidate selected." });
      }

      // Use loaded election configuration
      const { p, g, publicKey } = loadElectionConfig();

      // Encrypt the vote using ElGamal
      const encryptedVote = encryptVote(candidateValue, p, g, publicKey);

      // Append the encrypted vote (c1 and c2) to the votes file
      const voteRecord = `${new Date().toISOString()} - c1: ${encryptedVote.c1}, c2: ${encryptedVote.c2}\n`;
      fs.appendFileSync(VOTES_FILE_PATH, voteRecord, "utf8");
      console.log(`Encrypted vote recorded: ${voteRecord.trim()}`);

      // Send response to the user
      res.render("index", { message: "Your vote has been securely recorded!" });
    } catch (error) {
      console.error("Error encrypting vote:", error);
      res.render("index", { message: "An error occurred while recording your vote." });
    }
  });

  // Start HTTPS server
  https.createServer(options, app).listen(PORT_SERVER, SERVER_HOSTNAME, () => {
    console.log(
      `HTTPS server running at https://${SERVER_HOSTNAME}:${PORT_SERVER}`
    );
  });
}


startServer();
