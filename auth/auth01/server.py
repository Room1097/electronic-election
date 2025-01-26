from flask import Flask, request, jsonify
import os

app = Flask(__name__)

# File to store the received values
DATA_FILE = 'received_data.txt'

@app.route('/receive', methods=['POST'])
def receive():
    # Get the JSON payload from the request
    data = request.json
    if not data or 'value' not in data:
        return jsonify({'error': 'Invalid request, expected JSON with a "value" key.'}), 400

    # Extract the value
    value = data['value']

    try:
        # Write the value to the file
        with open(DATA_FILE, 'w') as f:
            f.write(f"{value}\n")

        return jsonify({'message': 'Value received and stored successfully.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-secret', methods=['GET'])
def get_secret():
    try:
        # Read the value from the file
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                data = f.read().strip()

            return jsonify({'message': 'Data retrieved successfully.', 'data': data}), 200
        else:
            return jsonify({'error': 'Data file does not exist.'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure the data file exists
    if not os.path.exists(DATA_FILE):
        open(DATA_FILE, 'w').close()
    # port = int(os.getenv('PORT', 5001))  # Default to 5001 if no port is provided
    # host = int(os.getenv('HOST', "0.0.0.0"))  # Default to 5001 if no port is provided
    
    host = os.getenv('HOST', "0.0.0.0")  # Default to 0.0.0.0 for host
    port = int(os.getenv('PORT', "5001"))  # Default to 5001 for port
    app.run(debug=True, host=host, port=port)


