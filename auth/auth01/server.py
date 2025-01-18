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

if __name__ == '__main__':
    # Ensure the data file exists
    if not os.path.exists(DATA_FILE):
        open(DATA_FILE, 'w').close()

    # Run the Flask application
    app.run(debug=True, port=5001)
