const { setupElection, encryptVote, decryptVote } = require("./crypto");

// Test values for election setup
const p = 37; // A small prime number (you can replace with a larger prime)
const g = 11;  // A generator for the group (replace with an appropriate value)
const secretKey = 12;  // Example secret key for the election setup
const n = 6;  // Number of participants in secret sharing

// Setup the election
const electionConfig = setupElection(p, g, secretKey, n);
console.log("Election Setup:", electionConfig);

// Simulate vote encryption and decryption
const vote = 1; // Example vote (e.g., candidate ID)

// Encrypt the vote
const encryptedVote = encryptVote(vote, p, g, electionConfig.publicKey);
console.log("Encrypted Vote:", encryptedVote);

// Decrypt the vote
const decryptedVote = decryptVote(encryptedVote, p, secretKey);
console.log("Decrypted Vote:", decryptedVote);

// Validate that the decrypted vote matches the original vote
if (decryptedVote === vote) {
  console.log("Success! The decrypted vote matches the original vote.");
} else {
  console.log("Failure! The decrypted vote does not match the original vote.");
}
