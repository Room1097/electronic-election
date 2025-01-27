const express = require("express");
const axios = require("axios");
const router = express.Router();
const { validUsers } = require("./user");

const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL;

router.get("/", (req, res) => {
  res.render("index");
});

router.post("/verify", (req, res) => {
  const { name, id } = req.body;

  console.log(`Verifying user: name=${name}, id=${id}`);

  const user = validUsers.find((user) => user.name === name && user.id === id);

  if (user) {
    if (user.voteCasted) {
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
      res.status(403).render("error", {
        message: "You have already casted your vote.",
      });
      return;
    }

    console.log(`Sending request to ${PYTHON_SERVER_URL}/encrypt with vi=${vi}`);

    const response = await axios.post(`${PYTHON_SERVER_URL}/encrypt`, { vi });

    console.log("Response from Python server:", response.data);

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


router.get("/tally", async (req, res) => {
  try {
    console.log(`Requesting tally results from ${PYTHON_SERVER_URL}/tally`);

    const response = await axios.get(`${PYTHON_SERVER_URL}/tally`);

    console.log("Response from Python server:", response.data);

    const {
      message,
      product_c1,
      product_c2,
      data_from_5001,
      data_from_5002,
      w1,
      w2,
      c1_secret,
      mod_inv_c1_secret,
      m,
      d,
      public_key,
      votes,
      result
    } = response.data;


    res.render("tally", {
      message,              
      product_c1,           
      product_c2,           
      data_from_5001,       
      data_from_5002,       
      w1,                   
      w2,                   
      c1_secret,            
      mod_inv_c1_secret,    
      m,                    
      d,
      public_key, 
      votes      ,
      result              
    });
  } catch (error) {
    console.error("Error with Python server:", error.message);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }


    res.status(500).render("error", {
      message: "Unable to fetch tally results.",
    });
  }
});

module.exports = router;