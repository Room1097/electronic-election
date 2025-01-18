from flask import Flask, request, jsonify
import random
import requests
from flask_cors import CORS

def calculate_modular_product(file_path, prime_p):
    from functools import reduce

    # Read the file and parse data
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


def generate_polynomial(t, secret):
    coefficients = [random.randint(1, 5) for _ in range(t - 1)] + [secret]
    return coefficients


def evaluate_polynomial(coefficients, x):
    return sum(c * (x ** i) for i, c in enumerate(coefficients))


app = Flask(__name__)
CORS(app)

# ElGamal encryption setup
p = 23  # Large prime
g = 5   # Generator
x = 3   # Private key
h = pow(g, x, p)  # Public key

n = 3  # Number of shares
t = 2  # Threshold
secret = random.randint(1, p-1)  # Secret to hide
polynomial = generate_polynomial(t, secret)

@app.route('/setup', methods=['GET'])
def setup():
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

if __name__ == '__main__':
    app.run(port=5000)
