import random
from sympy import mod_inverse

def generate_polynomial(secret, degree, prime):
    coefficients = [secret] + [random.randint(1, prime - 1) for _ in range(degree)]
    return coefficients

def evaluate_polynomial(coefficients, x, prime):
    value = sum(coeff * (x ** i) for i, coeff in enumerate(coefficients)) % prime
    return value

def generate_shares(secret, n, t, prime):
    coefficients = generate_polynomial(secret, t - 1, prime)
    shares = [(i, evaluate_polynomial(coefficients, i, prime)) for i in range(1, n + 1)]
    return shares

def reconstruct_secret(shares, prime):
    secret = 0
    for i, (xi, yi) in enumerate(shares):
        li = 1
        for j, (xj, _) in enumerate(shares):
            if i != j:
                li *= xj * mod_inverse(xj - xi, prime) % prime
        secret += yi * li
        secret %= prime
    return secret


if __name__ == "__main__":
    prime =  23
    secret =  5
    n = 3      
    t = 2        

   
    shares = generate_shares(secret, n, t, prime)
    print("Generated Shares:", shares)

   
    selected_shares = shares[:t]  
    reconstructed_secret = reconstruct_secret(selected_shares, prime)
    print("Reconstructed Secret:", reconstructed_secret)
