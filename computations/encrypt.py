import requests
from flask import Flask, request, jsonify
import random
from functools import reduce
from flask_cors import CORS

p = 23
g = 5 
secret = 3 
h = pow(g, secret, p) 

n = 3  
t = 2  
# secret = random.randint(1, p-1) 

app = Flask(__name__)
CORS(app)

def generate_polynomial(t, secret):
    coefficients = [random.randint(1, 5) for _ in range(t - 1)] + [secret]
    print(coefficients)
    return coefficients[::-1]
    # return [9, 3]

def evaluate_polynomial(coefficients, x):
    return sum(c * (x ** i) for i, c in enumerate(coefficients))

def calculate_modular_product(file_path, prime_p):
    with open(file_path, 'r') as file:
        lines = file.readlines()

    c1_values = []
    c2_values = []

    for line in lines:
        c1, c2 = map(int, line.split())
        c1_values.append(c1)
        c2_values.append(c2)

    product_c1 = reduce(lambda x, y: (x * y) % prime_p, c1_values, 1)
    product_c2 = reduce(lambda x, y: (x * y) % prime_p, c2_values, 1)

    return product_c1, product_c2, len(c1_values)

def fetch_data_from_servers():
    response_5001 = requests.get('http://127.0.0.1:5001/get-secret')
    response_5002 = requests.get('http://127.0.0.1:5002/get-secret')

    if response_5001.status_code != 200 or response_5002.status_code != 200:
        raise Exception("Failed to retrieve data from one or both servers.")

    data_5001 = response_5001.json()
    data_5002 = response_5002.json()
    
    data_from_5001 = int(data_5001.get('data', '0'))  
    data_from_5002 = int(data_5002.get('data', '0'))  

    return data_from_5001, data_from_5002

def calculate_w1_w2(product_c1, data_from_5001, data_from_5002):
    print(product_c1)
    w1 = pow(product_c1, data_from_5001, p) 
    w2 = pow(product_c1, data_from_5002, p) 
    print(w1)
    print(w2)
    return w1, w2

def calculate_c1_secret(w1, w2, l1=2, l2=-1):
    print(w1)
    print(w2)
    w1_l1 = pow(w1, l1, p)  # w1^l1 mod p

    w2_l2 = pow(w2, -1, p) if l2 == -1 else pow(w2, l2, p)

    c1_secret = (w1_l1 * w2_l2) % p  # (w1^l1 * w2^l2) mod p
    return c1_secret

def calculate_d(m, g, p, votes):
    d = None
    for candidate_d in range(-votes, votes): 
        if pow(g, candidate_d, p) == m:
            d = candidate_d
            break
    return d

def gcd(a,b):
    while b != 0:
        a, b = b, a % b
    return a

def primitive_roots(modulo):
    roots = []
    required_set = set(num for num in range (1, modulo) if gcd(num, modulo) == 1)

    for g in range(1, modulo):
        actual_set = set(pow(g, powers) % modulo for powers in range (1, modulo))
        if required_set == actual_set:
            roots.append(g)           
    return roots

@app.route('/setup', methods=['GET'])
def setup():
    polynomial = generate_polynomial(t, secret)
    shares = {i: evaluate_polynomial(polynomial, i) for i in range(1, n + 1)}

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

@app.route('/encrypt', methods=['POST'])
def encrypt():
    data = request.get_json()
    vi = data.get('vi')

    if vi is None:
        return jsonify({"error": "vi is required"}), 400

    try:
        vi = int(vi) 
        vi = pow(g,vi,p)
        # y = random.randint(1, p - 2)
        primitive_roots_list = primitive_roots(p)
        # y = 3

        y = random.choice(primitive_roots_list)
        c1 = pow(g, y, p)
        c2 = (vi * pow(h, y, p)) % p

        with open('encrypted_data.txt', 'a') as file:
            file.write(f"{c1} {c2}\n")

        return jsonify({"message": "Encryption successful", "c1": c1, "c2": c2}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/tally', methods=['GET'])
def tally():
    file_path = "encrypted_data.txt"

    try:
        data_from_5001, data_from_5002 = fetch_data_from_servers()

        product_c1, product_c2, votes = calculate_modular_product(file_path, p)

        w1, w2 = calculate_w1_w2(product_c1, data_from_5001, data_from_5002)

        c1_secret = calculate_c1_secret(w1, w2)

        mod_inv_c1_secret = pow(c1_secret, -1, p)

        m = (mod_inv_c1_secret * product_c2) % p

        d = calculate_d(m, g, p, votes)

        return jsonify({
            "message": "Tally successful",
            "votes": votes,
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
