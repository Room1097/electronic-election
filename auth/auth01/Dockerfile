# Use Python 3.12.3 as the base image
FROM python:3.12.3-slim

# Set the working directory
WORKDIR /server

# Copy the application files into the container
COPY . /server

# Install dependencies
RUN pip install --no-cache-dir -r req.txt

# Expose the application ports
EXPOSE 5001 5002 5003
ENV FLASK_APP=server.py
# Run the Flask application on the specified port
CMD ["python", "server.py"]
