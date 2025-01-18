from flask import Flask, request, jsonify
import random
from flask_cors import CORS  # Import CORS

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




app = Flask(__name__)

# Enable CORS for all domains (or restrict it to specific domains)
CORS(app, origins=["http://localhost:3000"])  # Only allow requests from your Next.js frontend

# ElGamal encryption setup
p = 23  # Large prime
g = 5   # Generator
x = 3   # Private key
h = pow(g, x, p)  # Public key

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

@app.route('/tally', methods=['GET'])
def tally():
    file_path = "encrypted_data.txt"
    try:
        product_c1, product_c2 = calculate_modular_product(file_path, p)
        return jsonify({
            "message": "Tally successful",
            "product_c1": product_c1,
            "product_c2": product_c2
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
