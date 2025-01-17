const crypto = require("crypto");

/**
 * Function to set up an election using ElGamal encryption or Shamir's Secret Sharing.
 * @param {number} p - A large prime number.
 * @param {number} g - A generator for the prime group.
 * @param {number} secretKey - The secret key (private key) for the election.
 * @param {number} n - The number of participants (for secret sharing).
 * @returns {object} - The election configuration.
 */
function setupElection(p, g, secretKey, n) {
  if (!p || !g || !secretKey || !n) {
    throw new Error("All parameters (p, g, secretKey, n) are required.");
  }

  // Compute public key: h = g^secretKey mod p
  const h = BigInt(g) ** BigInt(secretKey) % BigInt(p);

  // Generate Shamir's Secret Sharing coefficients
  const coefficients = Array.from({ length: n }, () =>
    Math.floor(Math.random() * 100)
  );

  return {
    p,
    g,
    publicKey: h.toString(),
    secretKey: secretKey.toString(),
    coefficients,
    n,
  };
}

/**
 * Function to encrypt a vote using ElGamal encryption.
 * @param {number} vote - The vote to be encrypted (e.g., candidate ID).
 * @param {number} p - A large prime number.
 * @param {number} g - A generator for the prime group.
 * @param {string} publicKey - The public key for encryption.
 * @returns {object} - The encrypted vote.
 */
function encryptVote(vote, p, g, publicKey) {
  if (!vote || !p || !g || !publicKey) {
    throw new Error("All parameters (vote, p, g, publicKey) are required.");
  }

  // Generate a random number k
  const k = Math.floor(Math.random() * 100);

  // Compute c1 = g^k mod p
  const c1 = BigInt(g) ** BigInt(k) % BigInt(p);

  // Compute c2 = (vote * publicKey^k) mod p
  const c2 =
    (BigInt(vote) * BigInt(publicKey) ** BigInt(k)) % BigInt(p);

  return { c1: c1.toString(), c2: c2.toString() };
}

/**
 * Function to decrypt an encrypted vote using the secret key.
 * @param {object} encryptedVote - The encrypted vote (c1, c2).
 * @param {number} p - A large prime number.
 * @param {number} secretKey - The secret key (private key) for decryption.
 * @returns {number} - The decrypted vote.
 */
function decryptVote(encryptedVote, p, secretKey) {
  const { c1, c2 } = encryptedVote;

  if (!c1 || !c2 || !p || !secretKey) {
    throw new Error("All parameters (c1, c2, p, secretKey) are required.");
  }

  // Compute s = c1^secretKey mod p
  const s = BigInt(c1) ** BigInt(secretKey) % BigInt(p);

  // Compute s^(-1) mod p (modular multiplicative inverse)
  const sInverse = modInverse(s, BigInt(p));

  // Compute vote = (c2 * s^(-1)) mod p
  const vote = (BigInt(c2) * sInverse) % BigInt(p);

  return parseInt(vote.toString(), 10);
}

/**
 * Function to compute modular multiplicative inverse using the Extended Euclidean Algorithm.
 * @param {BigInt} a - The number to invert.
 * @param {BigInt} m - The modulus.
 * @returns {BigInt} - The modular multiplicative inverse of a mod m.
 */
function modInverse(a, m) {
  let m0 = m;
  let y = BigInt(0);
  let x = BigInt(1);

  if (m === BigInt(1)) return BigInt(0);

  while (a > 1) {
    const q = a / m;
    let t = m;

    m = a % m;
    a = t;
    t = y;

    y = x - q * y;
    x = t;
  }

  if (x < 0) {
    x += m0;
  }

  return x;
}

module.exports = {
  setupElection,
  encryptVote,
  decryptVote,
};
