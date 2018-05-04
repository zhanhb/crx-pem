#!/usr/bin/env bash

PID_FILE=logs/gen.pid

echo $$ > ${PID_FILE}
mkdir work > /dev/null 2>&1
cd work
export PEM_FILE=key.pem
while true
do
    # Create private key called key.pem
    2>/dev/null openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out ${PEM_FILE}

    # Generate string to be used as "key" in manifest.json (outputs to stdout)
    #2>/dev/null openssl rsa -in ${PEM_FILE} -pubout -outform DER | openssl base64 -A

    # Calculate extension ID (outputs to stdout)
    cp "${PEM_FILE}" ../pems/`2>/dev/null openssl rsa -in "${PEM_FILE}" -pubout -outform DER | openssl dgst -sha256 -r | head -c32 | tr 0-9a-f a-p`.pem
done
