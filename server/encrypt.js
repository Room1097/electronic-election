const express = require("express");
const axios = require("axios");
const router = express.Router();
const { validUsers } = require("./user");

const PYTHON_SERVER_URL = "http://127.0.0.1:5000"; // Base URL for the Python server

// Root route to render the login page
router.get("/", (req, res) => {
  res.render("index");
});

// Route to verify name and ID
router.post("/verify", (req, res) => {
  const { name, id } = req.body;

  console.log(`Verifying user: name=${name}, id=${id}`);

  const user = validUsers.find((user) => user.name === name && user.id === id);

  if (user) {
    if (user.voteCasted) {
      // User has already voted
      res.status(403).render("error", {
        message: "You have already casted your vote.",
      });
    } else {
      // Render the voting page if the user hasn't voted yet
      res.render("vote", { name, id });
    }
  } else {
    res.status(401).render("error", { message: "Invalid name or ID." });
  }
});

// Handle the /encrypt route
router.post("/encrypt", async (req, res) => {
  try {
    const { vi, name, id } = req.body;

    console.log(`Encrypting vote for user: name=${name}, id=${id}, vi=${vi}`);

    const user = validUsers.find((user) => user.name === name && user.id === id);

    if (!user) {
      res.status(401).render("error", { message: "Invalid user." });
      return;
    }

    if (user.voteCasted) {
      // User has already voted
      res.status(403).render("error", {
        message: "You have already casted your vote.",
      });
      return;
    }

    console.log(`Sending request to ${PYTHON_SERVER_URL}/encrypt with vi=${vi}`);

    const response = await axios.post(`${PYTHON_SERVER_URL}/encrypt`, { vi });

    console.log("Response from Python server:", response.data);

    // Mark the user as having cast their vote
    user.voteCasted = true;

    res.render("success", {
      message: "Vote casted successfully!",
    });
  } catch (error) {
    console.error("Error with Python server:", error.message);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Handle the /tally route
router.get("/tally", async (req, res) => {
  try {
    console.log(`Requesting tally results from ${PYTHON_SERVER_URL}/tally`);

    const response = await axios.get(`${PYTHON_SERVER_URL}/tally`);

    console.log("Response from Python server:", response.data);

    const { product_c1, product_c2 } = response.data;

    res.render("tally", {
      message: "Tally results:",
      product_c1,
      product_c2,
    });
  } catch (error) {
    console.error("Error with Python server:", error.message);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    res.status(500).render("error", { message: "Unable to fetch tally results." });
  }
});

module.exports = router;
