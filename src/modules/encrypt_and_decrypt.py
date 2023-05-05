from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
import json


def encrypt(data):
    # Generate a new RSA key pair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # Get the public key to encrypt with
    public_key = private_key.public_key()

    # Serialize the data to bytes
    data_bytes = json.dumps(data).encode()

    # Encrypt the data with RSA-OAEP
    encrypted_data = public_key.encrypt(
        data_bytes,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # Serialize the private key to PEM format
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Save the encrypted data and private key to files
    with open("encrypted_data.json", "wb") as f:
        f.write(encrypted_data)

    with open("private_key.pem", "wb") as f:
        f.write(private_key_pem)


def decrypt():
    # Load the private key from file
    with open("private_key.pem", "rb") as f:
        private_key_pem = f.read()

    private_key = serialization.load_pem_private_key(private_key_pem, password=None)

    # Load the encrypted data from file
    with open("encrypted_data.json", "rb") as f:
        encrypted_data = f.read()

    # Decrypt the data with RSA-OAEP
    decrypted_data = private_key.decrypt(
        encrypted_data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    # Deserialize the decrypted data from bytes to a Python object
    decrypted_data_dict = json.loads(decrypted_data.decode())

    # Print the decrypted data
    print(decrypted_data_dict)


if __name__ == "__main__":
    # with open("data/data.json") as json_file:
    #     data = json.load(json_file)
    data = {
        "AADHAAR": {
            "Name": "MEGHANA REDDY MEKALA",
            "DOB": "08/03/2001",
            "F/M": "FEMALE",
            "Aadhaar_NO": "3556 4015 4832",
        },
        "PAN": {},
        "VOTER": {},
    }
    encrypt(data)
    decrypt()
