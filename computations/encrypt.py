import requests
from flask import Flask, request, jsonify
import random
from functools import reduce
from flask_cors import CORS

# ElGamal encryption setup
p = 23  # Large prime
g = 5   # Generator
x = 3   # Private key
h = pow(g, x, p)  # Public key

n = 3  # Number of shares
t = 2  # Threshold
secret = random.randint(1, p-1)  # Secret to hide

app = Flask(__name__)
CORS(app)

# Generate polynomial coefficients for secret sharing
def generate_polynomial(t, secret):
    coefficients = [random.randint(1, 5) for _ in range(t - 1)] + [secret]
    return coefficients

# Evaluate polynomial at x
def evaluate_polynomial(coefficients, x):
    return sum(c * (x ** i) for i, c in enumerate(coefficients))

# Calculate the product of c1 and c2 values from the file
def calculate_modular_product(file_path, prime_p):
    with open(file_path, 'r') as file:
        lines = file.readlines()

    c1_values = []
    c2_values = []

    for line in lines:
        c1, c2 = map(int, line.split())
        c1_values.append(c1)
        c2_values.append(c2)

    # Calculate the product of c1 and c2, and apply modulo
    product_c1 = reduce(lambda x, y: (x * y) % prime_p, c1_values, 1)
    product_c2 = reduce(lambda x, y: (x * y) % prime_p, c2_values, 1)

    return product_c1, product_c2

# Fetch data from both servers (5001 and 5002)
def fetch_data_from_servers():
    response_5001 = requests.get('http://127.0.0.1:5001/get-secret')
    response_5002 = requests.get('http://127.0.0.1:5002/get-secret')

    if response_5001.status_code != 200 or response_5002.status_code != 200:
        raise Exception("Failed to retrieve data from one or both servers.")

    data_5001 = response_5001.json()
    data_5002 = response_5002.json()

    # Ensure the data is converted to integers
    data_from_5001 = int(data_5001.get('data', '0'))  # Default to 0 if no data found
    data_from_5002 = int(data_5002.get('data', '0'))  # Default to 0 if no data found

    return data_from_5001, data_from_5002

# Calculate w1 and w2 based on c1 and c2 products and data from servers
def calculate_w1_w2(product_c1, data_from_5001, data_from_5002):
    w1 = pow(product_c1, data_from_5001, p)  # c1^data_from_5001 mod p
    w2 = pow(product_c1, data_from_5002, p)  # c1^data_from_5002 mod p
    return w1, w2

# Calculate c1_secret using w1, w2, and constants l1, l2
def calculate_c1_secret(w1, w2, l1=2, l2=-1):
    w1_l1 = pow(w1, l1, p)  # w1^l1 mod p
    
    # If l2 is -1, calculate modular inverse of w2 modulo p
    if l2 == -1:
        w2_l2 = pow(w2, p-2, p)  # w2^(-1) mod p (modular inverse of w2)
    else:
        w2_l2 = pow(w2, l2, p)  # w2^l2 mod p

    c1_secret = (w1_l1 * w2_l2) % p  # (w1^l1 * w2^l2) mod p
    return c1_secret


# Calculate d such that m = g^d mod p by brute-force checking in range -5 to 5
def calculate_d(m, g, p):
    d = None
    for candidate_d in range(-5, 6):
        if candidate_d < 0:
            candidate_d = p + candidate_d  # Convert to equivalent positive d
        if pow(g, candidate_d, p) == m:
            d = candidate_d
            break
    return d

# Route for setup - generates shares and sends them to servers
@app.route('/setup', methods=['GET'])
def setup():
    # Generate the polynomial and shares
    polynomial = generate_polynomial(t, secret)
    shares = {i: evaluate_polynomial(polynomial, i) for i in range(1, n + 1)}

    # Send shares to respective servers
    server_ports = [5001, 5002, 5003]
    responses = []

    for i, port in enumerate(server_ports, start=1):
        share = shares[i]
        try:
            response = requests.post(f"http://127.0.0.1:{port}/receive", json={"value": share})
            responses.append({"server_port": port, "share": share, "status": response.status_code})
        except requests.exceptions.RequestException as e:
            responses.append({"server_port": port, "share": share, "error": str(e)})

    return jsonify({
        "message": "Setup complete",
        "secret": secret,
        "shares_sent": responses
    }), 200

# Route for encryption - encrypts the input value vi
@app.route('/encrypt', methods=['POST'])
def encrypt():
    data = request.get_json()
    vi = data.get('vi')

    if vi is None:
        return jsonify({"error": "vi is required"}), 400

    try:
        vi = int(vi)  # Ensure vi is an integer
        y = random.randint(1, p - 2)  # Random ephemeral key
        c1 = pow(g, y, p)
        c2 = (vi * pow(h, y, p)) % p

        # Store c1 and c2 in a local text file
        with open('encrypted_data.txt', 'a') as file:
            file.write(f"{c1} {c2}\n")

        return jsonify({"message": "Encryption successful", "c1": c1, "c2": c2}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Route for tally - processes the encrypted data and calculates m and d
@app.route('/tally', methods=['GET'])
def tally():
    file_path = "encrypted_data.txt"

    try:
        # Fetch data from both servers
        data_from_5001, data_from_5002 = fetch_data_from_servers()

        # Calculate product_c1 and product_c2 from the encrypted data
        product_c1, product_c2 = calculate_modular_product(file_path, p)

        # Calculate w1 and w2
        w1, w2 = calculate_w1_w2(product_c1, data_from_5001, data_from_5002)

        # Calculate c1_secret
        c1_secret = calculate_c1_secret(w1, w2)

        # Calculate the modular inverse of c1_secret
        mod_inv_c1_secret = pow(c1_secret, p - 2, p)

        # Calculate m
        m = (mod_inv_c1_secret * product_c2) % p

        # Calculate d such that m = g^d mod p
        d = calculate_d(m, g, p)

        return jsonify({
            "message": "Tally successful",
            "product_c1": product_c1,
            "product_c2": product_c2,
            "data_from_5001": data_from_5001,
            "data_from_5002": data_from_5002,
            "w1": w1,
            "w2": w2,
            "c1_secret": c1_secret,
            "mod_inv_c1_secret": mod_inv_c1_secret,
            "m": m,
            "d": d if d is not None else "No solution found"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
