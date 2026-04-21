#!/usr/bin/env python3
import requests
import json
import time

# Wait for the backend to be ready
for _ in range(5):
    try:
        r = requests.get('http://localhost:8000/health', timeout=2)
        if r.status_code == 200:
            break
    except requests.RequestException:
        time.sleep(1)

print('=== Login as admin ===')
login = requests.post(
    'http://localhost:8000/api/v1/auth/login',
    json={'email': 'admin@curtain.app', 'password': 'Admin@123'},
    headers={'Content-Type': 'application/json'}
)
print('login status', login.status_code)
print(json.dumps(login.json(), indent=2))

if login.status_code != 200:
    raise SystemExit('Unable to login as admin')

print('\n=== Create user with invalid password ===')
token = login.json()['access_token']
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {token}'
}
payload = {
    'email': 'badpass@example.com',
    'full_name': 'Bad Pass',
    'password': '123',
    'role': 'actor'
}
create = requests.post('http://localhost:8000/api/v1/auth/users', json=payload, headers=headers)
print('create status', create.status_code)
print(json.dumps(create.json(), indent=2))

