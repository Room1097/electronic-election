const express = require("express");
const https = require("https");
const cors = require("cors");
const path = require("path");
const { setupServer } = require("./setup");
const encryptRoutes = require("./encrypt");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/", encryptRoutes);

const PORT_SERVER = process.env.PORT_SERVER || 4433;
const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || "localhost";

(async () => {
  const server = await setupServer(app, https);

  server.listen(PORT_SERVER, SERVER_HOSTNAME, () => {
    console.log(`HTTPS server running at https://${SERVER_HOSTNAME}:${PORT_SERVER}`);
  });
})();
