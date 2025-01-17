require("dotenv").config(); // Load environment variables
const express = require("express");
const https = require("https");
const fs = require("fs");
const axios = require("axios");
const { execSync } = require("child_process");
const unzipper = require("unzipper");
const cors = require("cors");
const path = require("path");

// Initialize Express app
const app = express();
app.use(express.json()); // Middleware to parse JSON request body
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Define views directory

// CORS setup to allow requests from Next.js frontend
app.use(cors({ origin: "*" }));

// Define paths for certificates and keys
const SERVER_KEY_PATH = "./server.key";
const SERVER_CSR_PATH = "./server.csr";
const SERVER_CERT_PATH = "./serverfiles/server.crt";
const CA_CERT_PATH = "./serverfiles/ca.crt";

// Environment variables
const PORT_SERVER = process.env.PORT_SERVER || 4433;
const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || "localhost";
const PYTHON_SERVER_URL = "http://127.0.0.1:5000/encrypt"; // Python server URL

// Define the function that generates the server key and CSR
function generateServerKeyAndCSR() {
  try {
    // Generate private key
    console.log("Generating server private key...");
    execSync(
      `openssl genpkey -algorithm RSA -out ${SERVER_KEY_PATH} -aes256 -pass pass:mysecurepassword`
    );
    
    // Generate Certificate Signing Request (CSR)
    console.log("Generating server CSR...");
    execSync(
      `openssl req -new -key ${SERVER_KEY_PATH} -out ${SERVER_CSR_PATH} -passin pass:mysecurepassword -subj "/C=US/ST=State/L=City/O=MyOrg/OU=MyUnit/CN=localhost"`
    );
    
    console.log("Server key and CSR generated successfully.");
  } catch (error) {
    console.error("Error generating server key and CSR:", error);
  }
}

// Call the function to generate the key and CSR
generateServerKeyAndCSR();

// Function to sign CSR (and further implementation continues...)
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

// Function to extract certificates from the zip file
async function extractCertsFromZip(zipPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: "./serverfiles" }))
      .on("close", resolve)
      .on("error", reject);
  });
}

// Function to start the HTTPS server
async function startServer() {
  await signCSR();

  const options = {
    key: fs.readFileSync(SERVER_KEY_PATH),
    cert: fs.readFileSync(SERVER_CERT_PATH),
    ca: fs.readFileSync(CA_CERT_PATH),
    passphrase: "mysecurepassword",
    rejectUnauthorized: true,
  };

  const server = https.createServer(options, app); // Use Express app for handling requests

  // Render the form (root route)
  app.get("/", (req, res) => {
    res.render("index"); // Render the index.ejs file
  });

  // Handle the /encrypt route
  app.post("/encrypt", async (req, res) => {
    try {
      const { vi } = req.body;
      
      // Log the URL and data being sent
      console.log(`Sending request to ${PYTHON_SERVER_URL} with vi=${vi}`);
      
      const response = await axios.post(PYTHON_SERVER_URL, { vi });
      
      console.log("Response from Python server:", response.data);

      // Render a result page with encryption details using EJS
      res.render("result", {
        message: "Encryption successful",
        c1: response.data.c1,
        c2: response.data.c2,
      });
    } catch (error) {
      console.error("Error with Python server:", error.message);
      if (error.response) {
        console.error("Error response:", error.response.data);
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  server.listen(PORT_SERVER, SERVER_HOSTNAME, () => {
    console.log(
      `HTTPS server running at https://${SERVER_HOSTNAME}:${PORT_SERVER}`
    );
  });
}

startServer();
