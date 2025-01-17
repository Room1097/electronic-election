const crypto = require("crypto");

// Generate ElGamal keys
function generateKeys() {
    const p = BigInt(crypto.randomInt(1e8, 1e9));
    const g = 2n; // Generator
    const x = BigInt(crypto.randomInt(1e6, 1e7)); // Private key
    const h = g ** x % p; // Public key
    return { p, g, x, h };
}

// Encrypt a vote
function encryptVote(vote, p, g, h) {
    const y = BigInt(crypto.randomInt(1e6, 1e7));
    const c1 = g ** y % p;
    const c2 = (BigInt(vote) * (h ** y % p)) % p;
    return { c1, c2 };
}

// Homomorphic tally (c1, c2 arrays)
function tallyVotes(c1Array, c2Array, p) {
    const c1Total = c1Array.reduce((a, b) => (a * b) % p, 1n);
    const c2Total = c2Array.reduce((a, b) => (a * b) % p, 1n);
    return { c1Total, c2Total };
}

// Decrypt tally
function decryptTally(c1, c2, p, x) {
    const s = c1 ** x % p;
    const sInv = modInverse(s, p);
    return (c2 * sInv) % p;
}

// Modular inverse
function modInverse(a, m) {
    let m0 = m, y = 0n, x = 1n;
    while (a > 1n) {
        const q = a / m;
        [m, a] = [a % m, m];
        [y, x] = [x - q * y, y];
    }
    return (x + m0) % m0;
}

module.exports = { generateKeys, encryptVote, tallyVotes, decryptTally };
